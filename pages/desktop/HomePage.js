const { BasePage } = require('../BasePage');
const { HomePopupHelper } = require('./home/HomePopupHelper');
const { HomeSessionHelper } = require('./home/HomeSessionHelper');
const { PageHealthMonitor } = require('../base/PageHealthMonitor');

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

class HomePage extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page, featureName) {
    super(page, featureName);

    this.closeAdsBtns = page.locator('[data-test-id="common__close-button"], .svicon-close, [class*="svicon-close"], button:has(.svicon-close), [aria-label*="close" i]');
    this.mobileEntryPopup = page.locator('.mbep-popup');
    this.mobileEntryPopupCloseBtn = this.mobileEntryPopup.getByRole('button').first();
    this.genericModalCloseBtn = page.locator(
      '#common__modal [data-test-id="common__close-button"], [data-test-id="common__form-modal"] [data-test-id="common__close-button"]'
    ).first();
    this.allLinks = page.locator('a[href]');
    this.logo = page.locator('a[href="/"] img, a[href="/"] svg').first();
    this.privacyConsentAgreeBtn = page.getByRole('button', { name: 'Đồng ý', exact: true });

    this.jobMenuBtn = page.getByRole('button', { name: /Việc làm/ });
    this.findJobSubMenuBtn = page.getByRole('button', { name: 'Tìm việc làm' });
    this.noCVJobLink = page.getByRole('link', { name: 'Việc không cần CV' });
    this.homePopupHelper = new HomePopupHelper(this);
    this.sessionHelper = new HomeSessionHelper(this);
    this.lotteJobLink = page.getByRole('link', { name: 'Nhân Viên Bán Hàng - Lotte' });
  }

  /**
   * Mở trang ngành nghề từ khối "ngành nghề" ở Home (UI 11/2026: thẻ <a href="/viec-lam-...-oN.html">, không còn nằm trong heading).
   * Không fallback sang menu "Tìm việc làm": fallback cũ khiến test chạy trên trang tìm kiếm chung mà vẫn báo pass bước chọn ngành.
   * @param {string} categoryName Tên ngành (khớp một phần, vd. 'Bán sỉ - Bán lẻ')
   */
  async selectJobCategory(categoryName = 'Bán sỉ - Bán lẻ') {
    await this.closeAllPopupsIfVisible();
    const catLink = this.page.getByRole('link', { name: new RegExp(escapeRegex(categoryName), 'i') }).first();
    await catLink.waitFor({ state: 'visible', timeout: 15000 });
    await Promise.all([
      this.page.waitForURL(/\/viec-lam-[^/]+-o\d+\.html/i, { timeout: 30000 }),
      this.actions.click(catLink),
    ]);
    await this.page.waitForLoadState('domcontentloaded');
  }

  async clickNoCVJobLink() {
    await this.clickElement(this.noCVJobLink);
  }

  async clickLotteJobLink() {
    await this.clickElement(this.lotteJobLink);
  }

  async clickJobMenu() {
    await this.clickElement(this.jobMenuBtn);
  }

  async clickFindJobSubMenu() {
    await this.clickElement(this.findJobSubMenuBtn);
  }

  async openJobSearch() {
    await this.clickJobMenu();
    await Promise.all([
      this.page.waitForURL(/\/tim-kiem-viec-lam-nhanh(?:[/?#]|$)/i, { timeout: 30000 }),
      this.clickFindJobSubMenu(),
    ]);
  }

  // --- HomePopupHelper (pages/desktop/home/HomePopupHelper.js) ---
  async closeBlockingModalIfVisible() { return this.homePopupHelper.closeBlockingModalIfVisible(); }
  async closeAdsIfVisible() { return this.homePopupHelper.closeAdsIfVisible(); }
  // --- HomeSessionHelper (pages/desktop/home/HomeSessionHelper.js) ---
  async expectLoggedIn() { return this.sessionHelper.expectLoggedIn(); }
  async expectGuestHeaderVisible() { return this.sessionHelper.expectGuestHeaderVisible(); }
  async reloadPage() { return this.sessionHelper.reloadPage(); }
  async openAccountManagement() { return this.sessionHelper.openAccountManagement(); }
  async expectAccountManagementVisible() { return this.sessionHelper.expectAccountManagementVisible(); }
  async openMyProfile() { return this.sessionHelper.openMyProfile(); }
  async logoutFromMyProfile() { return this.sessionHelper.logoutFromMyProfile(); }
  async expectLoggedOut() { return this.sessionHelper.expectLoggedOut(); }
  async expectMyProfileRequiresLogin() { return this.sessionHelper.expectMyProfileRequiresLogin(); }
  /** Gắn trước khi navigate() để ghi nhận mã HTTP, response 5xx và lỗi JS của lần tải trang. */
  startHealthMonitor() { return new PageHealthMonitor(this.page); }

  async navigate() {
    await super.navigate('/');
  }

  async getAllLinksHrefs() {
    const count = await this.allLinks.count();
    const hrefs = [];
    for (let i = 0; i < count; i++) {
      const href = await this.allLinks.nth(i).getAttribute('href');
      if (href) {
        hrefs.push(href);
      }
    }
    return hrefs;
  }

  async expectHomepageVisible() {
    await this.page.waitForLoadState('domcontentloaded');
    await this.actions.waitForVisible(this.logo, { timeout: 20000 });
  }

  async expectHomepageContentLoaded() {
    await this.expectHomepageVisible();
    await this.page.waitForFunction(
      () => {
        const isVisible = (element) => {
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);

          return (
            style.visibility !== 'hidden' &&
            style.display !== 'none' &&
            Number(style.opacity) !== 0 &&
            rect.width > 1 &&
            rect.height > 1 &&
            rect.bottom >= 0 &&
            rect.right >= 0 &&
            rect.top <= window.innerHeight &&
            rect.left <= window.innerWidth
          );
        };

        const hasVisibleText = (text) =>
          Array.from(document.querySelectorAll('body *')).some((element) =>
            isVisible(element) && element.innerText && element.innerText.includes(text)
          );

        return (
          hasVisibleText('Tìm việc') &&
          hasVisibleText('Việc đi làm ngay') &&
          hasVisibleText('Việc không cần CV')
        );
      },
      null,
      { timeout: 30000 }
    );

    if (this.screenshotHelper) {
      await this.screenshotHelper.waitForVisualLoadingHidden({ timeout: 30000 });
      await this.screenshotHelper.waitForPageStable({ maxWaitMs: 10000, stableFrameCount: 5 });
    }
  }

  async expectLoginAreaVisible() {
    const loginBtn = this.page.locator('#btn-login-header');
    await this.actions.waitForVisible(loginBtn, { timeout: 20000 });
    return loginBtn;
  }

  async expectEmployerSectionVisible() {
    const employerLink = this.page.locator('#qc-menu-item-employer');
    await this.actions.waitForVisible(employerLink, { timeout: 20000 });
    return employerLink;
  }

  async expectUrgentJobsSectionVisible() {
    const urgentJobsSection = this.page.getByText(/Việc làm tuyển gấp/i).first();
    await this.actions.waitForVisible(urgentJobsSection, { timeout: 20000 });
    return urgentJobsSection;
  }

  async expectImmediateJobsSectionVisible() {
    const immediateJobsSection = this.page.getByText(/Việc đi làm ngay/i).first();
    await this.actions.waitForVisible(immediateJobsSection, { timeout: 20000 });
    return immediateJobsSection;
  }

  async logout() { return this.sessionHelper.logout(); }
}

module.exports = { HomePage };
