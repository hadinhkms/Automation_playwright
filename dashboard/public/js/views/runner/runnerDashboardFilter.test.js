/**
 * dashboard/public/js/views/runner/runnerDashboardFilter.test.js
 * Unit tests for the pure helpers of the Runner "hide Dashboard tests" filter (L2).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const filter = require('./runnerDashboardFilter');

test('isInternal matches only paths under tests/dashboard/', () => {
  assert.equal(filter.isInternal('tests/dashboard/smoke.spec.js'), true);
  assert.equal(filter.isInternal('tests\\dashboard\\smoke.spec.js'), true);
  assert.equal(filter.isInternal('tests/e2e/dashboard-like.spec.js'), false);
  assert.equal(filter.isInternal(undefined), false);
});

test('visibleTags keeps a shared tag but drops tags that only internal specs carry', () => {
  const specTags = { 'tests/e2e/a.spec.js': ['@smoke'], 'tests/dashboard/i.spec.js': ['@smoke', '@only'] };
  assert.deepEqual(filter.visibleTags(['@smoke', '@only'], specTags), ['@smoke']);
});

test('read/write of the switch tolerates missing or throwing storage', () => {
  const mem = {}; const storage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = v; } };
  assert.equal(filter.readShow(storage), false);
  filter.writeShow(storage, true);
  assert.equal(filter.readShow(storage), true);
  assert.equal(filter.readShow(null), false);
  assert.doesNotThrow(() => filter.writeShow({ setItem() { throw new Error('denied'); } }, true));
});
