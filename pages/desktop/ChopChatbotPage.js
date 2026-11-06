const { BasePage } = require('../BasePage');
const { LoginPopup } = require('./LoginPopup');
const { ChopChatbotFilterHelper } = require('./chatbot/ChopChatbotFilterHelper');
const { ChopChatbotSessionHelper } = require('./chatbot/ChopChatbotSessionHelper');

/**
 * ChopChatbotPage — Page Object cho cửa sổ popup Chop AI chatbot.
 * Nhận `page` là popup page (context khác với main page), không phải main page.
 */
class ChopChatbotPage extends BasePage {
  constructor(page, featureName) {
    super(page, featureName);

    // Chat controls
    this.chatInput = page.getByRole('textbox', { name: 'Nhập nội dung' });
    this.sendBtn = page.locator('[data-test-id="ai-chatbot__send-button"]');

    // Intro / skip panel
    this.introPanel = page.locator('.relative.flex.w-full.bg-white').first();

    // City picker: TP.HCM
    this.btnCityHCM = page.getByRole('button', { name: 'TP.HCM' })
      .or(page.locator('[data-test-id="common__button"]').filter({ hasText: /^TP\.HCM$/ }))
      .first();

    // Salary picker: "Từ ... triệu trở lên"
    this.salaryOptions = page.getByRole('button', { name: /Từ \d+ triệu trở lên/i });

    // Job count button (text động)
    this.jobCountBtn = page.getByRole('button', { name: /Có \d+ công việc phù hợp/i });

    // Drawer triggers
    this.occupationTrigger = page.locator('[data-test-id="ai-chatbot__occupation-select__trigger"]');
    this.locationFilterTrigger = page.locator('[data-test-id="ai-chatbot__location-select__trigger"]');
    this.locationDropdown = page.locator('[data-test-id="select-dropdown__option-list"]');
    this.applyLocationBtn = page.getByRole('button', { name: 'Áp dụng' });
    this.salaryFilterTrigger = page.locator('[data-test-id="ai-chatbot__salary-select__trigger"]');
    this.experienceFilterTrigger = page.locator('[data-test-id="ai-chatbot__experience-range-select__trigger"]');

    // Shared filter controls
    this.doneBtn = page.getByRole('button', { name: 'Hoàn tất' });
    this.clearSingleFilterBtn = page.getByRole('button', { name: 'Xoá bộ lọc' });
    this.clearAllFiltersBtn = page.locator('[data-test-id="ai-chatbot__clear-filter"]');

    // Job detail modal
    this.jobDetailCloseBtn = page.locator('[data-test-id="common__close-button"]');

    // Real Chop AI Job Drawer Locators
    this.jobDrawerTitle = this.page.getByText(/Công việc gợi ý cho bạn/i).first();
    this.drawerCloseBtn = this.page.locator('[data-test-id="common__close-button"]').first();
    this.drawerContainer = this.page.locator('.overflow-y-auto.overscroll-contain.no-scrollbar').first();
    this.drawerJobCards = this.page.locator('.overflow-y-auto.overscroll-contain.no-scrollbar').locator('> div > div');
    this.drawerTotalJobsBanner = this.page.getByText(/Chớp đã tìm được \d+ công việc/i).first();
    this.botGuidanceFallback = this.page.getByText(/Chào bạn, mình là Chớp|Bạn đang tìm kiếm công việc thuộc lĩnh vực nào/i).first();
    this.filterHelper = new ChopChatbotFilterHelper(this);
    this.sessionHelper = new ChopChatbotSessionHelper(this);
  }

  /**
   * Đăng nhập trên popup chatbot bằng tài khoản tạo từ API nếu xuất hiện modal login
   * @param {Object} user - Thông tin tài khoản { phone, email, otp }
   */
  async loginIfVisible(user) {
    if (!user) return;
    const loginPopup = new LoginPopup(this.page, this.featureName);
    if (await loginPopup.phoneInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      const phone = user.phone || user.username;
      await loginPopup.fillPhone(phone);
      // Popup mặc định "Nhận OTP qua Zalo" (không còn nút "Tiếp tục"); OTP cố định 1111 của QC chỉ áp dụng kênh SMS.
      await loginPopup.requestSmsOtp({
        maxAttempts: 3,
        otpTimeout: 10000,
        loadingTimeout: 15000,
      });
      const otpCode = user.otp || '1111';
      await loginPopup.fillOtpCode(otpCode);

      const consentAgreeBtn = this.page.getByRole('button', { name: 'Đồng ý' });
      if (await consentAgreeBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await consentAgreeBtn.click({ force: true }).catch(() => null);
      }

      await loginPopup.otpInputs.first().waitFor({ state: 'hidden', timeout: 30000 }).catch(() => null);
      await this.page.waitForLoadState('domcontentloaded').catch(() => null);
    }
  }

  async dismissIntroIfVisible() {
    if (await this.introPanel.isVisible({ timeout: 4000 }).catch(() => false)) {
      await this.introPanel.click({ force: true }).catch(() => null);
    }
  }

  async enterChatMessage(message) {
    await this.actions.waitForVisible(this.chatInput, { timeout: 10000 });
    await this.chatInput.click();
    await this.chatInput.fill(message);
  }

