/**
 * dashboard/public/js/views/suites/settingsRevisionGuard.test.js
 * Unit tests for the client side of /api/settings revision handling.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const guard = require('./settingsRevisionGuard');

test('isSettingsUrl matches only /api/settings', () => {
  assert.equal(guard.isSettingsUrl('/api/settings'), true);
  assert.equal(guard.isSettingsUrl('/api/settings?x=1'), true);
  assert.equal(guard.isSettingsUrl('/api/settings/other'), false);
  assert.equal(guard.isSettingsUrl('/api/config'), false);
});

test('withBaseRevision adds baseRevision to JSON bodies only when a revision is known', () => {
  const init = { method: 'PUT', body: JSON.stringify({ suites: {} }) };
  assert.equal(guard.withBaseRevision(init, undefined), init);
  assert.deepEqual(JSON.parse(guard.withBaseRevision(init, 'r1').body), { suites: {}, baseRevision: 'r1' });
  const notJson = { method: 'PUT', body: 'x' };
  assert.equal(guard.withBaseRevision(notJson, 'r1'), notJson);
});

test('withBaseRevision keeps an explicit baseRevision (read-modify-write callers)', () => {
  const init = { method: 'PUT', body: JSON.stringify({ suites: {}, baseRevision: 'fresh' }) };
  assert.equal(JSON.parse(guard.withBaseRevision(init, 'remembered').body).baseRevision, 'fresh');
});

test('record: revision moves only on the first GET and on PUT 200, never on a later background GET', () => {
  guard.state.revision = undefined;
  assert.equal(guard.record('GET', 200, { revision: 'a', suites: { s: 1 } }), false);
  assert.equal(guard.state.revision, 'a');
  assert.deepEqual(guard.getServerSuites(), { s: 1 });
  guard.record('GET', 200, { revision: 'newer', suites: { s: 2 } });
  assert.equal(guard.state.revision, 'a', 'a background GET must not adopt the newer revision');
  assert.deepEqual(guard.getServerSuites(), { s: 2 });
  assert.equal(guard.record('PUT', 200, { revision: 'b', settings: { suites: { t: 2 } } }), false);
  assert.equal(guard.state.revision, 'b');
  assert.equal(guard.record('PUT', 409, { code: 'CONFIG_CONFLICT', revision: 'c' }), true);
  assert.equal(guard.state.revision, 'b', 'a conflict must not adopt the newer revision');
  assert.equal(guard.record('PUT', 400, { error: 'x' }), false);
});

test('setRenderedRevision adopts the revision of the rendered form and ignores missing ones', () => {
  guard.state.revision = 'old';
  guard.setRenderedRevision(undefined);
  assert.equal(guard.state.revision, 'old');
  guard.setRenderedRevision('rendered');
  assert.equal(guard.state.revision, 'rendered');
});
