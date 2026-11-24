/**
 * dashboard/public/js/views/runner/runnerDashboardFilter.test.js
 * Unit tests for the Dashboard-internal path rule and the list pruning used by the suite previews.
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

test('pruneList removes internal items and rewrites the count with the hidden number', () => {
  const item = (title) => ({ getAttribute: () => title, removed: false, remove() { this.removed = true; } });
  const items = [item('tests/dashboard/a.spec.js'), item('tests/e2e/b.spec.js'), item('tests/dashboard/c.spec.js')];
  const count = { textContent: '3 script' };
  const container = { querySelectorAll: () => items };
  assert.equal(filter.pruneList(container, count, '.x'), 2);
  assert.deepEqual(items.map((i) => i.removed), [true, false, true]);
  assert.equal(count.textContent, '1 script (+2 test Dashboard đang ẩn)');
  assert.equal(filter.pruneList(null, count, '.x'), 0);
});
