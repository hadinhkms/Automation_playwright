'use strict';

/**
 * Base Page Object for native Android screens (WebdriverIO + Appium UiAutomator2).
 * Uses the global `driver` provided by the WDIO runner.
 */

const fs = require('fs');
const path = require('path');

const EVIDENCE_DIR = path.join(process.cwd(), 'evidence', 'native', 'android');

class NativeBasePage {
  constructor(screenName) {
    this.screenName = screenName || this.constructor.name;
  }

  /** Element by resource-id, e.g. byId('com.app:id/login') or byId('login') with appPackage prefix. */
  byId(resourceId) {
    return $(`android=new UiSelector().resourceId("${resourceId}")`);
  }

  /** Element by content-desc (accessibility id). */
  byAccessibilityId(id) {
    return $(`~${id}`);
  }

  /** Element by exact visible text. */
  byText(text) {
    return $(`android=new UiSelector().text("${text}")`);
  }

  /** Element by partial visible text. */
  byTextContains(text) {
    return $(`android=new UiSelector().textContains("${text}")`);
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

  async currentPackage() {
    return driver.getCurrentPackage();
  }

  async currentActivity() {
    return driver.getCurrentActivity();
  }

  async capture(stepName) {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
    const safe = `${this.screenName}_${stepName}`.replace(/[^\w-]+/g, '_');
    const file = path.join(EVIDENCE_DIR, `${safe}_${Date.now()}.png`);
    await driver.saveScreenshot(file);
    return file;
  }
}

module.exports = { NativeBasePage };
