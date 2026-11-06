const { UiActions, ScreenshotHelper } = require('../core/utils/commonUtils');
const { BasePopupHelper } = require('./base/BasePopupHelper');
const { BaseInteractionHelper } = require('./base/BaseInteractionHelper');
const { PhoneVerificationHelper } = require('./base/PhoneVerificationHelper');
const { PhoneVerificationStepHelper } = require('./base/PhoneVerificationStepHelper');
const { AppliedJobsHelper } = require('./base/AppliedJobsHelper');

class BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page, featureName) {
    this.page = page;
    this.actions = new UiActions(page);
    this.accountMenuButton = page.getByRole('button', { name: /avt_invalid|tài khoản/i })
      .or(page.getByAltText('avt_invalid'))
      .or(page.locator('figure img[alt="avt_invalid"]'))
      .first();
    this.appliedJobsButton = page.getByRole('button', { name: /Việc làm đã ứng tuyển/i })
      .or(page.getByRole('link', { name: /Việc làm đã ứng tuyển/i }))
      .or(page.getByText('Việc làm đã ứng tuyển'))
      .first();
    this.appliedJobsList = page.locator('[data-test-id="applied-job__list-jobs"]');
    const resolvedFeatureName = featureName || this.constructor.name.toLowerCase();
    this.screenshotHelper = new ScreenshotHelper(page, resolvedFeatureName);
    this.popupHelper = new BasePopupHelper(this);
    this.interactionHelper = new BaseInteractionHelper(this);
    this.phoneVerificationHelper = new PhoneVerificationHelper(this);
    this.phoneVerificationStepHelper = new PhoneVerificationStepHelper(this);
    this.appliedJobsHelper = new AppliedJobsHelper(this);
  }

  async navigate(url, options = {}) {
    // Prefer 'load' to ensure full page resources, but allow overriding via options
    const gotoOptions = Object.assign({ waitUntil: 'load', timeout: 120000 }, options);
    try {
      await this.page.goto(url, gotoOptions);
    } catch (err) {
      // try to capture a screenshot for diagnosis, but don't fail the error handling if capture itself errors
      try {
        const safeName = String(url).replace(/[:\/\?&=.#]/g, '_');
        await this._capture('navigate_error', safeName);
      } catch (captureErr) {
        // ignore capture errors
      }

      // Retry once with a less strict waitUntil and longer timeout — helps when 'load' hangs on third-party resources
      try {
        await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 180000 });
      } catch (err2) {
        // Log and rethrow the original (or second) error so caller sees failure
        console.error(`Navigation to ${url} failed after retry:`, err2);
        throw err2;
      }
    }
  }

  /**
   * Chờ một element hiển thị ổn định trên trang.
   * @param {import('@playwright/test').Locator} locator - Locator của element cần chờ.
   */
  async waitForElement(locator) {
    return locator.waitFor({ state: 'visible', timeout: 15000 });
  }
  /**
   * Phát hiện xem hiện tại trên màn hình có Modal / Popup / Dialog / Drawer đang mở không.
   * @returns {Promise<boolean>}
   */
  async isModalOrPopupVisible() {
    if (this.screenshotHelper && typeof this.screenshotHelper.isModalOrPopupVisible === 'function') {
      return this.screenshotHelper.isModalOrPopupVisible();
    }
    return false;
  }

  async _capture(actionName, details = '', fullPage = null, options = {}) {
    if (this.screenshotHelper) {
      const fileName = `${actionName}${details ? `-${details}` : ''}`;
      await this.screenshotHelper.takeScreenshot(fileName, fullPage, options);
    }
  }

  /**
   * Đảm bảo toàn bộ tài nguyên, mạng và khung giao diện đã load xong hoàn toàn và ổn định.
   */
  async waitForPageReady(options = {}) {
    const {
      waitForNetworkIdle = true,
      waitForVisualLoading = true,
      waitForStability = true,
      visualLoadingTimeout = 15000,
      stabilityTimeout = 5000,
    } = options;

    try {
      await this.page.waitForLoadState('domcontentloaded', { timeout: 10000 });
    } catch (_) {}

    try {
      await this.page.waitForLoadState('load', { timeout: 10000 });
    } catch (_) {}

    if (waitForNetworkIdle) {
      try {
        await this.page.waitForLoadState('networkidle', { timeout: 4000 });
      } catch (_) {}
    }

    if (waitForVisualLoading) {
      await this.page.waitForFunction(
        () => !document.querySelector('[class*="skeleton"], [class*="Skeleton"], [class*="animate-pulse"], [class*="loading-block"], [class*="overlay-loading"], [role="progressbar"], [aria-busy="true"]'),
        null,
        { timeout: visualLoadingTimeout }
      ).catch(() => null);
    }

    if (waitForStability && this.screenshotHelper) {
      await this.screenshotHelper.waitForPageStable({ maxWaitMs: stabilityTimeout, stableFrameCount: 5 });
    }
  }

  async capture(stepName, fullPage = null, options = {}) {
    // Chờ trang load xong hoàn toàn trước khi chụp
    await this.waitForPageReady(options);

    return this._capture(stepName, '', fullPage, options);
  }

  // --- BasePopupHelper (pages/base/BasePopupHelper.js) ---
  async registerGuestPopupAutoHandlers() { return this.popupHelper.registerGuestPopupAutoHandlers(); }
  async closeAllPopupsIfVisible() { return this.popupHelper.closeAllPopupsIfVisible(); }
  // --- BaseInteractionHelper (pages/base/BaseInteractionHelper.js) ---
  async isElementInViewport(locator) { return this.interactionHelper.isElementInViewport(locator); }
  async scrollToElementIfOutsideViewport(locator) { return this.interactionHelper.scrollToElementIfOutsideViewport(locator); }
  async waitForElementStable(locatorOrSelector, options = {}) { return this.interactionHelper.waitForElementStable(locatorOrSelector, options); }
  async clickElement(locatorOrSelector, options = {}) { return this.interactionHelper.clickElement(locatorOrSelector, options); }
  async waitForGlobalLoadingHidden(timeout = 60000) { return this.interactionHelper.waitForGlobalLoadingHidden(timeout); }
  async fillInput(locatorOrSelector, text, options = {}) { return this.interactionHelper.fillInput(locatorOrSelector, text, options); }
  async fillCodeInputs(inputLocator, code) { return this.interactionHelper.fillCodeInputs(inputLocator, code); }
  // --- PhoneVerificationHelper (pages/base/PhoneVerificationHelper.js) ---
  getPhoneVerificationLocators() { return this.phoneVerificationHelper.getPhoneVerificationLocators(); }
  async handlePhoneVerificationAfterApplyIfVisible(otpCode) { return this.phoneVerificationHelper.handlePhoneVerificationAfterApplyIfVisible(otpCode); }
  async continuePhoneVerificationPhoneStepIfNeeded(locators, options = {}) { return this.phoneVerificationHelper.continuePhoneVerificationPhoneStepIfNeeded(locators, options); }
  async submitPhoneVerificationOtp(otpCode, options = {}) { return this.phoneVerificationHelper.submitPhoneVerificationOtp(otpCode, options); }
  async clickPhoneVerificationSubmitIfVisible(locators) { return this.phoneVerificationHelper.clickPhoneVerificationSubmitIfVisible(locators); }
  // --- PhoneVerificationStepHelper (pages/base/PhoneVerificationStepHelper.js) ---
  async isPhoneVerificationPhoneStepVisible(locators, timeout = 5000) { return this.phoneVerificationStepHelper.isPhoneVerificationPhoneStepVisible(locators, timeout); }
  async isPhoneVerificationCodeInputVisible(locators, timeout = 5000) { return this.phoneVerificationStepHelper.isPhoneVerificationCodeInputVisible(locators, timeout); }
  async isPhoneVerificationSubmitVisible(locators, timeout = 5000) { return this.phoneVerificationStepHelper.isPhoneVerificationSubmitVisible(locators, timeout); }
  async waitForPhoneVerificationCodeStepVisible(locators, timeout = 10000) { return this.phoneVerificationStepHelper.waitForPhoneVerificationCodeStepVisible(locators, timeout); }
  async fillPhoneVerificationCode(locators, otpCode) { return this.phoneVerificationStepHelper.fillPhoneVerificationCode(locators, otpCode); }
  // --- AppliedJobsHelper (pages/base/AppliedJobsHelper.js) ---
  async openAppliedJobs() { return this.appliedJobsHelper.openAppliedJobs(); }
  async expectAppliedJobsVisible() { return this.appliedJobsHelper.expectAppliedJobsVisible(); }
}

module.exports = { BasePage };
