/**
 * tests/dashboard-api/mobile-inspector.test.js
 * PLAN-25 P4 API contract for /api/mobile/inspector/* against a fake Appium (local HTTP server, no device):
 * session start/snapshot/find/action/stop, TC-4.2 suggestions with match counts (AC-402), TC-4.4 run lock both
 * ways (AC-404, REQ-401), EDGE-403 second tab, TC-4.3 Screen preview/draft/create/merge over HTTP (AC-403, EDGE-404),
 * and server shutdown deleting the Appium session (B6).
 */
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { startDashboardHarness } = require('../dashboard/support/dashboardHarness');
const { createFixtureWorkspace } = require('../dashboard/support/fixtureWorkspace');

const SPEC = 'tests/native/android/launch.native.js';
const FAKE_WDIO = "console.log('[0-0] RUNNING in Android'); setTimeout(() => process.exit(0), 2500);";
const SOURCE = '<hierarchy><android.widget.Button resource-id="com.vieclam24h.qa:id/login" text="Đăng nhập" class="android.widget.Button" bounds="[0,0][10,10]"/></hierarchy>';
const KEY = 'tab-aaaaaaaa';
const OTHER = 'tab-bbbbbbbb';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Appium stand-in: one session, counts depend on the query so the order of suggestions is observable. */
function startFakeAppium() {
  const fake = { sessions: [], calls: [], deleted: [] };
  fake.server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      const send = (code, value) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ value })); };
      fake.calls.push(`${req.method} ${req.url}`);
      if (req.url === '/status') return send(200, { ready: true, build: { version: '2.13.0' } });
      if (req.method === 'POST' && req.url === '/session') {
        fake.sessions.push(JSON.parse(raw).capabilities.alwaysMatch);
        return send(200, { sessionId: `s${fake.sessions.length}`, capabilities: {} });
      }
      const sub = req.url.replace(/^\/session\/[^/]+/, '');
      if (req.method === 'DELETE' && sub === '') { fake.deleted.push(req.url); return send(200, null); }
      if (sub === '/screenshot') return send(200, 'iVBORw0KGgo=');
      if (sub === '/source') return send(200, SOURCE);
      if (sub === '/window/rect') return send(200, { x: 0, y: 0, width: 1080, height: 2400 });
      if (sub === '/elements') {
        const { using, value } = JSON.parse(raw);
        const n = using === 'xpath' ? 3 : value.includes('resourceId') ? 1 : value.includes('.text(') ? 2 : 0;
        return send(200, Array.from({ length: n }, (_, i) => ({ 'element-6066-11e4-a52e-4f735466cecf': `e${i}` })));
      }
      if (sub === '/element') return send(200, { 'element-6066-11e4-a52e-4f735466cecf': 'e0' });
      fake.lastBody = raw;
      return send(200, null);
    });
  });
  return new Promise((resolve) => fake.server.listen(0, '127.0.0.1', () => { fake.port = fake.server.address().port; resolve(fake); }));
}

