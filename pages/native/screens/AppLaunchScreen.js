'use strict';

const { NativeBasePage } = require('../NativeBasePage');

/**
 * Launch screen shared by Android and iOS: the app under test is in the foreground and draws a UI.
 * Replace / extend with real screens (LoginScreen, HomeScreen...) once the app is known.
 */
class AppLaunchScreen extends NativeBasePage {
  /** Launch checks need no element; real Screens list { android, ios } locators here. */
  static locators = {};

  constructor() {
    super('app_launch');
  }

  /** Package (Android) or bundle id (iOS) Appium resolved for this session. */
  expectedAppId() {
    const caps = driver.capabilities || {};
    if (this.platform === 'ios') return caps.bundleId || caps['appium:bundleId'] || process.env.IOS_BUNDLE_ID || '';
    return caps.appPackage || caps['appium:appPackage'] || '';
  }

  async waitUntilForeground(timeout = 30000) {
    let expected = this.expectedAppId();
    // iOS started from an .app/.ipa path may not echo the bundle id: take the first foreground app.
    if (!expected) expected = await this.currentAppId();
    await driver.waitUntil(
      async () => (await this.currentAppId()) === expected,
      { timeout, interval: 1000, timeoutMsg: `App ${expected} did not reach foreground within ${timeout}ms` },
    );
    return expected;
  }

  async hasRenderedUi() {
    const source = await driver.getPageSource();
    const root = this.platform === 'ios' ? '<XCUIElementTypeApplication' : '<hierarchy';
    return typeof source === 'string' && source.includes(root);
  }
}

module.exports = { AppLaunchScreen };
