class JobApplySectionsHelper {
  constructor(pageInstance) {
    this.owner = pageInstance;
  }

  async uploadCV(filePath) {
    const uploadBtn = this.owner.page.locator('[data-test-id="user-profile__upload-cv"] [data-test-id="common__button"]').first();
    await uploadBtn.waitFor({ state: 'visible', timeout: 10000 });

    try {
      const [fileChooser] = await Promise.all([
        this.owner.page.waitForEvent('filechooser', { timeout: 5000 }),
        uploadBtn.click(),
      ]);
      await fileChooser.setFiles(filePath);
      return;
    } catch (e) {
      console.log('File chooser fallback: ', e.message);
    }

    const fileInput = this.owner.page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(filePath);
  }

  async clickAddIntroduction() {
    await this.owner.clickElement(this.owner.btnAddIntro);
    await this.owner.waitForApplyModalStable();
  }

  async fillIntroduction(text) {
    await this.owner.fillInput(this.owner.txtIntro, text);
  }

  async clickAddExperience() {
    await this.owner.btnAddExperience.evaluate((element) => element.scrollIntoView());
    await this.owner.clickElement(this.owner.btnAddExperience);
    await this.owner.waitForApplyModalStable();
  }

  async fillExperience(data) {
    await this.owner.fillInput(this.owner.txtCompany, data.company);
    await this.owner.actions.fillAutocomplete(this.owner.txtJobTitleSearch, data.jobTitle);
    await this.owner.actions.waitForVisible(this.owner.optJobTitleFirst);
    await this.owner.clickElement(this.owner.optJobTitleFirst);

    await this.owner.clickElement(this.owner.inpStartDate);
    await this.owner.clickElement(this.owner.btnSelectYear);

    const yearLocator = this.owner.page.getByRole('listitem').filter({ hasText: data.startYear }).first();
    await yearLocator.scrollIntoViewIfNeeded();
    await this.owner.clickElement(yearLocator);

    await this.owner.clickElement(this.owner.page.getByRole('button', { name: `Choose ${data.startMonth}` }));
    if (data.isWorkingHere) {
      await this.owner.actions.check(this.owner.chkWorkingHere);
    }
    await this.owner.fillInput(this.owner.txtExpDescription, data.description);
  }

  async clickAddEducation() {
    await this.owner.btnAddEdu.evaluate((element) => element.scrollIntoView());
    await this.owner.clickElement(this.owner.btnAddEdu);
    await this.owner.waitForApplyModalStable();
  }

  async fillEducation(data) {
    await this.owner.fillInput(this.owner.txtSchool, data.school);
    await this.owner.clickElement(this.owner.page.getByText(data.school, { exact: true }).first());

    await this.owner.clickElement(this.owner.inpStartYear);
    await this.owner.page.locator('#apply-job-modal .react-datepicker__year-text', { hasText: data.startYear }).scrollIntoViewIfNeeded();
    await this.owner.clickElement(this.owner.page.locator('#apply-job-modal .react-datepicker__year-text', { hasText: data.startYear }));

    await this.owner.clickElement(this.owner.inpEndYear);
    await this.owner.page.locator('#apply-job-modal .react-datepicker__year-text', { hasText: data.endYear }).scrollIntoViewIfNeeded();
    await this.owner.clickElement(this.owner.page.locator('#apply-job-modal .react-datepicker__year-text', { hasText: data.endYear }));

    await this.owner.fillInput(this.owner.txtMajor, data.major);
    await this.owner.clickElement(this.owner.page.getByText(data.major).first());

    await this.owner.clickElement(this.owner.lblDegree);
    await this.owner.clickElement(this.owner.page.getByRole('heading', { name: data.degree }));

    await this.owner.fillInput(this.owner.txtEduDescription, data.description);
  }

  async clickAddSkill() {
    await this.owner.btnAddSkill.scrollIntoViewIfNeeded().catch(() => null);
    await this.owner.clickElement(this.owner.btnAddSkill);
    await this.owner.waitForApplyModalStable();
  }

  async fillSkill(skillName) {
    const skillInput = this.owner.page.getByRole('textbox', { name: /Nhập kỹ năng/i })
      .or(this.owner.txtCommonInput)
      .or(this.owner.page.locator('input[placeholder*="kỹ năng" i]'))
      .first();

    await skillInput.waitFor({ state: 'visible', timeout: 15000 });
    await skillInput.click();
    await skillInput.fill(skillName);

    const escaped = skillName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const addNewOption = this.owner.page.locator(`text=/Thêm mới:\\s*${escaped}/i`).first();
    const exactOption = this.owner.page.getByText(new RegExp(`^${escaped}$`, 'i')).first();
    const anyOption = this.owner.page.locator(`text=/${escaped}/i`).first();

    const targetOption = addNewOption.or(exactOption).or(anyOption).first();
    try {
      await targetOption.waitFor({ state: 'visible', timeout: 5000 });
      await this.owner.clickElement(targetOption);
    } catch (_e) {
      await skillInput.press('Enter');
    }
  }

  async clickAddAchievement() {
    await this.owner.btnAddAchievement.scrollIntoViewIfNeeded();
    await this.owner.clickElement(this.owner.btnAddAchievement);
    await this.owner.waitForApplyModalStable();
  }

  async fillAchievement(data) {
    await this.owner.fillInput(this.owner.txtAchievementName, data.name);

    await this.owner.clickElement(this.owner.inpStartDate);
    await this.owner.clickElement(this.owner.btnSelectYear);

    const startYearLocator = this.owner.page.getByRole('listitem').filter({ hasText: data.startYear }).first();
    await startYearLocator.scrollIntoViewIfNeeded();
    await this.owner.clickElement(startYearLocator);
    await this.owner.clickElement(this.owner.page.getByRole('button', { name: `Choose ${data.startMonth}` }));

    await this.owner.clickElement(this.owner.inpEndDate);
    await this.owner.clickElement(this.owner.btnSelectYear);

    const endYearLocator = this.owner.page.getByRole('listitem').filter({ hasText: data.endYear }).first();
    await endYearLocator.scrollIntoViewIfNeeded();
    await this.owner.clickElement(endYearLocator);
    await this.owner.clickElement(this.owner.page.getByRole('button', { name: `Choose ${data.endMonth}` }));

    await this.owner.fillInput(this.owner.txtAchievementDesc, data.description);
  }

  async clickAddCertificate() {
    await this.owner.btnAddCertificate.scrollIntoViewIfNeeded();
    await this.owner.clickElement(this.owner.btnAddCertificate);
    await this.owner.waitForApplyModalStable();
  }

  async fillCertificate(certName) {
    await this.owner.fillInput(this.owner.txtCommonInput, certName);
  }

  async clickAddForeignLanguage() {
    await this.owner.btnAddLanguage.scrollIntoViewIfNeeded();
    await this.owner.clickElement(this.owner.btnAddLanguage);
    await this.owner.waitForApplyModalStable();
  }

  async fillForeignLanguage(data) {
    await this.owner.clickElement(this.owner.lblLanguage);
    await this.owner.clickElement(this.owner.page.locator('[data-test-id="common__select-menu"] div').filter({ hasText: data.language }).nth(3));
    await this.owner.clickElement(this.owner.page.getByRole('button', { name: data.level }));
  }
}

module.exports = { JobApplySectionsHelper };
