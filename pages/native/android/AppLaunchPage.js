'use strict';

const { NativeBasePage } = require('../NativeBasePage');

/**
 * Generic launch screen: verifies the app under test is in the foreground.
 * Replace / extend with real screens (LoginScreen, HomeScreen...) once the APK is known.
 */
class AppLaunchPage extends NativeBasePage {
  constructor() {
    super('app_launch');
  }

  /** Package Appium resolved for this session (from the APK or ANDROID_APP_PACKAGE). */
  expectedPackage() {
    const caps = driver.capabilities || {};
    return caps.appPackage || caps['appium:appPackage'] || '';
  }

  async waitUntilForeground(timeout = 30000) {
    const expected = this.expectedPackage();
    await driver.waitUntil(
      async () => (await this.currentPackage()) === expected,
      { timeout, interval: 1000, timeoutMsg: `App ${expected} did not reach foreground within ${timeout}ms` },
    );
    return expected;
  }

  async hasRenderedUi() {
    const source = await driver.getPageSource();
    return typeof source === 'string' && source.includes('<hierarchy');
  }
}

module.exports = { AppLaunchPage };
