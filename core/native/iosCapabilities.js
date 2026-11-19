'use strict';

/**
 * Appium XCUITest capabilities and connection for native iOS tests on a remote Mac (PLAN-25 P3).
 * Appium iOS only runs on macOS, so WDIO always connects to IOS_APPIUM_HOST:IOS_APPIUM_PORT (TECH-301).
 * The app must be readable by the Mac: a path on the Mac, an http(s) URL, or the bundle id of an installed app (TECH-303).
 */

require('dotenv').config();

function readEnv(env, name, fallback = '') {
  const value = env[name];
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

/** IOS_DEVICE_NAME / IOS_PLATFORM_VERSION / IOS_UDID / IOS_SIMULATOR, or the first entry of IOS_DEVICES. */
function pickDevice(env) {
  if (readEnv(env, 'IOS_DEVICE_NAME')) {
    return {
      name: readEnv(env, 'IOS_DEVICE_NAME'),
      platformVersion: readEnv(env, 'IOS_PLATFORM_VERSION'),
      udid: readEnv(env, 'IOS_UDID'),
      simulator: readEnv(env, 'IOS_SIMULATOR', 'true') !== 'false',
    };
  }
  let list = [];
  try { list = JSON.parse(readEnv(env, 'IOS_DEVICES', '[]')); } catch (_) {
    throw new Error('[ios] IOS_DEVICES is not valid JSON');
  }
  const first = Array.isArray(list) ? list[0] : null;
  if (!first?.name) return null;
  return { name: first.name, platformVersion: String(first.platformVersion || ''), udid: first.udid || '', simulator: first.simulator !== false };
}

function buildIosCapabilities(env = process.env) {
  const device = pickDevice(env);
  if (!device) throw new Error('[ios] Declare a device: IOS_DEVICES in .env (or IOS_DEVICE_NAME + IOS_PLATFORM_VERSION)');
  const app = readEnv(env, 'IOS_APP');
  const bundleId = readEnv(env, 'IOS_BUNDLE_ID');
  if (!app && !bundleId) throw new Error('[ios] Set IOS_APP (path on the Mac or http(s) URL) or IOS_BUNDLE_ID (installed app)');
  if (!device.simulator && !device.udid) throw new Error('[ios] A real iPhone needs its UDID (IOS_UDID or "udid" in IOS_DEVICES)');

  const caps = {
    platformName: 'iOS',
    'appium:automationName': 'XCUITest',
    'appium:deviceName': device.name,
    'appium:newCommandTimeout': 240,
    // Installed app (bundle id only): keep its data by default, like Android "App đã cài".
    'appium:noReset': readEnv(env, 'IOS_NO_RESET', app ? 'false' : 'true') === 'true',
    // First run builds WebDriverAgent on the Mac; give it time.
    'appium:wdaLaunchTimeout': 240000,
    'appium:wdaConnectionTimeout': 240000,
  };
  if (device.platformVersion) caps['appium:platformVersion'] = device.platformVersion;
  if (device.udid) caps['appium:udid'] = device.udid;
  if (app) caps['appium:app'] = app;
  if (bundleId) caps['appium:bundleId'] = bundleId;

  if (!device.simulator) {
    // BR-302: signing uses Team ID + bundle id only; no Apple ID password anywhere.
    const teamId = readEnv(env, 'IOS_XCODE_ORG_ID');
    if (teamId) {
      caps['appium:xcodeOrgId'] = teamId;
      caps['appium:xcodeSigningId'] = 'Apple Development';
    }
    const wdaBundleId = readEnv(env, 'IOS_WDA_BUNDLE_ID');
    if (wdaBundleId) caps['appium:updatedWDABundleId'] = wdaBundleId;
  }
  return caps;
}

/** { protocol, hostname, port, path } for WDIO; throws while the Mac host is not configured. */
function iosAppiumConnection(env = process.env) {
  const raw = readEnv(env, 'IOS_APPIUM_HOST');
  if (!raw) throw new Error('[ios] IOS_APPIUM_HOST is empty. Set it to http://<mac-ip> (see docs/IOS_NATIVE_TESTING.md)');
  let url;
  try { url = new URL(raw); } catch (_) { throw new Error(`[ios] IOS_APPIUM_HOST is not a URL: ${raw}`); }
  if (!/^https?:$/.test(url.protocol)) throw new Error('[ios] IOS_APPIUM_HOST must start with http:// or https://');
  return {
    protocol: url.protocol.replace(':', ''),
    hostname: url.hostname,
    port: Number(url.port || readEnv(env, 'IOS_APPIUM_PORT', '4723')),
    path: '/',
  };
}

module.exports = { buildIosCapabilities, iosAppiumConnection, pickDevice };
