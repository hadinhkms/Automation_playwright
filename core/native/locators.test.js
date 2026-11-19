'use strict';

/**
 * core/native/locators.test.js
 * PLAN-25 S-01: one Screen locator table for Android and iOS, translated per platform.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { toSelector, resolveLocator, missingLocators } = require('./locators');

const LOCATORS = {
  digit7: { android: 'id:com.coloros.calculator:id/digit_7', ios: '~7' },
  result: { android: 'id:com.coloros.calculator:id/result', ios: null },
  title: { android: 'text:Calculator', ios: 'text:Calculator' },
  any: '~shared',
};

test('translates each prefix for Android and iOS', () => {
  assert.equal(toSelector('id:a:id/b', 'android'), 'android=new UiSelector().resourceId("a:id/b")');
  assert.equal(toSelector('id:loginButton', 'ios'), '~loginButton');
  assert.equal(toSelector('~plus', 'android'), '~plus');
  assert.equal(toSelector('text:Say "hi"', 'android'), 'android=new UiSelector().text("Say \\"hi\\"")');
  assert.equal(toSelector('text:OK', 'ios'), '-ios predicate string:label == "OK" OR value == "OK"');
  assert.equal(toSelector('uia:new UiSelector().index(2)', 'android'), 'android=new UiSelector().index(2)');
  assert.equal(toSelector('pred:name BEGINSWITH "a"', 'ios'), '-ios predicate string:name BEGINSWITH "a"');
  assert.equal(toSelector('chain:**/XCUIElementTypeButton', 'ios'), '-ios class chain:**/XCUIElementTypeButton');
  assert.equal(toSelector('xpath://x', 'ios'), '//x');
});

test('rejects unknown prefixes, platform-only prefixes on the other platform, and empty values', () => {
  assert.throws(() => toSelector('css:.a', 'android'), /Unknown prefix/);
  assert.throws(() => toSelector('pred:a', 'android'), /not supported on android/);
  assert.throws(() => toSelector('uia:x', 'ios'), /not supported on ios/);
  assert.throws(() => toSelector('', 'ios'), /Empty/);
  assert.throws(() => toSelector('~a', 'windows'), /Unknown platform/);
});

test('resolveLocator picks the platform cell and names the gap', () => {
  assert.equal(resolveLocator(LOCATORS, 'digit7', 'ios'), '~7');
  assert.equal(resolveLocator(LOCATORS, 'any', 'android'), '~shared');
  assert.throws(() => resolveLocator(LOCATORS, 'result', 'ios', 'CalculatorScreen'), /CalculatorScreen\.result has no ios locator yet/);
  assert.throws(() => resolveLocator(LOCATORS, 'nope', 'ios', 'CalculatorScreen'), /has no locator "nope"/);
  assert.throws(() => resolveLocator(LOCATORS, 'toString', 'ios'), /has no locator/);
  assert.deepEqual(missingLocators(LOCATORS, 'ios'), ['result']);
  assert.deepEqual(missingLocators(LOCATORS, 'android'), []);
});
