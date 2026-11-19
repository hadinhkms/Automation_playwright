/**
 * dashboard/services/nativePageObjectGenerator.test.js
 * PLAN-25 P4 TC-4.3 (AC-403, BR-401/402, EDGE-404, I-02): Inspector → shared Screen.
 * Draft never lands in pages/, create writes pages/native/screens/, an existing Screen only gets the
 * current platform's locator cells, names and hand-edited source are validated.
 */
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { handlePageObject, listScreens, toClassName } = require('./nativePageObjectGenerator');
const { readLocators, mergeLocators, renderScreen } = require('../../core/native/screenSource');

const ELEMENTS = [
  { name: 'searchBox', locator: 'id:com.vieclam24h.qa:id/search', action: 'type' },
  { name: 'searchButton', locator: '~search', action: 'tap' },
  { name: 'title', locator: 'text:Việc làm', action: 'read' },
  { name: 'jobList', locator: 'id:list-jobs', action: 'visible' },
];
let root;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'native-po-'));
  fs.mkdirSync(path.join(root, 'pages', 'native'), { recursive: true });
  // The generated file requires '../NativeBasePage': give the temp root the real one.
  fs.cpSync(path.join(__dirname, '..', '..', 'pages', 'native', 'NativeBasePage.js'), path.join(root, 'pages', 'native', 'NativeBasePage.js'));
  fs.mkdirSync(path.join(root, 'core', 'native'), { recursive: true });
  fs.cpSync(path.join(__dirname, '..', '..', 'core', 'native', 'locators.js'), path.join(root, 'core', 'native', 'locators.js'));
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

const req = (extra) => ({ name: 'Job search', platform: 'android', elements: ELEMENTS, ...extra });

test('TC-4.3 BR-401: preview and draft never write into pages/; draft goes to .dashboard-drafts', () => {
  const preview = handlePageObject(root, req());
  assert.equal(preview.status, 200);
  assert.equal(preview.body.className, 'JobSearchScreen');
  assert.equal(preview.body.path, 'pages/native/screens/JobSearchScreen.js');
  assert.deepEqual(preview.body.missing, ['searchBox', 'searchButton', 'title', 'jobList'], 'iOS cells are still empty');
  const draft = handlePageObject(root, req({ mode: 'draft' }));
  assert.equal(draft.body.draft, '.dashboard-drafts/pages/native/screens/JobSearchScreen.js');
  assert.ok(fs.existsSync(path.join(root, draft.body.draft)));
  assert.ok(!fs.existsSync(path.join(root, 'pages', 'native', 'screens')));
});

test('TC-4.3 AC-403 BR-402: create writes a loadable Screen whose locators resolve through NativeBasePage.el()', () => {
  handlePageObject(root, req({ mode: 'draft' }));
  const created = handlePageObject(root, req({ mode: 'create' }));
  assert.equal(created.status, 201);
  const file = path.join(root, created.body.path);
  assert.ok(!fs.existsSync(path.join(root, '.dashboard-drafts/pages/native/screens/JobSearchScreen.js')), 'draft removed after create');
  const { JobSearchScreen } = require(file);
  assert.deepEqual(JobSearchScreen.locators.searchBox, { android: 'id:com.vieclam24h.qa:id/search', ios: null });
  const screen = new JobSearchScreen();
  assert.equal(screen.screenName, 'job_search');
  for (const fn of ['waitUntilLoaded', 'fillSearchBox', 'tapSearchButton', 'titleText', 'isJobListVisible']) assert.equal(typeof screen[fn], 'function', fn);
  global.driver = { isIOS: false };
  global.$ = (selector) => selector;
  try {
    assert.equal(screen.el('searchBox'), 'android=new UiSelector().resourceId("com.vieclam24h.qa:id/search")');
    assert.equal(screen.el('searchButton'), '~search');
  } finally { delete global.driver; delete global.$; }
});

