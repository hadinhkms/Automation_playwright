/**
 * tests/dashboard-api/run-history.test.js
 * GĐ2a (CONTRACT-run-history): web run history written when the child exits, read through /api/run-history*,
 * via real HTTP and real Playwright runs in a fixture workspace.
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
const TOKEN = 'SECRET_TOKEN_VALUE_9f3a';
const OK = 'tests/e2e/desktop/ok.spec.js';
const FAIL = 'tests/e2e/desktop/fail.spec.js';
const LONG = 'tests/e2e/desktop/long.spec.js';
const CONFIG = `module.exports = { testDir: './tests', retries: 0,
  reporter: [['list'], ['json', { outputFile: 'results.json' }], ['html', { outputFolder: 'playwright-report/html', open: 'never' }]],
  projects: [{ name: 'Desktop Smoke Tests', testMatch: '**/e2e/desktop/**' }] };\n`;
const hdr = `const { test } = require(${PW});\n`;
const FILES = {
  [OK]: `${hdr}test('first @smoke', async () => {});\ntest('second', async () => {});\ntest.skip('third skipped', async () => {});\n`,
  [FAIL]: `${hdr}test('passes', async () => {});\ntest('boom', async () => { throw new Error('call failed Authorization: Bearer abc.DEF-123~x token ${TOKEN} ' + 'x'.repeat(500)); });\n`,
  [LONG]: `${hdr}test('long', async () => { await new Promise((r) => setTimeout(r, 30000)); });\n`,
};

describe('GET /api/run-history* after real runs', () => {
  let fixture; let harness; let root;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const get = async (p) => { const res = await fetch(`${harness.url}${p}`); return { status: res.status, body: await res.json() }; };
  const post = (p, body) => fetch(`${harness.url}${p}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const idle = async () => { for (let i = 0; i < 150; i += 1) { if (!(await (await fetch(`${harness.url}/api/state`)).json()).activeRun) return; await sleep(200); } throw new Error('run did not finish'); };
  // The record is written AFTER the run is released and its final status published (R-3): wait for it.
  const recorded = async (id) => { for (let i = 0; i < 100; i += 1) { if ((await fetch(`${harness.url}/api/run-history/${id}`)).status === 200) return; await sleep(100); } throw new Error(`no history record for ${id}`); };
  const runAndWait = async (body) => { const res = await post('/api/run', body); assert.equal(res.status, 202); const id = (await res.json()).id; await idle(); await recorded(id); return id; };
  const write = (rel, text) => { const full = path.join(root, rel); fs.mkdirSync(path.dirname(full), { recursive: true }); fs.writeFileSync(full, text); };

  before(async () => {
    fixture = createFixtureWorkspace();
    root = fixture.rootPath;
    write('playwright.config.js', CONFIG);
    write('dashboardConfig.json', JSON.stringify({ api: { registrationBearerToken: TOKEN } }));
    Object.entries(FILES).forEach(([rel, text]) => write(rel, text));
    harness = await startDashboardHarness(root);
  });
  after(async () => { if (harness) await harness.stop(); if (fixture) fixture.cleanup(); });

  test('empty at the start: 200 with no runs, no latest-failed, no file-status', async () => {
    assert.deepEqual((await get('/api/run-history')).body, { version: 1, runs: [] });
    assert.deepEqual((await get('/api/run-history/latest-failed')).body, { run: null, specs: [], missing: [] });
    assert.deepEqual((await get('/api/run-history/file-status')).body, { files: {} });
  });

  test('the env var makes Playwright write the raw JSON and the HTML report is still produced', () => {
    const rawFile = path.join(root, 'raw-check.json');
    const res = spawnSync(process.execPath, [PW_CLI, 'test', 'ok.spec.js'], { cwd: root, encoding: 'utf8', env: { ...process.env, NODE_ENV: 'qc', PLAYWRIGHT_JSON_OUTPUT_FILE: rawFile } });
    assert.equal(res.status, 0, res.stdout + res.stderr);
    const json = JSON.parse(fs.readFileSync(rawFile, 'utf8'));
    assert.equal(json.stats.expected, 2);
    assert.ok(fs.existsSync(path.join(root, 'playwright-report/html/index.html')), 'HTML report must still exist');
    assert.ok(!fs.existsSync(path.join(root, 'results.json')), 'documented deviation: the config results.json is replaced by the env file');
  });

  test('a finished passing run is recorded with per-file counts that match the fixture and the run log', async () => {
    const id = await runAndWait({ specs: [OK], projects: ['Desktop Smoke Tests'] });
    const { body } = await get('/api/run-history');
    const rec = body.runs.find((r) => r.id === id);
    assert.ok(rec, 'record present');
    assert.equal(rec.status, 'passed');
    assert.equal(rec.exitCode, 0);
    assert.deepEqual(rec.specs, [OK]);
    assert.deepEqual(rec.projects, ['Desktop Smoke Tests']);
    assert.equal(rec.resultsSource, 'json');
    assert.deepEqual(rec.summary, { total: 3, passed: 2, failed: 0, flaky: 0, skipped: 1 });
    assert.equal(rec.files.length, 1);
    assert.equal(rec.files[0].file, OK);
    assert.equal(rec.files[0].status, 'passed');
    assert.deepEqual([rec.files[0].passed, rec.files[0].failed, rec.files[0].skipped], [2, 0, 1]);
    assert.ok(!('failures' in rec) && !('command' in rec), 'the list drops failures and command');
    const log = (await (await fetch(`${harness.url}/api/state`)).json()).logs.map((e) => e.payload.text).join('');
    assert.match(log, /2 passed/);
    assert.match(log, /1 skipped/);
    assert.ok(!fs.existsSync(path.join(root, 'test-results/web-runs', `${id}.raw.json`)), 'raw file is deleted after reading');
    const full = (await get(`/api/run-history/${id}`)).body;
    assert.equal(full.id, id);
    assert.ok(full.command.includes('playwright'));
  });

  test('a failing run: failures masked (token and Bearer) and cut to 300 chars; latest-failed and file-status by file', async () => {
    const id = await runAndWait({ specs: [FAIL, OK], projects: ['Desktop Smoke Tests'] });
    const rec = (await get(`/api/run-history/${id}`)).body;
    assert.equal(rec.status, 'failed');
    assert.notEqual(rec.exitCode, 0);
    assert.deepEqual(rec.summary, { total: 5, passed: 3, failed: 1, flaky: 0, skipped: 1 });
    const byFile = Object.fromEntries(rec.files.map((f) => [f.file, f.status]));
    assert.deepEqual(byFile, { [FAIL]: 'failed', [OK]: 'passed' });
    assert.equal(rec.failures.length, 1);
    const [failure] = rec.failures;
    assert.equal(failure.file, FAIL);
    assert.match(failure.title, /boom/);
    assert.ok(failure.error.length <= 300, `error length ${failure.error.length}`);
    assert.ok(!failure.error.includes(TOKEN), failure.error);
    assert.ok(!failure.error.includes('abc.DEF-123'), failure.error);
    assert.match(failure.error, /\*\*\*/);
    const raw = fs.readFileSync(path.join(root, 'test-results/web-runs/index.json'), 'utf8');
    assert.ok(!raw.includes(TOKEN) && !raw.includes('abc.DEF-123'), 'the stored file is masked too');

    const latest = (await get('/api/run-history/latest-failed')).body;
    assert.equal(latest.run.id, id);
    assert.deepEqual(latest.specs, [FAIL]);
    assert.deepEqual(latest.missing, []);
    const fs2 = (await get('/api/run-history/file-status')).body.files;
    assert.equal(fs2[FAIL].status, 'failed');
    assert.equal(fs2[FAIL].runId, id);
    assert.equal(fs2[OK].runId, id, 'newest result per file');
  });

  test('latest-failed reports files that no longer exist under "missing"', async () => {
    fs.renameSync(path.join(root, FAIL), path.join(root, 'tests/e2e/desktop/fail.removed'));
    try {
      const latest = (await get('/api/run-history/latest-failed')).body;
      assert.deepEqual(latest.specs, []);
      assert.deepEqual(latest.missing, [FAIL]);
    } finally {
      fs.renameSync(path.join(root, 'tests/e2e/desktop/fail.removed'), path.join(root, FAIL));
    }
  });

  test('a stopped run is recorded as stopped, has no results, and does not count for latest-failed/file-status', async () => {
    const before = (await get('/api/run-history/file-status')).body.files;
    const res = await post('/api/run', { specs: [LONG], projects: ['Desktop Smoke Tests'] });
    assert.equal(res.status, 202);
    const id = (await res.json()).id;
    await sleep(2500);
    assert.equal((await post('/api/stop', {})).status, 202);
    await idle();
    await recorded(id);
    const rec = (await get(`/api/run-history/${id}`)).body;
    assert.equal(rec.status, 'stopped');
    assert.equal(rec.resultsSource, 'none');
    assert.deepEqual(rec.files, []);
    assert.deepEqual((await get('/api/run-history/file-status')).body.files, before);
    assert.notEqual((await get('/api/run-history/latest-failed')).body.run.id, id);
  });

  test('two runs finishing back to back leave two records, newest first', async () => {
    const a = await runAndWait({ specs: [OK], projects: ['Desktop Smoke Tests'] });
    const b = await runAndWait({ specs: [OK], projects: ['Desktop Smoke Tests'] });
    const ids = (await get('/api/run-history?limit=5')).body.runs.map((r) => r.id);
    assert.deepEqual(ids.slice(0, 2), [b, a]);
  });

  test('rejections: unsafe or unknown ids are 404; limit falls back to the default, caps at 100', async () => {
    for (const id of ['..%2F..%2Fetc', 'nope', 'a%20b', '%E0%A4%A']) assert.equal((await get(`/api/run-history/${id}`)).status, 404, id);
    const total = (await get('/api/run-history?limit=100')).body.runs.length;
    for (const limit of ['-1', 'abc', '0', '']) assert.equal((await get(`/api/run-history?limit=${limit}`)).body.runs.length, Math.min(20, total), limit);
    assert.ok((await get('/api/run-history?limit=1000')).body.runs.length <= 100);
    assert.equal((await get('/api/run-history?limit=1')).body.runs.length, 1);
  });

  test('a corrupt history file is renamed to index.corrupt-*.json, reads stay 200 and recording continues', async () => {
    const dir = path.join(root, 'test-results/web-runs');
    fs.writeFileSync(path.join(dir, 'index.json'), '{"version":1,"runs":[{"id":"x"');
    assert.deepEqual((await get('/api/run-history')).body, { version: 1, runs: [] });
    assert.ok(fs.readdirSync(dir).some((n) => /^index\.corrupt-\d+\.json$/.test(n)), fs.readdirSync(dir).join());
    const id = await runAndWait({ specs: [OK], projects: ['Desktop Smoke Tests'] });
    assert.deepEqual((await get('/api/run-history')).body.runs.map((r) => r.id), [id]);
  });

  test('records missing fields are skipped on read without breaking the list', async () => {
    const file = path.join(root, 'test-results/web-runs/index.json');
    const good = JSON.parse(fs.readFileSync(file, 'utf8')).runs[0];
    fs.writeFileSync(file, JSON.stringify({ version: 1, runs: [{ id: 'bad' }, { ...good, startedAt: 'not a date', id: 'bad2' }, good, 7, null] }));
    const runs = (await get('/api/run-history')).body.runs;
    assert.deepEqual(runs.map((r) => r.id), [good.id]);
  });

  test('P-1: a request body over 2 MB answers 413 (not 400)', async () => {
    const res = await post('/api/run', { grep: 'x'.repeat(3 * 1024 * 1024) });
    assert.equal(res.status, 413);
  });
});

describe('history store limits (unit through the service)', () => {
  const { recordWebRun, listRuns, historyFile, MAX_RUNS } = require('../../dashboard/services/runHistoryService');
  const os = require('os');
  test('101 runs leave 100, newest first; unknown results source is "none"', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'run-hist-'));
    try {
      for (let i = 0; i < 101; i += 1) {
        const startedAt = new Date(Date.UTC(2026, 10, 24, 8, 0, i)).toISOString();
        await recordWebRun(root, { id: `r${i}`, startedAt, finishedAt: startedAt, status: 'passed', exitCode: 0, options: {}, command: 'x' }, null);
      }
      assert.equal(MAX_RUNS, 100);
      const stored = JSON.parse(fs.readFileSync(historyFile(root), 'utf8')).runs;
      assert.equal(stored.length, 100);
      assert.equal(stored[0].id, 'r100');
      assert.equal(stored[99].id, 'r1');
      assert.equal(stored[0].resultsSource, 'none');
      assert.equal(listRuns(root, 1000).length, 100);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
});
