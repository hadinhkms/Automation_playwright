const { expect } = require('@playwright/test');
const { BasePage } = require('../BasePage');
const { ScreenshotHelper } = require('../../core/utils/commonUtils');
const { ProfileSectionsHelper } = require('./profile/ProfileSectionsHelper');
const { ProfilePersonalHelper } = require('./profile/ProfilePersonalHelper');
const { ProfileJobGoalHelper } = require('./profile/ProfileJobGoalHelper');
const { ProfileCvHelper } = require('./profile/ProfileCvHelper');
const { ProfileAiHelper } = require('./profile/ProfileAiHelper');
const { initProfileExtendedLocators } = require('./profile/profileExtendedLocators');

class UserProfilePage extends BasePage {
  constructor(page) {
    super(page);
    this.screenshotHelper = new ScreenshotHelper(page, 'user-profile-details');

    // Header / Nav / Common
    this.btnUserAvatar = this.page.getByRole('button', { name: /avt_invalid/i }).first();
    this.btnMyProfile = this.page.getByRole('button', { name: /Hồ sơ của tôi/i }).first();
    this.btnCommonSave = this.page.getByRole('button', { name: /Lưu thông tin|Lưu thay đổi|^Lưu$/i }).or(this.page.locator('[data-test-id="common__actions-button"] button').filter({ hasText: /Lưu/i })).first();
    this.txtCommonInput = this.page.locator('[data-test-id="common__input"]').first();
    this.toastSuccess = this.page.getByText('Chuyển đổi thành công');
    this.profileContainer = this.page.locator('#user-profile-container, [data-test-id*="profile"], main, body').first();

    // Section Add Buttons & Containers
    this.btnAddExperience = this.page.locator('[data-test-id="user-profile__experience"] [data-test-id="user-profile__add-button"]').first();
    this.btnAddIntro = this.page.locator('[data-test-id="user-profile__introduce"] [data-test-id="user-profile__add-button"]').first();
    this.btnEditIntro = this.page.locator('[data-test-id="user-profile__introduce"] [data-test-id="user-profile__edit-button"]').first();
    this.btnIntroIconAction = this.page.locator('[data-test-id="user-profile__introduce"] button').first();
    this.btnAddEdu = this.page.locator('[data-test-id="user-profile__education"] [data-test-id="user-profile__add-button"]').first();
    this.btnAddAchievement = this.page.locator('[data-test-id="user-profile__achievement"] [data-test-id="user-profile__add-button"]').first();
    this.btnAddSkill = this.page.locator('[data-test-id="user-profile__skills"] [data-test-id="user-profile__add-button"]').or(this.page.locator('[data-test-id="user-profile__skills"] [data-test-id="user-profile__edit-button"]')).or(this.page.locator('[data-test-id="user-profile__skills"] button')).first();
    this.btnAddCertificate = this.page.locator('[data-test-id="user-profile__certificate"] [data-test-id="user-profile__add-button"]').first();
    this.btnAddLanguage = this.page.locator('[data-test-id="user-profile__foreign-language"] [data-test-id="user-profile__add-button"]').first();
    this.sectionExperience = this.page.locator('[data-test-id="user-profile__experience"]').first();
    this.sectionLanguage = this.page.locator('[data-test-id="user-profile__foreign-language"]').first();

    // Form inputs
    this.inpStartDate = this.page.locator('input[name="start_date"]').first();
    this.inpEndDate = this.page.locator('input[name="end_date"]').first();
    this.txtCompany = this.page.getByRole('textbox', { name: 'Nhập tên công ty' }).first();
    this.txtJobTitleSearch = this.page.locator('[data-test-id="common__job-title-select"] [data-test-id="common__input"]').first();
    this.chkWorkingHere = this.page.getByRole('checkbox', { name: 'Tôi đang làm việc ở đây' }).first();
    this.txtExpDescription = this.page.getByRole('textbox', { name: /Mô tả/i }).first();
    this.txtIntro = this.page.getByRole('textbox', { name: /Hãy chia sẻ về kinh nghiệm là/i }).first();
    this.txtSchool = this.page.getByRole('textbox', { name: /Nhập tên trường/i }).first();
    this.txtMajor = this.page.getByRole('textbox', { name: /Nhập chuyên ngành/i }).first();
    this.lblDegree = this.page.getByText('Chọn loại bằng cấp').first();
    this.inpDegreeSearch = this.page.locator('div').filter({ hasText: /^Chọn loại bằng cấp$/ }).getByTestId('common__input').first();
    this.txtEduDescription = this.page.getByRole('textbox', { name: /Mô tả/i }).first();
    this.txtAchievementName = this.page.getByRole('textbox', { name: 'Nhập tên dự án/thành tựu' }).first();
    this.txtAchievementDesc = this.page.getByRole('textbox', { name: /Mô tả/i }).first();
    this.drpLanguage = this.page.getByText('Chọn ngoại ngữ').first();
    this.inpLanguageSearch = this.page.locator('div').filter({ hasText: /^Chọn ngoại ngữ$/ }).getByTestId('common__input').first();

    // AI Form Actions
    this.btnAiFormAction = this.page.locator('[data-test-id="common__form-item"] [data-test-id="common__button"]');
    this.btnAiGenerate = this.page.locator('button.style_aiIcon__PcP_l').first();
    this.btnAiRewrite = this.page.getByRole('button', { name: /Viết lại/i });
    this.btnAiUse = this.page.getByRole('button', { name: /Sử dụng/i });

    initProfileExtendedLocators(this);

    // Modular sub-helpers
    this.sectionsHelper = new ProfileSectionsHelper(this);
    this.personalHelper = new ProfilePersonalHelper(this);
    this.jobGoalHelper = new ProfileJobGoalHelper(this);
    this.cvHelper = new ProfileCvHelper(this);
    this.aiHelper = new ProfileAiHelper(this);
  }

