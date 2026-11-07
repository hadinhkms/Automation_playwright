const { expect } = require('@playwright/test');
const { LoginPopup } = require('../desktop/LoginPopup');

class MobileLoginPopup extends LoginPopup {
  constructor(page, featureName) {
    super(page, featureName);
    this.loginHeaderBtn = page.getByRole('button', { name: 'Đăng nhập' }).first();
  }

  /** WebKit: nút header có thể được bấm trước khi trang hydrate xong → modal không mở; bấm lại tới khi modal hiện */
  async clickLoginHeader() {
    await expect(async () => {
      if (!(await this.modalTitle.isVisible().catch(() => false))) {
        await this.loginHeaderBtn.click({ force: true, timeout: 5000 });
      }
      await expect(this.modalTitle).toBeVisible({ timeout: 5000 });
    }).toPass({ timeout: 30000 });
  }
}

module.exports = { MobileLoginPopup };
