const { expect } = require('@playwright/test');

class ProfileCvHelper {
  constructor(pageInstance) {
    this.owner = pageInstance;
  }

  async completeOtpIfVisible(code = '1111') {
    const otpTitle = this.owner.page.getByText(/Xác thực(?: OTP)?|Mã xác thực|OTP/i).first();
    try {
      await otpTitle.waitFor({ state: 'visible', timeout: 5000 });
    } catch {
      return false;
    }

    const otpInputs = this.owner.page.locator(
      [
        'input[type="tel"]:visible',
        'input[maxlength="1"]:visible',
        'input[autocomplete="one-time-code"]:visible',
      ].join(', ')
    );
    await this.owner.fillCodeInputs(otpInputs, code);
    await this.owner.waitForGlobalLoadingHidden(15000).catch(() => null);
    await otpTitle.waitFor({ state: 'hidden', timeout: 30000 }).catch(() => null);
    return true;
  }

  async enableCVSearch() {
    const cvSearchSwitch = this.owner.page.locator('[data-test-id="common__switch"]').first();
    await this.owner.clickElement(cvSearchSwitch);
  }

  async isAllowSearchVisible(timeout = 1000) {
    const btnAllowSearch = this.owner.page.getByRole('button', { name: /Cho phép tìm kiếm/i }).first();
    try {
      await btnAllowSearch.waitFor({ state: 'visible', timeout });
      return true;
    } catch {
      return false;
    }
  }

  async clickContinueButton() {
    if (await this.isAllowSearchVisible()) {
      return;
    }

    const btnContinue = this.owner.page.getByRole('button', { name: /Tiếp tục/i }).first();
    await this.owner.clickElement(btnContinue);
  }

  async fillVerificationCode(code) {
    const verificationInputs = this.owner.page.getByRole('textbox', { name: /Digit|Please enter verification/i });
    try {
      await verificationInputs.first().waitFor({ state: 'visible', timeout: 5000 });
    } catch (error) {
      if (await this.isAllowSearchVisible()) {
        return;
      }
      throw error;
    }
    await this.owner.fillCodeInputs(verificationInputs, code);
  }

  async uploadCV(filePath) {
    const uploadSection = this.owner.page.locator('[data-test-id="user-profile__enable-search-cv"]');
    const fileInput = uploadSection.locator('input[type="file"]');

    if (await fileInput.count() > 0) {
      await fileInput.setInputFiles(filePath);
      return;
    }

    const uploadButton = uploadSection.locator('[data-test-id="common__button"]');
    const [fileChooser] = await Promise.all([
      this.owner.page.waitForEvent('filechooser', { timeout: 10000 }),
      this.owner.clickElement(uploadButton),
    ]);
    await fileChooser.setFiles(filePath);
  }

  async clickAllowSearch() {
    const btnAllowSearch = this.owner.page.getByRole('button', { name: /Cho phép tìm kiếm/i }).first();
    await this.owner.clickElement(btnAllowSearch);
  }

  async uploadProfileCV(filePath) {
    const btnUpload = this.owner.page.getByRole('button', { name: 'Tải lên CV' });
    const [fileChooser] = await Promise.all([
      this.owner.page.waitForEvent('filechooser', { timeout: 10000 }),
      this.owner.clickElement(btnUpload.first()),
    ]);
    await fileChooser.setFiles(filePath);
  }

  async confirmCVConversion() {
    if (typeof this.owner.capture === 'function') await this.owner.capture('before_confirm_cv_conversion', false);

    const btnConfirm = this.owner.page.locator('[data-test-id="common__actions-button"] [data-test-id="common__button"]').first();
    await this.owner.clickElement(btnConfirm);
  }

