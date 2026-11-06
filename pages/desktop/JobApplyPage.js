const { BasePage } = require('../BasePage');
const { ScreenshotHelper } = require('../../core/utils/commonUtils');
const { JobApplySectionsHelper } = require('./apply/JobApplySectionsHelper');
const { JobApplyBulkApplyHelper } = require('./apply/JobApplyBulkApplyHelper');

class JobApplyPage extends BasePage {
  constructor(page) {
    super(page);

    this.screenshotHelper = new ScreenshotHelper(page, 'job-apply-details');

    // --- Locators (Các element trong page) ---
    this.btnApplyNow = this.page.getByRole('button', { name: /Ứng tuyển ngay|Nộp lại hồ sơ/i }).first();
    this.optProfileMethod = this.page.locator('[data-test-id="apply-method-selector__option-profile"]').first();
    this.optCVMethod = this.page.locator('[data-test-id="apply-method-selector__option-cv"]').first();
    this.btnContinueProfile = this.page.locator('[data-test-id="apply-method-selector__expanded-profile"] [data-test-id="apply-profile-completion-content__action"]').first();
    this.btnCommonSave = this.page
      .locator('[data-test-id="common__actions-button"] [data-test-id="common__button"]')
      .filter({ hasText: /Lưu/i })
      .or(this.page.locator('#apply-job-modal button, [data-test-id="unified-apply__apply-job-modal"] button').filter({ hasText: /Lưu/i }))
      .or(this.page.getByRole('button', { name: /Lưu thông tin|Lưu thay đổi|^Lưu$/i }))
      .first();
    this.txtCommonInput = this.page.locator('[data-test-id="common__input"]').first();

    // Upload CV
    this.btnUploadCV = this.page.locator('[data-test-id="apply-method-selector__option-cv"]').first();
    this.inpCV = this.page.locator('input[type="file"]').first();
    this.cvUploadError = this.page.locator('[class*="error"], [class*="helper"], [class*="feedback"], [class*="text-danger"], [role="alert"]').filter({ hasText: /định dạng|dung lượng|kích thước|không hợp lệ|pdf|doc/i }).or(this.page.getByText(/định dạng.*không hợp lệ|dung lượng|kích thước.*quá lớn/i)).first();
    this.btnAlreadyApplied = this.page.getByRole('button', { name: /Đã ứng tuyển|Nộp lại hồ sơ/i }).first();

    // Giới thiệu
    this.btnAddIntro = this.page.locator('[data-test-id="apply-job__introduce"] [data-test-id="user-profile__add-button"]').first();
    this.txtIntro = this.page.getByRole('textbox', { name: /Hãy chia sẻ về kinh nghiệm/i }).first();

    // Kinh nghiệm
    this.btnHasExperience = this.page.getByRole('button', { name: /Đã có/i }).first();
    this.btnAddExperience = this.page.locator('[data-test-id="apply-job__experience"] [data-test-id="user-profile__add-button"]').first();
    this.txtCompany = this.page.getByRole('textbox', { name: /Nhập tên công ty/i }).first();
    this.txtJobTitleSearch = this.page.locator('[data-test-id="common__job-title-select"] [data-test-id="common__input"]').first();
    this.optJobTitleFirst = this.page.locator('[data-test-id="common__select-dropdown"]').getByRole('listitem').first();
    this.inpStartDate = this.page.locator('input[name="start_date"]').first();
    this.inpEndDate = this.page.locator('input[name="end_date"]').first();
    this.btnSelectYear = this.page.locator('[id="apply-job-modal"] [class="relative"] button').first();
    this.chkWorkingHere = this.page.getByRole('checkbox', { name: /Tôi đang làm việc ở đây/i }).first();
    this.txtExpDescription = this.page.getByRole('textbox', { name: /Mô tả 3 - 5 công việc/i }).first();

    // Học vấn
    this.btnAddEdu = this.page.locator('[data-test-id="apply-job__education"] [data-test-id="user-profile__add-button"]').first();
    this.txtSchool = this.page.getByRole('textbox', { name: /Nhập tên trường của bạn/i }).first();
    this.inpStartYear = this.page.locator('input[name="start_date"]').first();
    this.inpEndYear = this.page.locator('input[name="end_date"]').first();
    this.txtMajor = this.page.getByRole('textbox', { name: /Nhập chuyên ngành đào tạo/i }).first();
    this.lblDegree = this.page.getByText('Chọn loại bằng cấp').first();
    this.txtEduDescription = this.page.getByRole('textbox', { name: /Mô tả chi tiết quá trình học/i }).first();

    // Kỹ năng
    this.btnAddSkill = this.page.locator('[data-test-id="apply-job__skills"] [data-test-id="user-profile__add-button"]').or(this.page.locator('[data-test-id="apply-job__skills"] [data-test-id="user-profile__edit-button"]')).or(this.page.locator('[data-test-id="apply-job__skills"] button')).first();

    // Thành tựu
    this.btnAddAchievement = this.page.locator('[data-test-id="apply-job__achievement"]').first();
    this.txtAchievementName = this.page.getByRole('textbox', { name: /Nhập tên dự án\/thành tựu/i }).first();
    this.txtAchievementDesc = this.page.getByRole('textbox', { name: /Mô tả chi tiết các dự án/i }).first();

    // Chứng chỉ & Ngoại ngữ
    this.btnAddCertificate = this.page.locator('[data-test-id="apply-job__certificate"]').first();
    this.btnAddLanguage = this.page.locator('[data-test-id="apply-job__foreign-language"]').first();
    this.lblLanguage = this.page.getByText('Chọn ngoại ngữ').first();

    // Submit Application & Final steps
    this.chkAllowSearch = this.page.locator('[data-test-id="common__checkbox"]')
      .filter({ hasText: /Nhà tuyển dụng tìm kiếm hồ sơ/i })
      .locator('input[type="checkbox"]')
      .or(this.page.locator('[data-test-id="common__checkbox"] input[type="checkbox"]'))
      .first();
    // Nút chốt của modal "Ứng tuyển với Hồ sơ của tôi": UI 11/2026 là "Hoàn thành hồ sơ" (trước đây "Lưu")
    this.btnSubmitProfile = this.page.getByRole('button', { name: /Hoàn thành hồ sơ/i }).or(this.btnCommonSave).first();
    this.msgSuccess = this.page.getByText('Ứng tuyển thành công!').first();
    this.msgBulkApplySuccess = this.page.getByText(/Ứng tuyển thành công(?:\s*\d+\s*vị trí)?!?/i).first();
    this.chkConfirmAll = this.page.locator('[data-test-id="common__checkall"]').first();
    this.confirmCheckboxes = this.page.locator('[data-test-id="common__checkbox"]');
    this.btnConfirmPopup = this.page.getByRole('button', { name: /Nộp hồ sơ ngay/i }).first();

    this.btnApplyAll = this.page.getByRole('button', { name: /Ứng tuyển\s*[1-9]\d*\s*vị trí/i }).first();
    this.btnBulkApplyZero = this.page.getByRole('button', { name: /Ứng tuyển\s*0\s*vị trí/i }).first();
    this.btnBulkApplyReady = this.page.getByRole('button', { name: /Ứng tuyển\s*[1-9]\d*\s*vị trí/i }).first();
    this.btnBulkApplyZeroStable = this.page.getByRole('button', { name: /Ứng tuyển\s*0\s*vị trí/i }).first();
    this.msgNoSimilarJobs = this.page.getByText(/Hiện chưa tìm thấy việc làm phù hợp|Không có.*(?:job|việc làm).*gợi ý|Không tìm thấy.*việc làm phù hợp/i).first();
    this.applyModal = this.page.locator('#apply-job-modal').first();
    this.applyWarningNote = this.applyModal.locator('[class*="error"], [class*="helper"], [role="alert"]').filter({ hasText: /ghi chú|thông tin bắt buộc|vui lòng/i }).or(this.applyModal.getByText(/ghi chú|bắt buộc|vui lòng/i)).first();
    this.otpTitle = this.page.getByText(/Xác thực số điện thoại|Xác thực mã OTP|Mã xác thực|xác minh/i).first();
    this.otpCloseBtn = this.page.locator('[data-test-id*="close"], [class*="close"], button:has-text("Hủy"), button:has-text("Đóng")').first();
    this.otpError = this.page.locator('[class*="error"], [role="alert"], [class*="feedback"]').filter({ hasText: /otp|mã xác thực|không đúng|không hợp lệ|không chính xác/i }).or(this.page.getByText(/otp.*không đúng|mã.*không chính xác|không hợp lệ/i)).first();
    this.appliedTodayBadge = this.page.locator('.badge.applied, [class*="applied-badge"], [class*="status-applied"]').filter({ hasText: /đã nộp|hôm nay/i }).or(this.page.getByText(/đã nộp trong ngày/i)).first();
    this.btnSeeMoreJobs = this.page.getByRole('button', { name: /Xem thêm việc gợi ý/i }).first();

    // Modular helpers
    this.sectionsHelper = new JobApplySectionsHelper(this);
    this.bulkApplyHelper = new JobApplyBulkApplyHelper(this);
  }

