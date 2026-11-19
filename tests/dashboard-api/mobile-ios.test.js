/**
 * tests/dashboard-api/mobile-ios.test.js
 * PLAN-25 P3 API contract with a fake Appium (local HTTP server, no Mac):
 * TC-3.1 AC-301, TC-3.2/3.3 AC-302 + EDGE-301/302, TC-3.4 AC-303 (BR-301) over HTTP,
 * TC-3.5 AC-304 end to end: Dashboard → real WDIO + wdio.ios.conf.js → capabilities received by the fake Appium,
 * plus EDGE-303 (settings changed mid-run do not touch the run), iOS catalog/devices/doctor and .ipa/.app.zip uploads.
 */
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { startDashboardHarness } = require('../dashboard/support/dashboardHarness');
const { createFixtureWorkspace } = require('../dashboard/support/fixtureWorkspace');

const REPO = path.resolve(__dirname, '..', '..');
const SPEC = 'tests/native/shared/app-launch/app-launch.native.js';
const SIM = { name: 'iPhone 15', platformVersion: '17.5', simulator: true };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Minimal Appium 2 stand-in. mode: ok | nodriver | http500 | notappium | hang */
function startFakeAppium() {
  const fake = { mode: 'ok', sessions: [], statusHits: 0 };
  fake.server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      if (fake.mode === 'hang') return;
      const send = (code, body) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
      if (req.method === 'GET' && req.url === '/status') {
        fake.statusHits += 1;
        if (fake.mode === 'http500') return send(500, { value: { message: 'boom' } });
        if (fake.mode === 'notappium') return send(200, { hello: 'world' });
        return send(200, { value: { ready: true, message: 'The server is ready', build: { version: '2.11.3' } } });
      }
      if (req.method === 'POST' && req.url === '/session') {
        const caps = JSON.parse(raw || '{}')?.capabilities?.alwaysMatch || {};
        fake.sessions.push(caps);
        const message = fake.mode === 'nodriver'
          ? "Could not find a driver for automationName 'XCUITest' and platformName 'iOS'. Have you installed a driver that supports those capabilities?"
          : `Unknown device or simulator UDID / OS ${caps['appium:platformVersion']}`;
        return send(500, { value: { error: 'session not created', message, stacktrace: '' } });
      }
      return send(404, { value: { error: 'unknown command', message: req.url } });
    });
  });
  return new Promise((resolve) => fake.server.listen(0, '127.0.0.1', () => { fake.port = fake.server.address().port; resolve(fake); }));
}

