/**
 * tests/dashboard-api/run-log-masking.test.js
 * B-2: live run logs (/api/state logs, SSE "log" events) must not contain secrets, like the history already does.
 */
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { startDashboardHarness } = require('../dashboard/support/dashboardHarness');
const { createFixtureWorkspace } = require('../dashboard/support/fixtureWorkspace');

const PW = JSON.stringify(require.resolve('@playwright/test'));
const SPEC = 'tests/e2e/desktop/leak.spec.js';
const ENV_SECRET = 'qa-env-secret-9f3a7c21';
const LEAKS = ['Pa55w0rdXYZ', 'sk_' + 'live_4eC39HqLyjWDarjtT1zdp7dc', 'eyJ' + 'hbGciOiJIUzI1NiJ9', `ghp_${'A1b2C3d4E5'.repeat(3)}`, ENV_SECRET, 'cookie-session-77'];
const SPEC_SOURCE = `const { test } = require(${PW});
test('leaky', async () => {
  console.log('stdout url https://admin:Pa55w0rdXYZ@host.example/db');
  console.error('stderr api_key=sk_${''}live_4eC39HqLyjWDarjtT1zdp7dc and jwt eyJ${''}hbGciOiJIUzI1NiJ9.eyJ${''}zdWIiOiIxIn0.sig-abc');
  console.log('token ghp_${'A1b2C3d4E5'.repeat(3)} and env ' + process.env.QA_SECRET_TOKEN);
  process.stdout.write('Cookie: cookie-session-77; theme=dark\\n');
  throw new Error('boom https://admin:Pa55w0rdXYZ@host.example/db');
});\n`;

const UTF8_SPEC = 'tests/e2e/desktop/utf8.spec.js';
const VN = 'Đăng nhập thất bại: không tìm thấy tài khoản ệ';
const UTF8_SOURCE = `const { test } = require(${PW});
test('utf8', async () => {
  process.stdout.write('ệệ '.repeat(40000) + '\\n'); // 7 bytes per unit: 64 KiB pipe chunks cut it mid-character
  process.stdout.write(('${VN} ').repeat(3000) + '\\n');
});\n`;

describe('live run logs are masked', () => {
  let fixture; let harness; let root;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  before(async () => {
    fixture = createFixtureWorkspace();
    root = fixture.rootPath;
    fs.writeFileSync(path.join(root, 'playwright.config.js'), "module.exports = { testDir: './tests', retries: 0, reporter: [['list']], projects: [{ name: 'Desktop Smoke Tests', testMatch: '**/e2e/desktop/**' }] };\n");
    fs.mkdirSync(path.join(root, 'tests/e2e/desktop'), { recursive: true });
    fs.writeFileSync(path.join(root, SPEC), SPEC_SOURCE);
    fs.writeFileSync(path.join(root, UTF8_SPEC), UTF8_SOURCE);
    process.env.QA_SECRET_TOKEN = ENV_SECRET;
    try { harness = await startDashboardHarness(root); } finally { delete process.env.QA_SECRET_TOKEN; }
  });
  after(async () => { if (harness) await harness.stop(); if (fixture) fixture.cleanup(); });

  test('/api/state logs and every SSE log event carry no secret value; the rest of the output is intact', async () => {
    const sse = [];
    await new Promise((resolve, reject) => {
      const req = http.get(`${harness.url}/api/events`, (res) => {
        res.setEncoding('utf8');
        res.on('data', (chunk) => sse.push(chunk));
        resolve(req);
      });
      req.on('error', reject);
      globalThis.__sseReq = req;
    });
    const start = await fetch(`${harness.url}/api/run`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ specs: [SPEC], projects: ['Desktop Smoke Tests'] }) });
    assert.equal(start.status, 202);
    for (let i = 0; i < 150; i += 1) { if (!(await (await fetch(`${harness.url}/api/state`)).json()).activeRun) break; await sleep(100); }
    await sleep(400);
    globalThis.__sseReq.destroy();

    const state = await (await fetch(`${harness.url}/api/state`)).json();
    const logText = state.logs.map((e) => e.payload.text).join('');
    const sseText = sse.join('');
    for (const secret of LEAKS) {
      assert.ok(!logText.includes(secret), `"${secret}" leaked in /api/state logs`);
      assert.ok(!sseText.includes(secret), `"${secret}" leaked in the SSE stream`);
    }
    assert.match(logText, /\*\*\*/);
    assert.match(logText, /stdout url https:\/\/\*\*\*@host\.example\/db/);
    assert.match(logText, /1 failed/, 'ordinary output is untouched');
    assert.ok(state.logs.every((e) => e.type === 'log' && typeof e.payload.stream === 'string' && typeof e.payload.text === 'string'), 'shape unchanged');
  });
});

