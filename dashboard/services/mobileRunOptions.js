/**
 * dashboard/services/mobileRunOptions.js
 * Validates a Mobile App run request and turns it into a WDIO command + environment.
 */
const path = require('path');
const { PLATFORMS, listNativeSpecs, listApps } = require('./mobileSpecService');
const { SERIAL_PATTERN } = require('./mobileDeviceService');
const { readIosConfig } = require('./mobileIosService');
const { validateIosTarget, buildIosEnv } = require('./mobileIosRunOptions');

const TAG_PATTERN = /^@[\w-]{1,40}$/;
const PACKAGE_PATTERN = /^[A-Za-z][\w]*(\.[A-Za-z_][\w]*)+$/;
const ACTIVITY_PATTERN = /^\.?[A-Za-z_][\w$]*(\.[A-Za-z_][\w$]*)*$/;

function badRequest(message) {
  return Object.assign(new Error(message), { status: 400 });
}

function validateApp(input, root) {
  const app = input && typeof input === 'object' ? input : {};
  if (app.type === 'apk') {
    const known = listApps(root, 'android').map((a) => a.path);
    if (!known.includes(app.path)) throw badRequest('File APK không có trong thư mục apps/.');
    return { type: 'apk', path: app.path };
  }
  if (app.type === 'installed') {
    const appPackage = String(app.appPackage || '').trim();
    const appActivity = String(app.appActivity || '').trim();
    if (!PACKAGE_PATTERN.test(appPackage) || appPackage.length > 120) throw badRequest('Package name không hợp lệ (ví dụ: com.example.app).');
    if (appActivity && (!ACTIVITY_PATTERN.test(appActivity) || appActivity.length > 160)) throw badRequest('Activity không hợp lệ (ví dụ: .MainActivity).');
    return { type: 'installed', appPackage, appActivity };
  }
  throw badRequest('Chọn file APK hoặc nhập package của app đã cài.');
}

const SUITE_ID_PATTERN = /^[\w.-]{1,50}$/;

/** Free text shown in history only: strip control characters, cap length. */
function cleanLabel(value, max) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

/** Optional link to the Test Suite that started the run (AC-206). */
function validateSuite(input) {
  if (input == null) return null;
  const id = String(input.id || '');
  if (!SUITE_ID_PATTERN.test(id)) throw badRequest('Mã Test Suite không hợp lệ.');
  return { id, label: cleanLabel(input.label, 50) || id };
}

function validateAndroidTarget(input, root) {
  const udid = String(input.udid || '').trim();
  if (udid && !SERIAL_PATTERN.test(udid)) throw badRequest('Serial thiết bị không hợp lệ.');
  return { udid, deviceName: cleanLabel(input.deviceName, 80), app: validateApp(input.app, root) };
}

function validateMobileOptions(input = {}, root) {
  const platform = String(input.platform || 'android');
  if (!PLATFORMS[platform]) throw badRequest('Nền tảng không hợp lệ.');

  const known = listNativeSpecs(root, platform).map((s) => s.path);
  if (known.length === 0) throw badRequest(`Chưa có test native nào trong ${PLATFORMS[platform].specDirs.join('/ hoặc ')}/.`);
  const specs = Array.isArray(input.specs) ? [...new Set(input.specs.map(String))] : [];
  if (specs.length === 0) throw badRequest('Chọn ít nhất một file test.');
  const unknown = specs.filter((s) => !known.includes(s));
  if (unknown.length) throw badRequest(`File test không tồn tại: ${unknown[0]}`);

  const grep = String(input.grep || '').trim();
  if (grep && !TAG_PATTERN.test(grep)) throw badRequest('Tag phải có dạng @ten-tag.');

  const target = platform === 'ios' ? validateIosTarget(input, readIosConfig(root)) : validateAndroidTarget(input, root);
  return { platform, specs, grep, ...target, noReset: input.noReset === true, suite: validateSuite(input.suite) };
}

function buildArgs(options) {
  const args = ['run', `./${PLATFORMS[options.platform].config}`];
  options.specs.forEach((spec) => args.push('--spec', spec));
  if (options.grep) args.push('--mochaOpts.grep', options.grep);
  return args;
}

/** Environment for the WDIO child. iOS reads the saved Mac host now, so later edits never touch a running run (EDGE-303). */
function buildEnv(options, root) {
  if (options.platform === 'ios') return buildIosEnv(options, readIosConfig(root));
  const { app } = options;
  return {
    ANDROID_UDID: options.udid,
    ANDROID_APP_PATH: app.type === 'apk' ? path.join(root, app.path) : '',
    ANDROID_APP_PACKAGE: app.type === 'installed' ? app.appPackage : '',
    ANDROID_APP_ACTIVITY: app.type === 'installed' ? app.appActivity : '',
    ANDROID_NO_RESET: String(options.noReset || app.type === 'installed'),
    FORCE_COLOR: '0',
  };
}

function displayCommand(options) {
  return `npx wdio ${buildArgs(options).join(' ')}`;
}

module.exports = { validateMobileOptions, buildArgs, buildEnv, displayCommand, TAG_PATTERN, PACKAGE_PATTERN };
