const fs = require('fs');
const path = require('path');

let detectedRoot = process.env.QA_PROJECT_ROOT ? path.resolve(process.env.QA_PROJECT_ROOT) : process.cwd();
if (path.basename(detectedRoot) === 'dashboard' && fs.existsSync(path.join(detectedRoot, 'server.js'))) {
  detectedRoot = path.resolve(detectedRoot, '..');
}
const ROOT = detectedRoot;
const STATE_PATH = path.join(ROOT, '.dashboard-server.json');
const DEFAULT_PORT = Number.parseInt(process.env.DASHBOARD_PORT || '4174', 10);

function readPort() {
  if (process.env.DASHBOARD_PORT) {
    return DEFAULT_PORT;
  }

  try {
    const state = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
    if (state.workspaceRoot === ROOT && Number.isInteger(state.port)) {
      return state.port;
    }
  } catch {
    return DEFAULT_PORT;
  }

  return DEFAULT_PORT;
}

async function stop() {
  const port = readPort();
  const url = `http://127.0.0.1:${port}`;

  try {
    const response = await fetch(`${url}/api/shutdown`, {
      method: 'POST',
      signal: AbortSignal.timeout(2000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    if (fs.existsSync(STATE_PATH)) {
      fs.rmSync(STATE_PATH, { force: true });
    }

    console.log(`Đã tắt Việc Làm 24h dashboard tại ${url}`);
  } catch {
    console.log(`Không có Việc Làm 24h dashboard đang chạy tại ${url}`);
  }
}

stop();
