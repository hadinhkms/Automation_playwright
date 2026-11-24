/**
 * tests/dashboard-api/run-history-hardening.test.js
 * Gate 3 R-1 (end to end masking), R-2 (results.json of another terminal), R-3 (huge report tree does not hold
 * the run), R-5 (exact route prefix), via real HTTP and real Playwright runs.
 */
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { startDashboardHarness } = require('../dashboard/support/dashboardHarness');
const { createFixtureWorkspace } = require('../dashboard/support/fixtureWorkspace');

const PW = JSON.stringify(require.resolve('@playwright/test'));
const hdr = `const { test } = require(${PW});\n`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SLOW = 'tests/e2e/desktop/slow.spec.js';
const QUICK = 'tests/e2e/desktop/quick.spec.js';
const CONFIG = (reporters) => `module.exports = { testDir: './tests', retries: 0, reporter: ${reporters}, projects: [{ name: 'Desktop Smoke Tests', testMatch: '**/e2e/desktop/**' }] };\n`;

function setup(configText) {
  const fixture = createFixtureWorkspace();
  const write = (rel, text) => { const full = path.join(fixture.rootPath, rel); fs.mkdirSync(path.dirname(full), { recursive: true }); fs.writeFileSync(full, text); };
  write('playwright.config.js', configText);
  write(SLOW, `${hdr}test('slow', async () => { await new Promise((r) => setTimeout(r, 3500)); });\n`);
  write(QUICK, `${hdr}test('quick', async () => {});\n`);
  return { fixture, write };
}

function client(getHarness) {
  const post = (p, body) => fetch(`${getHarness().url}${p}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const state = async () => (await fetch(`${getHarness().url}/api/state`)).json();
  const idle = async () => { for (let i = 0; i < 150; i += 1) { if (!(await state()).activeRun) return; await sleep(100); } throw new Error('run did not finish'); };
  const recordOf = async (id) => { for (let i = 0; i < 100; i += 1) { const res = await fetch(`${getHarness().url}/api/run-history/${id}`); if (res.status === 200) return res.json(); await sleep(100); } throw new Error(`no record ${id}`); };
  return { post, state, idle, recordOf };
}

describe('R-2: results.json written by another terminal is not attributed to this run', () => {
  let setupResult; let harness;
  const c = client(() => harness);
  before(async () => { setupResult = setup(CONFIG("[['list']]")); harness = await startDashboardHarness(setupResult.fixture.rootPath); });
  after(async () => { if (harness) await harness.stop(); if (setupResult) setupResult.fixture.cleanup(); });

  test('a foreign results.json (fresh mtime, old stats.startTime) -> resultsSource "none"', async () => {
    const res = await c.post('/api/run', { specs: [SLOW], projects: ['Desktop Smoke Tests'] });
    assert.equal(res.status, 202);
    const id = (await res.json()).id;
    await sleep(800);
    const rootDir = fs.realpathSync(setupResult.fixture.rootPath);
    setupResult.write('playwright-report/26-11-24/desktop/[x] report/results.json', JSON.stringify({
      config: { rootDir: path.join(rootDir, 'tests') }, stats: { startTime: new Date(Date.now() - 3600000).toISOString() },
      suites: [{ specs: [{ file: 'e2e/desktop/quick.spec.js', title: 'foreign', tests: [{ projectName: 'Desktop Smoke Tests', status: 'unexpected', results: [{ duration: 5, error: { message: 'foreign failure' } }] }] }] }],
    }));
    await c.idle();
    const rec = await c.recordOf(id);
    assert.equal(rec.status, 'passed');
    assert.equal(rec.resultsSource, 'none');
    assert.deepEqual(rec.files, []);
  });
});

describe('R-3 and R-5: huge report tree, route prefix', () => {
  let setupResult; let harness;
  const c = client(() => harness);
  before(async () => {
    setupResult = setup(CONFIG("[['list'], ['json', { outputFile: 'results.json' }]]"));
    const root = path.join(setupResult.fixture.rootPath, 'playwright-report');
    for (let d = 0; d < 21; d += 1) {
      const dir = path.join(root, `d${d}`, 'x');
      fs.mkdirSync(dir, { recursive: true });
      for (let i = 0; i < 1000; i += 1) fs.writeFileSync(path.join(dir, `f${i}.txt`), '');
    }
    harness = await startDashboardHarness(setupResult.fixture.rootPath);
  });
  after(async () => { if (harness) await harness.stop(); if (setupResult) setupResult.fixture.cleanup(); });

  test('R-3: with 21k files under playwright-report the run is released at once, the record is still correct, a new run is accepted', async () => {
    const res = await c.post('/api/run', { specs: [QUICK], projects: ['Desktop Smoke Tests'] });
    assert.equal(res.status, 202);
    const id = (await res.json()).id;
    await c.idle();
    const again = await c.post('/api/run', { specs: [QUICK], projects: ['Desktop Smoke Tests'] });
    assert.equal(again.status, 202, 'no 409 right after the run ended');
    const second = (await again.json()).id;
    await c.idle();
    const rec = await c.recordOf(id);
    assert.equal(rec.resultsSource, 'json');
    assert.deepEqual(rec.summary, { total: 1, passed: 1, failed: 0, flaky: 0, skipped: 0 });
    assert.equal((await c.recordOf(second)).status, 'passed');
  });

  test('R-5: only /api/run-history and /api/run-history/... are the history routes', async () => {
    for (const p of ['/api/run-historyX', '/api/run-history-evil', '/api/run-historyx/latest-failed']) {
      const res = await fetch(`${harness.url}${p}`);
      assert.equal(res.status, 404, p);
      assert.doesNotMatch((await res.json()).error, /lượt chạy/, `${p} must not be answered by the history route`);
    }
    assert.equal((await fetch(`${harness.url}/api/run-history`)).status, 200);
    assert.equal((await fetch(`${harness.url}/api/run-history/`)).status, 200);
    assert.equal((await fetch(`${harness.url}/api/run-history/latest-failed`)).status, 200);
  });
});

describe('R-1 end to end: the stored record never contains secrets', () => {
  let setupResult; let harness;
  const c = client(() => harness);
  const SECRETS = ['hunter2pass', 'ghp_', 'eyJ' + 'hbGciOiJIUzI1NiJ9', 'abcd1234efgh'];
  before(async () => {
    setupResult = setup(CONFIG("[['list'], ['json', { outputFile: 'results.json' }]]"));
    setupResult.write('tests/e2e/desktop/leak.spec.js', `${hdr}test('leaky', async () => { throw new Error('GET https://admin:hunter2pass@db.example.com/x?api_key=abcd1234efgh jwt eyJ${''}hbGciOiJIUzI1NiJ9.eyJ${''}zdWIiOiIxIn0.sig-abc'); });\n`);
    harness = await startDashboardHarness(setupResult.fixture.rootPath);
  });
  after(async () => { if (harness) await harness.stop(); if (setupResult) setupResult.fixture.cleanup(); });

  test('url userinfo, api_key and JWT in a failure are masked in the file and in the API', async () => {
    const res = await c.post('/api/run', { specs: ['tests/e2e/desktop/leak.spec.js'], projects: ['Desktop Smoke Tests'] });
    const id = (await res.json()).id;
    await c.idle();
    const rec = await c.recordOf(id);
    const text = JSON.stringify(rec) + fs.readFileSync(path.join(setupResult.fixture.rootPath, 'test-results/web-runs/index.json'), 'utf8');
    for (const secret of SECRETS) assert.ok(!text.includes(secret), `${secret} leaked`);
    assert.match(rec.failures[0].error, /\*\*\*/);
  });
});
