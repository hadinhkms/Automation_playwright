/**
 * dashboard/services/mobileIosService.js
 * iOS (remote Mac host) settings: read, validate and save the IOS_* keys in .env (REQ-301, BR-301, BR-302).
 * Saving edits only the IOS_* lines; comments and every other key in .env stay as they are.
 */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { MAC_PATH_PATTERN, URL_PATTERN, PACKAGE_PATTERN } = require('./mobileAppProfiles');

const KEYS = {
  host: 'IOS_APPIUM_HOST', port: 'IOS_APPIUM_PORT', devices: 'IOS_DEVICES', app: 'IOS_APP',
  bundleId: 'IOS_BUNDLE_ID', xcodeOrgId: 'IOS_XCODE_ORG_ID', wdaBundleId: 'IOS_WDA_BUNDLE_ID',
};
const LABEL = '(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)';
// BR-301: scheme + host name or IPv4 + optional port. No path, query, credentials or whitespace.
const HOST_PATTERN = new RegExp(`^(https?)://(${LABEL}(?:\\.${LABEL})*)(?::(\\d{1,5}))?/?$`);
const DEVICE_NAME = /^[\w .()+-]{1,60}$/;
const IOS_VERSION = /^\d{1,2}(\.\d{1,2}){0,2}$/;
const UDID_PATTERN = /^[A-Fa-f0-9-]{20,60}$/;
const TEAM_ID = /^[A-Z0-9]{10}$/;
const MAX_DEVICES = 10;

function badRequest(message) {
  return Object.assign(new Error(message), { status: 400 });
}

function envPath(root) {
  return path.join(root, '.env');
}

function readEnv(root) {
  const file = envPath(root);
  const fromFile = fs.existsSync(file) ? dotenv.parse(fs.readFileSync(file, 'utf8')) : {};
  const get = (key) => (Object.prototype.hasOwnProperty.call(fromFile, key) ? fromFile[key] : process.env[key]) || '';
  return Object.fromEntries(Object.entries(KEYS).map(([field, key]) => [field, String(get(key)).trim()]));
}

function parsePort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw badRequest('Cổng phải là số từ 1 đến 65535.');
  return port;
}

/** Returns { host: 'http://name', port } or throws 400. An empty host means "not configured yet". */
function parseHost(rawHost, rawPort) {
  const host = String(rawHost || '').trim();
  if (!host) return { host: '', port: parsePort(rawPort || 4723) };
  const match = HOST_PATTERN.exec(host);
  if (!match || host.length > 200) {
    throw badRequest('Địa chỉ Mac chỉ nhận dạng http(s)://tên-máy-hoặc-IP[:cổng], không có đường dẫn hay ký tự đặc biệt.');
  }
  return { host: `${match[1]}://${match[2].toLowerCase()}`, port: parsePort(match[3] || rawPort || 4723) };
}

function parseDevices(raw) {
  let list = raw;
  if (typeof raw === 'string') {
    if (!raw.trim()) return [];
    try { list = JSON.parse(raw); } catch (_) { throw badRequest('Danh sách thiết bị iOS không phải JSON hợp lệ.'); }
  }
  if (list == null) return [];
  if (!Array.isArray(list) || list.length > MAX_DEVICES) throw badRequest(`Danh sách thiết bị iOS phải là mảng, tối đa ${MAX_DEVICES} máy.`);
  const seen = new Set();
  return list.map((d, i) => {
    const device = {
      name: String(d?.name || '').trim(),
      platformVersion: String(d?.platformVersion || '').trim(),
      udid: String(d?.udid || '').trim(),
      simulator: d?.simulator !== false,
    };
    const where = `Thiết bị #${i + 1}`;
    if (!DEVICE_NAME.test(device.name)) throw badRequest(`${where}: tên chỉ gồm chữ, số, khoảng trắng, . ( ) + - (tối đa 60 ký tự).`);
    if (!IOS_VERSION.test(device.platformVersion)) throw badRequest(`${where}: phiên bản iOS dạng 17.5.`);
    if (device.udid && !UDID_PATTERN.test(device.udid)) throw badRequest(`${where}: UDID không hợp lệ.`);
    if (!device.simulator && !device.udid) throw badRequest(`${where}: máy thật cần UDID.`);
    const key = deviceKey(device);
    if (seen.has(key)) throw badRequest(`${where}: trùng với thiết bị khác.`);
    seen.add(key);
    return device;
  });
}

