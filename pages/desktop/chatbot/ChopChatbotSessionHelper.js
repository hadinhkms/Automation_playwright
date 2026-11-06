const { expect } = require('@playwright/test');

/**
 * Phiên chatbot thật (TC-049/TC-050): điều hướng, gửi câu hỏi, drawer kết quả, lịch sử hội thoại, reset storage.
 * Được ChopChatbotPage sở hữu qua `this.sessionHelper`; mọi state/locator đọc từ owner (giữ nguyên API public).
 */
class ChopChatbotSessionHelper {
  /** @param {import('../ChopChatbotPage').ChopChatbotPage} owner */
  constructor(owner) {
    this.owner = owner;
  }

  // --- REAL CHATBOT TC-049 & TC-050 METHODS ---
  async navigateToChatbot() {
    await this.owner.page.goto('/chop-tro-ly-ai.html', { waitUntil: 'domcontentloaded' });
  }

  async setupRealChatbotPrecondition(user) {
    await this.owner.navigateToChatbot();
    await this.owner.loginIfVisible(user);
    await this.owner.dismissIntroIfVisible();
    await this.owner.actions.waitForVisible(this.owner.chatInput, { timeout: 15000 });
  }

  async sendChatbotQuery(query) {
    await this.owner.actions.waitForVisible(this.owner.chatInput, { timeout: 15000 });
    await this.owner.chatInput.click();
    await this.owner.chatInput.fill(query);
    await this.owner.sendBtn.last().click();
  }

  async expectFallbackGuidanceVisible() {
    const fallback = this.owner.page.getByText(/Chào bạn, mình là Chớp|Bạn đang tìm kiếm công việc thuộc lĩnh vực nào/i).first();
    await expect(fallback).toBeVisible({ timeout: 20000 });
  }

  async expectJobDrawerHidden() {
    await expect(this.owner.jobDrawerTitle).toBeHidden();
  }

  async openJobDrawer() {
    const btn = this.owner.page.getByRole('button', { name: /Có \d+ công việc phù hợp/i }).last();
    await this.owner.actions.waitForVisible(btn, { timeout: 35000 });
    await btn.click();
    await expect(this.owner.jobDrawerTitle).toBeVisible({ timeout: 20000 });
  }

  async closeJobDrawer() {
    await this.owner.actions.waitForVisible(this.owner.drawerCloseBtn, { timeout: 10000 });
    await this.owner.drawerCloseBtn.click();
    await expect(this.owner.jobDrawerTitle).toBeHidden({ timeout: 10000 });
  }

  async reopenJobDrawer() {
    const btn = this.owner.page.getByRole('button', { name: /Có \d+ công việc phù hợp/i }).first();
    await this.owner.actions.waitForVisible(btn, { timeout: 15000 });
    await btn.click();
    await expect(this.owner.jobDrawerTitle).toBeVisible({ timeout: 20000 });
  }

  async scrollDrawerToLoadMore() {
    const responsePromise = this.owner.page.waitForResponse(
      (res) => res.url().includes('get-job-list') && res.status() === 200,
      { timeout: 10000 }
    ).catch(() => null);
    await this.owner.page.evaluate(() => {
      const el = document.querySelector('.overflow-y-auto.overscroll-contain.no-scrollbar');
      if (el) el.scrollTop = el.scrollHeight;
    });
    await responsePromise;
  }

  async getDrawerItemsCount() {
    return await this.owner.drawerJobCards.count();
  }

  // --- TC-050 Methods ---
  async reloadChatbot() {
    await this.owner.page.reload({ waitUntil: 'domcontentloaded' });
    await this.owner.actions.waitForVisible(this.owner.chatInput, { timeout: 20000 });
  }

  async expectGreetingVisible() {
    const welcomeMsg = this.owner.page.getByText(/Chào .* Mình là Chớp/i).first();
    await expect(welcomeMsg).toBeVisible({ timeout: 15000 });
  }

  async expectChatHistoryContains(text) {
    const el = this.owner.page.getByText(text, { exact: false }).first();
    await expect(el).toBeVisible({ timeout: 20000 });
  }

  async clearStorageAndCookies(user = null) {
    await this.owner.page.context().clearCookies();
    await this.owner.page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await this.owner.page.reload({ waitUntil: 'domcontentloaded' });
    if (user) {
      await this.owner.loginIfVisible(user);
    }
    await this.owner.dismissIntroIfVisible();
    await this.owner.actions.waitForVisible(this.owner.chatInput, { timeout: 20000 });
  }
}

module.exports = { ChopChatbotSessionHelper };
