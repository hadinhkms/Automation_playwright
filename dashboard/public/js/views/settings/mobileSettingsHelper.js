/**
 * dashboard/public/js/views/settings/mobileSettingsHelper.js
 * Settings → Mobile / iOS: Mac host, declared iOS devices, default app and WDA signing (PLAN-25 P3, REQ-301/302).
 * The server validates everything (BR-301); this module only collects the form and shows results.
 * Team ID is never written to the browser console (NFR B5).
 */
import { apiClient } from '../../core/apiClient.js';
import { eventBus } from '../../core/eventBus.js';

const $ = (id) => document.getElementById(id);
const MAX_DEVICES = 10;
let busy = false;

function el(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function input(type, value, attrs) {
  const node = el('input');
  node.type = type;
  if (type === 'checkbox') node.checked = Boolean(value); else node.value = value || '';
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
  return node;
}

function deviceRow(device = { simulator: true }) {
  const row = el('div', 'settings-ios-device');
  row.append(
    input('text', device.name, { 'data-field': 'name', placeholder: 'iPhone 15', maxlength: '60', 'aria-label': 'Tên thiết bị' }),
    input('text', device.platformVersion, { 'data-field': 'platformVersion', placeholder: '17.5', maxlength: '8', 'aria-label': 'Phiên bản iOS' }),
    input('text', device.udid, { 'data-field': 'udid', placeholder: 'UDID (máy thật)', maxlength: '60', 'aria-label': 'UDID', spellcheck: 'false' }),
  );
  const sim = el('label', 'settings-ios-sim');
  sim.append(input('checkbox', device.simulator !== false, { 'data-field': 'simulator' }), document.createTextNode(' Simulator'));
  const remove = el('button', 'btn-icon-subtle');
  Object.assign(remove, { type: 'button', title: 'Xoá thiết bị' });
  remove.dataset.removeDevice = '1';
  remove.setAttribute('aria-label', 'Xoá thiết bị');
  remove.append(el('i', 'ph-bold ph-trash'));
  row.append(sim, remove);
  return row;
}

function renderDevices(devices) {
  const box = $('settings-ios-devices');
  box.replaceChildren();
  if (!devices.length) box.append(el('p', 'settings-note settings-ios-empty', 'Chưa khai báo thiết bị nào.'));
  devices.forEach((d) => box.append(deviceRow(d)));
  $('settings-ios-add-device').disabled = devices.length >= MAX_DEVICES;
}

function readDevices() {
  return [...document.querySelectorAll('#settings-ios-devices .settings-ios-device')].map((row) => {
    const get = (f) => row.querySelector(`[data-field="${f}"]`);
    return { name: get('name').value.trim(), platformVersion: get('platformVersion').value.trim(), udid: get('udid').value.trim(), simulator: get('simulator').checked };
  }).filter((d) => d.name || d.platformVersion || d.udid);
}

function readForm() {
  return {
    host: $('settings-ios-host').value.trim(),
    port: Number($('settings-ios-port').value || 4723),
    devices: readDevices(),
    app: $('settings-ios-app').value.trim(),
    bundleId: $('settings-ios-bundle').value.trim(),
    xcodeOrgId: $('settings-ios-team').value.trim(),
    wdaBundleId: $('settings-ios-wda').value.trim(),
  };
}

function fillForm(cfg) {
  $('settings-ios-host').value = cfg.host || '';
  $('settings-ios-port').value = cfg.port || 4723;
  $('settings-ios-app').value = cfg.app || '';
  $('settings-ios-bundle').value = cfg.bundleId || '';
  $('settings-ios-team').value = cfg.xcodeOrgId || '';
  $('settings-ios-wda').value = cfg.wdaBundleId || '';
  renderDevices(cfg.devices || []);
}

function setBadge(state, text) {
  const badge = $('settings-ios-badge');
  badge.className = `settings-badge-status${state ? ` is-${state}` : ''}`;
  badge.replaceChildren(el('i', 'ph-fill ph-circle'), document.createTextNode(` ${text}`));
}

function showResult(kind, title, lines) {
  const box = $('settings-ios-result');
  box.hidden = false;
  box.className = `wide settings-ios-result is-${kind}`;
  box.replaceChildren(el('strong', '', title), ...lines.filter(Boolean).map((l) => el('p', '', l)));
}

async function check() {
  if (busy) return;
  busy = true;
  $('settings-ios-check').disabled = true;
  setBadge('', 'Đang kiểm tra...');
  try {
    const r = await apiClient.post('/api/mobile/ios/check', readForm());
    if (!r.configured) { setBadge('', 'Chưa cấu hình'); showResult('warn', 'Chưa nhập địa chỉ Mac', [r.error]); return; }
    if (!r.reachable) { setBadge('error', 'Không kết nối được'); showResult('error', 'Không kết nối được', [r.error]); return; }
    setBadge(r.xcuitest === true ? 'ok' : 'warn', 'Kết nối được');
    const driver = r.xcuitest === true ? 'Driver XCUITest: có' : r.warning;
    showResult(r.xcuitest === true ? 'ok' : 'warn', 'Kết nối được', [`Appium ${r.appiumVersion || '(không rõ phiên bản)'} · phản hồi ${r.latencyMs} ms`, driver]);
  } catch (err) {
    setBadge('error', 'Dữ liệu không hợp lệ');
    showResult('error', 'Không kiểm tra được', [err.message]);
  } finally {
    busy = false;
    if ($('settings-ios-check')) $('settings-ios-check').disabled = false;
  }
}

async function save() {
  try {
    const cfg = await apiClient.put('/api/mobile/ios/config', readForm());
    fillForm(cfg);
    eventBus.emit('ui:notify', { message: 'Đã lưu cấu hình iOS vào .env.' });
  } catch (err) {
    showResult('error', 'Chưa lưu', [err.message]);
  }
}

async function load() {
  try {
    const cfg = await apiClient.get('/api/mobile/ios/config');
    fillForm(cfg);
    if (cfg.error) showResult('warn', 'Cấu hình trong .env cần sửa', [cfg.error]);
    else setBadge('', cfg.host ? 'Chưa kiểm tra' : 'Chưa cấu hình');
  } catch (err) {
    showResult('error', 'Không đọc được cấu hình iOS', [err.message]);
  }
}

/** Called each time the Mobile / iOS subtab opens; binds once per rendered panel (remount safe). */
export function initMobileSettings() {
  const panel = document.querySelector('#settings-view .settings-mobile');
  if (!panel) return;
  if (panel.dataset.bound !== 'true') {
    panel.dataset.bound = 'true';
    $('settings-ios-check').addEventListener('click', check);
    $('settings-ios-save').addEventListener('click', save);
    $('settings-ios-add-device').addEventListener('click', () => {
      const devices = [...readDevices(), { simulator: true }];
      renderDevices(devices);
      document.querySelector('#settings-ios-devices .settings-ios-device:last-child input')?.focus();
    });
    $('settings-ios-devices').addEventListener('click', (e) => {
      if (!e.target.closest('[data-remove-device]')) return;
      e.target.closest('.settings-ios-device').remove();
      renderDevices(readDevices());
    });
  }
  load();
}
