'use strict';

const { NativeBasePage } = require('../NativeBasePage');

/**
 * Shared Android/iOS screen. A null locator has not been captured on that platform yet.
 * iOS locators come from the page source of com.vieclam24h.qa 2.29.0 on a real iPhone (iOS 27.2.1).
 */
class JobListScreen extends NativeBasePage {
  static locators = {
    errorDialogMessage: { android: 'uia:new UiSelector().textContains("Không thể tải dữ liệu")', ios: 'pred:label CONTAINS "Không thể tải dữ liệu"' },
    retryLaterButton: { android: '~Thử lại sau', ios: '~Thử lại sau' },
    jobList: { android: 'id:list-jobs', ios: '~list-job' },
    searchPlaceholder: { android: 'uia:new UiSelector().className("android.widget.TextView").text("Tìm công việc tại đây...")', ios: 'pred:label CONTAINS "Tìm công việc tại đây..."' },
    nearbyJobsTitle: { android: 'uia:new UiSelector().className("android.widget.TextView").text("Khám phá việc làm gần tôi")', ios: 'pred:label CONTAINS "Khám phá việc làm gần tôi"' },
    notificationIcon: { android: 'id:ic-notification', ios: '~badge-noti' },
  };

  constructor() {
    super('job_list');
  }

  /** Waits until the screen is drawn (first element with a visibility check, else the first one). */
  async waitUntilLoaded(timeout = 30000) {
    await this.el('jobList').waitForDisplayed({ timeout });
  }

  /** First screen settled: the job list or the "Không thể tải dữ liệu…" dialog is on screen. */
  async waitForFirstScreen(timeout = 30000) {
    await driver.waitUntil(
      async () => (await this.el('jobList').isDisplayed()) || (await this.el('errorDialogMessage').isDisplayed()),
      { timeout, interval: 1000, timeoutMsg: `Neither the job list nor the error dialog appeared within ${timeout}ms` },
    );
  }

  /** True while the "Không thể tải dữ liệu vì có lỗi từ hệ thống" dialog is shown. */
  async hasErrorDialog(timeout = 5000) {
    return this.isVisible(this.el('errorDialogMessage'), timeout);
  }

  /** The QA build may open with "Không thể tải dữ liệu…"; close it so the list is reachable. */
  async dismissErrorDialogIfShown() {
    if (await this.isVisible(this.el('retryLaterButton'), 3000)) await this.tapRetryLaterButton();
  }

  async tapRetryLaterButton() {
    await this.tap(this.el('retryLaterButton'));
  }

  async isJobListVisible(timeout = 5000) {
    return this.isVisible(this.el('jobList'), timeout);
  }

  async searchPlaceholderText() {
    return this.visibleText(this.el('searchPlaceholder'));
  }

  async nearbyJobsTitleText() {
    return this.visibleText(this.el('nearbyJobsTitle'));
  }

  async isNotificationIconVisible(timeout = 5000) {
    return this.isVisible(this.el('notificationIcon'), timeout);
  }

  /**
   * Android: the TextView text. iOS: getText() is empty on XCUIElementTypeOther, and the label merges
   * the icon-font glyph (Private Use Area) and child texts ("\uE98C, Khám phá việc làm gần tôi, MỚI"):
   * drop the glyphs and keep the first non-empty part.
   */
  async visibleText(element) {
    if (this.platform !== 'ios') return element.getText();
    const label = String((await element.getAttribute('label')) || '').replace(/[\uE000-\uF8FF]/g, '');
    return label.split(',').map((part) => part.trim()).find(Boolean) || '';
  }
}

module.exports = { JobListScreen };
