const { BasePage } = require('../BasePage');
const { LoginOtpRequest } = require('./login/LoginOtpRequest');
const { definePersonalizeLocators } = require('./personalize/PersonalizeLocators');
const { PersonalizeAuthHelper } = require('./personalize/PersonalizeAuthHelper');
const { PersonalizeOnboardingHelper } = require('./personalize/PersonalizeOnboardingHelper');
const { PersonalizeRecordedFlowHelper } = require('./personalize/PersonalizeRecordedFlowHelper');

/**
 * Personalized Page "Việc làm dành riêng cho bạn" (REQ-008).
 * Locator ở personalize/PersonalizeLocators.js; hành vi ở các helper personalize/* (owner-delegating),
 * MobilePersonalizePage override trực tiếp các method public bên dưới.
 */
class PersonalizePage extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   * @param {string} [featureName]
   */
  constructor(page, featureName) {
    super(page, featureName);
    definePersonalizeLocators(this);

    // Zalo OTP mặc định (REQ-012): OTP cố định 1111 của QC chỉ áp dụng kênh SMS → "Phương thức khác" > "Nhận OTP qua SMS"
    this.otpRequest = new LoginOtpRequest({
      page,
      actions: this.actions,
      continueBtn: this.tiepTucBtn,
      clickContinue: () => this.actions.click(this.tiepTucBtn),
    });
    // Nút gửi OTP của bước nhập SĐT: "Nhận OTP qua Zalo" hoặc "Tiếp tục" khi Zalo OTP tắt
    this.requestOtpBtn = this.otpRequest.requestOtpBtn;

    this.authHelper = new PersonalizeAuthHelper(this);
    this.onboardingHelper = new PersonalizeOnboardingHelper(this);
    this.recordedFlowHelper = new PersonalizeRecordedFlowHelper(this);
  }

  async navigate() {
    await this.navigateToPersonalizedPage();
  }

  /** Mở trực tiếp trang Việc làm dành riêng cho bạn (Personalized Page) */
  async navigateToPersonalizedPage() {
    await super.navigate(this.personalizedPath);
  }

  // --- SEO / Social meta ---
  async getMetaDescription() { return this.metaDescription.getAttribute('content'); }
  async getMetaKeywords() { return this.metaKeywords.getAttribute('content'); }
  async getCanonicalHref() { return this.canonicalLink.getAttribute('href'); }
  async getOgTitle() { return this.ogTitleMeta.getAttribute('content'); }
  async getOgUrl() { return this.ogUrlMeta.getAttribute('content'); }
  async getOgDescription() { return this.ogDescriptionMeta.getAttribute('content'); }
  async getJobCardsCount() { return this.jobCards.count(); }

  /** Đóng banner / popup cản trở nếu xuất hiện */
  async closeBannerIfVisible() {
    try {
      await this.closeAllPopupsIfVisible();
      const closeBtns = this.page.locator('[data-test-id="common__close-button"], .svicon-close, [class*="svicon-close"], button:has(.svicon-close), [aria-label*="close" i], .absolute.top-1.right-1');
      if (await closeBtns.first().isVisible({ timeout: 1500 }).catch(() => false)) {
        await closeBtns.first().click({ force: true }).catch(() => null);
      }
      const privacyAgree = this.page.getByRole('button', { name: 'Đồng ý', exact: true });
      if (await privacyAgree.isVisible({ timeout: 1500 }).catch(() => false)) {
        await privacyAgree.click({ force: true }).catch(() => null);
      }
    } catch (_) { /* banner tuỳ chọn */ }
  }

  /** Nhập giá trị hợp lệ vào trường thông tin tìm kiếm tiêu chí */
  async fillValidCriteriaField(value = 'nhân viên bán hàng') {
    await this.actions.fill(this.dataTestId, value);
    await this.capture('valid_criteria_field_filled');
  }

  /** Nhập chuỗi 6 ký tự để kiểm tra biên tối đa 5 */
  async fill6CharsField(value = '123456') {
    await this.actions.fill(this.dataTestId, value);
    await this.capture('6_chars_field_filled');
  }

  /** Locator nút khu vực trong Bước 2 Onboarding mini */
  getLocationBtn(name) {
    const rx = new RegExp(`^${name}`, 'i');
    return this.step2Modal
      .getByRole('button', { name: rx })
      .or(this.step2Modal.locator('button, [role="button"]').filter({ hasText: rx }))
      .or(this.page.getByRole('button', { name: rx }))
      .first();
  }

  /** Nút khu vực thứ 6 trong danh sách mở rộng (An Giang) */
  get sixthLocationBtn() {
    return this.step2Modal.getByRole('button', { name: /An Giang/i }).or(this.page.getByRole('button', { name: /An Giang/i })).first();
  }

  // --- PersonalizeAuthHelper (personalize/PersonalizeAuthHelper.js) ---
  async registerAndAcceptConsentOnPersonalizedPage(phone, otp, fullName) { return this.authHelper.registerAndAcceptConsentOnPersonalizedPage(phone, otp, fullName); }
  async registerPhoneAndOtp(phone, otp) { return this.authHelper.registerPhoneAndOtp(phone, otp); }
  async enterFullNameAndAcceptConsent(fullName) { return this.authHelper.enterFullNameAndAcceptConsent(fullName); }
  async openPersonalizeAuthModal() { return this.authHelper.openPersonalizeAuthModal(); }
  async fillPhoneAndContinue(phone) { return this.authHelper.fillPhoneAndContinue(phone); }
  async fillOtpDigits(otp, options) { return this.authHelper.fillOtpDigits(otp, options); }
  async loginOrRegisterWithOtp(phone, otp, fullName) { return this.authHelper.loginOrRegisterWithOtp(phone, otp, fullName); }

  // --- PersonalizeOnboardingHelper (personalize/PersonalizeOnboardingHelper.js) ---
  async completeDirectMiniOnboarding(jobTitle, minSalary, maxSalary) { return this.onboardingHelper.completeDirectMiniOnboarding(jobTitle, minSalary, maxSalary); }
  async select5Locations(options) { return this.onboardingHelper.select5Locations(options); }
  async select6thLocationIfAvailable() { return this.onboardingHelper.select6thLocationIfAvailable(); }
  async openExtendedLocationsDropdown() { return this.onboardingHelper.openExtendedLocationsDropdown(); }
  async completeStep1JobTitle(jobTitle) { return this.onboardingHelper.completeStep1JobTitle(jobTitle); }
  async completeStep2Locations(locations) { return this.onboardingHelper.completeStep2Locations(locations); }
  async completeStep3Salary(minSalary, maxSalary) { return this.onboardingHelper.completeStep3Salary(minSalary, maxSalary); }
  async verifyPersonalizedPageAfterOnboarding(options) { return this.onboardingHelper.verifyPersonalizedPageAfterOnboarding(options); }
  async reachOnboardingStep1JobTitle(phone, otp, fullName) { return this.onboardingHelper.reachOnboardingStep1JobTitle(phone, otp, fullName); }
  async reachOnboardingStep2Locations(phone, otp, fullName) { return this.onboardingHelper.reachOnboardingStep2Locations(phone, otp, fullName); }
  async deselectLocation(btnName = 'Cần Thơ', options = {}) { return this.onboardingHelper.toggleLocation(btnName, 'location_deselected', options); }
  async selectSingleLocation(btnName = 'Cần Thơ', options = {}) { return this.onboardingHelper.toggleLocation(btnName, 'location_selected', options); }

  // --- PersonalizeRecordedFlowHelper (personalize/PersonalizeRecordedFlowHelper.js) ---
  async setupInitialCriteria(options) { return this.recordedFlowHelper.setupInitialCriteria(options); }
  async updateAdditionalCriteria() { return this.recordedFlowHelper.updateAdditionalCriteria(); }
  async exploreRecommendedJobs() { return this.recordedFlowHelper.exploreRecommendedJobs(); }
  async performRecordedActions(options) { return this.recordedFlowHelper.performRecordedActions(options); }
}

module.exports = { PersonalizePage };