describe('API Contract: Mobile iOS via a remote Mac (/api/mobile/ios/*, platform=ios)', () => {
  let fixture;
  let harness;
  let fake;
  let root;
  const runIds = [];

  before(async () => {
    fake = await startFakeAppium();
    fixture = createFixtureWorkspace();
    root = fixture.rootPath;
    fs.mkdirSync(path.dirname(path.join(root, SPEC)), { recursive: true });
    fs.copyFileSync(path.join(REPO, SPEC), path.join(root, SPEC));
    // The fixture runs the repo's real iOS config, so the capabilities checked below are the ones a Mac would get.
    fs.writeFileSync(path.join(root, 'wdio.ios.conf.js'), `module.exports = require(${JSON.stringify(path.join(REPO, 'wdio.ios.conf.js'))});`);
    harness = await startDashboardHarness(root);
  });

  after(async () => {
    if (harness) await harness.stop();
    if (fixture) fixture.cleanup();
    if (fake) fake.server.close();
    const junitDir = path.join(REPO, 'test-results', 'native', 'ios');
    if (fs.existsSync(junitDir)) {
      fs.readdirSync(junitDir).filter((n) => runIds.some((id) => n.includes(id))).forEach((n) => fs.rmSync(path.join(junitDir, n), { force: true }));
    }
  });

  const call = (method, p, body) => fetch(`${harness.url}${p}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const config = (patch = {}) => ({ host: 'http://127.0.0.1', port: fake.port, devices: [SIM], ...patch });

  test('TC-3.1 AC-301 / REQ-301: save the Mac host, read it back, "Kiểm tra kết nối" reports version and XCUITest', async () => {
    fake.mode = 'ok';
    const put = await call('PUT', '/api/mobile/ios/config', config());
    assert.equal(put.status, 200);
    assert.match(fs.readFileSync(path.join(root, '.env'), 'utf8'), new RegExp(`^IOS_APPIUM_PORT=${fake.port}$`, 'm'));
    const saved = await (await call('GET', '/api/mobile/ios/config')).json();
    assert.equal(saved.host, 'http://127.0.0.1');
    assert.deepEqual(saved.devices, [{ ...SIM, udid: '' }]);
    const res = await call('POST', '/api/mobile/ios/check', {});
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.reachable, true);
    assert.equal(body.appiumVersion, '2.11.3');
    assert.equal(body.xcuitest, true);
    assert.equal(typeof body.latencyMs, 'number');
    assert.equal(body.error, '');
    assert.ok(fake.sessions.every((c) => c['appium:deviceName'] === 'dashboard-driver-probe'), 'the check only sends the driver probe');
  });

  test('TC-3.2 AC-302 / EDGE-301: a Mac that never answers fails within 5 s; refused port, HTTP 500 and non-Appium replies are reachable=false', async () => {
    fake.mode = 'hang';
    const started = Date.now();
    const hang = await (await call('POST', '/api/mobile/ios/check', config())).json();
    const elapsed = Date.now() - started;
    assert.equal(hang.reachable, false);
    assert.match(hang.error, /5 giây/);
    assert.ok(elapsed >= 4500 && elapsed < 6500, `took ${elapsed} ms`);

    fake.mode = 'http500';
    assert.match((await (await call('POST', '/api/mobile/ios/check', config())).json()).error, /HTTP 500/);
    fake.mode = 'notappium';
    assert.match((await (await call('POST', '/api/mobile/ios/check', config())).json()).error, /không giống Appium/);
    const refused = await (await call('POST', '/api/mobile/ios/check', config({ port: 1 }))).json();
    assert.equal(refused.reachable, false);
    assert.match(refused.error, /từ chối|không phản hồi|Không kết nối/);
  });

  test('TC-3.3 EDGE-302: Appium without the XCUITest driver → reachable, xcuitest=false, install hint', async () => {
    fake.mode = 'nodriver';
    const body = await (await call('POST', '/api/mobile/ios/check', config())).json();
    assert.equal(body.reachable, true);
    assert.equal(body.xcuitest, false);
    assert.match(body.warning, /appium driver install xcuitest/);
  });

  test('TC-3.4 AC-303 / BR-301: file://, whitespace and shell characters → 400 on save and on check; saved value unchanged', async () => {
    for (const host of ['file:///etc/passwd', 'http://mac book', 'http://mac;id', 'http://mac/$(id)', 'http://mac|calc']) {
      assert.equal((await call('PUT', '/api/mobile/ios/config', config({ host }))).status, 400, host);
      assert.equal((await call('POST', '/api/mobile/ios/check', config({ host }))).status, 400, host);
    }
    assert.equal((await call('PUT', '/api/mobile/ios/config', config({ password: 'x', devices: '{bad' }))).status, 400);
    assert.equal((await (await call('GET', '/api/mobile/ios/config')).json()).host, 'http://127.0.0.1');
  });

  test('iOS catalog, declared devices and doctor answer for platform=ios', async () => {
    fake.mode = 'ok';
    const cat = await (await call('GET', '/api/mobile/catalog?platform=ios')).json();
    assert.equal(cat.platform, 'ios');
    assert.equal(cat.configFile, 'wdio.ios.conf.js');
    assert.deepEqual(cat.specs.map((s) => [s.path, s.scope]), [[SPEC, 'shared']]);
    const devices = await (await call('GET', '/api/mobile/devices?platform=ios')).json();
    assert.deepEqual(devices.devices.map((d) => [d.serial, d.osLabel, d.emulator]), [['iPhone 15@17.5', 'iOS 17.5', true]]);
    const doctor = await (await call('GET', '/api/mobile/doctor?platform=ios')).json();
    assert.equal(doctor.ready, true);
    assert.deepEqual(doctor.checks.map((c) => c.ok), [true, true, true, true]);
  });

  test('.ipa and .app.zip uploads are stored in apps/ and listed for iOS only; other types → 400', async () => {
    const put = (name) => fetch(`${harness.url}/api/mobile/builds/${name}`, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: Buffer.from('ipa') });
    assert.equal((await put('My-App.ipa')).status, 201);
    assert.equal((await put('My-App.app.zip')).status, 201);
    assert.equal((await put('notes.zip')).status, 400);
    const ios = await (await call('GET', '/api/mobile/catalog?platform=ios')).json();
    assert.deepEqual(ios.apps.map((a) => a.name).sort(), ['My-App.app.zip', 'My-App.ipa']);
    const android = await (await call('GET', '/api/mobile/catalog?platform=android')).json();
    assert.deepEqual(android.apps, []);
    assert.equal((await call('DELETE', '/api/mobile/builds/My-App.ipa')).status, 200);
  });

  test('POST /api/mobile/run (ios): 400 for an undeclared device, 503 while the Mac is down or lacks XCUITest', async () => {
    const run = { platform: 'ios', specs: [SPEC], device: 'iPhone 15@17.5', app: { type: 'bundle', bundleId: 'com.apple.Preferences' } };
    assert.equal((await call('POST', '/api/mobile/run', { ...run, device: 'iPhone X@1.0' })).status, 400);
    fake.mode = 'nodriver';
    const noDriver = await call('POST', '/api/mobile/run', run);
    assert.equal(noDriver.status, 503);
    assert.match((await noDriver.json()).error, /XCUITest/);
    await call('PUT', '/api/mobile/ios/config', config({ port: 1 }));
    assert.equal((await call('POST', '/api/mobile/run', run)).status, 503);
    await call('PUT', '/api/mobile/ios/config', config());
    const state = await (await call('GET', '/api/mobile/state')).json();
    assert.equal(state.activeRun, null);
  });

  test('TC-3.5 AC-304 + EDGE-303: a run reaches the external Appium with XCUITest capabilities; a settings change mid-run is not applied', { timeout: 120000 }, async () => {
    fake.mode = 'ok';
    fake.sessions = [];
    const res = await call('POST', '/api/mobile/run', { platform: 'ios', specs: [SPEC], grep: '@smoke', device: 'iPhone 15@17.5', app: { type: 'bundle', bundleId: 'com.apple.Preferences' } });
    assert.equal(res.status, 202);
    const started = await res.json();
    runIds.push(started.id);
    assert.equal(started.command, `npx wdio run ./wdio.ios.conf.js --spec ${SPEC} --mochaOpts.grep @smoke`);
    assert.equal(JSON.stringify(started).includes('xcodeOrgId'), false);
    // EDGE-303: point the settings elsewhere while the run is starting.
    assert.equal((await call('PUT', '/api/mobile/ios/config', config({ port: 1 }))).status, 200);

    let last;
    for (let i = 0; i < 100; i += 1) {
      last = (await (await call('GET', '/api/mobile/state')).json()).lastRun;
      if (last?.id === started.id && last.status !== 'running') break;
      await sleep(1000);
    }
    assert.equal(last?.id, started.id);
    assert.equal(last.status, 'failed', 'the fake Appium has no device, so the session must fail');
    const real = fake.sessions.filter((c) => c['appium:deviceName'] !== 'dashboard-driver-probe');
    assert.ok(real.length >= 1, 'WDIO must create the session on the external Appium (TECH-301)');
    assert.equal(real[0].platformName, 'iOS');
    assert.equal(real[0]['appium:automationName'], 'XCUITest');
    assert.equal(real[0]['appium:deviceName'], 'iPhone 15');
    assert.equal(real[0]['appium:platformVersion'], '17.5');
    assert.equal(real[0]['appium:bundleId'], 'com.apple.Preferences');
    assert.equal(real[0]['appium:noReset'], true);
    assert.equal(real[0]['appium:app'], undefined);
    await call('PUT', '/api/mobile/ios/config', config());
  });
});
