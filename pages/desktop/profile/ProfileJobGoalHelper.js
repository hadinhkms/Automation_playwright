class ProfileJobGoalHelper {
  constructor(pageInstance) {
    this.owner = pageInstance;
  }

  escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  async closeSelectModalMenuIfVisible() {
    const selectModalContainer = this.owner.page.locator('[data-test-id="select__modal-menu__container"]');
    if (await selectModalContainer.isVisible({ timeout: 1500 }).catch(() => false)) {
      const viewport = this.owner.page.viewportSize() || { width: 390, height: 844 };
      await this.owner.page.mouse.click(Math.round(viewport.width / 2), Math.min(600, viewport.height - 100));
      try {
        await selectModalContainer.waitFor({ state: 'hidden', timeout: 3000 });
      } catch (_e) {
        // ignore
      }
    }
  }

  async clickVisibleSelectMenuHeading(optionName, options = {}) {
    const timeout = options.timeout ?? 10000;
    const menu = this.owner.page.locator('[data-test-id="common__select-menu"]:visible, [data-test-id="select__modal-menu__container"]:visible').last();
    await menu.waitFor({ state: 'visible', timeout });
    const option = menu.getByRole('heading', { name: new RegExp(`^${this.escapeRegExp(optionName)}$`, 'i') })
      .or(menu.getByRole('button', { name: new RegExp(`^${this.escapeRegExp(optionName)}$`, 'i') }))
      .or(menu.locator('li, [role="option"]').filter({ hasText: new RegExp(`^\\s*${this.escapeRegExp(optionName)}\\s*$`, 'i') }))
      .or(menu.getByText(new RegExp(`^\\s*${this.escapeRegExp(optionName)}\\s*$`, 'i')))
      .first();
    await this.owner.clickElement(option, { timeout });
  }

  async clickSearchCriteria() {
    await this.owner.clickElement(this.owner.btnUserAvatar);
    const btnSearchCriteria = this.owner.page.getByRole('button', { name: /Tiêu chí tìm việc/i }).first();
    await this.owner.clickElement(btnSearchCriteria);
  }

  async clickAddJobGoal() {
    const linkAddJobGoal = this.owner.page.getByText('Thêm vị trí công việc').first();
    await this.owner.clickElement(linkAddJobGoal);
  }

  async fillJobGoal(data) {
    await this.owner.clickElement(this.owner.page.getByRole('button', { name: new RegExp(data.experienceLevel, 'i') }).first());

    await this.owner.clickElement(this.owner.page.getByText('Chọn số năm kinh nghiệm').first());
    await this.owner.clickElement(this.owner.page.getByRole('heading', { name: data.yearsOfExperience }).first());
    await this.closeSelectModalMenuIfVisible();

    const jobTitleInput = this.owner.page.locator('[data-test-id="common__job-title-select"] [data-test-id="common__input"]').first();
    await this.owner.fillInput(jobTitleInput, data.jobTitle);
    await this.owner.clickElement(this.owner.page.getByRole('listitem').filter({ hasText: new RegExp(`^${data.jobTitle}$`, 'i') }).locator('span').first());

    await this.owner.clickElement(this.owner.page.getByText('Chọn ngành nghề').first());
    await this.clickVisibleSelectMenuHeading(data.industry);
    await this.closeSelectModalMenuIfVisible();

    const removeIndustryBtn = this.owner.page.locator('[data-test-id="user-profile__job-goal-modal"]').getByRole('heading', { name: 'Tiêu chí tìm việc' }).first();
    if (await removeIndustryBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      try {
        await this.owner.clickElement(removeIndustryBtn);
      } catch (_e) {
        // ignore
      }
    }

    await this.owner.clickElement(this.owner.page.getByText('Chọn địa điểm').first());
    await this.clickVisibleSelectMenuHeading(data.workLocation);
    await this.closeSelectModalMenuIfVisible();

    const removeLocationBtn = this.owner.page.locator('[data-test-id="common__actions-button"]').first();
    if (await removeLocationBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      try {
        await this.owner.clickElement(removeLocationBtn);
      } catch (_e) {
        // ignore
      }
    }

    const jobGoalModal = this.owner.page.locator('[data-test-id="user-profile__job-goal-modal"]');
    const scrollTarget = jobGoalModal.locator('div').filter({ hasText: 'Kinh nghiệm làm việc*' }).nth(2);
    await scrollTarget.scrollIntoViewIfNeeded();

    const minSalaryInput = this.owner.page.getByRole('textbox', { name: 'Tối thiểu' }).first();
    await this.owner.fillInput(minSalaryInput, data.minSalary);

    const maxSalaryInput = this.owner.page.getByRole('textbox', { name: 'Tối đa' }).last();
    await this.owner.fillInput(maxSalaryInput, data.maxSalary);

    const negotiateCb = this.owner.page.getByRole('checkbox').first();
    if (data.canNegotiateSalary) {
      await this.owner.actions.check(negotiateCb);
    } else {
      await this.owner.actions.uncheck(negotiateCb);
    }

    await this.owner.clickElement(this.owner.page.getByText('Chọn cấp bậc hiện tại').first());
    await this.clickVisibleSelectMenuHeading(data.currentLevel);
    await this.closeSelectModalMenuIfVisible();

    await this.owner.clickElement(this.owner.page.getByText('Chọn hình thức làm việc').first());
    await this.clickVisibleSelectMenuHeading(data.workType);
    await this.closeSelectModalMenuIfVisible();

    const scrollTarget2 = jobGoalModal.locator('div').filter({ hasText: 'Kinh nghiệm làm việc*' }).nth(2);
    await scrollTarget2.scrollIntoViewIfNeeded();
  }

  async saveJobGoal() {
    const jobGoalModal = this.owner.page.locator('[data-test-id="user-profile__job-goal-modal"]');
    if (await jobGoalModal.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.owner.saveSection();
      try {
        const { expect } = require('@playwright/test');
        await expect(jobGoalModal).toBeHidden({ timeout: 30000 });
      } catch (_e) {
        // ignore
      }
    }
  }
}

module.exports = { ProfileJobGoalHelper };
