class ProfileSectionsHelper {
  constructor(pageInstance) {
    this.owner = pageInstance;
  }

  async fillIntroduction(text) {
    await this.owner.fillInput(this.owner.txtIntro, text);
  }

  async fillExperience(data) {
    await this.owner.fillInput(this.owner.txtCompany, data.company);

    await this.owner.actions.fillAutocomplete(this.owner.txtJobTitleSearch, data.jobTitle);
    const jobTitleOption = this.owner.page
      .locator('[data-test-id="common__select-dropdown"]')
      .getByRole('listitem')
      .first();
    await this.owner.clickElement(jobTitleOption);

    if (data.isWorkingHere) {
      await this.owner.actions.check(this.owner.chkWorkingHere);
    }
    await this.owner.clickElement(this.owner.inpStartDate);
    await this.owner.clickElement(this.owner.page.getByRole('button', { name: new RegExp('^\\d{4}', 'i') }).first());
    await this.owner.clickElement(this.owner.page.getByText(data.startYear).first());
    await this.owner.clickElement(this.owner.page.getByRole('button', { name: `Choose ${data.startMonth}` }).first());

    await this.owner.fillInput(this.owner.txtExpDescription, data.description);
  }

  async fillEducation(data) {
    await this.owner.fillInput(this.owner.txtSchool, data.school);
    await this.owner.clickElement(this.owner.page.getByRole('listitem').filter({ hasText: new RegExp('^' + data.school + '$', 'i') }).first());

    await this.owner.clickElement(this.owner.inpStartDate);
    await this.owner.clickElement(this.owner.page.locator('.react-datepicker__year-text', { hasText: data.startYear }).first());

    await this.owner.clickElement(this.owner.inpEndDate);
    await this.owner.clickElement(this.owner.page.locator('.react-datepicker__year-text', { hasText: data.endYear }).first());

    await this.owner.fillInput(this.owner.txtMajor, data.major);
    await this.owner.clickElement(this.owner.page.getByText(data.major).first());

    await this.owner.lblDegree.click();
    await this.owner.clickElement(this.owner.page.getByText(data.degree).first(), { timeout: 3000 });
    await this.owner.fillInput(this.owner.txtEduDescription, data.description);
  }

  async fillAchievement(data) {
    await this.owner.fillInput(this.owner.txtAchievementName, data.name);

    await this.owner.clickElement(this.owner.inpStartDate);
    await this.owner.clickElement(this.owner.page.getByRole('button', { name: new RegExp('^\\d{4}', 'i') }).first());
    await this.owner.clickElement(this.owner.page.locator('[data-test-id="user-profile__achievement-modal"]').getByText(data.startYear).first());
    await this.owner.clickElement(this.owner.page.getByRole('button', { name: `Choose ${data.startMonth}` }).first());

    await this.owner.clickElement(this.owner.inpEndDate);
    await this.owner.clickElement(this.owner.page.getByRole('button', { name: new RegExp('^\\d{4}', 'i') }).first());
    await this.owner.clickElement(this.owner.page.locator('[data-test-id="user-profile__achievement-modal"]').getByText(data.endYear).first());
    await this.owner.clickElement(this.owner.page.getByRole('button', { name: `Choose ${data.endMonth}` }).first());

    await this.owner.fillInput(this.owner.txtAchievementDesc, data.description);
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

  async fillCertificate(certName) {
    await this.owner.fillInput(this.owner.txtCommonInput, certName);
  }

  async fillForeignLanguage(languageName, level) {
    try {
      await this.owner.clickElement(this.owner.drpLanguage);
      await this.owner.fillInput(this.owner.txtCommonInput, languageName);
      await this.owner.clickElement(this.owner.page.locator('[data-test-id="common__select-menu"] div').filter({ hasText: languageName }).nth(3).first(), { timeout: 3000 });
    } catch (e) {
      console.log('fillForeignLanguage simple fallback', e);
    }
    await this.owner.clickElement(this.owner.page.getByRole('button', { name: level }).first());
  }
}

module.exports = { ProfileSectionsHelper };
