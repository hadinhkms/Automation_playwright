/**
 * dashboard/public/js/views/suites/suiteSaveGuard.test.js
 * Unit tests for the Settings / Suites save guards (NB-01, NB-02).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const guard = require('./suiteSaveGuard');

const doc = (map) => ({ querySelector: (sel) => map[sel] || null });

test('settingsFormReady needs env cards and a default environment value', () => {
  assert.equal(guard.settingsFormReady(doc({})), false);
  assert.equal(guard.settingsFormReady(doc({ '.env-card': {} })), false);
  assert.equal(guard.settingsFormReady(doc({ '.env-card': {}, '#settings-default-environment': { value: '' } })), false);
  assert.equal(guard.settingsFormReady(doc({ '.env-card': {}, '#settings-default-environment': { value: 'qc' } })), true);
});

test('suite form re-serialises only after an edit and only when its fields exist', () => {
  guard.resetSuiteFormEdited();
  const loaded = doc({ '#suite-field-key': {} });
  assert.equal(guard.shouldSyncSuiteForm(loaded), false);
  guard.markSuiteFormEdited();
  assert.equal(guard.shouldSyncSuiteForm(loaded), true);
  assert.equal(guard.shouldSyncSuiteForm(doc({})), false);
  guard.resetSuiteFormEdited();
  assert.equal(guard.shouldSyncSuiteForm(loaded), false);
});

test('pickSuitesForSave sends saved suites unless a Suites save asks for the cache', () => {
  const saved = { smoke: { label: 'Smoke' } };
  const cached = { x: { label: 'Kịch bản mới' } };
  assert.deepEqual(guard.pickSuitesForSave({ includeSuites: false, cachedSuites: cached, savedSuites: saved }), saved);
  assert.deepEqual(guard.pickSuitesForSave({ includeSuites: true, cachedSuites: cached, savedSuites: saved }), cached);
  assert.deepEqual(guard.pickSuitesForSave({ includeSuites: false, cachedSuites: {}, savedSuites: {}, settingsSuites: saved }), saved);
});

test('toSavePayload keeps only suites when the Settings form was never loaded', () => {
  const full = { suites: { a: 1 }, environments: {}, runtime: { defaultEnvironment: 'staging' } };
  assert.deepEqual(guard.toSavePayload(full, { settingsReady: false }), { suites: { a: 1 } });
  assert.equal(guard.toSavePayload(full, { settingsReady: true }), full);
});

test('keepCurrentOption keeps a project missing from the catalog', () => {
  assert.deepEqual(guard.keepCurrentOption(['chromium'], 'Desktop Smoke Tests'), ['chromium', 'Desktop Smoke Tests']);
  assert.deepEqual(guard.keepCurrentOption(['chromium'], 'chromium'), ['chromium']);
  assert.deepEqual(guard.keepCurrentOption(['chromium'], ''), ['chromium']);
});
