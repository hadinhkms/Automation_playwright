/**
 * dashboard/services/mobileAppiumClient.js
 * Minimal WebDriver HTTP client for the native Inspector (PLAN-25 P4, TECH-401) and the local Appium
 * process it may need on Android (TECH-402). No WDIO: an interactive session must live long and close on demand.
 */
const { spawn, execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const HOST_PATTERN = /^[\w.-]{1,253}$/;
const START_TIMEOUT_MS = 30000;

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

/** One WebDriver call. Appium errors keep their W3C code in `error.wdError`. */
async function wdCall(baseUrl, method, route, body, { timeoutMs = 30000, fetchImpl = fetch } = {}) {
  let response;
  try {
    response = await fetchImpl(`${baseUrl}${route}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError';
    throw Object.assign(httpError(503, timedOut ? `Appium không phản hồi trong ${Math.round(timeoutMs / 1000)} giây.` : `Không kết nối được Appium (${baseUrl}).`), { wdError: 'unreachable' });
  }
  let payload = {};
  try { payload = await response.json(); } catch (_) { payload = {}; }
  const value = payload?.value;
  if (!response.ok || value?.error) {
    const message = String(value?.message || `HTTP ${response.status}`).split('\n')[0].slice(0, 300);
    throw Object.assign(httpError(502, `Appium báo lỗi: ${message}`), { wdError: value?.error || 'unknown error' });
  }
  return value;
}

async function isAppiumUp(baseUrl, fetchImpl = fetch) {
  try {
    const value = await wdCall(baseUrl, 'GET', '/status', undefined, { timeoutMs: 2000, fetchImpl });
    return Boolean(value && typeof value === 'object');
  } catch (_) { return false; }
}

function killTree(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === 'win32' && child.pid) {
    execFile('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true }, () => {});
  } else {
    child.kill('SIGTERM');
  }
}

/** Default spawner: the global `appium` npm shim needs cmd.exe on Windows; host and port are validated first. */
function spawnAppium({ hostname, port, logFile }) {
  const args = ['--address', hostname, '--port', String(port), '--relaxed-security', '--log-no-colors'];
  const viaCmd = process.platform === 'win32';
  const child = spawn(viaCmd ? 'cmd.exe' : 'appium', viaCmd ? ['/d', '/s', '/c', 'appium', ...args] : args, {
    windowsHide: true, shell: false, stdio: ['ignore', 'pipe', 'pipe'],
  });
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  const log = fs.createWriteStream(logFile, { flags: 'w' });
  child.stdout.pipe(log);
  child.stderr.pipe(log);
  return child;
}

/**
 * Appium for an Android Inspector session: reuse one that already answers on host:port, otherwise start it
 * (unless APPIUM_EXTERNAL says someone else owns it). `stop()` only kills a process this call started.
 */
async function ensureLocalAppium(connection, { root, fetchImpl = fetch, spawnImpl = spawnAppium, startTimeoutMs = START_TIMEOUT_MS } = {}) {
  const { hostname, port, useExternalServer } = connection;
  if (!HOST_PATTERN.test(String(hostname)) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw httpError(400, 'APPIUM_HOST / APPIUM_PORT trong .env không hợp lệ.');
  }
  const url = `http://${hostname}:${port}`;
  if (await isAppiumUp(url, fetchImpl)) return { url, owned: false, stop() {} };
  if (useExternalServer) throw httpError(503, `Không kết nối được Appium tại ${url} (APPIUM_EXTERNAL=true). Hãy bật Appium rồi thử lại.`);

  const logFile = path.join(root || process.cwd(), 'test-results', 'appium', 'inspector.log');
  const child = spawnImpl({ hostname, port, logFile });
  let exited = false;
  child.on('exit', () => { exited = true; });
  child.on('error', () => { exited = true; });
  const deadline = Date.now() + startTimeoutMs;
  while (Date.now() < deadline && !exited) {
    if (await isAppiumUp(url, fetchImpl)) return { url, owned: true, child, stop: () => killTree(child) };
    await new Promise((r) => setTimeout(r, 500));
  }
  killTree(child);
  throw httpError(503, exited
    ? 'Không khởi động được Appium. Kiểm tra "npm i -g appium" và test-results/appium/inspector.log.'
    : `Appium chưa sẵn sàng sau ${Math.round(startTimeoutMs / 1000)} giây.`);
}

module.exports = { wdCall, isAppiumUp, ensureLocalAppium, killTree, httpError };
