/**
 * dashboard/services/mobileInspectorCommands.js
 * Inspector commands inside an open session (PLAN-25 P4): snapshot, locator match counts with suggestions,
 * tap / type / Back. `call(method, route, body, timeoutMs)` is bound to the session by mobileInspectorService.
 */
const { httpError } = require('./mobileAppiumClient');
const { suggestLocators, suggestName } = require('../../core/native/locatorSuggest');
const { toWebDriverQuery } = require('../../core/native/locators');

const ELEMENT_KEY = 'element-6066-11e4-a52e-4f735466cecf';

function query(locator, platform) {
  try { return toWebDriverQuery(String(locator || ''), platform); } catch (err) { throw httpError(400, err.message); }
}

async function snapshot(call, platform) {
  const [screenshot, source, rect] = await Promise.all([
    call('GET', '/screenshot', undefined, 30000),
    call('GET', '/source', undefined, 30000),
    call('GET', '/window/rect', undefined, 15000).catch(() => null),
  ]);
  return { platform, screenshot, source, window: rect ? { width: rect.width, height: rect.height } : null };
}

async function count(call, platform, locator) {
  const found = await call('POST', '/elements', query(locator, platform), 15000);
  return Array.isArray(found) ? found.length : 0;
}

/** `{ locator }` → match count; `{ element }` → ranked suggestions, each with its count (AC-402). */
async function find(call, platform, body = {}) {
  if (body.locator !== undefined) return { count: await count(call, platform, body.locator) };
  if (!body.element || typeof body.element !== 'object') throw httpError(400, 'Cần "locator" hoặc "element".');
  const suggestions = [];
  for (const s of suggestLocators(body.element, platform)) {
    let matches = null;
    try { matches = await count(call, platform, s.locator); } catch (err) { if (err.status === 503) throw err; }
    suggestions.push({ ...s, count: matches });
  }
  return { name: suggestName(body.element, platform), suggestions };
}

function tapActions(x, y) {
  const steps = [{ type: 'pointerMove', duration: 0, x, y }, { type: 'pointerDown', button: 0 }, { type: 'pause', duration: 80 }, { type: 'pointerUp', button: 0 }];
  return { actions: [{ type: 'pointer', id: 'finger1', parameters: { pointerType: 'touch' }, actions: steps }] };
}

async function action(call, platform, body = {}) {
  if (body.type === 'back') {
    if (platform !== 'android') throw httpError(400, 'iOS không có nút Back hệ thống.');
    await call('POST', '/back', {}, 15000);
  } else if (body.type === 'tap') {
    const x = Number(body.x);
    const y = Number(body.y);
    if (![x, y].every((n) => Number.isInteger(n) && n >= 0 && n <= 20000)) throw httpError(400, 'Toạ độ chạm không hợp lệ.');
    await call('POST', '/actions', tapActions(x, y), 15000);
  } else if (body.type === 'type') {
    const text = String(body.text ?? '');
    if (text.length > 500 || /[\u0000-\u001f\u007f]/.test(text)) throw httpError(400, 'Chữ cần nhập tối đa 500 ký tự, không có ký tự điều khiển.');
    const el = await call('POST', '/element', query(body.locator, platform), 15000);
    await call('POST', `/element/${encodeURIComponent(el?.[ELEMENT_KEY] || '')}/value`, { text }, 15000);
  } else {
    throw httpError(400, 'Thao tác phải là tap, type hoặc back.');
  }
  return { ok: true };
}

module.exports = { snapshot, find, action, ELEMENT_KEY };
