function initProfileExtendedLocators(owner) {
  const page = owner.page;

  owner.profileStatusBadge = page
    .locator('[data-test-id="user-profile__status-badge"], #profile-status-badge').first();
  owner.cvSearchSwitch = page
    .locator('[data-test-id="user-profile__enable-search-cv"] input[type="checkbox"], [data-test-id="common__switch"], #toggle-cv-search').first();
  owner.cvSearchLocked = page
    .locator('[data-test-id="user-profile__search-locked"], #search-switch-locked').first();
  owner.btnOpenPersonalInfo = page
    .locator('[data-test-id="btn-edit-personal-info"], #btn-edit-personal-info').first();
  owner.personalInfoModal = page
    .locator('[data-test-id="user-profile__personal-info-modal"], #personal-info-modal').first();
  owner.inpPersonalFullName = page
    .locator('[data-test-id="inp-personal-fullname"], #inp-fullname').first();
  owner.inpPersonalPhone = page
    .locator('[data-test-id="inp-personal-phone"], #inp-phone').first();
  owner.inpPersonalEmail = page
    .locator('[data-test-id="inp-personal-email"], #inp-email').first();
  owner.inpPersonalAddress = page
    .locator('[data-test-id="inp-personal-address"], #inp-address').first();
  owner.btnSavePersonalInfoModal = page
    .locator('[data-test-id="btn-save-personal-info"], #btn-save-personal-info').first();
  owner.btnConvertCVTrigger = page
    .locator('[data-test-id="btn-convert-cv-trigger"], #btn-convert-cv').first();
  owner.skillPython = page
    .locator('[data-test-id="user-profile__skills"], #skills-container').getByText('Python').first();
  owner.skillReact = page
    .locator('[data-test-id="user-profile__skills"], #skills-container').getByText('React').first();
  owner.skillJavaScript = page
    .locator('[data-test-id="user-profile__skills"], #skills-container').getByText('JavaScript').first();
  owner.expSeniorDev = page
    .locator('[data-test-id="user-profile__experience"], #experience-container').getByText('Senior Frontend Developer').first();
  owner.btnUpdateCriteria = page
    .locator('[data-test-id="btn-update-criteria"], #btn-update-criteria').first();
  owner.criteriaLocationValue = page
    .locator('[data-test-id="criteria-location"], #criteria-location').first();
  owner.criteriaIndustryValue = page
    .locator('[data-test-id="criteria-industry"], #criteria-industry').first();
  owner.criteriaSyncStatus = page
    .locator('[data-test-id="criteria-sync-status"], #criteria-sync-status').first();
  owner.otpTitle = page
    .getByText(/Xác thực(?: OTP)?|Mã xác thực|OTP/i).first();
  owner.profileOverview = page
    .getByText(/Tổng quan hồ sơ|Hoàn thiện các mục dưới đây/i).first();
  owner.btnUploadCV = page
    .getByRole('button', { name: /Tải lên CV/i }).or(page.getByText(/Tải ngay CV lên/i)).first();
  owner.linkCriteria = page
    .getByRole('link', { name: /Tiêu chí tìm việc/i }).or(page.getByText(/Tiêu chí tìm việc/i)).first();
  owner.criteriaHeading = page
    .getByText(/Tiêu chí tìm việc/i).first();
  owner.allowSearchToggle = page
    .locator('[data-test-id="user-profile__enable-search"] [data-test-id="common__switch"]')
    .or(page.locator('[data-test-id="common__switch"]'))
    .or(page.locator('div:has-text("Cho phép Nhà tuyển dụng tìm bạn") [class*="switch"], div:has-text("Cho phép Nhà tuyển dụng tìm bạn") [role="switch"]'))
    .or(page.locator('text=/Cho phép Nhà tuyển dụng tìm bạn/i').locator('..').locator('div, span, button').last()).first();

  owner.btnAiIntro = page
    .locator('[data-test-id="btn-add-intro"], #btn-add-intro').first();
  owner.modalAiIntro = page
    .locator('[data-test-id="modal-ai-intro"], #modal-intro').first();
  owner.txtAiIntroSource = page
    .locator('[data-test-id="txt-ai-intro-source"], #txt-intro-source').first();
  owner.btnAiTriggerRewrite = page
    .locator('[data-test-id="btn-ai-rewrite-trigger"], #btn-ai-rewrite-trigger').first();
  owner.btnAiToneProfessional = page
    .locator('[data-test-id="btn-ai-tone-pro"], #tone-pro').first();
  owner.btnAiTonePersuasive = page
    .locator('[data-test-id="btn-ai-tone-persuasive"], #tone-persuasive').first();
  owner.btnAiToneConcise = page
    .locator('[data-test-id="btn-ai-tone-concise"], #tone-concise').first();
  owner.aiPreviewBox = page
    .locator('[data-test-id="ai-preview-box"], #ai-preview-box').first();
  owner.aiPreviewContent = page
    .locator('[data-test-id="ai-preview-content"], #ai-preview-content').first();
  owner.aiActiveTone = page
    .locator('[data-test-id="ai-active-tone"], #ai-active-tone').first();
  owner.btnAiCancelPreview = page
    .locator('[data-test-id="btn-ai-cancel"], #btn-ai-cancel').first();
  owner.introSavedContent = page
    .locator('[data-test-id="intro-saved-content"], #intro-saved-content').first();
  owner.btnAiExp = page
    .locator('[data-test-id="btn-add-exp"], #btn-add-exp').first();
  owner.modalAiExp = page
    .locator('[data-test-id="modal-ai-exp"], #modal-exp').first();
  owner.inpAiJobTitle = page
    .locator('[data-test-id="inp-ai-jobtitle"], #inp-jobtitle').first();
  owner.inpAiCompany = page
    .locator('[data-test-id="inp-ai-company"], #inp-company').first();
  owner.txtAiExpDesc = page
    .locator('[data-test-id="txt-ai-exp-desc"], #txt-exp-desc').first();
  owner.btnAiGenerateExp = page
    .locator('[data-test-id="btn-ai-generate-exp"], #btn-ai-generate-exp').first();
  owner.btnSaveAiExp = page
    .locator('[data-test-id="btn-save-exp"], #btn-save-exp').first();
  owner.expSavedContent = page
    .locator('[data-test-id="exp-saved-content"], #exp-saved-content').first();
  owner.btnSimulateAiError = page
    .locator('#btn-simulate-ai-error').first();
  owner.aiLoadingSpinner = page
    .locator('[data-test-id="ai-loading"], #ai-loading').first();
  owner.aiErrorModal = page
    .locator('[data-test-id="ai-error-modal"], #ai-error-modal').first();
  owner.aiErrorMessage = page
    .locator('[data-test-id="ai-error-message"], #ai-error-message').first();
}

module.exports = { initProfileExtendedLocators };