function deviceKey(device) {
  return device.udid || `${device.name}@${device.platformVersion}`;
}

function optional(value, pattern, message, max = 500) {
  const text = String(value || '').trim();
  if (text && (!pattern.test(text) || text.length > max)) throw badRequest(message);
  return text;
}

/** Normalizes a full iOS settings object (PUT body). BR-302: no Apple ID password field exists. */
function validateIosConfig(input = {}) {
  const { host, port } = parseHost(input.host, input.port);
  const app = String(input.app || '').trim();
  if (app && !(MAC_PATH_PATTERN.test(app) || URL_PATTERN.test(app))) {
    throw badRequest('App iOS phải là đường dẫn trên Mac (/Users/.../MyApp.app) hoặc URL http(s).');
  }
  return {
    host, port,
    devices: parseDevices(input.devices),
    app,
    bundleId: optional(input.bundleId, PACKAGE_PATTERN, 'Bundle id không hợp lệ (ví dụ com.example.app).', 155),
    xcodeOrgId: optional(input.xcodeOrgId, TEAM_ID, 'Team ID gồm 10 chữ in hoa hoặc số.'),
    wdaBundleId: optional(input.wdaBundleId, PACKAGE_PATTERN, 'Bundle id WebDriverAgent không hợp lệ.', 155),
  };
}

/** Saved settings; a broken value in .env is reported in `error` instead of failing the page. */
function readIosConfig(root) {
  const raw = readEnv(root);
  try {
    return { ...validateIosConfig(raw), error: '' };
  } catch (err) {
    return { host: '', port: 4723, devices: [], app: '', bundleId: '', xcodeOrgId: '', wdaBundleId: '', error: `Cấu hình iOS trong .env chưa hợp lệ: ${err.message}` };
  }
}

function formatEnvValue(value) {
  const text = String(value);
  return /[\s#"'=]/.test(text) ? `'${text}'` : text;
}

/** Replaces the IOS_* lines (or appends them) and mirrors the values into process.env. */
function saveIosConfig(root, input) {
  const config = validateIosConfig(input);
  const values = {
    [KEYS.host]: config.host, [KEYS.port]: String(config.port),
    [KEYS.devices]: config.devices.length ? JSON.stringify(config.devices) : '',
    [KEYS.app]: config.app, [KEYS.bundleId]: config.bundleId,
    [KEYS.xcodeOrgId]: config.xcodeOrgId, [KEYS.wdaBundleId]: config.wdaBundleId,
  };
  const file = envPath(root);
  const lines = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split(/\r?\n/) : [];
  const pending = new Set(Object.keys(values));
  const next = lines.map((line) => {
    const key = (/^\s*([A-Z0-9_]+)\s*=/.exec(line) || [])[1];
    if (!key || !pending.has(key)) return line;
    pending.delete(key);
    return `${key}=${formatEnvValue(values[key])}`;
  });
  while (next.length && next[next.length - 1] === '') next.pop();
  pending.forEach((key) => next.push(`${key}=${formatEnvValue(values[key])}`));
  fs.writeFileSync(file, `${next.join('\n')}\n`, 'utf8');
  Object.entries(values).forEach(([key, value]) => { process.env[key] = value; });
  return { ...config, error: '' };
}

module.exports = { validateIosConfig, readIosConfig, saveIosConfig, parseHost, deviceKey, KEYS, HOST_PATTERN };
