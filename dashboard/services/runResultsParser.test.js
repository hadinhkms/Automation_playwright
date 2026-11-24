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

test('readResults: the raw file wins and is deleted; otherwise the newest results.json since startedAt; otherwise none', () => {
  const root = tmp();
  try {
    const rootDir = fs.realpathSync(root);
    const report = (title) => JSON.stringify({ config: { rootDir }, suites: [{ specs: [{ file: 'a.spec.js', title, tests: [t('expected')] }] }] });
    const raw = path.join(root, 'raw.json');
    fs.writeFileSync(raw, report('from raw'));
    assert.equal(readResults(root, raw, 0).files[0].file, 'a.spec.js');
    assert.ok(!fs.existsSync(raw), 'raw deleted');

    const dir = path.join(root, 'playwright-report', '26-11-24', 'desktop');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'results.json'), report('fallback'));
    assert.equal(readResults(root, path.join(root, 'missing.json'), 0).source, 'json');
    assert.equal(readResults(root, null, Date.now() + 60000).source, 'none', 'older than startedAt is ignored');
    assert.deepEqual(readResults(root, null, Date.now() + 60000).summary, { total: 0, passed: 0, failed: 0, flaky: 0, skipped: 0 });
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
