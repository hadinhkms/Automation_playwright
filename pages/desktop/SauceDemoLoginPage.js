const BasePage = require('../BasePage');
const { expect } = require('@playwright/test');

class SauceDemoLoginPage extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page, featureName) {
    super(page, featureName || 'saucedemo_login');
    this.usernameInput = page.locator('[data-test="username"]');
    this.passwordInput = page.locator('[data-test="password"]');
    this.loginButton = page.locator('[data-test="login-button"]');
    this.errorMessage = page.locator('[data-test="error"]');
    this.inventoryTitle = page.locator('.title');
    this.inventoryList = page.locator('.inventory_list');
  }

  /**
   * Mở trang đăng nhập SauceDemo và chụp ảnh precondition.
   */
  async open(url = 'https://www.saucedemo.com') {
    await this.navigate(url);
    await expect(this.loginButton).toBeVisible({ timeout: 15000 });
    await this.capture('precondition_login_page_loaded');
  }

  /**
   * Thực hiện nhập thông tin đăng nhập và nhấn Đăng nhập.
   * @param {string} username
   * @param {string} password
   */
  async login(username, password) {
    if (username) {
      await this.actions.fill(this.usernameInput, username);
    } else {
      await this.usernameInput.clear();
    }

    if (password) {
      await this.actions.fill(this.passwordInput, password);
    } else {
      await this.passwordInput.clear();
    }

    await this.capture('filled_login_credentials', `user_${username || 'empty'}`);
    await this.actions.click(this.loginButton);
  }

  /**
   * Đọc thông báo lỗi hiển thị trên form.
   */
  async getErrorMessage() {
    await expect(this.errorMessage).toBeVisible({ timeout: 10000 });
    await this.capture('error_message_displayed');
    return this.errorMessage.textContent();
  }

  /**
   * Kiểm tra giao diện sau khi đăng nhập thành công.
   */
  async expectInventoryPageVisible() {
    await expect(this.inventoryTitle).toBeVisible({ timeout: 15000 });
    await expect(this.inventoryList).toBeVisible({ timeout: 15000 });
    await this.capture('login_success_inventory_page');
  }
}

SauceDemoLoginPage.SauceDemoLoginPage = SauceDemoLoginPage;
module.exports = SauceDemoLoginPage;
