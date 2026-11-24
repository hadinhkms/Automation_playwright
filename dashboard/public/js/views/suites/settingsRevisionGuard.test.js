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

test('record keeps revision and server suites from GET and PUT 200, flags only 409 CONFIG_CONFLICT', () => {
  assert.equal(guard.record('GET', 200, { revision: 'a', suites: { s: 1 } }), false);
  assert.equal(guard.state.revision, 'a');
  assert.deepEqual(guard.getServerSuites(), { s: 1 });
  assert.equal(guard.record('PUT', 200, { revision: 'b', settings: { suites: { t: 2 } } }), false);
  assert.equal(guard.state.revision, 'b');
  assert.deepEqual(guard.getServerSuites(), { t: 2 });
  assert.equal(guard.record('PUT', 409, { code: 'CONFIG_CONFLICT', revision: 'c' }), true);
  assert.equal(guard.state.revision, 'b', 'a conflict must not adopt the newer revision');
  assert.equal(guard.record('PUT', 400, { error: 'x' }), false);
});
