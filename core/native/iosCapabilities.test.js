'use strict';

/**
 * core/native/iosCapabilities.test.js
 * PLAN-25 P3 AC-304 (TC-3.5): XCUITest capabilities and the external Appium connection built from IOS_* values.
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { buildIosCapabilities, iosAppiumConnection } = require('./iosCapabilities');

const SIM_ENV = { IOS_DEVICE_NAME: 'iPhone 15', IOS_PLATFORM_VERSION: '17.5', IOS_SIMULATOR: 'true', IOS_BUNDLE_ID: 'com.apple.Preferences' };

describe('buildIosCapabilities', () => {
  test('simulator + installed app: XCUITest caps, bundle id, noReset on, no signing caps', () => {
    const caps = buildIosCapabilities({ ...SIM_ENV, IOS_XCODE_ORG_ID: 'AB12CD34EF' });
    assert.equal(caps.platformName, 'iOS');
    assert.equal(caps['appium:automationName'], 'XCUITest');
    assert.equal(caps['appium:deviceName'], 'iPhone 15');
    assert.equal(caps['appium:platformVersion'], '17.5');
    assert.equal(caps['appium:bundleId'], 'com.apple.Preferences');
    assert.equal(caps['appium:noReset'], true);
    assert.equal(caps['appium:app'], undefined);
    assert.equal(caps['appium:xcodeOrgId'], undefined, 'simulators need no signing');
  });

  test('real iPhone + app on the Mac: udid, app, signing with Team ID and WDA bundle id', () => {
    const caps = buildIosCapabilities({
      IOS_DEVICES: JSON.stringify([{ name: 'QA iPhone', platformVersion: '17.4', udid: '00008110-001A2B3C4D5E6F70', simulator: false }]),
      IOS_APP: '/Users/qa/Builds/My.app', IOS_XCODE_ORG_ID: 'AB12CD34EF', IOS_WDA_BUNDLE_ID: 'com.acme.WebDriverAgentRunner',
    });
    assert.equal(caps['appium:udid'], '00008110-001A2B3C4D5E6F70');
    assert.equal(caps['appium:app'], '/Users/qa/Builds/My.app');
    assert.equal(caps['appium:noReset'], false);
    assert.equal(caps['appium:xcodeOrgId'], 'AB12CD34EF');
    assert.equal(caps['appium:updatedWDABundleId'], 'com.acme.WebDriverAgentRunner');
    assert.equal(Object.keys(caps).some((k) => /password/i.test(k)), false, 'BR-302');
  });

  test('explains what is missing', () => {
    assert.throws(() => buildIosCapabilities({ IOS_BUNDLE_ID: 'com.a.b' }), /Declare a device/);
    assert.throws(() => buildIosCapabilities({ IOS_DEVICE_NAME: 'iPhone 15' }), /IOS_APP .* or IOS_BUNDLE_ID/);
    assert.throws(() => buildIosCapabilities({ ...SIM_ENV, IOS_SIMULATOR: 'false' }), /UDID/);
    assert.throws(() => buildIosCapabilities({ IOS_DEVICES: '[oops', IOS_BUNDLE_ID: 'com.a.b' }), /not valid JSON/);
  });
});

describe('iosAppiumConnection (TECH-301)', () => {
  test('uses the Mac host and port; a port in the URL wins', () => {
    assert.deepEqual(iosAppiumConnection({ IOS_APPIUM_HOST: 'http://192.168.1.20', IOS_APPIUM_PORT: '4724' }),
      { protocol: 'http', hostname: '192.168.1.20', port: 4724, path: '/' });
    assert.equal(iosAppiumConnection({ IOS_APPIUM_HOST: 'https://mac.local:4800' }).port, 4800);
    assert.equal(iosAppiumConnection({ IOS_APPIUM_HOST: 'http://mac.local' }).port, 4723);
  });

  test('refuses an empty or non-http host', () => {
    assert.throws(() => iosAppiumConnection({}), /IOS_APPIUM_HOST is empty/);
    assert.throws(() => iosAppiumConnection({ IOS_APPIUM_HOST: 'ftp://mac' }), /http/);
  });
});
