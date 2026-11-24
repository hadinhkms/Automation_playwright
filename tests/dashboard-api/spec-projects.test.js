/**
 * tests/dashboard-api/spec-projects.test.js
 * NB-PK-1: GET /api/config specProjects must equal what `playwright test --list` says (grep/grepInvert per FULL test
 * title: describe + title + tag option), not a guess from the whole file text. Plus cache, estimate flag and budget.
 */
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { startDashboardHarness } = require('../dashboard/support/dashboardHarness');
const { createFixtureWorkspace } = require('../dashboard/support/fixtureWorkspace');

const PW = JSON.stringify(require.resolve('@playwright/test'));
const PW_CLI = require.resolve('@playwright/test/cli');

const CONFIG = `module.exports = { projects: [
  { name: 'Desktop Smoke Tests', testMatch: '**/e2e/desktop/**', grep: /@smoke/ },
  { name: 'Desktop Regression Tests', testMatch: '**/e2e/desktop/**', grep: /@e2e/, grepInvert: /@smoke/ },
  { name: 'Mobile Chrome Smoke Tests', testMatch: '**/e2e/mobile/**' },
  { name: 'API Tests', testMatch: '**/api/**' },
] };\n`;

const hdr = `const { test } = require(${PW});\n`;
const FILES = {
  // the reported bug: one @smoke test + two @e2e tests in the same file
  'tests/e2e/desktop/mixed.spec.js': `${hdr}test('smoke part @smoke', async () => {});\ntest('e2e part one @e2e', async () => {});\ntest('e2e part two @e2e', async () => {});\n`,
  // tags only on describe titles, nested
  'tests/e2e/desktop/nested.spec.js': `${hdr}test.describe('suite @e2e', () => {\n  test('plain', async () => {});\n  test.describe('inner @smoke', () => { test('deep', async () => {}); });\n});\n`,
  // tags through the tag option (Playwright >= 1.42): no tag text in the title
  'tests/e2e/desktop/option.spec.js': `${hdr}test('by option', { tag: '@e2e' }, async () => {});\ntest('by option smoke', { tag: ['@smoke'] }, async () => {});\n`,
  // the word @smoke only in a comment: must not remove Regression
  'tests/e2e/desktop/comment.spec.js': `${hdr}// not a @smoke file, the word is only in this comment\ntest('only regression @e2e', async () => {});\n`,
  // nothing in this file matches any desktop project
  'tests/e2e/desktop/plain.spec.js': `${hdr}test('no tag at all', async () => {});\n`,
  'tests/e2e/mobile/m.spec.js': `${hdr}test('mobile', async () => {});\n`,
  'tests/api/a.spec.js': `${hdr}test('api', async () => {});\n`,
};

function realMap(root) {
  const res = spawnSync(process.execPath, [PW_CLI, 'test', '--list', '--reporter=json'], { cwd: root, encoding: 'utf8' });
  const json = JSON.parse(res.stdout);
  const base = fs.realpathSync(root);
  const out = {};
  const visit = (s) => {
    for (const spec of s.specs || []) {
      const rel = path.relative(base, path.resolve(json.config.rootDir, spec.file)).split(path.sep).join('/');
      for (const t of spec.tests) (out[rel] ??= new Set()).add(t.projectName);
    }
    (s.suites || []).forEach(visit);
  };
  json.suites.forEach(visit);
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, [...v].sort()]));
}

function writeFixture() {
  const fixture = createFixtureWorkspace();
  fs.writeFileSync(path.join(fixture.rootPath, 'playwright.config.js'), CONFIG);
  for (const [rel, body] of Object.entries(FILES)) {
    const full = path.join(fixture.rootPath, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body);
  }
  return fixture;
}

