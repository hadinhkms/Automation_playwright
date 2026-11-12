/**
 * Theo dõi sức khỏe trang trong lúc tải: mã HTTP của document chính, response 5xx cùng site,
 * lỗi JavaScript không bắt được và console error. Gắn trước khi điều hướng.
 */
class PageHealthMonitor {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;
    this.documentStatus = null;
    this.responses = [];
    this.pageErrors = [];
    this.consoleErrors = [];

    this.onResponse = (response) => {
      const request = response.request();
      if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
        this.documentStatus = response.status();
      }
      if (response.status() >= 500) {
        this.responses.push({ status: response.status(), url: response.url() });
      }
    };
    this.onPageError = (error) => this.pageErrors.push(String(error && error.message ? error.message : error));
    this.onConsole = (message) => {
      if (message.type() === 'error') this.consoleErrors.push(message.text());
    };

    page.on('response', this.onResponse);
    page.on('pageerror', this.onPageError);
    page.on('console', this.onConsole);
  }

  /** Response 5xx từ chính hệ thống (cùng tên miền gốc với trang), bỏ qua bên thứ ba. */
  get serverErrors() {
    let siteDomain = '';
    try {
      siteDomain = new URL(this.page.url()).hostname.split('.').slice(-2).join('.');
    } catch (_err) {
      return this.responses;
    }
    return this.responses.filter(({ url }) => {
      try {
        return new URL(url).hostname.endsWith(siteDomain);
      } catch (_err) {
        return false;
      }
    });
  }

  stop() {
    this.page.off('response', this.onResponse);
    this.page.off('pageerror', this.onPageError);
    this.page.off('console', this.onConsole);
  }
}

module.exports = { PageHealthMonitor };
