'use strict';

/**
 * Gate 3 R-3: when the child exits, activeRun is released and the final status is published BEFORE the (heavy,
 * possibly slow) history recording starts, so a slow recording can neither hold the run nor delay the notice.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const historyPath = require.resolve('./runHistoryService');
const seen = { recorded: null };
require.cache[historyPath] = {
  id: historyPath, filename: historyPath, loaded: true,
  exports: {
    rawResultsFile: (root, id) => path.join(root, `${id}.raw.json`),
    recordWebRun: async (root, run) => {
      const service = require('./runnerService');
      seen.recorded = { active: service.getActiveRun(), published: seen.published, canStart: service.tryBeginStart() };
      service.endStart();
      const until = Date.now() + 700; while (Date.now() < until) { /* simulate a heavy synchronous scan */ }
      return { id: run.id };
    },
  },
};
const service = require('./runnerService');

test('activeRun is null and the final status already published when recording starts; a new run can start', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'run-close-'));
  try {
    fs.writeFileSync(path.join(root, 'playwright.config.js'), 'module.exports = { testDir: ".", testMatch: "**/*.spec.js" };\n');
    fs.writeFileSync(path.join(root, 'quick.spec.js'), `const { test } = require(${JSON.stringify(require.resolve('@playwright/test'))});\ntest('q', async () => {});\n`);
    const events = [];
    service.getClients().add({ write: (msg) => { const m = /^data: (.*)\n\n$/.exec(msg); if (m) { const e = JSON.parse(m[1]); events.push(e.type); if (e.type === 'status' && e.payload.status === 'passed') seen.published = true; } } });
    service.startRun({ project: 'all', projects: [], spec: 'quick.spec.js', specs: ['quick.spec.js'], tags: [], grep: '', environment: 'qc', workers: 1, headed: false, viewport: null, suiteLabel: '' }, false, root);
    for (let i = 0; i < 150 && !seen.recorded; i += 1) await new Promise((r) => setTimeout(r, 100));
    assert.ok(seen.recorded, 'recording was never called');
    assert.equal(seen.recorded.active, null, 'activeRun must already be released');
    assert.equal(seen.recorded.published, true, 'the final status must already be published');
    assert.equal(seen.recorded.canStart, true, 'a new run can start immediately');
    await new Promise((r) => setTimeout(r, 900));
    assert.ok(events.includes('history'), 'a "history" event announces the finished record');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
