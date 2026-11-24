/**
 * dashboard/services/runnerService.js
 * Manages Playwright subprocess execution, live SSE logging, and run status.
 */
const { spawn } = require('child_process');
const https = require('https');
const { runtimeEnv } = require('./runnerRuntimeEnv');
const { validateOptions } = require('./runOptions');
const { buildPlaywrightArgs } = require('./runnerArgs');
const { newestReport } = require('./resourceService');

let activeRun = null;
let starting = false; // cờ "đang khởi động" đặt ĐỒNG BỘ trước mọi await ở route: chặn nhiều POST đồng thời cùng qua kiểm tra 409
let lastRun = null;
const clients = new Set();
const logBuffer = [];

function publish(type, payload) {
  const event = { type, payload, timestamp: new Date().toISOString() };
  if (type === 'log') {
    logBuffer.push(event);
    if (logBuffer.length > 1000) logBuffer.shift();
  }
  const message = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of clients) client.write(message);
}

function publicRun(run) {
  if (!run) return null;
  const { child, ...rest } = run;
  return rest;
}

function tryBeginStart() {
  if (activeRun || starting) return false;
  starting = true;
  return true;
}
const endStart = () => { starting = false; };

function startRun(options, uiMode = false, root = process.env.QA_PROJECT_ROOT || process.cwd()) {
  if (activeRun) {
    const err = new Error('Đang có một test run khác.');
    err.statusCode = 409;
    throw err;
  }
  const args = buildPlaywrightArgs(options, uiMode, root);

  logBuffer.length = 0;
  const playwrightCli = require.resolve('@playwright/test/cli');
  const child = spawn(process.execPath, [playwrightCli, ...args], {
    cwd: root,
    env: { ...process.env, ...runtimeEnv(options) },
    shell: false,
    windowsHide: true,
  });

  activeRun = {
    id: Date.now().toString(36),
    status: 'running',
    startedAt: new Date().toISOString(),
    mode: uiMode ? 'ui' : 'test',
    options,
    command: `npx playwright ${args.map((a) => JSON.stringify(a)).join(' ')}`,
    child,
  };
  publish('status', publicRun(activeRun));

  const pipe = (src, stream) => src.on('data', (d) => publish('log', { stream, text: d.toString() }));
  pipe(child.stdout, 'stdout');
  pipe(child.stderr, 'stderr');

  child.on('error', (err) => publish('log', { stream: 'stderr', text: `${err.message}\n` }));
  child.on('close', (exitCode, signal) => {
    const report = newestReport(root);
    activeRun.status = signal ? 'stopped' : exitCode === 0 ? 'passed' : 'failed';
    activeRun.finishedAt = new Date().toISOString();
    activeRun.exitCode = exitCode;
    activeRun.reportAvailable = Boolean(report);
    lastRun = publicRun(activeRun);
    activeRun = null;
    publish('status', lastRun);
  });

  return publicRun(activeRun);
}

function stopRun() {
  if (!activeRun?.child) return false;
  activeRun.child.kill('SIGTERM');
  return true;
}

module.exports = {
  getActiveRun: () => activeRun,
  isRunStarting: () => starting,
  tryBeginStart,
  endStart,
  getLastRun: () => lastRun,
  getClients: () => clients,
  getLogBuffer: () => logBuffer,
  publish,
  publicRun,
  validateOptions,
  runtimeEnv,
  startRun,
  stopRun
};
