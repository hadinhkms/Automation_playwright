/**
 * dashboard/public/js/views/runner/picker/pickerSaveSuite.js
 * "Lưu lựa chọn thành suite" (CONTRACT-script-picker §4): maps the picker payload to a suite and saves it with
 * read-modify-write on PUT /api/settings + baseRevision (revision/409 of item #12). One retry after a 409
 * (fresh GET, key re-checked); an existing key is never overwritten. Pure mapping + a fetch-based flow.
 */
import { fold } from './pickerText.js';
import { grepFromTags, GREP_MAX } from './pickerPayload.js';

export const NAME_MAX = 50; // the server cuts labels (and keys) at 50 characters: never let it do so silently
export const DESC_MAX = 200;
export const KEY_RE = /^[a-z0-9][a-z0-9-]{0,49}$/;
const JSON_HEADERS = { 'Content-Type': 'application/json' };

export function slugify(label) {
  return fold(label).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, NAME_MAX).replace(/-+$/g, '');
}

/** A suite holds ONE project (schema): 2+ projects cannot be saved. */
export function saveBlocker(payload) {
  if ((payload.projects || []).length > 1) return 'Chọn đúng 1 nền tảng (project) để lưu thành suite.';
  // the server cuts a longer grep silently, which would store a broken regex while we say "saved"
  if (payload.tags && payload.tags.length && grepFromTags(payload.tags).length > GREP_MAX) return `Quá nhiều tag để lưu thành suite (tối đa ${GREP_MAX} ký tự).`;
  return '';
}

/** Picker payload (POST /api/run shape) + the dialog fields -> suite object of the existing schema. */
export function buildSuite(payload, { label, description = '' }) {
  const project = (payload.projects || [])[0] || 'all';
  const all = payload.spec === 'all';
  return {
    label, description, type: 'single', platform: /^mobile/i.test(project) ? 'mobile' : 'desktop', project, device: '',
    viewport: { preset: 'default', width: 1920, height: 1080 },
    specs: all ? 'all' : payload.specs, spec: all ? 'all' : (payload.specs.length === 1 ? payload.specs[0] : 'custom'),
    grep: payload.tags && payload.tags.length ? grepFromTags(payload.tags) : '', workers: payload.workers || 2,
  };
}

const fail = (code, message) => ({ ok: false, code, message });

async function readSettings(f) {
  const res = await f('/api/settings');
  const body = await res.json().catch(() => null);
  if (!res.ok || !body) throw new Error((body && body.error) || `HTTP ${res.status}`);
  return { suites: body.suites || {}, revision: body.revision };
}

export async function saveSuite({ key, suite }, f = (...a) => fetch(...a)) {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    let current;
    try { current = await readSettings(f); } catch (err) { return fail('NETWORK', err.message); }
    if (Object.prototype.hasOwnProperty.call(current.suites, key)) return fail('KEY_TAKEN', `Mã “${key}” đã dùng. Đổi mã hoặc chọn tên khác.`);
    let res;
    try {
      res = await f('/api/settings', { method: 'PUT', headers: { ...JSON_HEADERS, 'X-Settings-Conflict': 'handled' }, body: JSON.stringify({ suites: { ...current.suites, [key]: suite }, baseRevision: current.revision }) });
    } catch (err) { return fail('NETWORK', err.message); }
    const body = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, key, suites: (body.settings && body.settings.suites) || { ...current.suites, [key]: suite } };
    if (res.status === 409 && attempt === 1) continue; // someone saved meanwhile: fresh GET, key re-check, one more try
    if (res.status === 409) return fail('CONFLICT', 'Cấu hình đã đổi ở nơi khác nên chưa lưu.');
    return fail('SERVER', body.error || `HTTP ${res.status}`);
  }
  return fail('CONFLICT', 'Cấu hình đã đổi ở nơi khác nên chưa lưu.');
}
