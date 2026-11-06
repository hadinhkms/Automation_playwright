const { expect } = require('@playwright/test');

/**
 * Thao tác trên danh sách kết quả tìm kiếm: mở job (tab mới), mở Chớp, ứng tuyển hàng loạt.
 * Được JobSearchPage sở hữu qua `this.listHelper`; mọi state/locator đọc từ owner (giữ nguyên API public).
 */
class JobSearchListHelper {
  /** @param {import('../JobSearchPage').JobSearchPage} owner */
  constructor(owner) {
    this.owner = owner;
  }

  async clickFirstJob() {
    const pagePromise = this.owner.page.waitForEvent('popup');
    const targetJob = await this.owner.firstUnappliedJobLink.isVisible({ timeout: 5000 })
      ? this.owner.firstUnappliedJobLink
      : this.owner.firstJobLink;
    await this.owner.clickElement(targetJob);
    const jobPage = await pagePromise;
    await jobPage.waitForLoadState('domcontentloaded');
    return jobPage;
  }

  async closeGuestPromptModalIfVisible() {
    const dialog = this.owner.page.getByRole('dialog');
    if (await dialog.isVisible({ timeout: 2500 }).catch(() => false)) {
      const closeBtn = dialog.locator('button, [class*="close" i], i, svg, [cursor="pointer"]').last();
      if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await closeBtn.click({ force: true }).catch(() => null);
      } else {
        await this.owner.page.keyboard.press('Escape').catch(() => null);
      }
      await dialog.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {
        return this.owner.page.evaluate(() => {
          document.querySelectorAll('.ReactModalPortal').forEach(el => { el.style.display = 'none'; }); // không remove() node React (hỏng router)
        }).catch(() => null);
      });
    }
  }

  async openChopChatbot() {
    await this.owner.closeGuestPromptModalIfVisible();
    const popupPromise = this.owner.page.waitForEvent('popup');
    try {
      await this.owner.clickElement(this.owner.chopIntroBtn, { timeout: 5000 });
    } catch (err) {
      await this.owner.closeGuestPromptModalIfVisible();
      await this.owner.clickElement(this.owner.chopIntroBtn);
    }
    const chatbotPopup = await popupPromise;
    await chatbotPopup.waitForLoadState('domcontentloaded');
    return chatbotPopup;
  }

  async selectJobsForBulkApply(numberOfJobs) {
    const allCheckboxes = await this.owner.jobCheckboxes.all();
    for (let i = 0; i < Math.min(numberOfJobs, allCheckboxes.length); i++) {
      await allCheckboxes[i].check();
    }
  }

  async clickBulkApplyButton() { await this.owner.clickElement(this.owner.bulkApplyBtn); }
  async confirmBulkApply() { await this.owner.clickElement(this.owner.confirmBulkApplyBtn); }
  async expectBulkApplySuccessMessageVisible() {
    await expect(this.owner.bulkApplySuccessMsg).toBeVisible({ timeout: 15000 });
  }

  async clickJobByTitle(title) {
    await this.owner.closeAllPopupsIfVisible();
    await this.owner.page.waitForLoadState('domcontentloaded');
    const jobLink = title
      ? this.owner.page.getByRole('link', { name: new RegExp(title, 'i') }).first()
      : this.owner.page.locator('a[href*="-c"][href*="id"], a[href*="id200"], a[href*=".html?open_from="], a:has(h3)').first();

    await jobLink.scrollIntoViewIfNeeded({ timeout: 10000 }).catch(() => null);
    await jobLink.waitFor({ state: 'visible', timeout: 15000 });
    const popupPromise = this.owner.page.waitForEvent('popup', { timeout: 8000 }).catch(() => null);
    await jobLink.click({ force: true });
    const newTab = await popupPromise;
    if (newTab) {
      await newTab.waitForLoadState('domcontentloaded');
      return newTab;
    }
    await this.owner.page.waitForLoadState('domcontentloaded');
    return this.owner.page;
  }
}

module.exports = { JobSearchListHelper };
