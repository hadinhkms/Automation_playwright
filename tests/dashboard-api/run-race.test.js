/**
 * tests/dashboard-api/run-race.test.js
 * Gate 3 Q1: with a COLD specProjects cache, concurrent POST /api/run (and /api/ui) used to pass the 409 check
 * together (it ran before `await validateOptions`), so N requests -> N 202 -> N playwright processes, only one
 * tracked, /api/stop killing one and leaving orphans. Now: exactly one 202, the rest 409, one process.
 */
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const net = require('net');
const { execSync } = require('child_process');
const { startDashboardHarness } = require('../dashboard/support/dashboardHarness');
const { createFixtureWorkspace } = require('../dashboard/support/fixtureWorkspace');

const PW = JSON.stringify(require.resolve('@playwright/test'));
const CONFIG = `if (process.argv.includes('--ui')) { throw new Error('ui mode disabled in this fixture'); }
module.exports = { projects: [{ name: 'Desktop Smoke Tests', testMatch: '**/e2e/desktop/**', grep: /@smoke/ }] };\n`;
const SPEC = `const { test } = require(${PW});\ntest('long running @smoke', async () => { await new Promise((r) => setTimeout(r, 20000)); });\n`;

const playwrightProcesses = (root) => execSync('ps -ax -o command=', { encoding: 'utf8' })
  .split('\n').filter((line) => line.includes('@playwright/test/cli.js') && line.includes(path.basename(root)));
const LONG = 'tests/e2e/desktop/long.spec.js';
const BODY = { specs: [LONG], projects: ['Desktop Smoke Tests'] }; // the spec path (absolute, in argv) lets us find the process
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

describe('concurrent POST /api/run and /api/ui on a cold cache', () => {
  let fixture; let harness; let root;
  const post = (p, body) => fetch(`${harness.url}${p}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const state = async () => (await fetch(`${harness.url}/api/state`)).json();

  async function waitNoProcess(timeoutMs = 20000) {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) { if (playwrightProcesses(root).length === 0 && !(await state()).activeRun) return true; await sleep(200); }
    return false;
  }

  before(async () => {
    fixture = createFixtureWorkspace();
    root = fixture.rootPath;
    fs.writeFileSync(path.join(root, 'playwright.config.js'), CONFIG);
    fs.mkdirSync(path.join(root, 'tests/e2e/desktop'), { recursive: true });
    fs.writeFileSync(path.join(root, 'tests/e2e/desktop/long.spec.js'), SPEC);
    harness = await startDashboardHarness(root); // fresh server: specProjects cache is cold
  });
  after(async () => {
    if (harness) { try { await post('/api/stop', {}); } catch (_) { /* ignore */ } await harness.stop(); }
    try { execSync(`pkill -f "${path.basename(root)}"`); } catch (_) { /* none left */ }
    if (fixture) fixture.cleanup();
  });

  test('/api/ui: three simultaneous POSTs -> exactly one 202 and two 409', async () => {
    const results = await Promise.all([1, 2, 3].map(() => post('/api/ui', BODY)));
    assert.deepEqual(results.map((r) => r.status).sort(), [202, 409, 409]);
    assert.ok(await waitNoProcess(), 'the UI-mode run failed fast by design; nothing may be left running');
  });

  test('/api/run on a COLD cache: three simultaneous POSTs -> one 202, two 409, exactly ONE playwright process', async () => {
    // new server = cold cache again
    await harness.stop();
    harness = await startDashboardHarness(root);
    const started = Date.now();
    const results = await Promise.all([1, 2, 3].map(() => post('/api/run', BODY)));
    const statuses = results.map((r) => r.status).sort();
    assert.deepEqual(statuses, [202, 409, 409], `statuses ${statuses} after ${Date.now() - started} ms`);
    await sleep(1500);
    assert.equal(playwrightProcesses(root).length, 1, playwrightProcesses(root).join('\n'));

    const stop = await post('/api/stop', {});
    assert.equal(stop.status, 202);
    assert.ok(await waitNoProcess(), 'after /api/stop no playwright process may remain (no orphans)');
  });

  test('K-1: a request whose body never finishes does not hold the starting flag (others are not 409)', async () => {
    const port = new URL(harness.url).port;
    const sockets = [];
    // Content-Length says 500 bytes, only 10 are sent and the socket stays open: parseBody never completes.
    for (let i = 0; i < 3; i += 1) {
      const socket = net.connect(Number(port), '127.0.0.1');
      socket.on('error', () => {});
      socket.write(`POST /api/run HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nContent-Type: application/json\r\nContent-Length: 500\r\n\r\n{"specs":[`);
      sockets.push(socket);
    }
    try {
      await sleep(300);
      const ok = await post('/api/run', BODY);
      assert.equal(ok.status, 202, 'a normal request must be accepted while slow bodies are pending');
      await post('/api/stop', {});
      assert.ok(await waitNoProcess());
    } finally {
      sockets.forEach((s) => s.destroy());
    }
  });

  test('K-1: after slow bodies are dropped the cold race still gives exactly one 202', async () => {
    await harness.stop();
    harness = await startDashboardHarness(root);
    const slow = net.connect(Number(new URL(harness.url).port), '127.0.0.1');
    slow.on('error', () => {});
    slow.write(`POST /api/run HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: application/json\r\nContent-Length: 500\r\n\r\n{`);
    try {
      await sleep(200);
      const results = await Promise.all([1, 2, 3].map(() => post('/api/run', BODY)));
      assert.deepEqual(results.map((r) => r.status).sort(), [202, 409, 409]);
      await sleep(1200);
      assert.equal(playwrightProcesses(root).length, 1);
      await post('/api/stop', {});
      assert.ok(await waitNoProcess());
    } finally {
      slow.destroy();
    }
  });

  test('after the run ends a new one is accepted (the starting flag is released)', async () => {
    const res = await post('/api/run', BODY);
    assert.equal(res.status, 202);
    await post('/api/stop', {});
    assert.ok(await waitNoProcess());
  });

  test('a rejected request releases the flag too (400 then 202)', async () => {
    assert.equal((await post('/api/run', { specs: ['tests/none.spec.js'] })).status, 400);
    const ok = await post('/api/run', BODY);
    assert.equal(ok.status, 202);
    await post('/api/stop', {});
    assert.ok(await waitNoProcess());
  });
});