describe('GET /api/config specProjects equals playwright --list', () => {
  let fixture; let harness;
  const config = async () => { const t = Date.now(); const body = await (await fetch(`${harness.url}/api/config`)).json(); return { body, ms: Date.now() - t }; };
  before(async () => { fixture = writeFixture(); harness = await startDashboardHarness(fixture.rootPath); });
  after(async () => { if (harness) await harness.stop(); if (fixture) fixture.cleanup(); });

  test('the reported file lists BOTH Desktop projects (cold call), flagged as playwright data', async () => {
    const { body } = await config();
    assert.equal(body.specProjectsSource, 'playwright');
    assert.deepEqual(body.specProjects['tests/e2e/desktop/mixed.spec.js'], ['Desktop Smoke Tests', 'Desktop Regression Tests']);
  });

  test('every file equals the real --list result (nested describe, tag option, comment-only @smoke, no match)', async () => {
    const { body } = await config();
    const real = realMap(fixture.rootPath);
    for (const spec of Object.keys(FILES)) {
      const expected = (real[spec] || []).slice().sort();
      assert.deepEqual((body.specProjects[spec] || []).slice().sort(), expected, spec);
    }
    assert.deepEqual(body.specProjects['tests/e2e/desktop/comment.spec.js'], ['Desktop Regression Tests']);
    assert.deepEqual(body.specProjects['tests/e2e/desktop/plain.spec.js'], []);
    // 'suite @e2e plain' runs in Regression, 'suite @e2e inner @smoke deep' runs in Smoke
    assert.deepEqual(body.specProjects['tests/e2e/desktop/nested.spec.js'], ['Desktop Smoke Tests', 'Desktop Regression Tests']);
  });

  test('payload shape: existing fields untouched, one added field', async () => {
    const { body } = await config();
    for (const key of ['projects', 'environments', 'specs', 'specTags', 'availableTags', 'specProjects', 'defaults', 'branding', 'suites']) assert.ok(key in body, key);
    assert.ok(Array.isArray(body.specProjects['tests/api/a.spec.js']));
  });

  test('warm calls are served from cache well under 300 ms', async () => {
    await config();
    const times = [];
    for (let i = 0; i < 5; i += 1) times.push((await config()).ms);
    assert.ok(Math.max(...times) < 300, `warm times ${times.join(',')} ms`);
  });

  test('editing a spec invalidates the cache (mtime/size): map follows the file', async () => {
    const mixed = path.join(fixture.rootPath, 'tests/e2e/desktop/mixed.spec.js');
    fs.writeFileSync(mixed, `${hdr}test('only smoke now @smoke', async () => {});\n`);
    const { body } = await config();
    assert.deepEqual(body.specProjects['tests/e2e/desktop/mixed.spec.js'], ['Desktop Smoke Tests']);
    fs.writeFileSync(mixed, FILES['tests/e2e/desktop/mixed.spec.js']);
    assert.deepEqual((await config()).body.specProjects['tests/e2e/desktop/mixed.spec.js'], ['Desktop Smoke Tests', 'Desktop Regression Tests']);
  });
});

describe('estimate flag when playwright --list cannot answer', () => {
  let fixture; let harness;
  after(async () => { if (harness) await harness.stop(); if (fixture) fixture.cleanup(); });

  test('a config that hangs only while listing, past the timeout, answers quickly with source "estimate"', async () => {
    fixture = writeFixture();
    fs.writeFileSync(path.join(fixture.rootPath, 'playwright.config.js'), `if (process.argv.includes('--list')) { const t = Date.now(); while (Date.now() - t < 6000) {} }\n${CONFIG}`);
    process.env.DASHBOARD_SPEC_LIST_TIMEOUT_MS = '600';
    try { harness = await startDashboardHarness(fixture.rootPath); } finally { delete process.env.DASHBOARD_SPEC_LIST_TIMEOUT_MS; }
    const started = Date.now();
    const res = await fetch(`${harness.url}/api/config`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.specProjectsSource, 'estimate');
    assert.ok(Date.now() - started < 5000);
    assert.ok(Array.isArray(body.specs) && body.specs.length === Object.keys(FILES).length);
  });
});
