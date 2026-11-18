/**
 * dashboard/public/js/views/mobile/mobileForm.js
 * Reads the Mobile App run form, explains why a run is blocked, and keeps per-browser preferences.
 */

const PREFS_KEY = 'dashboard_mobile_prefs';
const $ = (id) => document.getElementById(id);

export function readFormOptions(state) {
  const mode = document.querySelector('input[name="mobile-app-mode"]:checked')?.value || 'apk';
  const app = mode === 'apk'
    ? { type: 'apk', path: $('mobile-apk-select')?.value || '' }
    : { type: 'installed', appPackage: $('mobile-package-input').value.trim(), appActivity: $('mobile-activity-input').value.trim() };
  const device = (state.devices?.devices || []).find((d) => d.serial === state.udid);
  return {
    platform: 'android', udid: state.udid, deviceName: device?.model || '', specs: [...state.specs], grep: state.tag,
    app, noReset: $('mobile-noreset').checked, suite: state.suite || undefined,
  };
}

/** Returns the reason the Run button is disabled, or '' when a run can start. */
export function runBlocker(state, opts) {
  if (state.platform !== 'android') return 'iOS chưa được hỗ trợ.';
  if (state.webBusy) return 'Đang có lượt chạy Playwright ở tab Chạy test.';
  if (!state.udid) return 'Chưa có thiết bị sẵn sàng.';
  if (opts.app.type === 'apk' && !opts.app.path) return 'Đặt file .apk vào thư mục apps/ hoặc chọn "App đã cài trên máy".';
  if (opts.app.type === 'installed' && !opts.app.appPackage) return 'Nhập package của app (ví dụ com.example.app).';
  if (opts.specs.length === 0) return 'Chọn ít nhất một file test.';
  if (state.catalog && state.catalog.configReady === false) return `Thiếu file ${state.catalog.configFile} trong repo.`;
  return '';
}

/** Mirrors mobileRunOptions.displayCommand on the server. */
export function commandPreview(opts) {
  const parts = ['npx wdio run ./wdio.android.conf.js', ...opts.specs.map((sp) => `--spec ${sp}`)];
  if (opts.grep) parts.push(`--mochaOpts.grep ${opts.grep}`);
  return parts.join(' ');
}

export function loadPrefs(state) {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
    if (p.udid) state.udid = p.udid;
    if (p.mode === 'installed') $('mobile-mode-installed').checked = true;
    $('mobile-package-input').value = p.appPackage || '';
    $('mobile-activity-input').value = p.appActivity || '';
  } catch (_) {}
}

export function savePrefs(state) {
  try {
    const o = readFormOptions(state);
    localStorage.setItem(PREFS_KEY, JSON.stringify({ udid: state.udid, mode: o.app.type, appPackage: o.app.appPackage || '', appActivity: o.app.appActivity || '' }));
  } catch (_) {}
}
