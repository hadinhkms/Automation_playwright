/**
 * tests/dashboard-api/mobile-builds.test.js
 * TC-2.1..2.6 (AC-201, AC-202, EDGE-201, EDGE-202), TC-2.7 over HTTP (AC-203),
 * run history across a server restart (AC-204, EDGE-204) and one JUnit per run (AC-205).
 * A fake @wdio/cli bin in the fixture stands in for WebdriverIO, so no device or Appium is needed.
 */
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { startDashboardHarness } = require('../dashboard/support/dashboardHarness');
const { createFixtureWorkspace } = require('../dashboard/support/fixtureWorkspace');

const SPEC = 'tests/native/android/launch.native.js';
const FAKE_WDIO = `
const fs = require('fs'); const path = require('path');
const id = process.env.MOBILE_RUN_ID;
const dir = path.join(process.cwd(), 'test-results', 'native', 'android');
console.log('[0-0] RUNNING in Android - ' + process.argv.filter((a) => a.endsWith('.native.js')).join(','));
setTimeout(() => {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'junit-' + id + '-0-0.xml'), '<testsuites><testsuite name="Launch" tests="1">'
    + '<testcase classname="native.android.@smoke_Launch" name="TC-1 opens" time="0.5"/></testsuite></testsuites>');
  console.log('[0-0]    \\u2713 TC-1 opens');
  process.exit(0);
}, Number(process.env.FAKE_WDIO_DELAY_MS || 1500));
`;

