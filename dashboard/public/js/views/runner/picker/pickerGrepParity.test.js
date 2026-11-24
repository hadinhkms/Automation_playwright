/**
 * dashboard/public/js/views/runner/picker/pickerGrepParity.test.js
 * The picker's grepFromTags must be BYTE-IDENTICAL to the server's runnerArgs.tagGrep, otherwise a suite saved
 * by the picker matches different tests than the same tags run directly (V3). Also checks the matching itself.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { tagGrep } = require('../../../../../services/runnerArgs');

const SETS = [['@smoke'], ['@smoke', '@e2e'], ['@REQ-001', '@REQ', '@a_b-c'], ['@x'], ['@auth', '@mobile', '@api', '@e2e', '@smoke', '@regression']];

test('grepFromTags equals the server tagGrep for many tag sets', async () => {
  const { grepFromTags } = await import('./pickerPayload.js');
  for (const tags of SETS) assert.equal(grepFromTags(tags), tagGrep(tags), JSON.stringify(tags));
});

test('the generated regex has tag boundaries on both sides, and round-trips through tagsFromGrep', async () => {
  const { grepFromTags, tagsFromGrep } = await import('./pickerPayload.js');
  const re = new RegExp(grepFromTags(['@smoke']));
  assert.equal(re.test('login @smoke @e2e'), true);
  assert.equal(re.test('x@smoke'), false);
  assert.equal(re.test('@smoke-extra'), false);
  for (const tags of SETS) assert.deepEqual(tagsFromGrep(grepFromTags(tags)), tags);
});
