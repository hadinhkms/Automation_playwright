/**
 * dashboard/services/mobileRunOptions.js
 * Validates a Mobile App run request and turns it into a WDIO command + environment.
 */
const path = require('path');
const { PLATFORMS, listNativeSpecs, listApps } = require('./mobileSpecService');
const { SERIAL_PATTERN } = require('./mobileDeviceService');

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

function validateMobileOptions(input = {}, root) {
  const platform = String(input.platform || 'android');
  if (platform === 'ios') throw badRequest('iOS chưa được hỗ trợ ở giai đoạn này.');
  if (!PLATFORMS[platform]) throw badRequest('Nền tảng không hợp lệ.');

  const known = listNativeSpecs(root, platform).map((s) => s.path);
  if (known.length === 0) throw badRequest(`Chưa có test native nào trong ${PLATFORMS[platform].specDir}/.`);
  const specs = Array.isArray(input.specs) ? [...new Set(input.specs.map(String))] : [];
  if (specs.length === 0) throw badRequest('Chọn ít nhất một file test.');
  const unknown = specs.filter((s) => !known.includes(s));
  if (unknown.length) throw badRequest(`File test không tồn tại: ${unknown[0]}`);

  const grep = String(input.grep || '').trim();
  if (grep && !TAG_PATTERN.test(grep)) throw badRequest('Tag phải có dạng @ten-tag.');

  const udid = String(input.udid || '').trim();
  if (udid && !SERIAL_PATTERN.test(udid)) throw badRequest('Serial thiết bị không hợp lệ.');

  return { platform, specs, grep, udid, app: validateApp(input.app, root), noReset: input.noReset === true };
}

function buildArgs(options) {
  const args = ['run', `./${PLATFORMS[options.platform].config}`];
  options.specs.forEach((spec) => args.push('--spec', spec));
  if (options.grep) args.push('--mochaOpts.grep', options.grep);
  return args;
}

function buildEnv(options, root) {
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
