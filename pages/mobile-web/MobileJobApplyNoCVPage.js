const { expect } = require('@playwright/test');
const { JobApplyNoCVPage } = require('../desktop/JobApplyNoCVPage');

class MobileJobApplyNoCVPage extends JobApplyNoCVPage {
  constructor(page, featureName) {
    super(page, featureName);
    
    // Override locators for mobile where the actual input is hidden/intercepted by a wrapper or text element
    this.txtProvince = this.page.getByText('Chọn tỉnh', { exact: true })
      .or(this.page.getByRole('textbox', { name: /Chọn tỉnh/i }))
      .or(this.page.locator('[data-test-id="common__select-input"]').filter({ hasText: /Chọn tỉnh/i }))
      .first();
      
    this.txtDistrict = this.page.getByText('Chọn quận', { exact: true })
      .or(this.page.getByRole('textbox', { name: /Chọn quận/i }))
      .or(this.page.locator('[data-test-id="common__select-input"]').filter({ hasText: /Chọn quận/i }))
      .first();
      
    this.txtBirthYear = this.page.getByText('Chọn năm sinh', { exact: true })
      .or(this.page.getByRole('textbox', { name: /Chọn năm sinh/i }))
      .or(this.page.locator('[data-test-id="common__select-input"]').filter({ hasText: /Chọn năm sinh/i }))
      .first();

    this.txtIntro = this.page.locator('textarea:not([class*="recaptcha"]):not([id*="recaptcha"])')
      .or(this.page.locator('[placeholder*="Chia sẻ về bản thân"]'))
      .or(this.page.getByRole('textbox', { name: /Chia sẻ về bản thân|Giới thiệu bản thân/i }))
      .or(this.page.getByPlaceholder(/Giới thiệu bản thân|Chia sẻ về bản thân/i))
      .first();

    this.fileInput = this.page.locator('input[type="file"]').first();

    this.btnUploadFile = this.page.getByRole('button', { name: /Chọn hình\/file|Thay hình/i })
      .or(this.page.locator('button:has-text("chân dung")'))
      .first();
  }

  /**
   * Điền profile mini trên Mobile, đảm bảo các trường đặc thù như intro được điền đầy đủ
   */
  async fillMiniProfile(data) {
    await super.fillMiniProfile(data);

    // Đảm bảo trường Giới thiệu bản thân được điền trên mobile nếu có trong data
    if (data.intro) {
      try {
        const intro = this.txtIntro;
        if ((await intro.count().catch(() => 0)) > 0) {
          const val = await intro.inputValue().catch(() => '');
          if (!val) {
            await this.clickElement(intro);
            await this.fillInput(intro, data.intro);
          }
        }
      } catch (err) {
        console.log('Mobile intro fill fallback notice:', err.message);
      }
    }

    // Một số tin bắt buộc Giới tính ("Vui lòng chọn giới tính"); không có <input type=radio>:
    // <label><i class="svicon-circle|svicon-circle-dot-s"/><span>Nam</span></label> — icon dot = đã chọn
    if (data.gender) {
      const label = this.page.locator('label').filter({ has: this.page.getByText(data.gender, { exact: true }) })
        .filter({ visible: true }).first();
      const selectedIcon = label.locator('i.svicon-circle-dot-s');
      // Trường render trễ → chờ thật (isVisible không chờ); tin không yêu cầu giới tính thì bỏ qua
      if (await label.waitFor({ state: 'visible', timeout: 8000 }).then(() => true, () => false)) {
        await label.scrollIntoViewIfNeeded().catch(() => null);
        await expect(async () => {
          // Dropdown (Học vấn/Năm sinh) còn mở có thể che label → bắn click thẳng vào nhãn (không click toạ độ, tránh chọn nhầm option)
          if (!(await selectedIcon.isVisible())) {
            await label.click({ timeout: 3000 }).catch(() => label.locator('span').first().dispatchEvent('click'));
          }
          await expect(selectedIcon).toBeVisible({ timeout: 2000 });
        }).toPass({ timeout: 15000 });
      }
    }
  }

  /**
   * Override mở danh sách việc đã ứng tuyển trên Mobile:
   * Nếu menu header bị ẩn vào drawer/hamburger hoặc modal đang che, điều hướng URL tương đối
   */
  async openAppliedJobs() {
    try {
      await super.openAppliedJobs();
      return;
    } catch (e) {
      // Fallback: Điều hướng trực tiếp URL tương đối chuẩn trên Mobile
      await this.navigate('/ntv-trang-quan-tri-viec-lam-da-ung-tuyen.html');
      await this.page.waitForLoadState('domcontentloaded');
    }
  }

  /**
   * Đảm bảo danh sách việc đã ứng tuyển hiển thị trên mobile
   */
  async expectAppliedJobsVisible() {
    await this.page.waitForLoadState('domcontentloaded');
    const appliedList = this.page.locator(
      'h1:has-text("Việc làm đã ứng tuyển"):visible, ' +
      'h2:has-text("Việc làm đã ứng tuyển"):visible, ' +
      '[data-test-id="applied-job__list-jobs"]:visible, ' +
      'div:has-text("Hồ sơ đã đến nhà tuyển dụng"):visible, ' +
      'span:has-text("CV ứng tuyển"):visible'
    ).first();
    await this.waitForElement(appliedList, 20000);
  }
}
module.exports = { MobileJobApplyNoCVPage };
