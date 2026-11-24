'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadPlaywrightConfig, getLastConfigError } = require('./playwrightConfigLoader');

// Gate 3 M1: a failure from root A must not be reported for root B that has no config at all.
test('lastConfigError is reset on every load (no stale error from another root)', () => {
  const a = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-a-'));
  const b = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-b-'));
  try {
    fs.writeFileSync(path.join(a, 'playwright.config.js'), "throw new Error('boom-a');\n");
    assert.equal(loadPlaywrightConfig(a), null);
    assert.match(getLastConfigError(), /boom-a/);

    assert.equal(loadPlaywrightConfig(b), null);
    assert.equal(getLastConfigError(), null);

    fs.writeFileSync(path.join(b, 'playwright.config.js'), 'module.exports = { projects: [] };\n');
    assert.deepEqual(loadPlaywrightConfig(b), { projects: [] });
    assert.equal(getLastConfigError(), null);
  } finally {
    fs.rmSync(a, { recursive: true, force: true });
    fs.rmSync(b, { recursive: true, force: true });
  }
});