describe('API Contract: Mobile Inspector (/api/mobile/inspector/*)', () => {
  let fixture;
  let harness;
  let fake;
  let root;
  const saved = {};
  const api = (p, method = 'GET', body) => fetch(`${harness.url}${p}`, {
    method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
  });
  const start = (key = KEY) => api('/api/mobile/inspector/start', 'POST', {
    key, platform: 'android', udid: 'SERIAL1', deviceName: 'CPH2481',
    app: { type: 'installed', appPackage: 'com.vieclam24h.qa', appActivity: 'com.vieclam24h.MainActivity' },
  });

  before(async () => {
    fake = await startFakeAppium();
    for (const k of ['APPIUM_EXTERNAL', 'APPIUM_HOST', 'APPIUM_PORT']) saved[k] = process.env[k];
    Object.assign(process.env, { APPIUM_EXTERNAL: 'true', APPIUM_HOST: '127.0.0.1', APPIUM_PORT: String(fake.port) });
    fixture = createFixtureWorkspace();
    root = fixture.rootPath;
    fs.mkdirSync(path.join(root, 'tests/native/android'), { recursive: true });
    fs.mkdirSync(path.join(root, 'node_modules/@wdio/cli/bin'), { recursive: true });
    fs.writeFileSync(path.join(root, SPEC), "describe('Launch', () => { it('TC-1 opens @smoke', () => {}); });");
    fs.writeFileSync(path.join(root, 'wdio.android.conf.js'), 'exports.config = {};');
    fs.writeFileSync(path.join(root, 'node_modules/@wdio/cli/bin/wdio.js'), FAKE_WDIO);
    harness = await startDashboardHarness(root);
  });

  after(async () => {
    if (harness) await harness.stop();
    if (fixture) fixture.cleanup();
    if (fake) fake.server.close();
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  });

  test('no session: snapshot/stop 404, state inactive, bad key 400, unknown route 404', async () => {
    assert.deepEqual(await (await api('/api/mobile/inspector/state')).json(), { active: false });
    assert.equal((await api(`/api/mobile/inspector/snapshot?key=${KEY}`)).status, 404);
    assert.equal((await api('/api/mobile/inspector/stop', 'POST', { key: KEY })).status, 404);
    assert.equal((await api('/api/mobile/inspector/start', 'POST', { platform: 'android', app: { type: 'installed', appPackage: 'a.b' } })).status, 400);
    assert.equal((await api('/api/mobile/inspector/start', 'POST', { key: KEY, app: { type: 'installed', appPackage: 'a.b;calc' } })).status, 400);
    assert.equal((await api('/api/mobile/inspector/nope')).status, 404);
    assert.equal(fake.sessions.length, 0);
  });

  test('TC-4.4 AC-404: a running Mobile App test blocks the Inspector with 409', async () => {
    const run = await api('/api/mobile/run', 'POST', { specs: [SPEC], app: { type: 'installed', appPackage: 'com.a.b' } });
    assert.equal(run.status, 202);
    assert.equal((await start()).status, 409);
    for (let i = 0; i < 40 && (await (await api('/api/mobile/state')).json()).activeRun; i += 1) await sleep(250);
    assert.equal(fake.sessions.length, 0);
  });

  test('AC-401 contract: start 201 with Android capabilities, snapshot 200 with screenshot + source', async () => {
    const res = await start();
    assert.equal(res.status, 201);
    const state = await res.json();
    assert.equal(state.ready, true);
    assert.equal(state.device, 'CPH2481');
    const caps = fake.sessions[0];
    assert.equal(caps.platformName, 'Android');
    assert.equal(caps['appium:udid'], 'SERIAL1');
    assert.equal(caps['appium:appPackage'], 'com.vieclam24h.qa');
    assert.equal(caps['appium:noReset'], true);
    assert.equal(caps['appium:newCommandTimeout'], 660);
    const snap = await (await api(`/api/mobile/inspector/snapshot?key=${KEY}`)).json();
    assert.equal(snap.screenshot, 'iVBORw0KGgo=');
    assert.equal(snap.source, SOURCE);
    assert.deepEqual(snap.window, { width: 1080, height: 2400 });
  });

  test('TC-4.4 AC-404 + EDGE-403: while open, /api/run, /api/ui, /api/mobile/run and a second tab get 409', async () => {
    assert.equal((await api('/api/run', 'POST', {})).status, 409);
    assert.equal((await api('/api/ui', 'POST', {})).status, 409);
    const mobile = await api('/api/mobile/run', 'POST', { specs: [SPEC], app: { type: 'installed', appPackage: 'com.a.b' } });
    assert.equal(mobile.status, 409);
    assert.match((await mobile.json()).error, /Inspector đang mở/);
    assert.equal((await start(OTHER)).status, 409);
    assert.equal((await api(`/api/mobile/inspector/snapshot?key=${OTHER}`)).status, 409);
    assert.equal((await api('/api/mobile/inspector/stop', 'POST', { key: OTHER })).status, 409);
  });

  test('TC-4.2 AC-402: find ranks byId first with count 1; a plain locator returns its count', async () => {
    const element = { 'resource-id': 'com.vieclam24h.qa:id/login', text: 'Đăng nhập', class: 'android.widget.Button', index: 1 };
    const res = await api('/api/mobile/inspector/find', 'POST', { key: KEY, element });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.name, 'login');
    assert.deepEqual(body.suggestions.map((s) => [s.kind, s.count]), [['id', 1], ['uiautomator', 2], ['text', 2], ['xpath', 3]]);
    assert.equal(body.suggestions[0].code, "this.byId('com.vieclam24h.qa:id/login')");
    assert.deepEqual(await (await api('/api/mobile/inspector/find', 'POST', { key: KEY, locator: 'xpath://x' })).json(), { count: 3 });
    assert.equal((await api('/api/mobile/inspector/find', 'POST', { key: KEY, locator: 'css:.x' })).status, 400);
    assert.equal((await api('/api/mobile/inspector/find', 'POST', { key: KEY })).status, 400);
  });

  test('actions: tap, type, back reach Appium; invalid input is 400', async () => {
    assert.equal((await api('/api/mobile/inspector/action', 'POST', { key: KEY, type: 'tap', x: 540, y: 1200 })).status, 200);
    assert.match(fake.lastBody, /"pointerType":"touch"/);
    assert.equal((await api('/api/mobile/inspector/action', 'POST', { key: KEY, type: 'type', locator: 'id:com.vieclam24h.qa:id/search', text: 'tester' })).status, 200);
    assert.equal(fake.lastBody, JSON.stringify({ text: 'tester' }));
    assert.equal((await api('/api/mobile/inspector/action', 'POST', { key: KEY, type: 'back' })).status, 200);
    assert.ok(fake.calls.some((c) => c.endsWith('/back')));
    assert.equal((await api('/api/mobile/inspector/action', 'POST', { key: KEY, type: 'tap', x: 'a', y: 1 })).status, 400);
    assert.equal((await api('/api/mobile/inspector/action', 'POST', { key: KEY, type: 'rm -rf' })).status, 400);
  });

  test('TC-4.3 AC-403: Screen preview → draft → create, then 409 on the same name and merge for iOS', async () => {
    const elements = [{ name: 'login', locator: 'id:com.vieclam24h.qa:id/login', action: 'tap' }];
    const preview = await (await api('/api/mobile/inspector/page-object', 'POST', { name: 'Login', platform: 'android', elements })).json();
    assert.equal(preview.className, 'LoginScreen');
    assert.equal(preview.exists, false);
    assert.equal((await api('/api/mobile/inspector/page-object', 'POST', { mode: 'draft', name: 'Login', platform: 'android', elements })).status, 200);
    assert.ok(!fs.existsSync(path.join(root, 'pages/native/screens/LoginScreen.js')), 'BR-401: draft stays out of pages/');
    const created = await api('/api/mobile/inspector/page-object', 'POST', { mode: 'create', name: 'Login', platform: 'android', elements, source: preview.source });
    assert.equal(created.status, 201);
    assert.ok(fs.existsSync(path.join(root, 'pages/native/screens/LoginScreen.js')));
    assert.equal((await api('/api/mobile/inspector/page-object', 'POST', { mode: 'create', name: 'Login', platform: 'android', elements })).status, 409);
    const merged = await api('/api/mobile/inspector/page-object', 'POST', { mode: 'create', name: 'LoginScreen', platform: 'ios', merge: true, elements: [{ name: 'login', locator: '~login' }] });
    assert.equal(merged.status, 201);
    const screens = (await (await api('/api/mobile/inspector/screens')).json()).screens;
    assert.deepEqual(screens.map((s) => [s.className, s.missing.ios.length, s.missing.android.length]), [['LoginScreen', 0, 0]]);
    assert.equal((await api('/api/mobile/inspector/page-object', 'POST', { mode: 'create', name: 'X', platform: 'android', elements: [] })).status, 400);
  });

  test('TC-4.4: stop 200 deletes the Appium session, then runs are accepted again', async () => {
    assert.equal((await api('/api/mobile/inspector/stop', 'POST', { key: KEY })).status, 200);
    assert.deepEqual(fake.deleted, ['/session/s1']);
    assert.deepEqual(await (await api('/api/mobile/inspector/state')).json(), { active: false });
    // An unknown spec reaches validation (400) instead of the lock (409) and starts nothing.
    assert.equal((await api('/api/run', 'POST', { spec: 'tests/none.spec.js' })).status, 400);
    const mobile = await api('/api/mobile/run', 'POST', { specs: [] });
    assert.equal(mobile.status, 400, 'reaches validation, no lock');
  });

  test('B6: server shutdown deletes an open Appium session before exiting', async () => {
    assert.equal((await start()).status, 201);
    assert.equal((await api('/api/shutdown', 'POST', {})).status, 200);
    for (let i = 0; i < 40 && fake.deleted.length < 2; i += 1) await sleep(100);
    assert.deepEqual(fake.deleted, ['/session/s1', '/session/s2']);
  });
});
