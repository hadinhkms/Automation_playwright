'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const { safeConfigError } = require('./runOptions');

// Gate 3 T1: the config error shown in the 400 must not leak host paths, even with spaces/brackets.
const none = (text, ...secrets) => secrets.forEach((s) => assert.ok(!text.includes(s), `"${s}" leaked in: ${text}`));

test('project root with spaces and brackets is replaced before cutting', () => {
  const root = '/Users/John Smith/my (proj)';
  const out = safeConfigError(`boom at ${root}/cfg/x.js`, root);
  none(out, 'John', 'Smith', 'my (proj)', '/Users');
  assert.match(out, /x\.js/);
  assert.equal(safeConfigError(`cannot chdir ${root}`, root), 'cannot chdir <project>');
});

test('Windows root and Windows path with spaces: no user or folder names leak', () => {
  const root = 'C:\\Users\\Bob\\a b';
  const known = safeConfigError("Cannot find 'C:\\Users\\Bob\\a b\\c.js'", root);
  none(known, 'Bob', 'Users', 'a b');
  assert.match(known, /c\.js/);
  const unknown = safeConfigError('Error in C:\\Users\\Bob\\a b\\c.js', '/some/other/root');
  none(unknown, 'Bob', 'Users', 'a b');
  assert.match(unknown, /c\.js/);
});

test('home directory is masked even when the project is elsewhere', () => {
  const home = os.homedir();
  const out = safeConfigError(`boom at ${home}/secret dir/(x)/y.js`, '/tmp/elsewhere');
  none(out, home, 'secret dir');
  assert.match(out, /y\.js/);
});

test('only the first line is used (no Require stack) and plain text is untouched', () => {
  assert.equal(safeConfigError("Cannot find module './m'\nRequire stack:\n- /abs/secret/playwright.config.js", '/abs/secret'), "Cannot find module './m'");
  assert.equal(safeConfigError('boom', '/x'), 'boom');
});
