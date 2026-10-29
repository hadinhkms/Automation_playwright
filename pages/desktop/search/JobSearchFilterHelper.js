const { expect } = require('@playwright/test');

class JobSearchFilterHelper {
  /**
   * @param {import('../JobSearchPage').JobSearchPage} pageInstance
   */
  constructor(pageInstance) {
    this.owner = pageInstance;
  }

  /**
   * Xác nhận bộ lọc tỉnh thành (và tùy chọn quận/huyện) đã được áp dụng
   * @param {string} cityName Tên tỉnh thành (ví dụ: 'TP.HCM')
   * @param {string} [districtName] Tên quận/huyện nếu có (ví dụ: 'Quận 1')
   */
  async expectCityFilterApplied(cityName = 'TP.HCM', districtName = null) {
    await this.owner.page.waitForLoadState('domcontentloaded');
    if (districtName) {
      await expect(this.owner.locTheoTinhThanhInput).toHaveValue(
        new RegExp(`${cityName}.*${districtName}|${districtName}.*${cityName}`, 'i'),
        { timeout: 15000 }
      );
      await expect(this.owner.jobSearchResultTitle).toContainText(districtName, { timeout: 15000 });
    } else {
      await expect(this.owner.locTheoTinhThanhInput).toHaveValue(cityName, { timeout: 15000 });
      await expect(this.owner.jobSearchResultTitle).toContainText(cityName, { timeout: 15000 });
    }
  }

  /**
   * Xác nhận bộ lọc kinh nghiệm đã được áp dụng
   * @param {string} expLabel Nhãn kinh nghiệm (ví dụ: '1 năm')
   */
  async expectExperienceFilterApplied(expLabel = '1 năm') {
    await this.owner.page.waitForLoadState('domcontentloaded');
    const expIndicator = this.owner.page
      .getByText(expLabel)
      .or(this.owner.page.locator(`input[value*="${expLabel}"]`))
      .first();
    await expect(expIndicator).toBeVisible({ timeout: 15000 });
  }

  /**
   * Xác nhận các bộ lọc đã được đặt lại về mặc định
   */
  async expectFiltersReset() {
    await this.owner.page.waitForLoadState('domcontentloaded');
    const defaultExpIndicator = this.owner.page
      .getByText(/Tất cả kinh nghiệm/i)
      .or(this.owner.page.locator('input[value*="Tất cả kinh nghiệm"]'))
      .first();
    await expect(defaultExpIndicator).toBeVisible({ timeout: 15000 });
  }

  /**
   * Mở dropdown chọn tỉnh thành từ thanh tìm kiếm
   */
  async openCityDropdown() {
    await this.owner.closeAllPopupsIfVisible();
    await this.owner.locTheoTinhThanhInput.waitFor({ state: 'visible', timeout: 10000 });
    await this.owner.actions.click(this.owner.locTheoTinhThanhInput);
    await this.owner.cityDropdownContainer.waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * Chọn tỉnh thành (và tùy chọn quận/huyện) trong danh sách dropdown
   * @param {string} cityName Tên tỉnh thành (ví dụ: 'TP.HCM', 'Hà Nội', 'Bình Dương', 'Toàn quốc')
   * @param {string} [districtName] Tên quận/huyện nếu muốn lọc chi tiết (ví dụ: 'Quận 1', 'Quận 3')
   */
  async selectCityOption(cityName = 'TP.HCM', districtName = null) {
    if (districtName) {
      const row = this.owner.cityDropdownContainer
        .locator('div.h-10.relative')
        .filter({ hasText: new RegExp(`^${cityName}`, 'i') })
        .first();
      await row.scrollIntoViewIfNeeded({ timeout: 5000 });
      const arrowBtn = row.locator('button.absolute, button').last();
      await this.owner.actions.click(arrowBtn);
      const districtBtn = this.owner.cityDropdownContainer
        .locator('button')
        .filter({ hasText: new RegExp(`^${districtName}$`, 'i') })
        .first();
      await districtBtn.waitFor({ state: 'visible', timeout: 5000 });
      await districtBtn.scrollIntoViewIfNeeded({ timeout: 5000 });
      await this.owner.actions.click(districtBtn);
    } else {
      const cityBtn = this.owner.cityDropdownContainer
        .locator('button')
        .filter({ hasText: new RegExp(`^${cityName}$`, 'i') })
        .or(this.owner.page.getByRole('button', { name: cityName, exact: true }))
        .first();
      await cityBtn.scrollIntoViewIfNeeded({ timeout: 5000 });
      await this.owner.actions.click(cityBtn);
    }
    await this.owner.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Bấm nút "Tìm kiếm" để thực thi truy vấn và làm mới danh sách việc làm
   */
  async clickSearch() {
    await this.owner.timKiemBtn.waitFor({ state: 'visible', timeout: 10000 });
    await this.owner.actions.click(this.owner.timKiemBtn);
    await this.owner.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Quy trình đầy đủ để lọc việc làm theo tỉnh thành
   * @param {string} [cityName='TP.HCM']
   * @param {string} [districtName]
   */
  async filterByCity(cityName = 'TP.HCM', districtName = null) {
    await this.openCityDropdown();
    await this.selectCityOption(cityName, districtName);
    await this.clickSearch();
  }

  async filterByTuyenNhanh() {
    await this.owner.closeAllPopupsIfVisible();
    await this.owner.actions.click(this.owner.tuyenNhanhFilterBtn);
    await this.owner.page.waitForLoadState('domcontentloaded');
  }

  async filterByViecKhongCanCv() {
    await this.owner.closeAllPopupsIfVisible();
    await this.owner.actions.click(this.owner.viecKhongCanCvFilterBtn);
    await this.owner.page.waitForLoadState('domcontentloaded');
  }

  async selectDropdownOption(inputLocator, optionLabel) {
    await this.owner.closeAllPopupsIfVisible();
    if (await inputLocator.isVisible({ timeout: 5000 }).catch(() => false)) {
      await this.owner.actions.click(inputLocator);
      const optBtn = this.owner.page.getByRole('button', { name: optionLabel, exact: true }).first();
      if (await optBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await this.owner.actions.click(optBtn);
      }
      await this.owner.page.waitForLoadState('domcontentloaded');
    }
  }

  async filterByExperience(expLabel = '1 năm') {
    const trigger = this.owner.kinhNghiemFilterInput.or(this.owner.filterDropdownTrigger);
    await this.selectDropdownOption(trigger, expLabel);
  }

  async filterBySalary(salaryLabel = '10 - 15 triệu') {
    await this.selectDropdownOption(this.owner.mucLuongFilterInput, salaryLabel);
  }

  async filterByJobLevel(levelLabel = 'Nhân viên') {
    await this.selectDropdownOption(this.owner.capBacFilterInput, levelLabel);
  }

  async filterByEducation(eduLabel = 'Đại học') {
    await this.selectDropdownOption(this.owner.trinhDoFilterInput, eduLabel);
  }

  async filterByJobType(jobTypeLabel = 'Toàn thời gian cố định') {
    await this.selectDropdownOption(this.owner.loaiCongViecFilterInput, jobTypeLabel);
  }

  async filterByGender(genderLabel = 'Nam') {
    await this.selectDropdownOption(this.owner.gioiTinhFilterInput, genderLabel);
  }

  async clearFilters() {
    await this.owner.closeAllPopupsIfVisible();
    if (await this.owner.xoaLocBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await this.owner.actions.click(this.owner.xoaLocBtn);
      await this.owner.page.waitForLoadState('domcontentloaded');
    }
  }
}

module.exports = { JobSearchFilterHelper };

