const { expect } = require('@playwright/test');
const { BasePage } = require('../BasePage');
const { HomePage } = require('./HomePage');
const { LoginPopup } = require('./LoginPopup');

/**
 * ChopWebEntryPage — các điểm vào Chớp trên trang chủ Seeker (JS-8782..8786):
 * floating panel "Hỏi Chớp", dialog "Hỏi Chớp bất cứ điều gì" và section "Hỏi Chớp - Trợ lý AI"
 * trong dropdown ô tìm kiếm. Câu mẫu ở cả 3 nơi lấy từ cấu hình admin `seeker_chatbot_default_prompts`.
 */
class ChopWebEntryPage extends BasePage {
  constructor(page, featureName) {
    super(page, featureName);
    this.homePage = new HomePage(page, featureName);

    // Floating panel (tự hiện cho khách khi vào trang chủ)
    this.floatingPanel = page.locator('[data-test-id="ai-chatbot__chop-ask-panel"]');
    this.floatingInput = this.floatingPanel.locator('[data-test-id="common__input"]');
    this.floatingSendBtn = this.floatingPanel.locator('[data-test-id="ai-chatbot__send-button"]');
    this.floatingCloseBtn = this.floatingPanel.locator('[data-test-id="common__close-button"]');

    // Nút "Hỏi Chớp" cạnh ô tìm kiếm và dialog mở ra từ nút đó
    this.askChopButton = page.getByRole('button', { name: 'Hỏi Chớp' });
    this.askDialog = page.getByRole('dialog', { name: 'Hỏi Chớp bất cứ điều gì' });
    this.askDialogInput = this.askDialog.getByRole('textbox');
    // Chip câu mẫu: class CSS module có tiền tố ổn định "styles_chip__"
    this.askDialogChips = this.askDialog.locator('button[class*="styles_chip__"]');

    // Dropdown ô tìm kiếm: section có heading "Hỏi Chớp - Trợ lý AI"
    this.searchInput = page.getByPlaceholder(/Nhập vị trí muốn/);
    // Dropdown là vùng role=region (class CSS module "styles_dropdown__") mở ra dưới ô tìm kiếm
    this.searchDropdown = page.getByRole('region').filter({ has: page.getByRole('heading', { name: 'Hỏi Chớp - Trợ lý AI' }) });
    this.searchChopSection = this.searchDropdown.locator('section').filter({
      has: page.getByRole('heading', { name: 'Hỏi Chớp - Trợ lý AI' }),
    });
    this.searchChopChips = this.searchChopSection.getByRole('button');

  }

  /**
   * Popup nhắc đăng nhập bật theo thời gian (~30s) và làm đóng floating panel/dropdown — không thuộc
   * phạm vi kiểm thử câu mẫu. Trang chỉ hiện popup này 1 lần/phiên: khi đã hiện, trang ghi
   * sessionStorage `remind_login_banner_session` và localStorage `remind_login_banner_day`
   * → đặt sẵn 2 cờ này trước khi trang tải để popup không bật.
   */
  async suppressRemindLoginPopup() {
    await this.page.addInitScript(() => {
      const today = new Date().toLocaleDateString('sv-SE'); // yyyy-mm-dd theo giờ trình duyệt
      window.sessionStorage.setItem('remind_login_banner_session', '1');
      window.localStorage.setItem('remind_login_banner_day', JSON.stringify({ date: today, count: 1 }));
    });
  }

