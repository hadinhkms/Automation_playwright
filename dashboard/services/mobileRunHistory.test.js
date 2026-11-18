/**
 * dashboard/services/mobileRunHistory.test.js
 * TC-2.8 (AC-204, EDGE-203, EDGE-204): durable run history, newest first, max 30, corrupt data skipped.
 */
const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { appendRun, listRuns, getRun, historyFile, MAX_RUNS } = require('./mobileRunHistory');

function run(id, minute, status = 'passed', extra = {}) {
  const startedAt = new Date(Date.UTC(2026, 10, 19, 8, minute)).toISOString();
  const finishedAt = new Date(Date.UTC(2026, 10, 19, 8, minute, 30)).toISOString();
  return {
    id, platform: 'android', status, startedAt, finishedAt, exitCode: 0, command: 'npx wdio run',
    options: { udid: 'SERIAL1', deviceName: 'CPH2481', specs: ['tests/native/android/a.native.js'], grep: '', app: { type: 'installed', appPackage: 'com.a.b' } },
    results: [{ title: 'TC-1', status: 'passed' }], evidence: [], ...extra,
  };
}

describe('mobileRunHistory', () => {
  let root;
  beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'mobile-hist-')); });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }));

  test('returns [] when no history file exists', () => {
    assert.deepEqual(listRuns(root), []);
    assert.equal(getRun(root, 'abc'), null);
  });

  test('persists runs newest first with duration, device and app', () => {
    appendRun(root, run('r1', 1));
    appendRun(root, run('r2', 5, 'failed'));
    const runs = listRuns(root);
    assert.deepEqual(runs.map((r) => r.id), ['r2', 'r1']);
    assert.equal(runs[1].durationMs, 30000);
    assert.deepEqual(runs[0].device, { udid: 'SERIAL1', name: 'CPH2481' });
    assert.equal(runs[0].app.appPackage, 'com.a.b');
    assert.ok(fs.existsSync(historyFile(root)));
    assert.equal(getRun(root, 'r1').status, 'passed');
  });

  test('records a stopped run (EDGE-204) and ignores runs still in progress', () => {
    appendRun(root, run('r1', 1, 'stopped'));
    assert.equal(appendRun(root, run('r2', 2, 'running')), null);
    assert.deepEqual(listRuns(root).map((r) => [r.id, r.status]), [['r1', 'stopped']]);
  });

  test(`keeps only the newest ${MAX_RUNS} runs and honours limit`, () => {
    for (let i = 0; i < MAX_RUNS + 5; i += 1) appendRun(root, run(`r${i}`, i));
    const runs = listRuns(root);
    assert.equal(runs.length, MAX_RUNS);
    assert.equal(runs[0].id, `r${MAX_RUNS + 4}`);
    assert.equal(listRuns(root, 3).length, 3);
    assert.equal(listRuns(root, 'abc').length, MAX_RUNS);
    assert.equal(listRuns(root, 999).length, MAX_RUNS);
  });

  test('re-saving the same id replaces the record instead of duplicating it', () => {
    appendRun(root, run('r1', 1, 'failed'));
    appendRun(root, run('r1', 1, 'passed'));
    assert.deepEqual(listRuns(root).map((r) => r.status), ['passed']);
  });

  test('corrupt JSON gives an empty list and the next append rewrites a valid file (EDGE-203)', () => {
    fs.mkdirSync(path.dirname(historyFile(root)), { recursive: true });
    fs.writeFileSync(historyFile(root), '{"runs": [ {"id": "x"', 'utf8');
    assert.deepEqual(listRuns(root), []);
    appendRun(root, run('r1', 1));
    assert.deepEqual(listRuns(root).map((r) => r.id), ['r1']);
  });

  test('invalid records are skipped while valid ones survive (EDGE-203)', () => {
    const good = appendRun(root, run('ok1', 1));
    const doc = { version: 1, runs: [good, null, 'text', { id: '../bad', status: 'passed', startedAt: good.startedAt }, { id: 'nodate', status: 'passed', startedAt: 'x' }] };
    fs.writeFileSync(historyFile(root), JSON.stringify(doc), 'utf8');
    assert.deepEqual(listRuns(root).map((r) => r.id), ['ok1']);
  });

  test('rejects unsafe ids on lookup and leaves no temp files behind', () => {
    appendRun(root, run('r1', 1));
    assert.equal(getRun(root, '../index'), null);
    assert.deepEqual(fs.readdirSync(path.dirname(historyFile(root))), ['index.json']);
  });
});