  /**
   * Hai luồng chuyển đổi CV:
   * - Mới (QC 11/2026): Upload → màn "Kiểm tra thông tin" → "Thêm vào Hồ sơ của tôi" (confirmCVConversion) áp dữ liệu ngay, không còn toast.
   * - Cũ: toast "Chuyển đổi thành công" → bấm toast → modal áp dữ liệu.
   * Luồng mới được xác nhận bằng nội dung của data/TemplateCV.pdf hiện trên Hồ sơ sau khi màn kiểm tra đóng.
   */
  async verifyAndApplyCVData() {
    const { page } = this.owner;
    const txtSuccess = page.getByText('Chuyển đổi thành công');
    const reviewScreen = page.getByText('Kiểm tra thông tin', { exact: true });
    const appliedCvContent = page.getByText(/Office Manager with over 6 years/i).first(); // từ data/TemplateCV.pdf
    await expect(async () => {
      if (await txtSuccess.isVisible()) return;
      expect(await reviewScreen.isVisible(), 'Màn "Kiểm tra thông tin" phải đóng sau khi xác nhận').toBe(false);
      expect(await appliedCvContent.isVisible(), 'Hồ sơ phải hiển thị dữ liệu từ CV đã chuyển đổi').toBe(true);
    }).toPass({ timeout: 60000 });
    if (!(await txtSuccess.isVisible())) {
      if (typeof this.owner.capture === 'function') await this.owner.capture('cv_data_applied_to_profile', false);
      return;
    }

    if (typeof this.owner.capture === 'function') await this.owner.capture('cv_conversion_success_toast', false);

    await this.owner.clickElement(txtSuccess);

    if (typeof this.owner.capture === 'function') await this.owner.capture('apply_cv_data_modal_opened', false);

    const btnApplyData = this.owner.page.locator('[data-test-id="common__actions-button"] [data-test-id="common__button"]').first();
    await this.owner.clickElement(btnApplyData);
  }

  async navigateToProfileManagement() {
    await this.owner.navigateToMyProfile();
    await this.owner.waitForPageReady();
  }

  async fillAndSavePersonalInfoModal({ fullName = 'Nguyễn Văn Test', phone = '0901234567', email = 'test@example.com', address = 'Quận 1, TP.HCM' } = {}) {
    if (await this.owner.btnOpenPersonalInfo.isVisible()) {
      await this.owner.clickElement(this.owner.btnOpenPersonalInfo);
      await this.owner.actions.waitForVisible(this.owner.personalInfoModal, { timeout: 5000 });
      if (await this.owner.inpPersonalFullName.isVisible()) await this.owner.fillInput(this.owner.inpPersonalFullName, fullName);
      if (await this.owner.inpPersonalPhone.isVisible()) await this.owner.fillInput(this.owner.inpPersonalPhone, phone);
      if (await this.owner.inpPersonalEmail.isVisible()) await this.owner.fillInput(this.owner.inpPersonalEmail, email);
      if (await this.owner.inpPersonalAddress.isVisible()) await this.owner.fillInput(this.owner.inpPersonalAddress, address);
      if (await this.owner.btnSavePersonalInfoModal.isVisible()) await this.owner.clickElement(this.owner.btnSavePersonalInfoModal);
      await this.owner.waitForPageReady();
    }
  }

  async triggerCVConversion() {
    if (await this.owner.btnConvertCVTrigger.isVisible()) {
      await this.owner.clickElement(this.owner.btnConvertCVTrigger);
      await this.owner.waitForPageReady();
    }
  }

  async triggerUpdateJobCriteria() {
    if (await this.owner.btnUpdateCriteria.isVisible()) {
      await this.owner.clickElement(this.owner.btnUpdateCriteria);
      await this.owner.waitForPageReady();
    }
  }

  async openJobCriteria() {
    await this.owner.clickElement(this.owner.linkCriteria);
    await this.owner.page.waitForLoadState('domcontentloaded');
    await this.owner.waitForPageReady();
  }

  async toggleAllowSearchSwitch() {
    const toggle = this.owner.allowSearchToggle;
    if (await toggle.isVisible()) {
      await this.owner.clickElement(toggle);
      await this.owner.waitForPageReady();
    }
  }

  async fillOtpVerificationCode(code) {
    const otpInput = this.owner.otpInputField?.or?.(this.owner.page.locator('input[type="tel"]:visible, input[maxlength="1"]:visible').first())
      || this.owner.page.locator('input[type="tel"]:visible, input[maxlength="1"]:visible').first();
    if (await otpInput.isVisible()) {
      await this.owner.fillInput(otpInput, code);
    }
  }

  async confirmOtpVerification() {
    const btn = this.owner.btnConfirmOtp?.or?.(this.owner.page.getByRole('button', { name: /Xác nhận|Xác thực/i }).first())
      || this.owner.page.getByRole('button', { name: /Xác nhận|Xác thực/i }).first();
    if (await btn.isVisible()) {
      await this.owner.clickElement(btn);
      await this.owner.waitForPageReady();
    }
  }
}

module.exports = { ProfileCvHelper };
