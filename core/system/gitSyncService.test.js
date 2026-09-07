const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const {
  isPermittedPath,
  isBlockedPath,
  categorizeAsset,
  getGitStatus,
  runFrameworkQualityGate,
  syncSuitesAndConfigs,
} = require('./gitSyncService');

test('Asset Shield: isBlockedPath blocks sensitive and temporary files', () => {
  assert.equal(isBlockedPath('.env'), true);
  assert.equal(isBlockedPath('.env.production'), true);
  assert.equal(isBlockedPath('credentials.json'), true);
  assert.equal(isBlockedPath('secrets.key'), true);
  assert.equal(isBlockedPath('playwright-report/index.html'), true);
  assert.equal(isBlockedPath('test-results/trace.zip'), true);
  assert.equal(isBlockedPath('evidence/screenshot.png'), true);
  assert.equal(isBlockedPath('.dashboard-drafts/draft.json'), true);
  assert.equal(isBlockedPath('tmp/cache.tmp'), true);
  assert.equal(isBlockedPath('scratch/notes.txt'), true);
  assert.equal(isBlockedPath('.ai/learning/scratch/test.txt'), true);
  assert.equal(isBlockedPath('ai/personal/prompt.md'), true);
});

test('Asset Whitelist: isPermittedPath allows safe test assets and configs', () => {
  assert.equal(isPermittedPath('tests/e2e/sample.spec.js'), true);
  assert.equal(isPermittedPath('pages/desktop/SamplePage.js'), true);
  assert.equal(isPermittedPath('data/sampleData.json'), true);
  assert.equal(isPermittedPath('dashboardConfig.json'), true);
  assert.equal(isPermittedPath('qa-engine.config.json'), true);
  assert.equal(isPermittedPath('package.json'), true);
  assert.equal(isPermittedPath('playwright.config.js'), true);
  assert.equal(isPermittedPath('README.md'), true);
  assert.equal(isPermittedPath('GIT_WORKFLOW.md'), true);

  // Blocked paths take precedence even if located under tests or pages
  assert.equal(isPermittedPath('tests/.env'), false);
});

test('categorizeAsset categorizes files properly for UI presentation', () => {
  assert.equal(categorizeAsset('tests/e2e/test.spec.js').type, 'test_script');
  assert.equal(categorizeAsset('pages/mobile/LoginMobilePage.js').type, 'page_object');
  assert.equal(categorizeAsset('data/users.json').type, 'test_data');
  assert.equal(categorizeAsset('dashboardConfig.json').type, 'test_suite');
  assert.equal(categorizeAsset('.env').type, 'blocked');
});

test('getGitStatus returns clean repository status', () => {
  const status = getGitStatus();
  assert.equal(status.ok, true);
  assert.equal(status.isGitRepo, true);
  assert.ok(typeof status.currentBranch === 'string' && status.currentBranch.length > 0);
  assert.ok(typeof status.ahead === 'number');
  assert.ok(typeof status.behind === 'number');
  assert.ok(Array.isArray(status.permittedFiles));
  assert.ok(Array.isArray(status.blockedFiles));
});

test('Framework Quality Gate validates codebase structure', () => {
  const qg = runFrameworkQualityGate();
  assert.equal(qg.ok, true);
  assert.equal(qg.passed, true);
});

test('syncSuitesAndConfigs runs safely in dryRun mode without errors', () => {
  const result = syncSuitesAndConfigs({ dryRun: true });
  assert.equal(result.ok, true);
  assert.equal(result.success, true);
  assert.equal(result.dryRun, true);
  assert.ok(result.message.length > 0);
});
