/**
 * tests/dashboard-api/mobile.test.js
 * API contract for /api/mobile/* (Mobile App view, Android P1).
 * Covers 200 / 400 / 404 / 409 responses without starting a real Appium session.
 */
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { startDashboardHarness } = require('../dashboard/support/dashboardHarness');
const { createFixtureWorkspace } = require('../dashboard/support/fixtureWorkspace');

const SPEC = 'tests/native/android/launch.native.js';

describe('API Contract: Mobile App (/api/mobile/*)', () => {
  let fixture;
  let harness;

  before(async () => {
    fixture = createFixtureWorkspace();
    const root = fixture.rootPath;
    fs.mkdirSync(path.join(root, 'tests/native/android'), { recursive: true });
    fs.writeFileSync(path.join(root, SPEC), "describe('@smoke Launch', () => { it('TC-1 opens', () => {}); });");
    fs.writeFileSync(path.join(root, 'wdio.android.conf.js'), 'exports.config = {};');
    harness = await startDashboardHarness(root);
  });

  after(async () => {
    if (harness) await harness.stop();
    if (fixture) fixture.cleanup();
  });

  const post = (p, body) => fetch(`${harness.url}${p}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

  test('GET /api/mobile/catalog lists native specs, tags and config readiness', async () => {
    const res = await fetch(`${harness.url}/api/mobile/catalog?platform=android`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.platform, 'android');
    assert.equal(body.configReady, true);
    assert.deepEqual(body.specs.map((s) => s.path), [SPEC]);
    assert.deepEqual(body.tags, ['@smoke']);
    assert.ok(Array.isArray(body.apps));
  });

  test('GET /api/mobile/catalog rejects unsupported platforms with 400', async () => {
    // iOS became a supported platform in P3 (tests/dashboard-api/mobile-ios.test.js); unknown ones stay 400.
    const res = await fetch(`${harness.url}/api/mobile/catalog?platform=windows`);
    assert.equal(res.status, 400);
  });

  test('GET /api/mobile/devices returns 200 with a device list or an actionable error', async () => {
    const res = await fetch(`${harness.url}/api/mobile/devices`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(typeof body.available, 'boolean');
    assert.ok(Array.isArray(body.devices));
    if (!body.available) assert.ok(body.error.length > 0);
  });

  test('GET /api/mobile/doctor returns 200 with all toolchain checks', async () => {
    const res = await fetch(`${harness.url}/api/mobile/doctor`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body.checks.map((c) => c.id), ['adb', 'android-home', 'java', 'appium', 'uiautomator2']);
    assert.equal(typeof body.ready, 'boolean');
  });

  test('GET /api/mobile/state returns an idle snapshot', async () => {
    const res = await fetch(`${harness.url}/api/mobile/state`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.activeRun, null);
    assert.ok(Array.isArray(body.logs));
  });

  const badRuns = [
    ['malformed JSON', '{"platform":', /JSON/],
    ['an Android-only spec on iOS', { platform: 'ios', specs: [SPEC] }, /tests\/native\/ios/],
    ['unknown spec', { specs: ['tests/native/android/missing.native.js'], app: { type: 'installed', appPackage: 'com.a.b' } }, /không tồn tại/],
    ['path traversal spec', { specs: ['../../package.json'], app: { type: 'installed', appPackage: 'com.a.b' } }, /không tồn tại/],
    ['shell metacharacters in tag', { specs: [SPEC], grep: '@a && calc', app: { type: 'installed', appPackage: 'com.a.b' } }, /Tag/],
    ['APK not in apps/', { specs: [SPEC], app: { type: 'apk', path: 'apps/none.apk' } }, /APK/],
  ];
  for (const [name, body, pattern] of badRuns) {
    test(`POST /api/mobile/run rejects ${name} with 400 and starts nothing`, async () => {
      const res = await post('/api/mobile/run', body);
      assert.equal(res.status, 400);
      assert.match((await res.json()).error, pattern);
      const state = await (await fetch(`${harness.url}/api/mobile/state`)).json();
      assert.equal(state.activeRun, null);
    });
  }

  test('POST /api/mobile/stop returns 409 when nothing is running', async () => {
    const res = await post('/api/mobile/stop', {});
    assert.equal(res.status, 409);
  });

  test('unknown /api/mobile route returns 404', async () => {
    const res = await fetch(`${harness.url}/api/mobile/unknown`);
    assert.equal(res.status, 404);
  });
});