function rawPut(port, name, { length, chunks = [], end = true, destroyAfterMs = 0 } = {}) {
  return new Promise((resolve) => {
    const req = http.request({ agent: false, host: '127.0.0.1', port, method: 'PUT', path: `/api/mobile/builds/${encodeURIComponent(name)}`, headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(length) } }, (res) => {
      let text = '';
      res.on('data', (c) => { text += c; });
      res.on('end', () => resolve({ status: res.statusCode, text }));
    });
    req.on('error', (err) => resolve({ status: 0, error: err.code }));
    chunks.forEach((c) => req.write(c));
    if (destroyAfterMs) setTimeout(() => req.destroy(), destroyAfterMs);
    else if (end) req.end();
    if (!end && !destroyAfterMs) resolve({ pending: req });
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

describe('API Contract: Mobile builds & run history (/api/mobile/builds, /api/mobile/runs)', () => {
  let fixture;
  let harness;
  let root;
  const api = (p, init) => fetch(`${harness.url}${p}`, init);
  const put = (name, data, query = '') => api(`/api/mobile/builds/${encodeURIComponent(name)}${query}`, { method: 'PUT', body: data, headers: { 'Content-Type': 'application/octet-stream' } });
  const appsFiles = () => fs.readdirSync(path.join(root, 'apps')).sort();
  const runOnce = (body) => api('/api/mobile/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  async function waitIdle() {
    for (let i = 0; i < 60; i += 1) {
      const state = await (await api('/api/mobile/state')).json();
      if (!state.activeRun) return state.lastRun;
      await sleep(250);
    }
    throw new Error('run did not finish');
  }

  before(async () => {
    fixture = createFixtureWorkspace();
    root = fixture.rootPath;
    fs.mkdirSync(path.join(root, 'tests/native/android'), { recursive: true });
    fs.mkdirSync(path.join(root, 'apps'), { recursive: true });
    fs.mkdirSync(path.join(root, 'node_modules/@wdio/cli/bin'), { recursive: true });
    fs.writeFileSync(path.join(root, SPEC), "describe('@smoke Launch', () => { it('TC-1 opens', () => {}); });");
    fs.writeFileSync(path.join(root, 'wdio.android.conf.js'), 'exports.config = {};');
    fs.writeFileSync(path.join(root, 'node_modules/@wdio/cli/bin/wdio.js'), FAKE_WDIO);
    harness = await startDashboardHarness(root);
  });

  after(async () => {
    if (harness) await harness.stop();
    if (fixture) fixture.cleanup();
  });

  test('TC-2.1 PUT 50 MB app.apk returns 201, file lands in apps/ and in the catalog (AC-201)', async () => {
    const res = await put('app.apk', Buffer.alloc(50 * 1024 * 1024, 1));
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.deepEqual([body.path, body.sizeBytes], ['apps/app.apk', 50 * 1024 * 1024]);
    assert.deepEqual(appsFiles(), ['app.apk']);
    const catalog = await (await api('/api/mobile/catalog?platform=android')).json();
    assert.deepEqual(catalog.apps.map((a) => a.path), ['apps/app.apk']);
  });

  for (const [label, name, data] of [['wrong extension', 'x.exe', 'MZ'], ['path traversal', '../a.apk', 'x'], ['hidden file', '.a.apk', 'x'], ['empty body', 'empty.apk', '']]) {
    test(`TC-2.2 PUT ${label} returns 400 and writes nothing (AC-202)`, async () => {
      const res = await put(name, data);
      assert.equal(res.status, 400);
      assert.ok((await res.json()).error.length > 0);
      assert.deepEqual(appsFiles(), ['app.apk']);
    });
  }

  test('TC-2.3 PUT over 300 MB returns 413 and writes nothing (AC-202)', async () => {
    const res = await rawPut(harness.port, 'big.apk', { length: 300 * 1024 * 1024 + 1, chunks: [Buffer.alloc(1024)] });
    assert.equal(res.status, 413);
    assert.deepEqual(appsFiles(), ['app.apk']);
  });

  test('TC-2.4 duplicate name returns 409 until overwrite is confirmed (BR-201)', async () => {
    assert.equal((await put('app.apk', 'v2')).status, 409);
    assert.equal(fs.statSync(path.join(root, 'apps/app.apk')).size, 50 * 1024 * 1024);
    assert.equal((await put('app.apk', 'v2', '?overwrite=1')).status, 201);
    assert.equal(fs.readFileSync(path.join(root, 'apps/app.apk'), 'utf8'), 'v2');
  });

  test('TC-2.5 a second upload of the same name while the first is in flight gets 409 (EDGE-202)', async () => {
    const first = await rawPut(harness.port, 'twin.apk', { length: 8, chunks: ['1234'], end: false });
    await sleep(150);
    assert.equal((await put('twin.apk', 'zzzz')).status, 409);
    const done = new Promise((resolve) => first.pending.on('response', (res) => resolve(res.statusCode)));
    first.pending.end('5678');
    assert.equal(await done, 201);
    assert.equal(fs.readFileSync(path.join(root, 'apps/twin.apk'), 'utf8'), '12345678');
  });

  test('TC-2.6 upload cancelled midway leaves no file and no .part (EDGE-201)', async () => {
    await rawPut(harness.port, 'cut.apk', { length: 1024 * 1024, chunks: [Buffer.alloc(4096)], destroyAfterMs: 150 });
    await sleep(400);
    assert.deepEqual(appsFiles(), ['app.apk', 'twin.apk']);
  });

  test('DELETE a missing build returns 404, an unsafe name 400', async () => {
    assert.equal((await api('/api/mobile/builds/none.apk', { method: 'DELETE' })).status, 404);
    assert.equal((await api(`/api/mobile/builds/${encodeURIComponent('../package.json')}`, { method: 'DELETE' })).status, 400);
  });

  let firstRunId;
  test('TC-2.7 build used by the running run: DELETE and overwrite return 409 (AC-203); the run ends in history with JUnit (AC-205)', async () => {
    process.env.FAKE_WDIO_DELAY_MS = '1500';
    const res = await runOnce({ specs: [SPEC], udid: 'SERIAL1', deviceName: 'Fake phone', app: { type: 'apk', path: 'apps/app.apk' }, suite: { id: 'smoke-native', label: 'Smoke native' } });
    assert.equal(res.status, 202);
    firstRunId = (await res.json()).id;
    assert.equal((await api('/api/mobile/builds/app.apk', { method: 'DELETE' })).status, 409);
    assert.equal((await put('app.apk', 'v3', '?overwrite=1')).status, 409);
    assert.equal((await api('/api/mobile/builds/twin.apk', { method: 'DELETE' })).status, 200, 'another build stays deletable');
    const last = await waitIdle();
    assert.equal(last.status, 'passed');
    const record = await (await api(`/api/mobile/runs/${firstRunId}`)).json();
    assert.equal(record.junit.tests, record.results.length);
    assert.deepEqual(record.results.map((r) => [r.id, r.status]), [['native.android.@smoke_Launch.TC-1 opens', 'passed']]);
    assert.deepEqual(record.suite, { id: 'smoke-native', label: 'Smoke native' });
    assert.deepEqual(record.device, { udid: 'SERIAL1', name: 'Fake phone' });
    const junit = await api(`/api/mobile/runs/${firstRunId}/junit`);
    assert.equal(junit.status, 200);
    assert.match(junit.headers.get('content-type'), /xml/);
    assert.equal(((await junit.text()).match(/<testcase\b/g) || []).length, 1);
    assert.deepEqual(fs.readdirSync(path.join(root, 'test-results/native/android')), [`junit-${firstRunId}.xml`]);
  });

  test('a stopped run is still recorded with status stopped (EDGE-204)', async () => {
    process.env.FAKE_WDIO_DELAY_MS = '20000';
    assert.equal((await runOnce({ specs: [SPEC], app: { type: 'installed', appPackage: 'com.a.b' } })).status, 202);
    await sleep(300);
    assert.equal((await api('/api/mobile/stop', { method: 'POST' })).status, 202);
    assert.equal((await waitIdle()).status, 'stopped');
  });

  test('GET /api/mobile/runs survives a Dashboard restart, newest first (AC-204)', async () => {
    await harness.stop();
    harness = await startDashboardHarness(root);
    const { runs } = await (await api('/api/mobile/runs?limit=30')).json();
    assert.deepEqual(runs.map((r) => r.status), ['stopped', 'passed']);
    assert.equal(runs[1].id, firstRunId);
    assert.equal((await (await api('/api/mobile/runs?limit=1')).json()).runs.length, 1);
  });

  test('GET unknown run returns 404; a run without JUnit returns 404 on /junit', async () => {
    assert.equal((await api('/api/mobile/runs/nope')).status, 404);
    assert.equal((await api(`/api/mobile/runs/${encodeURIComponent('../x')}`)).status, 404);
    const { runs } = await (await api('/api/mobile/runs')).json();
    assert.equal((await api(`/api/mobile/runs/${runs[0].id}/junit`)).status, 404);
  });

  test('after the run ends the build can be deleted (200)', async () => {
    assert.equal((await api('/api/mobile/builds/app.apk', { method: 'DELETE' })).status, 200);
    assert.deepEqual(appsFiles(), []);
  });
});
