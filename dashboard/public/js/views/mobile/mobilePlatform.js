/**
 * dashboard/public/js/views/mobile/mobilePlatform.js
 * Platform-specific parts of the Mobile App form: Android ↔ iOS switch, app profiles (S-05),
 * the iOS app source field, and choosing "App đã cài" when apps/ has no APK (U-06).
 */
import { el } from './mobileRender.js';

const $ = (id) => document.getElementById(id);

const IOS_APP_HELP = {
  bundle: ['com.example.app', 'App đã cài sẵn trên simulator / iPhone.'],
  'mac-path': ['/Users/qa/Builds/MyApp.app', 'Đường dẫn trên máy Mac (.app, .ipa hoặc .zip). File trên máy này không tự sang Mac.'],
  url: ['https://ci.example.com/MyApp.ipa', 'Appium trên Mac tự tải app từ URL này.'],
};

/** Remembers the device of the platform being left and restores the one for `next`. */
export function swapPlatform(state, next) {
  if (state.platform === next) return false;
  state[state.platform === 'ios' ? 'iosDevice' : 'androidUdid'] = state.udid;
  state.platform = next;
  state.udid = (next === 'ios' ? state.iosDevice : state.androidUdid) || '';
  Object.assign(state, { catalog: null, devices: null, doctor: null, specs: new Set(), tag: '', suite: null, apk: '' });
  return true;
}

export function renderProfiles(select, profiles, platform) {
  const current = select.value;
  select.replaceChildren();
  const manual = el('option', '', profiles.length ? 'Nhập tay' : 'Chưa có hồ sơ (core/native/app-profiles.json)');
  manual.value = '';
  select.append(manual);
  profiles.forEach((p) => {
    const detail = platform === 'ios' ? p.bundleId || p.app : p.appPackage;
    const opt = el('option', '', `${p.name} · ${detail}`);
    opt.value = p.id;
    select.append(opt);
  });
  select.value = profiles.some((p) => p.id === current) ? current : '';
}

/** Fills the form from a profile; the user can still edit the fields afterwards. */
export function applyProfile(profile, platform) {
  if (!profile) return;
  if (platform === 'ios') {
    const mode = profile.bundleId ? 'bundle' : /^https?:/i.test(profile.app) ? 'url' : 'mac-path';
    document.querySelector(`input[name="mobile-ios-app-mode"][value="${mode}"]`).checked = true;
    $('mobile-ios-app-input').value = profile.bundleId || profile.app;
    return;
  }
  $('mobile-mode-installed').checked = true;
  $('mobile-package-input').value = profile.appPackage;
  $('mobile-activity-input').value = profile.appActivity || '';
}

export function renderIosAppField() {
  const mode = document.querySelector('input[name="mobile-ios-app-mode"]:checked')?.value || 'bundle';
  const [placeholder, help] = IOS_APP_HELP[mode];
  $('mobile-ios-app-input').placeholder = placeholder;
  $('mobile-ios-app-help').textContent = help;
}

/** After a catalog load: keep known specs selected, fill app defaults, and (U-06) prefer "App đã cài" with no APK. */
export function applyCatalog(state) {
  const known = new Set((state.catalog?.specs || []).map((s) => s.path));
  state.specs = new Set([...state.specs].filter((s) => known.has(s)));
  if (state.specs.size === 0 && known.size) state.specs = new Set(known);
  const defaults = state.catalog?.defaults || {};
  if (state.platform === 'ios') {
    if (!$('mobile-ios-app-input').value && defaults.bundleId) $('mobile-ios-app-input').value = defaults.bundleId;
    return;
  }
  if (!$('mobile-package-input').value && defaults.appPackage) {
    $('mobile-package-input').value = defaults.appPackage;
    $('mobile-activity-input').value = defaults.appActivity || '';
  }
  if (!state.prefsMode && !(state.catalog?.apps || []).length) $('mobile-mode-installed').checked = true;
}

/** Frame-1 banner for iOS: the configured Mac host or a prompt to set it up. */
export function renderIosHost(devices) {
  const host = devices?.host || '';
  $('mobile-ios-host').textContent = devices ? host || 'Chưa cấu hình Mac host' : 'Đang đọc cấu hình...';
  $('mobile-ios-host').classList.toggle('is-missing', Boolean(devices) && !host);
}
