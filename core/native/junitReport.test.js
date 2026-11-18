/**
 * core/native/junitReport.test.js
 * Merging WDIO worker JUnit files into one report and reading the test cases back (REQ-203, AC-205).
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { parseJunitCases, mergeJunitXml, mergeRunReports } = require('./junitReport');

const worker = (suite, cases) => `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="wdio" tests="${cases.length}">
  <testsuite name="${suite}" tests="${cases.length}">
${cases.join('\n')}
  </testsuite>
</testsuites>`;

const PASS = (name) => `    <testcase classname="native.android.${name}" name="TC ${name} &amp; ok" time="1.5"/>`;
const FAIL = (name) => `    <testcase classname="native.android.${name}" name="TC ${name}" time="2"><failure message="boom"/></testcase>`;
const SKIP = (name) => `    <testcase classname="native.android.${name}" name="TC ${name}"><skipped/></testcase>`;

describe('parseJunitCases', () => {
  test('reads passed, failed and skipped cases with decoded names', () => {
    const cases = parseJunitCases(worker('A', [PASS('a'), FAIL('b'), SKIP('c')]));
    assert.deepEqual(cases.map((c) => [c.classname, c.name, c.status]), [
      ['native.android.a', 'TC a & ok', 'passed'],
      ['native.android.b', 'TC b', 'failed'],
      ['native.android.c', 'TC c', 'skipped'],
    ]);
  });

  test('returns an empty list for empty or non-JUnit input', () => {
    assert.deepEqual(parseJunitCases(''), []);
    assert.deepEqual(parseJunitCases('<html></html>'), []);
  });
});

describe('mergeJunitXml / mergeRunReports', () => {
  test('one <testsuites> root with summed totals and every suite kept', () => {
    const xml = mergeJunitXml([worker('A', [PASS('a')]), worker('B', [FAIL('b'), SKIP('c')])], 'native-x');
    assert.match(xml, /<testsuites name="native-x" tests="3" failures="1" errors="0" skipped="1" time="3.500">/);
    assert.equal((xml.match(/<testsuite\b/g) || []).length, 2);
    assert.equal((xml.match(/<testsuites\b/g) || []).length, 1);
    assert.equal(parseJunitCases(xml).length, 3);
  });

  test('merges only the files of the given run and removes them', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'junit-'));
    fs.writeFileSync(path.join(dir, 'junit-r1-0-0.xml'), worker('A', [PASS('a')]));
    fs.writeFileSync(path.join(dir, 'junit-r1-0-1.xml'), worker('B', [PASS('b')]));
    fs.writeFileSync(path.join(dir, 'junit-r2-0-0.xml'), worker('C', [PASS('c')]));
    const merged = mergeRunReports(dir, 'r1');
    assert.equal(path.basename(merged), 'junit-r1.xml');
    assert.equal(parseJunitCases(fs.readFileSync(merged, 'utf8')).length, 2);
    assert.deepEqual(fs.readdirSync(dir).sort(), ['junit-r1.xml', 'junit-r2-0-0.xml']);
    assert.equal(mergeRunReports(dir, 'r1'), merged, 'a second call keeps the merged file');
    assert.equal(mergeRunReports(dir, 'none'), '');
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  });

  test('writes to an explicit target such as a gate receipt path', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'junit-'));
    fs.writeFileSync(path.join(dir, 'junit-r3-0-0.xml'), worker('A', [FAIL('a')]));
    const target = path.join(dir, 'out', 'receipt.xml');
    assert.equal(mergeRunReports(dir, 'r3', target), target);
    assert.equal(parseJunitCases(fs.readFileSync(target, 'utf8'))[0].status, 'failed');
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  });
});
