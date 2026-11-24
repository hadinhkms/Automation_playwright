'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { parseReport, readResults, sanitizeError } = require('./runResultsParser');
const { createJsonRunStore } = require('./jsonRunStore');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'rrp-'));
const t = (status, duration = 10, projectName = 'P') => ({ projectName, status, results: [{ duration, error: status === 'unexpected' ? { message: 'boom\nsecond line' } : undefined }] });

test('parseReport walks nested suites and maps statuses; file is relative to the project root with /', () => {
  const root = tmp();
  try {
    const rootDir = path.join(fs.realpathSync(root), 'tests');
    const report = { config: { rootDir }, suites: [{ file: 'e2e/a.spec.js', suites: [{ specs: [
      { file: 'e2e/a.spec.js', title: 'one', line: 3, tests: [t('expected', 5), t('unexpected', 7)] },
      { file: 'e2e/a.spec.js', title: 'two', line: 9, tests: [t('flaky'), t('skipped')] },
    ] }] }, { specs: [{ file: 'e2e/b.spec.js', title: 'three', line: 1, tests: [t('expected')] }] }] };
    const out = parseReport(report, root);
    assert.deepEqual(out.summary, { total: 5, passed: 2, failed: 1, flaky: 1, skipped: 1 });
    const byFile = Object.fromEntries(out.files.map((f) => [f.file, f]));
    assert.equal(byFile['tests/e2e/a.spec.js'].status, 'failed');
    assert.equal(byFile['tests/e2e/a.spec.js'].durationMs, 5 + 7 + 10 + 10);
    assert.equal(byFile['tests/e2e/b.spec.js'].status, 'passed');
    assert.deepEqual(out.failures.map((f) => [f.file, f.title, f.line, f.error]), [['tests/e2e/a.spec.js', 'one', 3, 'boom']]);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('file status: flaky when no failure, skipped when only skipped', () => {
  const root = tmp();
  try {
    const rootDir = fs.realpathSync(root);
    const out = parseReport({ config: { rootDir }, suites: [{ specs: [
      { file: 'f.spec.js', title: 'x', tests: [t('flaky'), t('expected')] }, { file: 's.spec.js', title: 'y', tests: [t('skipped')] }] }] }, root);
    assert.deepEqual(Object.fromEntries(out.files.map((f) => [f.file, f.status])), { 'f.spec.js': 'flaky', 's.spec.js': 'skipped' });
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('sanitizeError keeps the first line, masks Bearer values and ANSI, cuts at 300', () => {
  assert.equal(sanitizeError('\u001b[31mfail\u001b[0m with Bearer abc.def-1= here\nstack'), 'fail with Bearer *** here');
  assert.equal(sanitizeError('x'.repeat(400)).length, 300);
});

test('readResults: the raw file wins and is deleted; the fallback scan is lazy', async () => {
  const root = tmp();
  try {
    const rootDir = fs.realpathSync(root);
    const report = (title, startTime, project = 'P') => JSON.stringify({ config: { rootDir }, stats: { startTime }, suites: [{ specs: [{ file: 'a.spec.js', title, tests: [t('expected', 10, project)] }] }] });
    const run = { startedAt: '2026-11-24T10:00:00.000Z', finishedAt: '2026-11-24T10:05:00.000Z', projects: ['P'] };
    const raw = path.join(root, 'raw.json');
    fs.writeFileSync(raw, report('from raw', '2026-11-24T10:00:01.000Z'));
    const readdirs = [];
    const original = fs.promises.readdir;
    fs.promises.readdir = async (...args) => { readdirs.push(args[0]); return original(...args); };
    try {
      assert.equal((await readResults(root, raw, run)).files[0].file, 'a.spec.js');
    } finally { fs.promises.readdir = original; }
    assert.ok(!fs.existsSync(raw), 'raw deleted');
    assert.equal(readdirs.length, 0, 'playwright-report must not be scanned when the raw file was readable');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('R-2: the fallback results.json is accepted only inside the run window and for the run projects', async () => {
  const root = tmp();
  try {
    const rootDir = fs.realpathSync(root);
    const dir = path.join(root, 'playwright-report', '26-11-24', 'desktop');
    fs.mkdirSync(dir, { recursive: true });
    const put = (startTime, project) => fs.writeFileSync(path.join(dir, 'results.json'), JSON.stringify({ config: { rootDir }, stats: { startTime }, suites: [{ specs: [{ file: 'a.spec.js', title: 'x', tests: [t('expected', 10, project)] }] }] }));
    const run = { startedAt: new Date(Date.now() - 60000).toISOString(), finishedAt: new Date(Date.now() + 60000).toISOString(), projects: ['P'] };
    const none = path.join(root, 'missing.raw.json');

    put(new Date().toISOString(), 'P');
    assert.equal((await readResults(root, none, run)).source, 'json', 'inside the window, same project');
    put(new Date(Date.now() - 3600000).toISOString(), 'P');
    assert.equal((await readResults(root, none, run)).source, 'none', 'another terminal: started before this run');
    put(new Date().toISOString(), 'Other');
    assert.equal((await readResults(root, none, run)).source, 'none', 'another terminal: project outside the run projects');
    put(new Date().toISOString(), 'Other');
    assert.equal((await readResults(root, none, { ...run, projects: [] })).source, 'json', 'a run without projects accepts any project');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('jsonRunStore: quarantine keeps at most 3 corrupt copies; without quarantine a corrupt file is only skipped', () => {
  const root = tmp();
  try {
    const file = path.join(root, 'h', 'index.json');
    const valid = (r) => Boolean(r && r.id && r.startedAt);
    const web = createJsonRunStore({ fileFor: () => file, maxRuns: 5, isValidRecord: valid, quarantineCorrupt: true });
    const plain = createJsonRunStore({ fileFor: () => file, maxRuns: 5, isValidRecord: valid });
    fs.mkdirSync(path.dirname(file), { recursive: true });
    for (let i = 0; i < 5; i += 1) { fs.writeFileSync(file, '{broken'); assert.deepEqual(web.read(root), []); }
    assert.ok(fs.readdirSync(path.dirname(file)).filter((n) => n.startsWith('index.corrupt-')).length <= 3);
    fs.writeFileSync(file, '{broken');
    assert.deepEqual(plain.read(root), []);
    assert.ok(fs.existsSync(file), 'the plain store leaves the corrupt file in place');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('R-4: a read error other than ENOENT never overwrites the history (web and Mobile stores)', (t) => {
  if (process.getuid && process.getuid() === 0) return t.skip('root ignores file permissions');
  const root = tmp();
  try {
    const mobile = require('./mobileRunHistory');
    const valid = (r) => Boolean(r && r.id && r.startedAt);
    const dir = path.join(root, 'h');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'index.json');
    const store = createJsonRunStore({ fileFor: () => file, maxRuns: 5, isValidRecord: valid });
    const rec = (id) => ({ id, startedAt: new Date().toISOString() });

    assert.ok(store.append(root, rec('a')), 'ENOENT: the first write creates the file');
    const before = fs.readFileSync(file, 'utf8');
    fs.chmodSync(file, 0o000);
    try {
      assert.equal(store.append(root, rec('b')), null, 'EACCES: the write is skipped');
      assert.deepEqual(store.read(root), [], 'reads stay tolerant');
    } finally { fs.chmodSync(file, 0o644); }
    assert.equal(fs.readFileSync(file, 'utf8'), before, 'the history file is untouched');
    assert.ok(store.append(root, rec('c')), 'once readable again, writing resumes');
    assert.deepEqual(store.read(root).map((r) => r.id).sort(), ['a', 'c']);

    // the same guarantee through the Mobile history built on the shared store
    const mobileRun = { id: 'm1', platform: 'android', status: 'passed', startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), options: {} };
    mobile.appendRun(root, mobileRun);
    const mFile = mobile.historyFile(root);
    const mBefore = fs.readFileSync(mFile, 'utf8');
    fs.chmodSync(mFile, 0o000);
    try { assert.equal(mobile.appendRun(root, { ...mobileRun, id: 'm2' }), null); } finally { fs.chmodSync(mFile, 0o644); }
    assert.equal(fs.readFileSync(mFile, 'utf8'), mBefore);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
