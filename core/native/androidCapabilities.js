'use strict';

/**
 * Builds Appium UiAutomator2 capabilities for native Android testing from .env.
 * Real device: set ANDROID_UDID to the serial shown by `adb devices`.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

function readEnv(name, fallback = '', env = process.env) {
  const value = env[name];
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function resolveApkPath(rawPath) {
  if (!rawPath) return '';
  const absolute = path.resolve(process.cwd(), rawPath);
  if (!fs.existsSync(absolute)) {
    throw new Error(`[android] ANDROID_APP_PATH not found: ${absolute}`);
  }
  if (path.extname(absolute).toLowerCase() !== '.apk') {
    throw new Error(`[android] ANDROID_APP_PATH must point to an .apk file: ${absolute}`);
  }
  return absolute;
}

/** `env` defaults to process.env; the Dashboard Inspector passes the values picked on screen (P4). */
function buildAndroidCapabilities(env = process.env) {
  const read = (name, fallback) => readEnv(name, fallback, env);
  const apkPath = resolveApkPath(read('ANDROID_APP_PATH'));
  const appPackage = read('ANDROID_APP_PACKAGE');
  const appActivity = read('ANDROID_APP_ACTIVITY');

  if (!apkPath && !appPackage) {
    throw new Error('[android] Set ANDROID_APP_PATH (APK) or ANDROID_APP_PACKAGE (already installed app) in .env');
  }

  const caps = {
    platformName: 'Android',
    'appium:automationName': 'UiAutomator2',
    'appium:newCommandTimeout': 240,
    'appium:autoGrantPermissions': read('ANDROID_AUTO_GRANT_PERMISSIONS', 'true') === 'true',
    // Pre-installed app (no APK): keep its data by default; `pm clear` is refused for system apps.
    'appium:noReset': read('ANDROID_NO_RESET', apkPath ? 'false' : 'true') === 'true',
    // With noReset, Appium skips the launch when the app already runs in the background ("is already running
    // and noReset is enabled") and the test sees the launcher. Always bring the app to the front; data is kept.
    'appium:forceAppLaunch': true,
    'appium:adbExecTimeout': 60000,
    // OPPO/Xiaomi/Vivo show an on-device "install via USB" prompt; give the tester time to approve it.
    'appium:androidInstallTimeout': 180000,
    'appium:uiautomator2ServerInstallTimeout': 120000,
  };

  const udid = read('ANDROID_UDID');
  if (udid) caps['appium:udid'] = udid;
  if (apkPath) caps['appium:app'] = apkPath;
  if (appPackage) caps['appium:appPackage'] = appPackage;
  if (appActivity) caps['appium:appActivity'] = appActivity;

  return caps;
}

function appiumConnection(env = process.env) {
  return {
    hostname: readEnv('APPIUM_HOST', '127.0.0.1', env),
    port: Number(readEnv('APPIUM_PORT', '4723', env)),
    useExternalServer: readEnv('APPIUM_EXTERNAL', 'false', env) === 'true',
  };
}

module.exports = { buildAndroidCapabilities, appiumConnection, resolveApkPath };
