'use strict';

/**
 * Base class for native Screens, shared by Android (UiAutomator2) and iOS (XCUITest).
 * Uses the global `driver` provided by the WDIO runner.
 *
 * A Screen keeps both platforms' locators side by side and writes its logic once:
 *   static locators = { submit: { android: 'id:com.app:id/submit', ios: '~submit' } };
 *   await this.tap(this.el('submit'));
 */

const fs = require('fs');
const path = require('path');
const { resolveLocator, toSelector } = require('../../core/native/locators');

const SAFE_PART = /[^\w-]+/g;

class NativeBasePage {
  constructor(screenName) {
    this.screenName = screenName || this.constructor.name;
  }

  /** 'ios' or 'android' for the running session. */
  get platform() {
    return driver.isIOS ? 'ios' : 'android';
  }

  /** Element from the Screen's `static locators` for the running platform. */
  el(name) {
    return $(resolveLocator(this.constructor.locators, name, this.platform, this.screenName));
  }

  /** Android resource-id; on iOS the accessibility identifier. */
  byId(resourceId) {
    return $(toSelector(`id:${resourceId}`, this.platform));
  }

  /** Element by content-desc (Android) / accessibility id (iOS). */
  byAccessibilityId(id) {
    return $(`~${id}`);
  }

  /** Element by exact visible text (Android text, iOS label or value). */
  byText(text) {
    return $(toSelector(`text:${text}`, this.platform));
  }

  /** Element by partial visible text. */
  byTextContains(text) {
    const safe = String(text).replace(/"/g, '\\"');
    return this.platform === 'ios'
      ? $(`-ios predicate string:label CONTAINS "${safe}"`)
      : $(`android=new UiSelector().textContains("${safe}")`);
  }

  async tap(element, timeout = 15000) {
    await element.waitForDisplayed({ timeout });
    await element.click();
  }

  async type(element, value, timeout = 15000) {
    await element.waitForDisplayed({ timeout });
    await element.clearValue();
    await element.setValue(value);
  }

  async isVisible(element, timeout = 5000) {
    try {
      await element.waitForDisplayed({ timeout });
      return true;
    } catch (error) {
      if (error && /still not displayed|wasn't found|not existing/i.test(String(error.message))) return false;
      throw error;
    }
  }

  async hideKeyboardIfShown() {
    if (await driver.isKeyboardShown()) await driver.hideKeyboard();
  }

  /** Android package or iOS bundle id of the app in the foreground. */
  async currentAppId() {
    if (this.platform === 'android') return driver.getCurrentPackage();
    const info = await driver.execute('mobile: activeAppInfo');
    return info?.bundleId || '';
  }

  /** Cold start: with noReset the app may still be running (and past its first screen) from an earlier session. */
  async relaunchApp(appId) {
    await driver.terminateApp(appId);
    await driver.activateApp(appId);
  }

  /** Android only; iOS has no activity concept. */
  async currentActivity() {
    return this.platform === 'android' ? driver.getCurrentActivity() : '';
  }

  /**
   * Screenshot into evidence/native/<platform>/<runId>/<TC>_<screen>_<step>.png.
   * The run id comes from the Dashboard (MOBILE_RUN_ID); the TC id from the current `it` title.
   */
  async capture(stepName) {
    const runId = /^[\w-]{1,40}$/.test(process.env.MOBILE_RUN_ID || '') ? process.env.MOBILE_RUN_ID : 'cli';
    const dir = path.join(process.cwd(), 'evidence', 'native', this.platform, runId);
    fs.mkdirSync(dir, { recursive: true });
    const tc = (String(process.env.MOBILE_CURRENT_TEST || '').match(/\bTC-[A-Za-z0-9]+(?:-\d+)?/) || [])[0];
    const base = [tc, this.screenName, stepName].filter(Boolean).join('_').replace(SAFE_PART, '_').slice(0, 120);
    const file = path.join(dir, `${base}_${Date.now()}.png`);
    await driver.saveScreenshot(file);
    return file;
  }
}

module.exports = { NativeBasePage };
