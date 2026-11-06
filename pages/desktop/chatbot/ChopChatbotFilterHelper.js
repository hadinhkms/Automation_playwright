const { expect } = require('@playwright/test');

/**
 * Bộ lọc kết quả việc làm trong Chop chatbot: ngành nghề, địa điểm, mức lương, kinh nghiệm; mở/đóng chi tiết job.
 * Được ChopChatbotPage sở hữu qua `this.filterHelper`; mọi state/locator đọc từ owner (giữ nguyên API public).
 */
class ChopChatbotFilterHelper {
  /** @param {import('../ChopChatbotPage').ChopChatbotPage} owner */
  constructor(owner) {
    this.owner = owner;
  }

  // Industry / Occupation filter
  async openIndustryFilter() {
    const trigger = this.owner.occupationTrigger.last();
    await this.owner.actions.waitForVisible(trigger, { timeout: 15000 });
    await trigger.click();
  }

  async selectIndustry(industryName) {
    const option = this.owner.page.getByRole('button', { name: industryName }).first();
    await this.owner.actions.waitForVisible(option, { timeout: 10000 });
    await option.click();
  }

  async confirmFilter() {
    await this.owner.actions.waitForVisible(this.owner.doneBtn, { timeout: 10000 });
    await this.owner.doneBtn.click();
  }

  async clearActiveFilter() {
    await this.owner.actions.waitForVisible(this.owner.clearSingleFilterBtn, { timeout: 10000 });
    await this.owner.clearSingleFilterBtn.click();
  }

  // Location filter
  async openLocationFilter() {
    const trigger = this.owner.locationFilterTrigger.last();
    await this.owner.actions.waitForVisible(trigger, { timeout: 15000 });
    await trigger.click();
  }

  async selectLocationOption(name) {
    const trimmed = name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const dropdown = this.owner.page.locator('[data-test-id="select-dropdown__option-list"]');
    const option = dropdown.getByRole('button', { name: new RegExp(`^${trimmed}\\s*$`, 'i') })
      .or(dropdown.locator('button').filter({ hasText: new RegExp(`^${trimmed}\\s*$`, 'i') }))
      .first();
    await this.owner.actions.waitForVisible(option, { timeout: 15000 });
    await option.click();
  }

  async applyLocationFilter() {
    const applyBtn = this.owner.page.getByRole('button', { name: 'Áp dụng' }).last();
    await this.owner.actions.waitForVisible(applyBtn, { timeout: 10000 });
    await applyBtn.click();
  }

  async clearLocationFilter() {
    await this.owner.openLocationFilter();
    const clearBtn = this.owner.page.getByRole('button', { name: 'Xoá bộ lọc' }).last();
    await this.owner.actions.waitForVisible(clearBtn, { timeout: 10000 });
    await clearBtn.click();
  }

  // Salary filter
  async openSalaryFilterAfterScroll() {
    const scrollRight = this.owner.page.getByLabel('Scroll right').last();
    if (await scrollRight.isEnabled({ timeout: 1000 }).catch(() => false)) {
      await scrollRight.click().catch(() => null);
    }
    const salaryTrigger = this.owner.salaryFilterTrigger.last();
    await this.owner.actions.waitForVisible(salaryTrigger, { timeout: 15000 });
    await salaryTrigger.click();
  }

  async selectSalaryOption(salaryOption) {
    const validOption = this.owner.page.locator('button:not([disabled])').filter({ hasText: new RegExp(`^${salaryOption.trim()}$`, 'i') })
      .or(this.owner.page.locator('.text-secondary-100, span').filter({ hasText: new RegExp(`^${salaryOption.trim()}$`, 'i') }))
      .last();
    await this.owner.actions.waitForVisible(validOption, { timeout: 10000 });
    await validOption.click();
  }

  async confirmFilter() {
    const doneBtn = this.owner.page.getByRole('button', { name: 'Hoàn tất' })
      .or(this.owner.page.getByRole('button', { name: 'Áp dụng' }))
      .last();
    await this.owner.actions.waitForVisible(doneBtn, { timeout: 10000 });
    await doneBtn.click();
  }

  async clearSalaryFilter() {
    await this.owner.openSalaryFilterAfterScroll();
    const clearBtn = this.owner.page.getByRole('button', { name: 'Xoá bộ lọc' }).last();
    await this.owner.actions.waitForVisible(clearBtn, { timeout: 10000 });
    await clearBtn.click();
  }

  // Experience filter
  async scrollToExperienceFilterBar() {
    const scrollRight = this.owner.page.getByLabel('Scroll right').last();
    if (await scrollRight.isEnabled({ timeout: 1000 }).catch(() => false)) {
      await scrollRight.click().catch(() => null);
    }
  }

  async openExperienceFilter() {
    const scrollRight = this.owner.page.getByLabel('Scroll right').last();
    if (await scrollRight.isEnabled({ timeout: 1000 }).catch(() => false)) {
      await scrollRight.click().catch(() => null);
    }
    const expTrigger = this.owner.experienceFilterTrigger.last();
    await this.owner.actions.waitForVisible(expTrigger, { timeout: 15000 });
    await expTrigger.click();
  }

  async selectExperienceOption(expOption) {
    const validOption = this.owner.page.locator('button:not([disabled])').filter({ hasText: new RegExp(`^${expOption.trim()}$`, 'i') })
      .or(this.owner.page.locator('.text-secondary-100, span').filter({ hasText: new RegExp(`^${expOption.trim()}$`, 'i') }))
      .last();
    await this.owner.actions.waitForVisible(validOption, { timeout: 10000 });
    await validOption.click();
  }

  async clearAllFilters() {
    const btn = this.owner.clearAllFiltersBtn.last();
    await this.owner.actions.waitForVisible(btn, { timeout: 10000 });
    await btn.click();
  }

  // Job card
  async openFirstJobCard() {
    const jobCards = this.owner.page.locator('.flex.flex-col.gap-3 > .flex.items-center.justify-between')
      .or(this.owner.page.locator('div').filter({ hasText: /Còn \d+ ngày/i }));
    await this.owner.actions.waitForVisible(jobCards.first(), { timeout: 15000 });
    await jobCards.first().click();
  }

  async closeJobDetailModal() {
    const closeBtn = this.owner.page.locator('[data-test-id="common__modal__close-btn"], [data-test-id="common__close-button"], button:has(svg)').last();
    await this.owner.actions.waitForVisible(closeBtn, { timeout: 10000 });
    await closeBtn.click();
  }

  // Assertions
  async expectJobCountVisible() {
    const btn = this.owner.jobCountBtn.last();
    await expect(btn).toBeVisible({ timeout: 25000 });
  }

  async expectLocationFilterDisplayed(locationDisplay) {
    await expect(this.owner.page.getByText(new RegExp(locationDisplay, 'i')).first()).toBeVisible({ timeout: 10000 });
  }

  async expectSalaryFilterDisplayed(salaryDisplay) {
    const chip = this.owner.salaryFilterTrigger.last();
    await expect(chip).toBeVisible({ timeout: 10000 });
    await expect(chip).toContainText(salaryDisplay);
  }

  async expectExperienceFilterDisplayed(expDisplay) {
    const chip = this.owner.experienceFilterTrigger.last();
    await expect(chip).toBeVisible({ timeout: 10000 });
    await expect(chip).toContainText(expDisplay);
  }
}

module.exports = { ChopChatbotFilterHelper };