test('TC-4.3 EDGE-404: an existing Screen is not overwritten; merge fills only this platform (I-02)', () => {
  handlePageObject(root, req({ mode: 'create' }));
  assert.throws(() => handlePageObject(root, req({ mode: 'create' })), (e) => e.status === 409 && e.exists === true);
  const ios = handlePageObject(root, { name: 'JobSearchScreen', platform: 'ios', merge: true, mode: 'create',
    elements: [{ name: 'searchBox', locator: '~searchField' }, { name: 'filter', locator: '~filter' }] });
  assert.equal(ios.status, 201);
  assert.deepEqual(ios.body.added, ['filter']);
  assert.deepEqual(ios.body.updated, ['searchBox']);
  const { entries } = readLocators(fs.readFileSync(path.join(root, ios.body.path), 'utf8'));
  assert.deepEqual(entries.searchBox, { android: 'id:com.vieclam24h.qa:id/search', ios: '~searchField' });
  assert.deepEqual(entries.filter, { android: null, ios: '~filter' });
  const [listed] = listScreens(root);
  assert.equal(listed.className, 'JobSearchScreen');
  assert.deepEqual(listed.missing.ios, ['searchButton', 'title', 'jobList']);
  assert.deepEqual(listed.missing.android, ['filter']);
});

test('TC-4.3: names, locators and edited source are validated', () => {
  assert.equal(toClassName('đăng nhập'), 'DangNhapScreen');
  assert.equal(toClassName('LoginScreen'), 'LoginScreen');
  assert.equal(toClassName('../../evil'), 'EvilScreen', 'path characters are stripped, never used as a path');
  for (const bad of ['', '123', '..', '   ', '9x']) assert.throws(() => toClassName(bad), (e) => e.status === 400, bad);
  const bads = [
    [{ name: 'Bad Name', locator: '~x' }], [{ name: 'a', locator: '~x' }, { name: 'a', locator: '~y' }],
    [{ name: 'a', locator: 'css:.x' }], [{ name: 'a', locator: 'pred:x == 1' }], [], new Array(41).fill({ name: 'a', locator: '~x' }),
  ];
  for (const elements of bads) assert.throws(() => handlePageObject(root, req({ elements })), (e) => e.status === 400);
  assert.throws(() => handlePageObject(root, req({ mode: 'create', source: 'class JobSearchScreen {' })), /cú pháp/);
  assert.throws(() => handlePageObject(root, req({ mode: 'create', source: 'module.exports = {};' })), /extends NativeBasePage/);
  assert.throws(() => handlePageObject(root, req({ mode: 'publish' })), (e) => e.status === 400);
});

test('merge refuses a hand-written locators block instead of rewriting it', () => {
  const src = renderScreen('XScreen', 'android', [{ name: 'a', locator: '~a', action: 'tap' }]);
  assert.equal(mergeLocators(src, 'ios', [{ name: 'a', locator: '~b' }]).source.includes("a: { android: '~a', ios: '~b' },"), true);
  const hand = src.replace("    a: { android: '~a', ios: null },", "    a: { android: someVar, ios: null },");
  assert.equal(readLocators(hand).editable, false);
  assert.throws(() => mergeLocators(hand, 'ios', [{ name: 'a', locator: '~b' }]), /sửa tay/);
  const empty = "class A extends NativeBasePage {\n  static locators = {};\n}";
  assert.match(mergeLocators(empty, 'android', [{ name: 'x', locator: "text:it's" }]).source, /x: \{ android: 'text:it\\'s', ios: null \},/);
});

test('waitUntilLoaded waits for the first "visible" element, not a dialog button picked first', () => {
  const src = renderScreen('AScreen', 'android', [{ name: 'okButton', locator: '~ok', action: 'tap' }, { name: 'list', locator: 'id:list', action: 'visible' }]);
  assert.match(src, /await this\.el\('list'\)\.waitForDisplayed/);
});
