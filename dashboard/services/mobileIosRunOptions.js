/**
 * dashboard/services/mobileIosRunOptions.js
 * iOS part of a Mobile App run request: device from the declared list, app location on the Mac (TECH-303).
 * Appium runs on the Mac, so a file on this Windows machine is never sent; only a Mac path, URL or bundle id.
 */
const { MAC_PATH_PATTERN, URL_PATTERN, PACKAGE_PATTERN } = require('./mobileAppProfiles');
const { deviceKey } = require('./mobileIosService');

function badRequest(message) {
  return Object.assign(new Error(message), { status: 400 });
}

function validateIosApp(input) {
  const app = input && typeof input === 'object' ? input : {};
  if (app.type === 'bundle') {
    const bundleId = String(app.bundleId || '').trim();
    if (!PACKAGE_PATTERN.test(bundleId) || bundleId.length > 155) throw badRequest('Bundle id không hợp lệ (ví dụ com.example.app).');
    return { type: 'bundle', bundleId };
  }
  if (app.type === 'mac-path') {
    const macPath = String(app.path || '').trim();
    if (!MAC_PATH_PATTERN.test(macPath)) throw badRequest('Đường dẫn trên Mac phải bắt đầu bằng / và kết thúc bằng .app, .ipa hoặc .zip.');
    return { type: 'mac-path', path: macPath };
  }
  if (app.type === 'url') {
    const url = String(app.url || '').trim();
    if (!URL_PATTERN.test(url)) throw badRequest('URL tải app phải là http(s)://… không có khoảng trắng.');
    return { type: 'url', url };
  }
  throw badRequest('Chọn app iOS: bundle id đã cài, đường dẫn trên Mac hoặc URL tải về.');
}

/** The device must be one declared in Settings (IOS_DEVICES); the client only sends its key. */
function validateIosDevice(rawKey, config) {
  const key = String(rawKey || '').trim();
  const device = (config.devices || []).find((d) => deviceKey(d) === key);
  if (!device) throw badRequest(config.devices?.length ? 'Chọn một thiết bị iOS đã khai báo.' : 'Chưa khai báo thiết bị iOS nào trong Cấu hình hệ thống → Mobile / iOS.');
  return device;
}

function validateIosTarget(input, config) {
  const device = validateIosDevice(input.device, config);
  return { device, deviceName: device.name, udid: device.udid, app: validateIosApp(input.app) };
}

/** Environment for wdio.ios.conf.js; every key is set so stale .env values never leak into a run. */
function buildIosEnv(options, config) {
  const { app, device } = options;
  return {
    IOS_APPIUM_HOST: config.host,
    IOS_APPIUM_PORT: String(config.port),
    IOS_DEVICE_NAME: device.name,
    IOS_PLATFORM_VERSION: device.platformVersion,
    IOS_UDID: device.udid || '',
    IOS_SIMULATOR: String(device.simulator !== false),
    IOS_APP: app.type === 'mac-path' ? app.path : app.type === 'url' ? app.url : '',
    IOS_BUNDLE_ID: app.type === 'bundle' ? app.bundleId : '',
    IOS_XCODE_ORG_ID: config.xcodeOrgId || '',
    IOS_WDA_BUNDLE_ID: config.wdaBundleId || '',
    IOS_NO_RESET: String(options.noReset || app.type === 'bundle'),
    FORCE_COLOR: '0',
  };
}

module.exports = { validateIosTarget, validateIosApp, validateIosDevice, buildIosEnv };
