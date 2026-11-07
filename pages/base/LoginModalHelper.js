const { expect } = require('@playwright/test');

/**
 * Mở modal "Đăng nhập hoặc Đăng ký" từ header.
 * WebKit: bấm nút header trước khi trang hydrate xong thì modal không mở → bấm lại tới khi modal hiện.
 * @param {{ modalTitle: import('@playwright/test').Locator, clickLoginHeader: () => Promise<void> }} loginPopup
 */
async function openLoginModal(loginPopup, { timeout = 40000 } = {}) {
  await expect(async () => {
    if (!(await loginPopup.modalTitle.isVisible().catch(() => false))) await loginPopup.clickLoginHeader();
    await expect(loginPopup.modalTitle).toBeVisible({ timeout: 5000 });
  }).toPass({ timeout });
}

module.exports = { openLoginModal };
