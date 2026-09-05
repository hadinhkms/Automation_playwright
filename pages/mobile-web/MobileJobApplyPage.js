const { JobApplyPage } = require('../desktop/JobApplyPage');

class MobileJobApplyPage extends JobApplyPage {
  constructor(page, featureName) {
    super(page, featureName);

    // Mobile responsive locators:
    // Nút "Ứng tuyển ngay" trên mobile thường là sticky button dưới đáy màn hình
    this.btnApplyNow = this.page
      .getByRole('button', { name: /Ứng tuyển ngay|Nộp lại hồ sơ/i })
      .or(this.page.locator('.fixed.bottom-0 button:has-text("Ứng tuyển")'))
      .or(this.page.locator('[data-test-id*="apply-button"]'))
      .first();

    // Phương thức ứng tuyển trên Mobile dialog / bottom-sheet
    this.optProfileMethod = this.page
      .locator('[data-test-id="apply-method-selector__option-profile"]')
      .or(this.page.getByText(/Hồ sơ trực tuyến|Sử dụng hồ sơ/i))
      .first();

    this.optCVMethod = this.page
      .locator('[data-test-id="apply-method-selector__option-cv"]')
      .or(this.page.getByText(/Tải lên CV|Đính kèm CV/i))
      .first();

    this.btnContinueProfile = this.page
      .locator('[data-test-id="apply-method-selector__expanded-profile"] [data-test-id="apply-profile-completion-content__action"]')
      .or(this.page.getByRole('button', { name: /Tiếp tục/i }))
      .first();

    // Input file upload CV
    this.inpCV = this.page.locator('input[type="file"]').first();

    // Bulk apply modal on mobile
    this.btnBulkApply = this.page
      .getByRole('button', { name: /Ứng tuyển nhanh|Nộp hồ sơ ngay|Ứng tuyển tất cả/i })
      .or(this.page.locator('[data-test-id*="bulk-apply"] button'))
      .first();
  }

  /**
   * Override mở danh sách việc đã ứng tuyển trên Mobile:
   * Nếu menu header bị ẩn vào drawer/hamburger, điều hướng URL tương đối hoặc mở drawer
   */
  async openAppliedJobs() {
    try {
      const isVisible = await this.btnAppliedJobs.isVisible({ timeout: 3000 });
      if (isVisible) {
        await this.actions.click(this.btnAppliedJobs);
        return;
      }
    } catch (e) {
      // Tiếp tục fallback
    }

    // Fallback: Điều hướng trực tiếp URL tương đối trên Mobile
    await this.page.goto('/viec-lam-da-ung-tuyen.html');
  }

  /**
   * Đảm bảo danh sách việc đã ứng tuyển hiển thị trên mobile
   */
  async expectAppliedJobsVisible() {
    await this.page.waitForLoadState('domcontentloaded');
    const appliedList = this.appliedJobsList
      .or(this.page.locator('.applied-job-item, [data-test-id*="applied-job"]'))
      .or(this.page.getByRole('heading', { name: /Việc làm đã ứng tuyển/i }))
      .first();
    await this.waitForElement(appliedList, 20000);
  }
}

module.exports = { MobileJobApplyPage };
