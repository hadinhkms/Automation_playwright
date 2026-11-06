const { expect } = require('@playwright/test');

class JobSearchFilterHelper {
  /**
   * @param {import('../JobSearchPage').JobSearchPage} pageInstance
   */
  constructor(pageInstance) {
    this.owner = pageInstance;
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

  /**
   * Bấm "Xoá lọc" và chờ URL bỏ query filter. Không được skip im lặng: nếu filter còn dính,
   * các bước sau (vd. TP.HCM + Nam = 0 việc) sẽ treo ở bước chọn tin tuyển dụng.
   */
  async clearFilters() {
    const { page } = this.owner;
    await this.owner.closeAllPopupsIfVisible();
    const btn = this.owner.xoaLocBtn.first();
    await btn.waitFor({ state: 'visible', timeout: 10000 });
    const urlBefore = page.url();
    await this.owner.actions.click(btn);
    await page.waitForURL((url) => url.toString() !== urlBefore, { timeout: 10000 }).catch(() => null);
    await page.waitForLoadState('domcontentloaded');
  }
}

module.exports = { JobSearchFilterHelper };
