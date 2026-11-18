/**
 * dashboard/services/mobileRunnerService.js
 * Runs native WDIO/Appium tests as a child process and streams progress over /api/events.
 * Shares the single-run lock with the Playwright runner.
 */
const fs = require('fs');
const path = require('path');
const { spawn, execFile } = require('child_process');
const { publish, getActiveRun: getWebRun } = require('./runnerService');
const { buildArgs, buildEnv, displayCommand } = require('./mobileRunOptions');

const RESULT_PATTERN = /(✓|✖)\s+(.+?)\s*$/;
const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;
const MAX_LOG = 600;

let activeRun = null;
let lastRun = null;
const logTail = [];

function publicRun(run) {
  if (!run) return null;
  const { child, lineBuffer, stopRequested, ...rest } = run;
  return rest;
}

function conflict(message) {
  return Object.assign(new Error(message), { status: 409 });
}

function emitStatus() {
  publish('mobile_status', publicRun(activeRun || lastRun));
}

function consumeLine(run, rawLine) {
  const line = rawLine.replace(ANSI_PATTERN, '');
  if (run.phase === 'starting' && /RUNNING in/i.test(line)) {
    run.phase = 'testing';
    emitStatus();
  }
  const match = RESULT_PATTERN.exec(line);
  if (!match) return;
  const title = match[2].replace(/\s*\(\d+(\.\d+)?m?s\)$/, '');
  if (run.results.some((r) => r.title === title)) return;
  run.results.push({ title, status: match[1] === '✓' ? 'passed' : 'failed' });
  emitStatus();
}

function pipe(run, stream, name) {
  stream.on('data', (chunk) => {
    const text = chunk.toString();
    logTail.push({ stream: name, text });
    if (logTail.length > MAX_LOG) logTail.shift();
    publish('mobile_log', { runId: run.id, stream: name, text });
    const lines = (run.lineBuffer[name] + text).split(/\r?\n/);
    run.lineBuffer[name] = lines.pop();
    lines.forEach((l) => consumeLine(run, l));
  });
}

function collectEvidence(root, platform, sinceIso) {
  const dir = path.join(root, 'evidence', 'native', platform);
  if (!fs.existsSync(dir)) return [];
  const since = Date.parse(sinceIso) - 1000;
  return fs.readdirSync(dir)
    .filter((n) => /\.png$/i.test(n))
    .map((n) => ({ name: n, mtime: fs.statSync(path.join(dir, n)).mtimeMs }))
    .filter((f) => f.mtime >= since)
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, 12)
    .map((f) => ({ name: f.name, url: `/evidence/native/${platform}/${encodeURIComponent(f.name)}` }));
}

/** @wdio/cli does not export its bin through package "exports", so locate the file directly. */
function findWdioBin(root) {
  const rel = path.join('node_modules', '@wdio', 'cli', 'bin', 'wdio.js');
  const found = [root, process.cwd()].map((dir) => path.join(dir, rel)).find((p) => fs.existsSync(p));
  if (!found) throw Object.assign(new Error('Chưa cài WebdriverIO (@wdio/cli). Chạy "npm install" trong repo rồi thử lại.'), { status: 503 });
  return found;
}

function startMobileRun(options, root) {
  if (activeRun) throw conflict('Đang có một lượt chạy Mobile khác.');
  if (getWebRun()) throw conflict('Đang có một lượt chạy Playwright. Đợi xong hoặc dừng nó trước.');

  const wdioBin = findWdioBin(root);
  const child = spawn(process.execPath, [wdioBin, ...buildArgs(options)], {
    cwd: root,
    env: { ...process.env, ...buildEnv(options, root) },
    shell: false,
    windowsHide: true,
  });
  logTail.length = 0;
  const run = {
    id: Date.now().toString(36),
    platform: options.platform,
    status: 'running',
    phase: 'starting',
    startedAt: new Date().toISOString(),
    options,
    command: displayCommand(options),
    results: [],
    evidence: [],
    child,
    lineBuffer: { stdout: '', stderr: '' },
    stopRequested: false,
  };
  activeRun = run;
  emitStatus();
  pipe(run, child.stdout, 'stdout');
  pipe(run, child.stderr, 'stderr');
  child.on('error', (err) => publish('mobile_log', { runId: run.id, stream: 'stderr', text: `${err.message}\n` }));
  child.on('close', (exitCode) => {
    ['stdout', 'stderr'].forEach((n) => consumeLine(run, run.lineBuffer[n]));
    run.status = run.stopRequested ? 'stopped' : exitCode === 0 ? 'passed' : 'failed';
    run.phase = 'done';
    run.exitCode = exitCode;
    run.finishedAt = new Date().toISOString();
    run.evidence = collectEvidence(root, run.platform, run.startedAt);
    lastRun = publicRun(run);
    activeRun = null;
    emitStatus();
  });
  return publicRun(run);
}

/** Kills the whole tree: WDIO spawns workers and the Appium server as grandchildren. */
function stopMobileRun() {
  if (!activeRun?.child) return false;
  activeRun.stopRequested = true;
  activeRun.status = 'stopping';
  emitStatus();
  const { pid } = activeRun.child;
  if (process.platform === 'win32' && pid) {
    execFile('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true }, () => {});
  } else {
    activeRun.child.kill('SIGTERM');
  }
  return true;
}

module.exports = {
  startMobileRun,
  stopMobileRun,
  getActiveMobileRun: () => activeRun,
  getMobileState: () => ({ activeRun: publicRun(activeRun), lastRun, logs: [...logTail] }),
  consumeLine,
  collectEvidence,
  findWdioBin,
};
