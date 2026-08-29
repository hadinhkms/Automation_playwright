const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const APP_NAME = process.env.DASHBOARD_APP_NAME || 'carthings';
const STATE_PATH = path.join(ROOT, '.dashboard-server.json');
const DEFAULT_PORT = Number.parseInt(process.env.DASHBOARD_PORT || '4174', 10);
const MAX_PORT_ATTEMPTS = 20;

function dashboardUrl(port) {
  return `http://127.0.0.1:${port}`;
}

async function fetchJson(url, timeout = 1000) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeout) });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

async function isRunning(port) {
  const response = await fetchJson(`${dashboardUrl(port)}/api/state`);
  return Boolean(response);
}

async function getHealth(port) {
  return fetchJson(`${dashboardUrl(port)}/api/health`);
}

async function hasCurrentSettingsApi(port) {
  const response = await fetchJson(`${dashboardUrl(port)}/api/settings`);
  return Boolean(response);
}

async function stopRunningDashboard(port) {
  try {
    await fetch(`${dashboardUrl(port)}/api/shutdown`, {
      method: 'POST',
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    return;
  }

  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    if (!(await isRunning(port))) return;
  }
}

function writeState(port) {
  fs.writeFileSync(
    STATE_PATH,
    `${JSON.stringify({ appName: APP_NAME, workspaceRoot: ROOT, port }, null, 2)}\n`,
    'utf8'
  );
}

async function findDashboardPort() {
  for (let offset = 0; offset < MAX_PORT_ATTEMPTS; offset += 1) {
    const port = DEFAULT_PORT + offset;
    if (!(await isRunning(port))) {
      return { port, status: 'available' };
    }

    const health = await getHealth(port);
    if (health?.workspaceRoot === ROOT && health?.appName === APP_NAME) {
      return { port, status: 'same-dashboard' };
    }

    if (offset === 0) {
      console.log(`Port ${port} đang được dashboard khác sử dụng, thử port kế tiếp...`);
    }
  }

  throw new Error(`Không tìm được port trống từ ${DEFAULT_PORT} đến ${DEFAULT_PORT + MAX_PORT_ATTEMPTS - 1}.`);
}

async function start() {
  const selected = await findDashboardPort();
  const url = dashboardUrl(selected.port);

  if (selected.status === 'same-dashboard') {
    if (await hasCurrentSettingsApi(selected.port)) {
      writeState(selected.port);
      console.log(`CarThings dashboard đã chạy tại ${url}`);
      return;
    }

    console.log(`CarThings dashboard tại ${url} đang chạy phiên bản cũ, đang khởi động lại...`);
    await stopRunningDashboard(selected.port);
  }

  const child = spawn(process.execPath, [path.join(__dirname, 'server.js')], {
    cwd: ROOT,
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
    env: {
      ...process.env,
      DASHBOARD_APP_NAME: APP_NAME,
      DASHBOARD_PORT: String(selected.port),
    },
  });
  child.unref();

  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    if (await isRunning(selected.port)) {
      writeState(selected.port);
      console.log(`CarThings dashboard đang chạy ngầm tại ${url}`);
      console.log('Tắt bằng: npm run dashboard:stop');
      return;
    }
  }

  process.exitCode = 1;
  console.error('Dashboard không thể khởi động. Chạy npm run dashboard để xem log chi tiết.');
}

start().catch((error) => {
  process.exitCode = 1;
  console.error(`Dashboard không thể khởi động: ${error.message}`);
});
