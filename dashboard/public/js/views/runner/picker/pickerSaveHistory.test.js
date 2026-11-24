/**
 * dashboard/public/js/views/runner/picker/pickerSaveHistory.test.js
 * Unit tests: history wording/selection helpers and the save-suite mapping + flow (fake fetch).
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const load = (name) => import(`./${name}.js`);
const NOW = new Date('2026-11-25T12:00:00').getTime();
const ago = (min) => new Date(NOW - min * 60000).toISOString();

test('history: timeAgo / statusInfo always carry words, recentSets dedupes and skips stopped runs', async () => {
  const { timeAgo, statusInfo, recentSets, runLabel } = await load('pickerHistory');
  assert.equal(timeAgo(ago(0.2), NOW), 'vừa xong');
  assert.equal(timeAgo(ago(5), NOW), '5 phút trước');
  assert.equal(timeAgo(ago(125), NOW), '2 giờ trước');
  assert.match(timeAgo(ago(24 * 60 + 30), NOW), /^hôm qua \d\d:\d\d$/);
  assert.match(timeAgo(ago(5 * 24 * 60), NOW), /^\d\d\/\d\d \d\d:\d\d$/);
  assert.deepEqual(statusInfo({ status: 'failed', at: ago(60) }, NOW), { kind: 'fail', icon: 'ph-x', text: 'Fail 1 giờ trước' });
  assert.equal(statusInfo({ status: 'passed', at: ago(5) }, NOW).text, 'Pass 5 phút trước');
  assert.deepEqual(statusInfo(undefined, NOW), { kind: 'none', icon: 'ph-circle-dashed', text: 'Chưa chạy' });
  const runs = [{ id: 'a', status: 'passed', specs: ['x'], tags: [] }, { id: 'b', status: 'stopped', specs: ['y'] }, { id: 'c', status: 'failed', specs: ['x'], tags: [] }, { id: 'd', status: 'failed', specs: ['z'], tags: ['@t'] }];
  assert.deepEqual(recentSets(runs).map((r) => r.id), ['a', 'd']);
  assert.equal(runLabel({ startedAt: ago(5), specs: ['a', 'b'], summary: { failed: 1 } }, NOW), '5 phút trước · 2 script · 1 fail');
  assert.equal(runLabel({ startedAt: ago(5), specs: [] }, NOW), '5 phút trước · tất cả script');
});

test('save: slug, one-project rule, suite mapping and the grep round trip', async () => {
  const s = await load('pickerSaveSuite');
  const p = await load('pickerPayload');
  assert.equal(s.slugify('Smoke nhanh — Đăng nhập!'), 'smoke-nhanh-dang-nhap');
  assert.equal(s.slugify('x'.repeat(80)).length, 50);
  assert.ok(s.KEY_RE.test('smoke-1') && !s.KEY_RE.test('Smoke') && !s.KEY_RE.test('-a'));
  assert.equal(s.saveBlocker({ projects: ['A', 'B'] }) !== '', true);
  assert.equal(s.saveBlocker({ projects: ['A'] }), '');
  const one = s.buildSuite({ specs: ['tests/a.spec.js'], projects: ['Mobile Chrome Smoke Tests'], tags: ['@smoke', '@e2e'], workers: 3 }, { label: 'L', description: 'D' });
  assert.deepEqual([one.type, one.platform, one.project, one.spec, one.specs, one.workers], ['single', 'mobile', 'Mobile Chrome Smoke Tests', 'tests/a.spec.js', ['tests/a.spec.js'], 3]);
  assert.equal(one.grep, '(?:@smoke|@e2e)(?![\\w-])');
  assert.deepEqual(p.tagsFromGrep(one.grep), ['@smoke', '@e2e']);
  assert.equal(p.tagsFromGrep('@smoke'), null);
  const all = s.buildSuite({ spec: 'all', projects: [] }, { label: 'All' });
  assert.deepEqual([all.specs, all.spec, all.project, all.grep], ['all', 'all', 'all', '']);
  assert.equal(s.buildSuite({ specs: ['a', 'b'], projects: [] }, { label: 'M' }).spec, 'custom');
});

test('save flow: ok, key taken (never overwritten), one retry on 409, conflict after two, server error, network error', async () => {
  const { saveSuite } = await load('pickerSaveSuite');
  const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
  const make = (puts) => { const calls = []; let i = 0; const f = async (url, init) => { calls.push([url, init && init.method]); if (!init) return reply(200, { suites: { old: { label: 'Old' } }, revision: `r${calls.length}` }); const r = puts[Math.min(i, puts.length - 1)]; i += 1; return typeof r === 'function' ? r(init) : r; }; return { f, calls }; };
  let sent;
  let { f, calls } = make([(init) => { sent = JSON.parse(init.body); return reply(200, { settings: { suites: { old: {}, k: {} } }, revision: 'n' }); }]);
  assert.deepEqual(await saveSuite({ key: 'k', suite: { label: 'K' } }, f), { ok: true, key: 'k', suites: { old: {}, k: {} } });
  assert.deepEqual(Object.keys(sent.suites), ['old', 'k']);
  assert.equal(sent.baseRevision, 'r1');
  ({ f } = make([reply(200, {})]));
  assert.deepEqual(await saveSuite({ key: 'old', suite: {} }, f), { ok: false, code: 'KEY_TAKEN', message: 'Mã “old” đã dùng. Đổi mã hoặc chọn tên khác.' });
  ({ f, calls } = make([reply(409, { code: 'CONFIG_CONFLICT' }), reply(200, { settings: { suites: { k: {} } } })]));
  assert.equal((await saveSuite({ key: 'k', suite: {} }, f)).ok, true);
  assert.equal(calls.filter((c) => c[1] === 'PUT').length, 2);
  assert.equal(calls.filter((c) => !c[1]).length, 2, 'a fresh GET before each attempt');
  ({ f, calls } = make([reply(409, {})]));
  assert.equal((await saveSuite({ key: 'k', suite: {} }, f)).code, 'CONFLICT');
  assert.equal(calls.filter((c) => c[1] === 'PUT').length, 2, 'exactly one retry');
  ({ f } = make([reply(400, { error: 'Không thể lưu cấu hình: x.' })]));
  assert.deepEqual(await saveSuite({ key: 'k', suite: {} }, f), { ok: false, code: 'SERVER', message: 'Không thể lưu cấu hình: x.' });
  assert.equal((await saveSuite({ key: 'k', suite: {} }, async () => { throw new Error('offline'); })).code, 'NETWORK');
});
