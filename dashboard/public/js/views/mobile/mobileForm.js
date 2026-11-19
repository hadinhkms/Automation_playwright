/**
 * dashboard/public/js/views/mobile/mobileForm.js
 * Reads the Mobile App run form for Android or iOS, explains why a run is blocked, and keeps per-browser preferences.
 */

const PREFS_KEY = 'dashboard_mobile_prefs';
const $ = (id) => document.getElementById(id);
const checked = (name) => document.querySelector(`input[name="${name}"]:checked`)?.value;

function readIosApp() {
  const type = checked('mobile-ios-app-mode') || 'bundle';
  const value = $('mobile-ios-app-input').value.trim();
  if (type === 'bundle') return { type, bundleId: value };
  return type === 'url' ? { type, url: value } : { type, path: value };
}

export function readFormOptions(state) {
  const device = (state.devices?.devices || []).find((d) => d.serial === state.udid);
  const common = { platform: state.platform, specs: [...state.specs], grep: state.tag, noReset: $('mobile-noreset').checked, suite: state.suite || undefined };
  if (state.platform === 'ios') return { ...common, device: state.udid, deviceName: device?.model || '', app: readIosApp() };
  const app = (checked('mobile-app-mode') || 'apk') === 'apk'
    ? { type: 'apk', path: $('mobile-apk-select')?.value || '' }
    : { type: 'installed', appPackage: $('mobile-package-input').value.trim(), appActivity: $('mobile-activity-input').value.trim() };
  return { ...common, udid: state.udid, deviceName: device?.model || '', app };
}

/** iOS: the Run button stays locked until the Mac host answers (frame-1 checks, A3). */
function iosBlocker(state, opts) {
  const checks = state.doctor?.checks || [];
  if (!state.doctor) return 'Đang kiểm tra Mac host...';
  const failing = checks.slice(0, 3).find((c) => !c.ok);
  if (failing) return `${failing.label}: ${failing.hint}`;
  if (!state.udid) return 'Chưa khai báo thiết bị iOS trong Cấu hình hệ thống → Mobile / iOS.';
  const v = opts.app.bundleId ?? opts.app.path ?? opts.app.url;
  if (!v) return 'Nhập bundle id, đường dẫn app trên Mac hoặc URL tải app.';
  return '';
}

/** Returns the reason the Run button is disabled, or '' when a run can start. */
export function runBlocker(state, opts) {
  if (state.webBusy) return 'Đang có lượt chạy Playwright ở tab Chạy test.';
  if (state.inspectorBusy) return 'Inspector đang mở. Đóng phiên Inspector trước khi chạy test.';
  if (state.platform === 'ios') {
    const why = iosBlocker(state, opts);
    if (why) return why;
  } else {
    if (!state.udid) return 'Chưa có thiết bị sẵn sàng.';
    if (opts.app.type === 'apk' && !opts.app.path) return 'Đặt file .apk vào thư mục apps/ hoặc chọn "App đã cài trên máy".';
    if (opts.app.type === 'installed' && !opts.app.appPackage) return 'Nhập package của app (ví dụ com.example.app).';
  }
  if (opts.specs.length === 0) return 'Chọn ít nhất một file test.';
  if (state.catalog && state.catalog.configReady === false) return `Thiếu file ${state.catalog.configFile} trong repo.`;
  return '';
}

/** Mirrors mobileRunOptions.displayCommand on the server. */
export function commandPreview(opts) {
  const parts = [`npx wdio run ./wdio.${opts.platform === 'ios' ? 'ios' : 'android'}.conf.js`, ...opts.specs.map((sp) => `--spec ${sp}`)];
  if (opts.grep) parts.push(`--mochaOpts.grep ${opts.grep}`);
  return parts.join(' ');
}

function readPrefs() {
  try { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') || {}; } catch (_) { return {}; }
}

/** Restores the last platform and both platforms' app fields (one browser only; team defaults live in app profiles). */
export function loadPrefs(state) {
  const p = readPrefs();
  if (p.platform === 'ios' || p.platform === 'android') state.platform = p.platform;
  if (p.udid) state.udid = p.udid;
  state.iosDevice = p.ios?.device || '';
  if (p.mode === 'installed') $('mobile-mode-installed').checked = true;
  $('mobile-package-input').value = p.appPackage || '';
  $('mobile-activity-input').value = p.appActivity || '';
  const mode = document.querySelector(`input[name="mobile-ios-app-mode"][value="${p.ios?.mode}"]`);
  if (mode) mode.checked = true;
  $('mobile-ios-app-input').value = p.ios?.value || '';
  state.prefsMode = p.mode || '';
}

export function savePrefs(state) {
  try {
    const p = readPrefs();
    const ios = state.platform === 'ios'
      ? { device: state.udid, mode: checked('mobile-ios-app-mode'), value: $('mobile-ios-app-input').value.trim() }
      : p.ios;
    const android = state.platform === 'android'
      ? { udid: state.udid, mode: checked('mobile-app-mode'), appPackage: $('mobile-package-input').value.trim(), appActivity: $('mobile-activity-input').value.trim() }
      : { udid: p.udid, mode: p.mode, appPackage: p.appPackage, appActivity: p.appActivity };
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...android, platform: state.platform, ios }));
  } catch (_) {}
}
