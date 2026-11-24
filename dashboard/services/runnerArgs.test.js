'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { escapeRegex, specArg, tagGrep, buildPlaywrightArgs, argsLength, MAX_ARGS_CHARS } = require('./runnerArgs');
const { normalizeDashboardConfig, DEFAULT_CONFIG, GREP_MAX_LENGTH } = require('../../core/config/dashboardConfig');

test('specArg escapes regex metacharacters, anchors the end and accepts / or \\ separators', () => {
  assert.equal(specArg('tests/e2e/a.spec.js'), 'tests[\\\\/]e2e[\\\\/]a\\.spec\\.js$');
  assert.equal(specArg('tests/e2e/odd [1] (x)+y$z.spec.js'), 'tests[\\\\/]e2e[\\\\/]odd \\[1\\] \\(x\\)\\+y\\$z\\.spec\\.js$');
  const re = new RegExp(specArg('tests/e2e/odd [1] (x)+y$z.spec.js'), 'i');
  assert.ok(re.test('/abs/tests/e2e/odd [1] (x)+y$z.spec.js'));
  assert.ok(re.test('C:\\abs\\tests\\e2e\\odd [1] (x)+y$z.spec.js'), 'Windows separators');
  assert.ok(!re.test('/abs/tests/e2e/odd [1] (x)+y$z.spec.jsx'), 'end anchored');
});

test('specArg handles spaces, dots and Unicode (NFC) names literally', () => {
  const name = 'tests/e2e/Đăng nhập ✓ (v2).spec.js'.normalize('NFC');
  const re = new RegExp(specArg(name), 'i');
  assert.ok(re.test(`/x/${name}`));
  assert.ok(!re.test('/x/tests/e2e/Dang nhap v2.spec.js'));
  assert.equal(escapeRegex('a.b*c'), 'a\\.b\\*c');
});

test('tagGrep puts a tag boundary after every tag: @REQ never matches @REQ-001', () => {
  const re = new RegExp(tagGrep(['@REQ']));
  assert.ok(!re.test('case @REQ-001'));
  assert.ok(re.test('case @REQ here'));
  assert.ok(re.test('case @REQ'));
  assert.equal(tagGrep(['@smoke', '@e2e']), '(?:@smoke|@e2e)(?![\\w-])');
});

test('buildPlaywrightArgs: specs anchored, projects, grep, ui/headed; legacy single spec still works', () => {
  assert.deepEqual(buildPlaywrightArgs({ specs: ['tests/a.spec.js'], projects: ['P1', 'P2'], grep: '@x', headed: true }),
    ['test', specArg('tests/a.spec.js'), '--project=P1', '--project=P2', '--grep', '@x', '--headed']);
  assert.deepEqual(buildPlaywrightArgs({ spec: 'tests/a.spec.js', project: 'P' }, true), ['test', specArg('tests/a.spec.js'), '--project=P', '--ui']);
  assert.deepEqual(buildPlaywrightArgs({ spec: 'all', project: 'all' }), ['test']);
});

test('argsLength counts every argument plus one separator; 200 files of ordinary length stay far under the cap', () => {
  assert.equal(argsLength(['ab', 'c']), 5);
  const specs = Array.from({ length: 200 }, (_, i) => `tests/e2e/desktop/some_reasonably_long_name_${i}.spec.js`);
  assert.ok(argsLength(buildPlaywrightArgs({ specs })) < MAX_ARGS_CHARS);
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