  async navigateToMyProfile() {
    const closeBtn = this.page.locator('#common__modal [data-test-id*="close"], #common__modal button:has-text("Đóng"), #common__modal button:has-text("Bỏ qua"), .svicon-close, [data-test-id="common__close-button"]').first();
    if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await closeBtn.click({ force: true }).catch(() => null);
    }
    try {
      await this.clickElement(this.btnUserAvatar);
      await this.clickElement(this.btnMyProfile);
    } catch {
      await this.page.goto('/tai-khoan/ho-so-cua-toi', { waitUntil: 'domcontentloaded' });
    }
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
    await this.actions.waitForVisible(this.btnAddExperience, { timeout: 30000 });
  }

  async saveSection(options = {}) {
    if (await this.btnCommonSave.isVisible({ timeout: 3000 }).catch(() => false)) {
      await this.clickElement(this.btnCommonSave);
      try {
        await expect(this.btnCommonSave).toBeHidden({ timeout: 60000 });
      } catch (_e) {
        // ignore if already hidden
      }
    }
  }

  async saveIntroduction() {
    await this.saveSection();
    await expect(this.txtIntro).toBeHidden({ timeout: 30000 });
    await this.capture('introduction_saved', true);
  }

  async saveExperience() {
    await this.saveSection();
    await expect(this.txtCompany).toBeHidden({ timeout: 30000 });
    await this.capture('experience_saved', true);
  }

  // --- Delegation: Section Actions ---
  async clickAddIntroduction() { await this.clickElement(this.btnAddIntro.or(this.btnEditIntro).or(this.btnIntroIconAction).first()); }
  async fillIntroduction(text) { return this.sectionsHelper.fillIntroduction(text); }
  async clickAddExperience() { await this.clickElement(this.btnAddExperience); }
  async fillExperience(data) { return this.sectionsHelper.fillExperience(data); }
  async clickAddEducation() { await this.clickElement(this.btnAddEdu); }
  async fillEducation(data) { return this.sectionsHelper.fillEducation(data); }
  async clickAddAchievement() { await this.clickElement(this.btnAddAchievement); }
  async fillAchievement(data) { return this.sectionsHelper.fillAchievement(data); }
  async clickAddSkill() {
    await this.btnAddSkill.scrollIntoViewIfNeeded().catch(() => null);
    await this.clickElement(this.btnAddSkill);
    await this.waitForGlobalLoadingHidden(10000).catch(() => null);
  }
  async fillSkill(skillName) { return this.sectionsHelper.fillSkill(skillName); }
  async clickAddCertificate() { await this.clickElement(this.btnAddCertificate); }
  async fillCertificate(certName) { return this.sectionsHelper.fillCertificate(certName); }
  async clickAddForeignLanguage() { await this.clickElement(this.btnAddLanguage); }
  async fillForeignLanguage(languageName, level) { return this.sectionsHelper.fillForeignLanguage(languageName, level); }

  // --- Delegation: Personal Info & Job Goals ---
  async clickEditPersonalInfo() { return this.personalHelper.clickEditPersonalInfo(); }
  async fillPersonalInfo(data) { return this.personalHelper.fillPersonalInfo(data); }
  async savePersonalInfo() { return this.personalHelper.savePersonalInfo(); }
  async clickSearchCriteria() { return this.jobGoalHelper.clickSearchCriteria(); }
  async clickAddJobGoal() { return this.jobGoalHelper.clickAddJobGoal(); }
  async fillJobGoal(data) { return this.jobGoalHelper.fillJobGoal(data); }
  async saveJobGoal() { return this.jobGoalHelper.saveJobGoal(); }

  // --- Delegation: CV, Verification & Search Settings ---
  async completeOtpIfVisible(code = '1111') { return this.cvHelper.completeOtpIfVisible(code); }
  async enableCVSearch() { return this.cvHelper.enableCVSearch(); }
  async isAllowSearchVisible(timeout = 1000) { return this.cvHelper.isAllowSearchVisible(timeout); }
  async clickContinueButton() { return this.cvHelper.clickContinueButton(); }
  async fillVerificationCode(code) { return this.cvHelper.fillVerificationCode(code); }
  async uploadCV(filePath) { return this.cvHelper.uploadCV(filePath); }
  async clickAllowSearch() { return this.cvHelper.clickAllowSearch(); }
  async uploadProfileCV(filePath) { return this.cvHelper.uploadProfileCV(filePath); }
  async confirmCVConversion() { return this.cvHelper.confirmCVConversion(); }
  async verifyAndApplyCVData() { return this.cvHelper.verifyAndApplyCVData(); }
  async navigateToProfileManagement() { return this.cvHelper.navigateToProfileManagement(); }
  async fillAndSavePersonalInfoModal(options) { return this.cvHelper.fillAndSavePersonalInfoModal(options); }
  async triggerCVConversion() { return this.cvHelper.triggerCVConversion(); }
  async triggerUpdateJobCriteria() { return this.cvHelper.triggerUpdateJobCriteria(); }
  async openJobCriteria() { return this.cvHelper.openJobCriteria(); }
  async toggleAllowSearchSwitch() { return this.cvHelper.toggleAllowSearchSwitch(); }
  async fillOtpVerificationCode(code) { return this.cvHelper.fillOtpVerificationCode(code); }
  async confirmOtpVerification() { return this.cvHelper.confirmOtpVerification(); }

  // --- Delegation: AI Assistant ---
  async generateExperienceDescriptionWithAi(tones) { return this.aiHelper.generateExperienceDescriptionWithAi(tones); }
  async rewriteIntroductionWithAi(text, tones) { return this.aiHelper.rewriteIntroductionWithAi(text, tones); }
  async rewriteWithAiTones(tones) { return this.aiHelper.rewriteWithAiTones(tones); }
  async selectAiTone(tone) { return this.aiHelper.selectAiTone(tone); }
  async setupAiProfilePrecondition() { return this.aiHelper.setupAiProfilePrecondition(); }
  async openAiIntroModal() { return this.aiHelper.openAiIntroModal(); }
  async fillAiIntroSourceText(text) { return this.aiHelper.fillAiIntroSourceText(text); }
  async triggerAiRewrite() { return this.aiHelper.triggerAiRewrite(); }
  async selectTonePro() { return this.aiHelper.selectTonePro(); }
  async selectTonePersuasive() { return this.aiHelper.selectTonePersuasive(); }
  async selectToneConcise() { return this.aiHelper.selectToneConcise(); }
  async cancelAiPreview() { return this.aiHelper.cancelAiPreview(); }
  async openAiExpModal() { return this.aiHelper.openAiExpModal(); }
  async fillAiExperienceHeader(jobTitle, company) { return this.aiHelper.fillAiExperienceHeader(jobTitle, company); }
  async triggerAiGenerateExp() { return this.aiHelper.triggerAiGenerateExp(); }
  async saveAiExperience() { return this.aiHelper.saveAiExperience(); }
  async simulateAiServiceError() { return this.aiHelper.simulateAiServiceError(); }
}

module.exports = { UserProfilePage };