  async waitForApplyModalStable(options = {}) {
    try {
      await this.applyModal.waitFor({ state: 'visible', timeout: options.timeout ?? 5000 });
    } catch {
      return false;
    }
    try {
      await this.waitForElementStable(this.applyModal, {
        timeout: options.timeout ?? 15000,
        stableFrameCount: options.stableFrameCount ?? 10,
      });
      return true;
    } catch {
      return false;
    }
  }

  async capture(stepName, fullPage = null, options = {}) {
    await this.waitForApplyModalStable({
      timeout: options.modalStableTimeout ?? 15000,
      stableFrameCount: options.modalStableFrameCount ?? 10,
    });
    return super.capture(stepName, fullPage, options);
  }

  async clickApplyNow() {
    await this.clickElement(this.btnApplyNow);
    await this.waitForApplyModalStable().catch(() => null);
  }

  async closeOtpPopup() { await this.clickElement(this.otpCloseBtn); }

  async startApply(options = {}) {
    await this.clickElement(this.btnApplyNow);
    await this.handlePhoneVerificationAfterApplyIfVisible(options.otpCode);
    await this.actions.waitForVisible(this.optProfileMethod);
    await this.waitForApplyModalStable();
  }

  async applyByProfile() {
    await this.clickElement(this.optProfileMethod);
    await this.waitForApplyModalStable();
  }