  async clickSendMessage() {
    await this.actions.waitForVisible(this.sendBtn, { timeout: 5000 });
    await this.sendBtn.click();
  }

  async sendChatMessage(message) {
    await this.enterChatMessage(message);
    await this.clickSendMessage();
  }

  async selectCityHCM() {
    await this.actions.waitForVisible(this.btnCityHCM, { timeout: 15000 });
    await this.clickElement(this.btnCityHCM);
  }

  async selectInitialSalaryAndSend() {
    await this.actions.waitForVisible(this.salaryOptions.first(), { timeout: 15000 });
    // Chọn option đầu tiên (ví dụ 9tr) để sau này lọc 15tr không bị disable
    await this.clickElement(this.salaryOptions.first());
    await this.clickElement(this.sendBtn);
  }

  async viewJobResults() {
    const btn = this.jobCountBtn.last();
    await this.actions.waitForVisible(btn, { timeout: 25000 });
    await btn.click();
    const suggestedJobsTitle = this.page.getByText(/Công việc gợi ý cho bạn/i).first();
    await suggestedJobsTitle.waitFor({ state: 'visible', timeout: 20000 }).catch(() => null);
  }

  // --- ChopChatbotFilterHelper (pages/desktop/chatbot/ChopChatbotFilterHelper.js) ---
  async openIndustryFilter() { return this.filterHelper.openIndustryFilter(); }
  async selectIndustry(industryName) { return this.filterHelper.selectIndustry(industryName); }
  async confirmFilter() { return this.filterHelper.confirmFilter(); }
  async clearActiveFilter() { return this.filterHelper.clearActiveFilter(); }
  async openLocationFilter() { return this.filterHelper.openLocationFilter(); }
  async selectLocationOption(name) { return this.filterHelper.selectLocationOption(name); }
  async applyLocationFilter() { return this.filterHelper.applyLocationFilter(); }
  async clearLocationFilter() { return this.filterHelper.clearLocationFilter(); }
  async openSalaryFilterAfterScroll() { return this.filterHelper.openSalaryFilterAfterScroll(); }
  async selectSalaryOption(salaryOption) { return this.filterHelper.selectSalaryOption(salaryOption); }
  async clearSalaryFilter() { return this.filterHelper.clearSalaryFilter(); }
  async scrollToExperienceFilterBar() { return this.filterHelper.scrollToExperienceFilterBar(); }
  async openExperienceFilter() { return this.filterHelper.openExperienceFilter(); }
  async selectExperienceOption(expOption) { return this.filterHelper.selectExperienceOption(expOption); }
  async clearAllFilters() { return this.filterHelper.clearAllFilters(); }
  async openFirstJobCard() { return this.filterHelper.openFirstJobCard(); }
  async closeJobDetailModal() { return this.filterHelper.closeJobDetailModal(); }
  async expectJobCountVisible() { return this.filterHelper.expectJobCountVisible(); }
  async expectLocationFilterDisplayed(locationDisplay) { return this.filterHelper.expectLocationFilterDisplayed(locationDisplay); }
  async expectSalaryFilterDisplayed(salaryDisplay) { return this.filterHelper.expectSalaryFilterDisplayed(salaryDisplay); }
  async expectExperienceFilterDisplayed(expDisplay) { return this.filterHelper.expectExperienceFilterDisplayed(expDisplay); }

  // --- ChopChatbotSessionHelper (pages/desktop/chatbot/ChopChatbotSessionHelper.js) ---
  async navigateToChatbot() { return this.sessionHelper.navigateToChatbot(); }
  async setupRealChatbotPrecondition(user) { return this.sessionHelper.setupRealChatbotPrecondition(user); }
  async sendChatbotQuery(query) { return this.sessionHelper.sendChatbotQuery(query); }
  async expectFallbackGuidanceVisible() { return this.sessionHelper.expectFallbackGuidanceVisible(); }
  async expectJobDrawerHidden() { return this.sessionHelper.expectJobDrawerHidden(); }
  async openJobDrawer() { return this.sessionHelper.openJobDrawer(); }
  async closeJobDrawer() { return this.sessionHelper.closeJobDrawer(); }
  async reopenJobDrawer() { return this.sessionHelper.reopenJobDrawer(); }
  async scrollDrawerToLoadMore() { return this.sessionHelper.scrollDrawerToLoadMore(); }
  async getDrawerItemsCount() { return this.sessionHelper.getDrawerItemsCount(); }
  async reloadChatbot() { return this.sessionHelper.reloadChatbot(); }
  async expectGreetingVisible() { return this.sessionHelper.expectGreetingVisible(); }
  async expectChatHistoryContains(text) { return this.sessionHelper.expectChatHistoryContains(text); }
  async clearStorageAndCookies(user = null) { return this.sessionHelper.clearStorageAndCookies(user); }

  async openSecondTabChatbot() {
    const context = this.page.context();
    const tabB = await context.newPage();
    const chatbotB = new ChopChatbotPage(tabB, this.featureName);
    await chatbotB.navigateToChatbot();
    await chatbotB.dismissIntroIfVisible();
    return chatbotB;
  }

}

module.exports = { ChopChatbotPage };
