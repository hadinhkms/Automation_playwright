/**
 * dashboard/services/mobileInspectorTarget.test.js
 * PLAN-25 P4: Inspector start request → Appium capabilities and address, Android (local Appium) and
 * iOS (Mac host from .env). iOS on a real Mac is BLOCKED (chờ Mac); this checks the request that would be sent.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildInspectorTarget } = require('./mobileInspectorTarget');

const KEY = 'tab-aaaaaaaa';

function tempRoot(env) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'insp-target-'));
  fs.writeFileSync(path.join(root, '.env'), env);
  return root;
}

test('iOS: Mac host and declared simulator become XCUITest capabilities; Appium is never started locally', () => {
  const root = tempRoot('IOS_APPIUM_HOST=http://192.168.1.20\nIOS_APPIUM_PORT=4723\nIOS_DEVICES=[{"name":"iPhone 15","platformVersion":"17.5","simulator":true}]\n');
  try {
    const t = buildInspectorTarget({ key: KEY, platform: 'ios', device: 'iPhone 15@17.5', app: { type: 'bundle', bundleId: 'com.apple.Preferences' } }, root);
    assert.equal(t.connection.local, false);
    assert.equal(t.connection.url, 'http://192.168.1.20:4723');
    assert.equal(t.caps.platformName, 'iOS');
    assert.equal(t.caps['appium:automationName'], 'XCUITest');
    assert.equal(t.caps['appium:bundleId'], 'com.apple.Preferences');
    assert.equal(t.caps['appium:newCommandTimeout'], 660);
    assert.deepEqual(t.label, { device: 'iPhone 15', app: 'com.apple.Preferences' });
    assert.throws(() => buildInspectorTarget({ key: KEY, platform: 'ios', device: 'iPhone 99@1', app: { type: 'bundle', bundleId: 'a.b' } }, root), (e) => e.status === 400);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('iOS without a Mac host is a 400 with the place to fix it', () => {
  const root = tempRoot('IOS_APPIUM_HOST=\n');
  try {
    assert.throws(() => buildInspectorTarget({ key: KEY, platform: 'ios', device: 'x', app: { type: 'bundle', bundleId: 'a.b' } }, root), /Mac host/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('Android: installed app with forced launch and kept data; local Appium address', () => {
  const root = tempRoot('');
  try {
    const t = buildInspectorTarget({ key: KEY, platform: 'android', udid: '6XPNHY9DVCUCR4OB', deviceName: 'CPH2481', app: { type: 'installed', appPackage: 'com.vieclam24h.qa', appActivity: 'com.vieclam24h.MainActivity' } }, root);
    assert.equal(t.connection.local, true);
    assert.equal(t.caps['appium:appPackage'], 'com.vieclam24h.qa');
    assert.equal(t.caps['appium:udid'], '6XPNHY9DVCUCR4OB');
    assert.equal(t.caps['appium:noReset'], true);
    assert.equal(t.caps['appium:forceAppLaunch'], true);
    assert.deepEqual(t.label, { device: 'CPH2481', app: 'com.vieclam24h.qa' });
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
