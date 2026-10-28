const { expect } = require('@playwright/test');
const { BasePage } = require('../BasePage');
const { JobSearchFilterHelper } = require('./search/JobSearchFilterHelper');
const { JobSearchRestoreHelper } = require('./search/JobSearchRestoreHelper');

class JobSearchPage extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   * @param {string} specName
   */
  constructor(page, specName) {
    super(page, specName);

    this.firstJobLink = page
      .locator('a[href*=".html?open_from="], a[href*="id200"], a:has(h3), [data-job-id]')
      .first();
    this.firstUnappliedJobLink = page
      .locator('a[href*=".html?open_from="], a[href*="id200"], a:has(h3), [data-job-id]')
      .filter({ hasNotText: /\u0110\u00e3 \u1ee9ng tuy\u1ec3n|B\u1ea1n v\u1eeba \u1ee9ng tuy\u1ec3n/i })
      .first();
    this.jobSearchResultTitle = page.getByRole('heading', { level: 1 }).first();
    this.jobCheckboxes = page.locator('.job-item-checkbox');
    this.bulkApplyBtn = page.getByRole('button', { name: 'Ứng tuyển hàng loạt' });
    this.confirmBulkApplyBtn = page.locator('.bulk-apply-modal').getByRole('button', { name: 'Xác nhận' });
    this.bulkApplySuccessMsg = page.getByText('Bạn đã ứng tuyển hàng loạt thành công');

    // Chop AI chatbot entry point
    this.chopIntroBtn = page.getByRole('img', { name: 'Chop Introduction' });

    // Bộ lọc việc làm & tìm kiếm
    this.locTheoTinhThanhInput = page
      .getByRole('textbox', { name: 'Lọc theo tỉnh thành' })
      .or(page.locator('input[placeholder*="tỉnh thành"]'))
      .first();
    this.cityDropdownContainer = page.locator('.fixed.z-\\[50\\], [class*="fixed"][class*="z-50"], .w-\\[200\\%\\]').first();
    this.timKiemBtn = page.getByRole('button', { name: 'Tìm kiếm' }).first();
    this.xoaLocBtn = page.getByText('Xoá lọc');

    // Bộ lọc thanh công cụ ngang (Horizontal Filter Bar)
    this.tuyenNhanhFilterBtn = page.getByRole('button', { name: 'Tuyển nhanh' });
    this.viecKhongCanCvFilterBtn = page.getByRole('button', { name: 'Việc không cần CV' });
    this.kinhNghiemFilterInput = page.locator('input[value*="kinh nghiệm"]').first();
    this.mucLuongFilterInput = page.locator('input[value*="mức lương"]').first();
    this.capBacFilterInput = page.locator('input[value*="cấp bậc"]').first();
    this.trinhDoFilterInput = page.locator('input[value*="trình độ"]').first();
    this.loaiCongViecFilterInput = page.locator('input[value*="Loại công việc"]').first();
    this.gioiTinhFilterInput = page.locator('input[value*="giới tính"]').first();
    this.filterDropdownTrigger = page.locator('.select-search-custom__input, [data-test-id*="filter"]').first();
    this.activeExperienceBtn = page.getByRole('button', { name: '1 năm', exact: true }).first();
    this.defaultExperienceBtn = page.getByRole('button', { name: /Tất cả kinh nghiệm/i }).first();

    // Locators cho kiểm thử URL dài & HTTP 431 restore (JS-8865)
    this.toastWarning = page.getByText(/Bạn đã chọn quá nhiều khu vực/i).first();
    this.robotsMeta = page.locator('meta[name="robots"], meta[name="googlebot"]').first();
    this.fallbackErrorMsg = page.getByText(/Không thể mở liên kết này/i).first();
    this.retrySearchBtn = page.getByRole('button', { name: /Tìm lại/i }).first();
    this.homeRedirectBtn = page.getByRole('button', { name: /Về trang chủ/i }).or(page.locator('a[href="/"]')).first();
    this.loginNavButton = page.getByRole('button', { name: /đăng nhập/i }).or(page.locator('a[href*="/dang-nhap"]')).first();

    // Modular helpers
    this.filterHelper = new JobSearchFilterHelper(this);
    this.restoreHelper = new JobSearchRestoreHelper(this);
  }

  async navigate() {
    await super.navigate('/tim-kiem-viec-lam-nhanh');
  }

  async navigateToPath(relativePath) {
    await super.navigate(relativePath, { waitUntil: 'domcontentloaded' });
  }

  async open() {
    await this.navigate();
  }

  async clickFirstJob() {
    const pagePromise = this.page.waitForEvent('popup');
    const targetJob = await this.firstUnappliedJobLink.isVisible({ timeout: 5000 })
      ? this.firstUnappliedJobLink
      : this.firstJobLink;
    await this.clickElement(targetJob);
    const jobPage = await pagePromise;
    await jobPage.waitForLoadState('domcontentloaded');
    return jobPage;
  }

  async closeGuestPromptModalIfVisible() {
    const dialog = this.page.getByRole('dialog');
    if (await dialog.isVisible({ timeout: 2500 }).catch(() => false)) {
      const closeBtn = dialog.locator('button, [class*="close" i], i, svg, [cursor="pointer"]').last();
      if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await closeBtn.click({ force: true }).catch(() => null);
      } else {
        await this.page.keyboard.press('Escape').catch(() => null);
      }
      await dialog.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {
        return this.page.evaluate(() => {
          document.querySelectorAll('.ReactModalPortal').forEach(el => el.remove());
        }).catch(() => null);
      });
    }
  }

  async openChopChatbot() {
    await this.closeGuestPromptModalIfVisible();
    const popupPromise = this.page.waitForEvent('popup');
    try {
      await this.clickElement(this.chopIntroBtn, { timeout: 5000 });
    } catch (err) {
      await this.closeGuestPromptModalIfVisible();
      await this.clickElement(this.chopIntroBtn);
    }
    const chatbotPopup = await popupPromise;
    await chatbotPopup.waitForLoadState('domcontentloaded');
    return chatbotPopup;
  }

  async expectJobSearchPageVisible() {
    await this.page.waitForLoadState('domcontentloaded');
    const heading = this.jobSearchResultTitle.or(this.page.getByRole('heading', { level: 1 })).first();
    await expect(heading).toBeVisible({ timeout: 15000 });
  }

  async selectJobsForBulkApply(numberOfJobs) {
    const allCheckboxes = await this.jobCheckboxes.all();
    for (let i = 0; i < Math.min(numberOfJobs, allCheckboxes.length); i++) {
      await allCheckboxes[i].check();
    }
  }

  async clickBulkApplyButton() { await this.clickElement(this.bulkApplyBtn); }
  async confirmBulkApply() { await this.clickElement(this.confirmBulkApplyBtn); }
  async expectBulkApplySuccessMessageVisible() {
    await expect(this.bulkApplySuccessMsg).toBeVisible({ timeout: 15000 });
  }

  async clickJobByTitle(title) {
    await this.closeAllPopupsIfVisible();
    await this.page.waitForLoadState('domcontentloaded');
    const jobLink = title
      ? this.page.getByRole('link', { name: new RegExp(title, 'i') }).first()
      : this.page.locator('a[href*="-c"][href*="id"], a[href*="id200"], a[href*=".html?open_from="], a:has(h3)').first();

    await jobLink.scrollIntoViewIfNeeded({ timeout: 10000 }).catch(() => null);
    await jobLink.waitFor({ state: 'visible', timeout: 15000 });
    const popupPromise = this.page.waitForEvent('popup', { timeout: 8000 }).catch(() => null);
    await jobLink.click({ force: true });
    const newTab = await popupPromise;
    if (newTab) {
      await newTab.waitForLoadState('domcontentloaded');
      return newTab;
    }
    await this.page.waitForLoadState('domcontentloaded');
    return this.page;
  }

  // --- Delegation: Search Filters ---
  async expectCityFilterApplied(cityName, districtName) { return this.filterHelper.expectCityFilterApplied(cityName, districtName); }
  async expectExperienceFilterApplied(expLabel) { return this.filterHelper.expectExperienceFilterApplied(expLabel); }
  async expectFiltersReset() { return this.filterHelper.expectFiltersReset(); }
  async openCityDropdown() { return this.filterHelper.openCityDropdown(); }
  async selectCityOption(cityName, districtName) { return this.filterHelper.selectCityOption(cityName, districtName); }
  async clickSearch() { return this.filterHelper.clickSearch(); }
  async filterByCity(cityName, districtName) { return this.filterHelper.filterByCity(cityName, districtName); }
  async filterByTuyenNhanh() { return this.filterHelper.filterByTuyenNhanh(); }
  async filterByViecKhongCanCv() { return this.filterHelper.filterByViecKhongCanCv(); }
  async filterByExperience(expLabel) { return this.filterHelper.filterByExperience(expLabel); }
  async filterBySalary(salaryLabel) { return this.filterHelper.filterBySalary(salaryLabel); }
  async filterByJobLevel(levelLabel) { return this.filterHelper.filterByJobLevel(levelLabel); }
  async filterByEducation(eduLabel) { return this.filterHelper.filterByEducation(eduLabel); }
  async filterByJobType(jobTypeLabel) { return this.filterHelper.filterByJobType(jobTypeLabel); }
  async filterByGender(genderLabel) { return this.filterHelper.filterByGender(genderLabel); }
  async clearFilters() { return this.filterHelper.clearFilters(); }

  // --- Delegation: Long URL & HTTP 431 Restore (JS-8865) ---
  async openCustomUrl(relativePath) { return this.restoreHelper.openCustomUrl(relativePath); }
  async clickLoginNavButton() { return this.restoreHelper.clickLoginNavButton(); }
  async getStorageValue(type, key) { return this.restoreHelper.getStorageValue(type, key); }
  async expectWarningToastVisible() { return this.restoreHelper.expectWarningToastVisible(); }
  async getRobotsMetaDirective() { return this.restoreHelper.getRobotsMetaDirective(); }
  async expectFallbackErrorVisible() { return this.restoreHelper.expectFallbackErrorVisible(); }
}

module.exports = { JobSearchPage };