  async applyByCV() { await this.clickElement(this.optCVMethod); }

  async continueApply() {
    await this.clickElement(this.btnContinueProfile);
    await this.waitForApplyModalStable();
  }

  async continueApplyCV() {
    const btnAction = this.page.locator('[data-test-id="common__actions-button"] [data-test-id="common__button"]');
    await this.clickElement(btnAction);
    await this.waitForApplyModalStable();
  }

  async saveSection() {
    if (await this.btnCommonSave.isVisible({ timeout: 3000 }).catch(() => false)) {
      await this.clickElement(this.btnCommonSave);
      await this.waitForGlobalLoadingHidden(15000).catch(() => null);
      await this.waitForApplyModalStable().catch(() => null);
    }
  }

  async submitApplication() {
    await this.actions.check(this.chkAllowSearch);
    await this.clickElement(this.btnSubmitProfile);
  }

  // --- Delegation: Section Actions ---
  async uploadCV(filePath) { return this.sectionsHelper.uploadCV(filePath); }
  async clickAddIntroduction() { return this.sectionsHelper.clickAddIntroduction(); }
  async fillIntroduction(text) { return this.sectionsHelper.fillIntroduction(text); }
  async clickAddExperience() { return this.sectionsHelper.clickAddExperience(); }
  async fillExperience(data) { return this.sectionsHelper.fillExperience(data); }
  async clickAddEducation() { return this.sectionsHelper.clickAddEducation(); }
  async fillEducation(data) { return this.sectionsHelper.fillEducation(data); }
  async clickAddSkill() { return this.sectionsHelper.clickAddSkill(); }
  async fillSkill(skillName) { return this.sectionsHelper.fillSkill(skillName); }
  async clickAddAchievement() { return this.sectionsHelper.clickAddAchievement(); }
  async fillAchievement(data) { return this.sectionsHelper.fillAchievement(data); }
  async clickAddCertificate() { return this.sectionsHelper.clickAddCertificate(); }
  async fillCertificate(certName) { return this.sectionsHelper.fillCertificate(certName); }
  async clickAddForeignLanguage() { return this.sectionsHelper.clickAddForeignLanguage(); }
  async fillForeignLanguage(data) { return this.sectionsHelper.fillForeignLanguage(data); }

  // --- Delegation: Bulk Apply Actions ---
  async uncheckAllBulkApplyJobs() { return this.bulkApplyHelper.uncheckAllBulkApplyJobs(); }
  async checkAllBulkApplyJobs() { return this.bulkApplyHelper.checkAllBulkApplyJobs(); }
  async clickBulkApplySubmit() { return this.bulkApplyHelper.clickBulkApplySubmit(); }
  async confirmAndFinishApplication() { return this.bulkApplyHelper.confirmAndFinishApplication(); }
  async confirmBulkApplySubmission() { return this.bulkApplyHelper.confirmBulkApplySubmission(); }
  async bulkApply() { return this.bulkApplyHelper.bulkApply(); }
  async hasNoBulkApplyJobs() { return this.bulkApplyHelper.hasNoBulkApplyJobs(); }
  async waitForBulkApplyListReady(timeout) { return this.bulkApplyHelper.waitForBulkApplyListReady(timeout); }
}

module.exports = { JobApplyPage };
