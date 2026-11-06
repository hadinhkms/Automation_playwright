const { expect } = require('@playwright/test');
const { BasePage } = require('../BasePage');
const { JobSearchFilterHelper } = require('./search/JobSearchFilterHelper');
const { JobSearchCityPickerHelper } = require('./search/JobSearchCityPickerHelper');
const { JobSearchRestoreHelper } = require('./search/JobSearchRestoreHelper');
const { JobSearchListHelper } = require('./search/JobSearchListHelper');

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
    // Điều hướng client-side (menu Việc làm > Tìm việc làm) render trang 404 ~6s trước khi tự điều hướng lại.
    this.notFoundHeading = page.getByRole('heading', { level: 1, name: /Không tìm thấy trang/i });
    this.jobCheckboxes = page.locator('.job-item-checkbox');
    this.bulkApplyBtn = page.getByRole('button', { name: 'Ứng tuyển hàng loạt' });
    this.confirmBulkApplyBtn = page.locator('.bulk-apply-modal').getByRole('button', { name: 'Xác nhận' });
    this.bulkApplySuccessMsg = page.getByText('Bạn đã ứng tuyển hàng loạt thành công');

    // Chop AI chatbot entry point
    this.chopIntroBtn = page.getByRole('img', { name: 'Chop Introduction' });

    // Bộ lọc việc làm & tìm kiếm
    // Picker tỉnh thành (UI 11/2026): trigger là div role=button, label đổi thành tên tỉnh sau khi Áp dụng;
    // panel là dialog "Chọn địa điểm" dạng checkbox, phải bấm "Áp dụng" để commit lựa chọn.
    this.locTheoTinhThanhTrigger = page
      .locator('[data-test-id="location-search__anchor"]')
      .or(page.getByRole('button', { name: 'Lọc theo tỉnh thành' }))
      .first();
    this.cityDropdownContainer = page.getByRole('dialog', { name: 'Chọn địa điểm' });
    this.cityPickerApplyBtn = this.cityDropdownContainer.getByRole('button', { name: 'Áp dụng', exact: true });
    this.cityPickerClearAllBtn = this.cityDropdownContainer.getByRole('button', { name: 'Bỏ chọn tất cả', exact: true });
    this.cityPickerOldVersionRadio = this.cityDropdownContainer.getByRole('radio', { name: /Tỉnh\/thành cũ/ });
    this.cityPickerCoachMarkBtn = page.getByRole('button', { name: 'Tôi đã hiểu' });
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
    // Text thực tế trên QC (đã verify trong JS-8865) khác câu trong mô tả ticket → chấp nhận cả hai.
    this.toastWarning = page.getByText(/Kết quả sẽ tốt hơn khi chọn ít khu vực|Bạn đã chọn quá nhiều khu vực/i).first();
    this.robotsMeta = page.locator('meta[name="robots"], meta[name="googlebot"]').first();
    this.fallbackErrorMsg = page.getByText(/Không thể mở liên kết này/i).first();
    this.retrySearchBtn = page.getByRole('button', { name: /Tìm lại/i }).first();
    this.homeRedirectBtn = page.getByRole('button', { name: /Về trang chủ/i }).or(page.locator('a[href="/"]')).first();
    this.loginNavButton = page.getByRole('button', { name: /đăng nhập/i }).or(page.locator('a[href*="/dang-nhap"]')).first();

    // Modular helpers
    this.filterHelper = new JobSearchFilterHelper(this);
    this.cityPickerHelper = new JobSearchCityPickerHelper(this);
    this.restoreHelper = new JobSearchRestoreHelper(this);
    this.listHelper = new JobSearchListHelper(this);
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

  // --- JobSearchListHelper (pages/desktop/search/JobSearchListHelper.js) ---
  async clickFirstJob() { return this.listHelper.clickFirstJob(); }
  async closeGuestPromptModalIfVisible() { return this.listHelper.closeGuestPromptModalIfVisible(); }
  async openChopChatbot() { return this.listHelper.openChopChatbot(); }
  async selectJobsForBulkApply(numberOfJobs) { return this.listHelper.selectJobsForBulkApply(numberOfJobs); }
  async clickBulkApplyButton() { return this.listHelper.clickBulkApplyButton(); }
  async confirmBulkApply() { return this.listHelper.confirmBulkApply(); }
  async expectBulkApplySuccessMessageVisible() { return this.listHelper.expectBulkApplySuccessMessageVisible(); }
  async clickJobByTitle(title) { return this.listHelper.clickJobByTitle(title); }

  async expectJobSearchPageVisible() {
    await this.page.waitForLoadState('domcontentloaded');
    const heading = this.jobSearchResultTitle.or(this.page.getByRole('heading', { level: 1 })).first();
    await expect(heading).toBeVisible({ timeout: 15000 });
    // H1 404 cũng là heading level 1: chờ trang tìm kiếm thật, nếu thao tác lọc trong lúc này
    // lần điều hướng lại muộn sẽ ghi đè bộ lọc vừa chọn.
    await expect(this.notFoundHeading).toBeHidden({ timeout: 20000 });
  }

  // --- Delegation: Search Filters ---
  async expectCityFilterApplied(cityName, districtName) { return this.cityPickerHelper.expectCityFilterApplied(cityName, districtName); }
  async expectExperienceFilterApplied(expLabel) { return this.filterHelper.expectExperienceFilterApplied(expLabel); }
  async expectFiltersReset() { return this.filterHelper.expectFiltersReset(); }
  async openCityDropdown() { return this.cityPickerHelper.openCityDropdown(); }
  async selectCityOption(cityName, districtName) { return this.cityPickerHelper.selectCityOption(cityName, districtName); }
  async clickSearch() { return this.cityPickerHelper.clickSearch(); }
  async filterByCity(cityName, districtName) { return this.cityPickerHelper.filterByCity(cityName, districtName); }
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
  async padRequestHeaders(context, baseURL, bytes) { return this.restoreHelper.padRequestHeaders(context, baseURL, bytes); }
  startSearchApiRecorder() { return this.restoreHelper.startSearchApiRecorder(); }
  startDocumentStatusRecorder() { return this.restoreHelper.startDocumentStatusRecorder(); }
  async expectSearchFormReady() { return this.restoreHelper.expectSearchFormReady(); }
  async expectWarningToastHidden() { return this.restoreHelper.expectWarningToastHidden(); }
}

module.exports = { JobSearchPage };
