'use strict';

const { NativeBasePage } = require('../NativeBasePage');

/** Shared Android/iOS screen. A null locator has not been captured on that platform yet. */
class JobListScreen extends NativeBasePage {
  static locators = {
    retryLaterButton: { android: '~Thử lại sau', ios: null },
    jobList: { android: 'id:list-jobs', ios: null },
    searchPlaceholder: { android: 'uia:new UiSelector().className("android.widget.TextView").text("Tìm công việc tại đây...")', ios: null },
    nearbyJobsTitle: { android: 'uia:new UiSelector().className("android.widget.TextView").text("Khám phá việc làm gần tôi")', ios: null },
    notificationIcon: { android: 'id:ic-notification', ios: null },
  };

  constructor() {
    super('job_list');
  }

  /** Waits until the screen is drawn (first element with a visibility check, else the first one). */
  async waitUntilLoaded(timeout = 30000) {
    await this.el('jobList').waitForDisplayed({ timeout });
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
    return this.el('searchPlaceholder').getText();
  }

  async nearbyJobsTitleText() {
    return this.el('nearbyJobsTitle').getText();
  }

  async isNotificationIconVisible(timeout = 5000) {
    return this.isVisible(this.el('notificationIcon'), timeout);
  }
}

module.exports = { JobListScreen };