describe('Z-3: multi-byte characters split between chunks survive (web)', () => {
  let fixture; let harness;
  before(async () => {
    fixture = createFixtureWorkspace();
    fs.writeFileSync(path.join(fixture.rootPath, 'playwright.config.js'), "module.exports = { testDir: './tests', retries: 0, reporter: [['list']], projects: [{ name: 'Desktop Smoke Tests', testMatch: '**/e2e/desktop/**' }] };\n");
    fs.mkdirSync(path.join(fixture.rootPath, 'tests/e2e/desktop'), { recursive: true });
    fs.writeFileSync(path.join(fixture.rootPath, UTF8_SPEC), UTF8_SOURCE);
    harness = await startDashboardHarness(fixture.rootPath);
  });
  after(async () => { if (harness) await harness.stop(); if (fixture) fixture.cleanup(); });

  test('300 KB of 3-byte and Vietnamese text arrives intact: no U+FFFD, exact counts', async () => {
    const start = await fetch(`${harness.url}/api/run`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ specs: [UTF8_SPEC], projects: ['Desktop Smoke Tests'] }) });
    assert.equal(start.status, 202);
    for (let i = 0; i < 150; i += 1) { if (!(await (await fetch(`${harness.url}/api/state`)).json()).activeRun) break; await new Promise((r) => setTimeout(r, 100)); }
    const state = await (await fetch(`${harness.url}/api/state`)).json();
    const text = state.logs.map((e) => e.payload.text).join('');
    assert.ok(!text.includes('\uFFFD'), 'a multi-byte character was split into replacement characters');
    assert.equal((text.match(/ệ/g) || []).length, 80000 + 3000, 'every ệ of the long line and of the sentences arrives');
    assert.equal((text.match(/Đăng nhập thất bại: không tìm thấy tài khoản ệ/g) || []).length, 3000);
  });
});

describe('Mobile run logs are masked on the same path', () => {
  let fixture; let harness;
  before(async () => {
    fixture = createFixtureWorkspace();
    const root = fixture.rootPath;
    fs.mkdirSync(path.join(root, 'tests/native/android'), { recursive: true });
    fs.writeFileSync(path.join(root, 'tests/native/android/launch.native.js'), "describe('@smoke L', () => { it('TC-1 x', () => {}); });");
    fs.writeFileSync(path.join(root, 'wdio.android.conf.js'), "console.log('MOBLEAK https://admin:Pa55w0rdXYZ@host.example/x api_key=sk_" + "live_abcdef123456');\nconsole.error('ERRLEAK token=zzz999yyy');\nexports.config = {};\n");
    harness = await startDashboardHarness(root);
  });
  after(async () => { if (harness) await harness.stop(); if (fixture) fixture.cleanup(); });

  test('/api/mobile/state logs carry no secret; the run state keeps its shape (no internal fields)', async () => {
    const res = await fetch(`${harness.url}/api/mobile/run`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ specs: ['tests/native/android/launch.native.js'], app: { type: 'installed', appPackage: 'com.a.b' } }) });
    assert.equal(res.status, 202);
    let state;
    for (let i = 0; i < 100; i += 1) { state = await (await fetch(`${harness.url}/api/mobile/state`)).json(); if (!state.activeRun && state.lastRun) break; await new Promise((r) => setTimeout(r, 200)); }
    const text = state.logs.map((l) => l.text).join('');
    for (const secret of ['Pa55w0rdXYZ', 'sk_' + 'live_abcdef123456', 'zzz999yyy']) assert.ok(!text.includes(secret), `"${secret}" leaked in mobile logs`);
    assert.match(text, /MOBLEAK https:\/\/\*\*\*@host\.example\/x api_key=\*\*\*/);
    assert.match(text, /ERRLEAK token=\*\*\*/);
    assert.ok(!('mask' in state.lastRun) && !('flushLogs' in state.lastRun), 'no internal fields in the public run');
  });
});
