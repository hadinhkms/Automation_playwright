'use strict';

const test = require('node:test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('node:assert/strict');
const { escapeRegex, specArg, tagGrep, buildPlaywrightArgs, argsLength, MAX_ARGS_CHARS } = require('./runnerArgs');
const { normalizeDashboardConfig, DEFAULT_CONFIG, GREP_MAX_LENGTH } = require('../../core/config/dashboardConfig');

const ROOT = fs.realpathSync(os.tmpdir());
const abs = (rel) => path.join(ROOT, rel).replace(/\\/g, '/');

test('specArg is built from the absolute path: escaped, anchored both ends, / or \\ separators', () => {
  const arg = specArg('tests/e2e/odd [1] (x)+y$z.spec.js', ROOT);
  assert.ok(arg.startsWith('^') && arg.endsWith('$'));
  const re = new RegExp(arg, 'i');
  assert.ok(re.test(abs('tests/e2e/odd [1] (x)+y$z.spec.js')));
  assert.ok(re.test(abs('tests/e2e/odd [1] (x)+y$z.spec.js').replace(/\//g, '\\')), 'Windows separators');
  assert.ok(!re.test(`${abs('tests/e2e/odd [1] (x)+y$z.spec.js')}x`), 'end anchored');
});

test('S3: a nested folder with the same tail is not matched', () => {
  const re = new RegExp(specArg('tests/e2e/a.spec.js', ROOT), 'i');
  assert.ok(re.test(abs('tests/e2e/a.spec.js')));
  assert.ok(!re.test(abs('tests/sub/tests/e2e/a.spec.js')));
  assert.ok(!re.test(`/elsewhere${abs('tests/e2e/a.spec.js')}`), 'start anchored at the project root');
});

test('specArg handles spaces, dots and Unicode (NFC) names literally', () => {
  const name = 'tests/e2e/Đăng nhập ✓ (v2).spec.js'.normalize('NFC');
  const re = new RegExp(specArg(name, ROOT), 'i');
  assert.ok(re.test(abs(name)));
  assert.ok(!re.test(abs('tests/e2e/Dang nhap v2.spec.js')));
  assert.equal(escapeRegex('a.b*c'), 'a\\.b\\*c');
});

test('tagGrep has boundaries on both sides: @REQ is not @REQ-001, x@smoke is not @smoke', () => {
  const re = new RegExp(tagGrep(['@REQ']));
  assert.ok(!re.test('case @REQ-001'));
  assert.ok(re.test('case @REQ here'));
  assert.ok(re.test('case @REQ'));
  const smoke = new RegExp(tagGrep(['@smoke']));
  assert.ok(!smoke.test('x@smoke'));
  assert.ok(!smoke.test('a-@smoke'));
  assert.ok(smoke.test('login @smoke @e2e'));
  assert.equal(tagGrep(['@smoke', '@e2e']), '(?<![\\w@-])(?:@smoke|@e2e)(?![\\w-])');
});

test('buildPlaywrightArgs: specs anchored, projects, grep, ui/headed; legacy single spec still works', () => {
  assert.deepEqual(buildPlaywrightArgs({ specs: ['tests/a.spec.js'], projects: ['P1', 'P2'], grep: '@x', headed: true }, false, ROOT),
    ['test', specArg('tests/a.spec.js', ROOT), '--project=P1', '--project=P2', '--grep', '@x', '--headed']);
  assert.deepEqual(buildPlaywrightArgs({ spec: 'tests/a.spec.js', project: 'P' }, true, ROOT), ['test', specArg('tests/a.spec.js', ROOT), '--project=P', '--ui']);
  assert.deepEqual(buildPlaywrightArgs({ spec: 'all', project: 'all' }, false, ROOT), ['test']);
});

test('argsLength counts every argument plus one separator; 100 files of ordinary length stay under the cap (each arg now carries the absolute root)', () => {
  assert.equal(argsLength(['ab', 'c']), 5);
  const specs = Array.from({ length: 100 }, (_, i) => `tests/e2e/desktop/some_reasonably_long_name_${i}.spec.js`);
  assert.ok(argsLength(buildPlaywrightArgs({ specs }, false, ROOT)) < MAX_ARGS_CHARS);
});

test('suite grep keeps up to 200 characters (cap raised from 80, no silent truncation)', () => {
  const grep = 'x'.repeat(150);
  assert.equal(GREP_MAX_LENGTH, 200);
  const cfg = normalizeDashboardConfig({ suites: { s1: { label: 'S1', grep, platforms: { desktop: { grep } } } } }, DEFAULT_CONFIG);
  assert.equal(cfg.suites.s1.grep.length, 150);
  assert.equal(cfg.suites.s1.platforms.desktop.grep.length, 150);
  const tooLong = normalizeDashboardConfig({ suites: { s2: { label: 'S2', grep: 'y'.repeat(300) } } }, DEFAULT_CONFIG);
  assert.equal(tooLong.suites.s2.grep.length, 200);
});
