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

    this.txtIntro = this.page.locator('textarea')
      .or(this.page.getByRole('textbox', { name: /Chia sẻ về bản thân|Giới thiệu bản thân/i }))
      .or(this.page.getByPlaceholder(/Giới thiệu bản thân|Chia sẻ về bản thân/i))
      .first();

    this.fileInput = this.page.locator('input[type="file"]').first();

    this.btnUploadFile = this.page.getByRole('button', { name: /Chọn hình\/file|Thay hình/i })
      .or(this.page.locator('button:has-text("chân dung")'))
      .first();
  }
}
module.exports = { MobileJobApplyNoCVPage };
