/**
 * dashboard/public/js/views/runner/runnerTagGuard.test.js
 * Unit tests for the "no valid @tag" detection (R1).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { isInvalidTagText } = require('./runnerTagGuard');

test('flags text that has no @tag token, ignores empty text and valid tags', () => {
  assert.equal(isInvalidTagText('smoke'), true);
  assert.equal(isInvalidTagText('  zzz  '), true);
  assert.equal(isInvalidTagText('e2e mobile'), true);
  assert.equal(isInvalidTagText(''), false);
  assert.equal(isInvalidTagText('   '), false);
  assert.equal(isInvalidTagText('@smoke'), false);
  assert.equal(isInvalidTagText('@e2e @mobile'), false);
  assert.equal(isInvalidTagText('smoke @e2e'), false);
});