  /**
   * Tắt popup banner quảng cáo hằng ngày của trang chủ (trả danh sách rỗng) để popup này không che
   * các điểm vào Chớp. Không dùng closeAdsIfVisible() vì hàm đó đóng luôn floating panel Chớp.
   */
  async suppressHomeDailyPopup() {
    await this.page.route(/banner\/list\?position_key=HOME_POPUP_DAILY/, (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ code: 200, msg: '', data: [] }),
    }));
  }

  /**
   * Mở trang chủ cho khách: tắt popup quảng cáo hằng ngày và popup nhắc đăng nhập.
   * Cấu hình câu mẫu kỳ vọng đọc qua API (core/utils/chopWebApiHelper.js) — cùng nguồn trang dùng.
   */
  async openGuestHome() {
    await this.suppressHomeDailyPopup();
    await this.suppressRemindLoginPopup();
    await this.homePage.navigate();
  }

  /** Chỉ dùng khi không cần floating panel (ví dụ ứng viên đã đăng nhập). */
  async closeHomePopups() {
    await this.homePage.closeAdsIfVisible();
  }

  /** Mở popup đăng nhập từ header trang chủ rồi đăng nhập bằng SĐT + OTP. */
  async loginFromHeader(user) {
    const loginPopup = new LoginPopup(this.page, this.featureName);
    await loginPopup.clickLoginHeader();
    await this.loginOnChopPage(user);
  }

  /**
   * Đăng nhập bằng SĐT + OTP khi popup đăng nhập đang mở (trang Chớp yêu cầu đăng nhập sau khi khách
   * gửi câu hỏi, hoặc mở từ header). Dùng LoginPopup.requestSmsOtp() để hỗ trợ cả giao diện OTP Zalo
   * lẫn nút "Tiếp tục" cũ.
   */
  async loginOnChopPage(user) {
    const loginPopup = new LoginPopup(this.page, this.featureName);
    await expect(loginPopup.phoneInput).toBeVisible({ timeout: 20000 });
    await loginPopup.fillPhone(user.phone || user.username);
    await loginPopup.requestSmsOtp({ maxAttempts: 3, otpTimeout: 10000, loadingTimeout: 15000 });
    // requestSmsOtp có thể trả về sớm (regex /OTP/ khớp cả chữ trên nút "Nhận OTP qua SMS")
    // → chờ ô nhập OTP thật sự hiện; QC gửi SMS OTP có lúc mất vài chục giây
    await expect(loginPopup.otpInputs.first()).toBeVisible({ timeout: 60000 });
    await loginPopup.fillOtpCode(user.otp || '1111');
    await expect(loginPopup.otpInputs.first()).toBeHidden({ timeout: 30000 });
  }

  async expectChopConversationContains(text) {
    await expect(this.page.getByText(text, { exact: true }).first()).toBeVisible({ timeout: 30000 });
  }

  async expectFloatingPanelVisible() {
    await expect(this.floatingPanel).toBeVisible({ timeout: 20000 });
  }

  async getFloatingPromptTexts() {
    await this.expectFloatingPanelVisible();
    const texts = await this.floatingPanel.getByRole('button').allInnerTexts();
    return texts.map((t) => t.trim()).filter(Boolean);
  }

  async closeFloatingPanel() {
    await this.actions.click(this.floatingCloseBtn);
    await expect(this.floatingPanel).toBeHidden({ timeout: 10000 });
  }

  async selectFloatingPrompt(text) {
    await this.actions.click(this.floatingPanel.getByRole('button', { name: text, exact: true }));
    await expect(this.floatingInput).toHaveValue(text, { timeout: 10000 });
  }

  async sendFloatingMessage() {
    await Promise.all([
      this.page.waitForURL(/\/chop-tro-ly-ai\.html/, { timeout: 30000 }),
      this.actions.click(this.floatingSendBtn),
    ]);
  }

  async openAskDialog() {
    await this.actions.click(this.askChopButton, { force: true });
    await expect(this.askDialog).toBeVisible({ timeout: 10000 });
  }

  async getAskDialogPromptTexts() {
    let texts = [];
    await expect(async () => {
      await expect(this.askDialogChips.first()).toBeVisible({ timeout: 5000 });
      texts = (await this.askDialogChips.allInnerTexts()).map((t) => t.trim()).filter(Boolean);
      expect(texts.length).toBeGreaterThan(0);
    }).toPass({ timeout: 15000 });
    return texts;
  }

  async selectAskDialogPrompt(text) {
    await this.actions.click(this.askDialogChips.filter({ hasText: text }));
    await expect(this.askDialogInput).toHaveValue(text, { timeout: 10000 });
  }

  async closeAskDialog() {
    await this.page.keyboard.press('Escape');
    await expect(this.askDialog).toBeHidden({ timeout: 10000 });
  }

  async openSearchDropdown() {
    await this.actions.click(this.searchInput);
    await expect(this.searchChopSection).toBeVisible({ timeout: 10000 });
  }

  async getSearchDropdownPromptTexts() {
    let texts = [];
    await expect(async () => {
      await expect(this.searchChopChips.first()).toBeVisible({ timeout: 5000 });
      // Mỗi nút có dòng phụ "Mở cuộc trò chuyện" bên dưới câu mẫu → chỉ lấy dòng đầu
      texts = (await this.searchChopChips.allInnerTexts()).map((t) => t.split('\n')[0].trim()).filter(Boolean);
      // Dropdown có hiệu ứng mở: chỉ chấp nhận khi chip đã có nội dung
      expect(texts.length).toBeGreaterThan(0);
    }).toPass({ timeout: 30000 });
    return texts;
  }

  /** Ba câu đầu theo thứ tự trong cấu hình (khách / chưa có job goal). */
  static expectedGuestPrompts(config) {
    return config.slice(0, 3).map((p) => p.text);
  }

  /** Câu đầu tiên trong cấu hình có slot_key tương ứng (fallback khi job goal thiếu tiêu chí). */
  static firstPromptOfSlot(config, slotKey) {
    const item = config.find((p) => p.slot_key === slotKey);
    if (!item) throw new Error(`Cấu hình không có câu mẫu nào cho slot_key=${slotKey}`);
    return item.text;
  }
}

module.exports = { ChopWebEntryPage };
