/**
 * dashboard/services/mobileInspectorTarget.js
 * Turns an Inspector start request (same device/app fields as a Mobile App run) into Appium capabilities
 * and the Appium address: local Appium on Android, the Mac host on iOS (PLAN-25 P4, TECH-402).
 */
const { validateAndroidTarget, buildEnv } = require('./mobileRunOptions');
const { validateIosTarget } = require('./mobileIosRunOptions');
const { readIosConfig } = require('./mobileIosService');
const { buildAndroidCapabilities, appiumConnection } = require('../../core/native/androidCapabilities');
const { buildIosCapabilities, iosAppiumConnection } = require('../../core/native/iosCapabilities');

/** A little over the 10-minute idle close (REQ-402), so Appium never drops the session before we do. */
const NEW_COMMAND_TIMEOUT_S = 660;
const KEY_PATTERN = /^[\w-]{8,64}$/;

function badRequest(message) {
  return Object.assign(new Error(message), { status: 400 });
}

function validateKey(key) {
  const value = String(key || '');
  if (!KEY_PATTERN.test(value)) throw badRequest('Thiếu mã phiên Inspector hợp lệ.');
  return value;
}

function appLabel(app) {
  return app.appPackage || app.bundleId || app.path || app.url || '';
}

/** { platform, key, label, caps, connection } — `connection.local` is true when Appium may be started here. */
function buildInspectorTarget(input = {}, root) {
  const platform = String(input.platform || 'android');
  if (!['android', 'ios'].includes(platform)) throw badRequest('Nền tảng không hợp lệ.');
  const key = validateKey(input.key);

  if (platform === 'ios') {
    const config = readIosConfig(root);
    if (!config.host) throw badRequest('Chưa cấu hình Mac host trong Cấu hình hệ thống → Mobile / iOS.');
    const target = validateIosTarget(input, config);
    const env = buildEnv({ platform, ...target, noReset: true }, root);
    const conn = iosAppiumConnection(env);
    return {
      platform, key,
      label: { device: target.deviceName, app: appLabel(target.app) },
      caps: { ...buildIosCapabilities(env), 'appium:newCommandTimeout': NEW_COMMAND_TIMEOUT_S },
      connection: { local: false, url: `${conn.protocol}://${conn.hostname}:${conn.port}` },
    };
  }

  const target = validateAndroidTarget(input, root);
  // Inspector never wipes app data: noReset is forced, whatever the run form says.
  const env = { ...process.env, ...buildEnv({ platform, ...target, noReset: true }, root) };
  return {
    platform, key,
    label: { device: target.deviceName || target.udid || 'Android', app: appLabel(target.app) },
    caps: { ...buildAndroidCapabilities(env), 'appium:newCommandTimeout': NEW_COMMAND_TIMEOUT_S },
    connection: { local: true, ...appiumConnection(env) },
  };
}

module.exports = { buildInspectorTarget, validateKey, NEW_COMMAND_TIMEOUT_S };
