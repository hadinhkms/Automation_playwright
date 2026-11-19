'use strict';

/**
 * core/native/locatorSuggest.test.js
 * PLAN-25 P4 TC-4.2 (AC-402, BR-402): priority order of Inspector locator suggestions, edge cases
 * (no id, long text, quotes, iOS) and the WebDriver query used to count matches.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { suggestLocators, suggestName } = require('./locatorSuggest');
const { toWebDriverQuery, toSelector } = require('./locators');

const BUTTON = { 'resource-id': 'com.vieclam24h.qa:id/login', 'content-desc': 'login', text: 'Đăng nhập', class: 'android.widget.Button', index: 2 };

test('TC-4.2 AC-402: an element with resource-id gets byId first, then accessibility id, UiSelector, text, XPath last', () => {
  const list = suggestLocators(BUTTON, 'android');
  assert.deepEqual(list.map((s) => s.kind), ['id', 'accessibility', 'uiautomator', 'text', 'xpath']);
  assert.equal(list[0].locator, 'id:com.vieclam24h.qa:id/login');
  assert.equal(list[0].code, "this.byId('com.vieclam24h.qa:id/login')");
  assert.equal(list[1].code, "this.byAccessibilityId('login')");
  assert.equal(list[2].locator, 'uia:new UiSelector().className("android.widget.Button").text("Đăng nhập")');
  assert.equal(list[3].code, "this.byText('Đăng nhập')");
  assert.equal(list.at(-1).locator, 'xpath://android.widget.Button[@text="Đăng nhập"]');
  list.forEach((s) => assert.doesNotThrow(() => toSelector(s.locator, 'android'), s.locator));
});

test('TC-4.2: without id or text the UiSelector and XPath fall back to the position among nodes of that class', () => {
  const list = suggestLocators({ class: 'android.widget.ImageView', index: 3 }, 'android');
  assert.deepEqual(list.map((s) => s.kind), ['uiautomator', 'xpath']);
  assert.equal(list[0].locator, 'uia:new UiSelector().className("android.widget.ImageView").instance(2)');
  assert.equal(list[1].locator, 'xpath:(//android.widget.ImageView)[3]');
});

test('TC-4.2: long text uses textStartsWith and no exact text locator; quotes are escaped', () => {
  const long = 'Tìm việc làm nhanh '.repeat(5);
  const list = suggestLocators({ class: 'android.widget.TextView', text: long }, 'android');
  assert.ok(!list.some((s) => s.kind === 'text'));
  assert.match(list[0].locator, /textStartsWith\("Tìm việc làm nhanh/);
  const quoted = suggestLocators({ class: 'android.widget.TextView', text: 'Say "hi" it\'s' }, 'android');
  assert.equal(quoted.find((s) => s.kind === 'uiautomator').locator, 'uia:new UiSelector().className("android.widget.TextView").text("Say \\"hi\\" it\'s")');
  assert.equal(quoted.at(-1).locator, 'xpath:(//android.widget.TextView)[1]', 'both quote kinds → positional XPath');
  quoted.forEach((s) => assert.doesNotThrow(() => toSelector(s.locator, 'android')));
});

test('iOS: accessibility id, predicate, class chain, label text, XPath', () => {
  const list = suggestLocators({ type: 'XCUIElementTypeButton', name: 'loginButton', label: 'Log in', index: 1 }, 'ios');
  assert.deepEqual(list.map((s) => s.kind), ['accessibility', 'predicate', 'classChain', 'text', 'xpath']);
  assert.equal(list[1].locator, 'pred:type == "XCUIElementTypeButton" AND label == "Log in"');
  assert.equal(list[2].locator, 'chain:**/XCUIElementTypeButton[`label == "Log in"`]');
  list.forEach((s) => assert.doesNotThrow(() => toSelector(s.locator, 'ios'), s.locator));
});

test('suggested names are ASCII camelCase from id → description → text → class', () => {
  assert.equal(suggestName(BUTTON, 'android'), 'login');
  assert.equal(suggestName({ text: 'Việc làm đã lưu' }, 'android'), 'viecLamDaLuu');
  assert.equal(suggestName({ 'resource-id': 'pkg:id/btn_search_job' }, 'android'), 'btnSearchJob');
  assert.equal(suggestName({ text: '24h' }, 'android'), 'el24h');
  assert.equal(suggestName({}, 'android'), 'element');
  assert.equal(suggestName({ type: 'XCUIElementTypeTextField' }, 'ios'), 'textField');
});

test('toWebDriverQuery uses the same strategy a Screen uses at run time', () => {
  assert.deepEqual(toWebDriverQuery('id:a:id/b', 'android'), { using: '-android uiautomator', value: 'new UiSelector().resourceId("a:id/b")' });
  assert.deepEqual(toWebDriverQuery('~login', 'android'), { using: 'accessibility id', value: 'login' });
  assert.deepEqual(toWebDriverQuery('xpath://a[@b="c"]', 'android'), { using: 'xpath', value: '//a[@b="c"]' });
  assert.deepEqual(toWebDriverQuery('pred:label == "x"', 'ios'), { using: '-ios predicate string', value: 'label == "x"' });
  assert.deepEqual(toWebDriverQuery('chain:**/XCUIElementTypeButton', 'ios'), { using: '-ios class chain', value: '**/XCUIElementTypeButton' });
  assert.deepEqual(toWebDriverQuery('id:loginButton', 'ios'), { using: 'accessibility id', value: 'loginButton' });
  assert.throws(() => toWebDriverQuery('css:.x', 'android'), /Unknown prefix/);
});

test('TC-4.2: a long content-desc (list data) is not an exact accessibility id; UiSelector uses descriptionStartsWith', () => {
  const desc = 'Trưởng Nhóm Marketing, Công Ty TNHH Bao Bì, Trung Mỹ Tây, TP.HCM, 14-16 triệu, Đăng 2 tuần trước';
  const list = suggestLocators({ 'resource-id': 'item-job-card', 'content-desc': desc, class: 'android.view.ViewGroup', index: 4 }, 'android');
  assert.deepEqual(list.map((s) => s.kind), ['id', 'uiautomator', 'xpath']);
  assert.equal(list[1].locator, 'uia:new UiSelector().className("android.view.ViewGroup").descriptionStartsWith("Trưởng Nhóm Marketing, Công Ty TNHH Bao ")');
  assert.equal(list[2].locator, 'xpath:(//android.view.ViewGroup)[4]');
});
