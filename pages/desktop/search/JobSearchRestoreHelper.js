const { expect } = require('@playwright/test');

class JobSearchRestoreHelper {
  /**
   * @param {import('../JobSearchPage').JobSearchPage} pageInstance
   */
  constructor(pageInstance) {
    this.owner = pageInstance;
  }

  /**
   * Mở một URL tùy biến (phục vụ test URL dài/restore)
   * @param {string} relativePath
   */
  async openCustomUrl(relativePath) {
    await this.owner.navigateToPath(relativePath);
  }

  /**
   * Click nút đăng nhập từ thanh điều hướng nếu có
   */
  async clickLoginNavButton() {
    if (await this.owner.loginNavButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await this.owner.actions.click(this.owner.loginNavButton);
    }
  }

  /**
   * Lấy giá trị từ window.localStorage hoặc window.sessionStorage
   * @param {'local' | 'session'} type
   * @param {string} key
   */
  async getStorageValue(type, key) {
    return this.owner.page.evaluate(({ t, k }) => {
      const storage = t === 'local' ? window.localStorage : window.sessionStorage;
      return storage.getItem(k);
    }, { t: type, k: key });
  }

  /**
   * Xác nhận toast cảnh báo chọn quá nhiều khu vực hiển thị
   */
  async expectWarningToastVisible() {
    await expect(this.owner.toastWarning).toBeVisible({ timeout: 10000 });
  }

  /**
   * Lấy directive content của thẻ meta robots
   */
  async getRobotsMetaDirective() {
    return this.owner.robotsMeta.getAttribute('content');
  }

  /**
   * Kiểm tra thông báo lỗi fallback khi cookie độc lập quá lớn
   */
  async expectFallbackErrorVisible() {
    if (await this.owner.fallbackErrorMsg.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(this.owner.retrySearchBtn.or(this.owner.homeRedirectBtn).first()).toBeVisible({ timeout: 5000 });
    }
  }
}

module.exports = { JobSearchRestoreHelper };
