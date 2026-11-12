const { expect } = require('@playwright/test');

/**
 * Trạng thái phiên đăng nhập trên header và truy cập trang yêu cầu đăng nhập.
 * Được HomePage sở hữu.
 */
class HomeSessionHelper {
  /** @param {import('../HomePage').HomePage} owner */
  constructor(owner) {
    this.owner = owner;
    const page = owner.page;
    this.loginHeaderBtn = page.locator('#btn-login-header')
      .or(page.getByRole('button', { name: /Đăng ký\s*\/\s*Đăng nhập|^Đăng nhập$/i }))
      .first();
    this.accountManagementItem = page.getByRole('button', { name: /Quản lý tài khoản/i })
      .or(page.getByRole('link', { name: /Quản lý tài khoản/i }))
      .or(page.getByText('Quản lý tài khoản', { exact: true })) // Mobile Web: mục menu là text thường
      .first();
    this.accountManagementUrl = /\/taikhoan\/quan-ly(?:[/?#]|$)/i;

    // Nút "Đăng xuất" nằm ở trang Hồ sơ của tôi, phía dưới mục Ngoại ngữ (menu tài khoản không có)
    this.myProfilePath = '/ho-so-cua-toi.html';
    this.logoutBtn = page.locator('button:has(.svicon-signout)').filter({ hasText: /Đăng xuất/i }).first();
    this.logoutConfirmDialog = page.locator('.fixed').filter({ hasText: /Bạn muốn đăng xuất\?/i }).last();
    this.logoutConfirmBtn = this.logoutConfirmDialog.locator('button').filter({ hasText: /^\s*Đăng xuất\s*$/ });
    this.loginDialogTitle = page.getByText(/Đăng nhập hoặc Đăng ký/i).first();
  }

  /** Mở thẳng trang Hồ sơ của tôi (yêu cầu đăng nhập). */
  async openMyProfile() {
    await this.owner.page.goto(this.myProfilePath, { waitUntil: 'domcontentloaded' }); // HomePage.navigate() bỏ qua path
  }

  /** Đăng xuất từ trang Hồ sơ của tôi: bấm "Đăng xuất" rồi xác nhận trong hộp "Bạn muốn đăng xuất?". */
  async logoutFromMyProfile() {
    await expect(this.logoutBtn, 'Trang Hồ sơ của tôi phải có nút Đăng xuất').toBeVisible({ timeout: 30000 });
    await this.logoutBtn.scrollIntoViewIfNeeded();
    // Popup bật muộn có thể che nút → đóng rồi bấm lại cho tới khi hộp xác nhận hiện
    await expect(async () => {
      await this.owner.closeBlockingModalIfVisible();
      await this.logoutBtn.click({ timeout: 5000 });
      await expect(this.logoutConfirmDialog).toBeVisible({ timeout: 5000 });
    }).toPass({ timeout: 40000 });
    await this.owner.clickElement(this.logoutConfirmBtn);
    await this.owner.page.waitForLoadState('domcontentloaded');
  }

  async expectLoggedOut() {
    await this.expectGuestHeaderVisible();
    await expect(this.owner.accountMenuButton, 'Menu tài khoản phải ẩn sau khi đăng xuất').toBeHidden({ timeout: 10000 });
  }

  /** Sau khi đăng xuất, trang Hồ sơ của tôi phải yêu cầu đăng nhập và không hiển thị nút Đăng xuất. */
  async expectMyProfileRequiresLogin() {
    await expect(this.loginDialogTitle, 'Trang Hồ sơ của tôi phải yêu cầu đăng nhập khi là khách').toBeVisible({ timeout: 30000 });
    await expect(this.logoutBtn, 'Khách không được thấy nút Đăng xuất').toBeHidden();
  }

  async expectLoggedIn() {
    await expect(this.owner.accountMenuButton, 'Header phải hiển thị menu tài khoản khi đã đăng nhập').toBeVisible({ timeout: 30000 });
    await expect(this.loginHeaderBtn, 'Nút Đăng ký/Đăng nhập phải ẩn khi đã đăng nhập').toBeHidden({ timeout: 10000 });
  }

  async expectGuestHeaderVisible() {
    await expect(this.loginHeaderBtn, 'Header phải có nút Đăng ký/Đăng nhập cho khách').toBeVisible({ timeout: 20000 });
  }

  async reloadPage() {
    await this.owner.page.reload({ waitUntil: 'domcontentloaded' });
  }

  /** Mở trang "Quản lý tài khoản" (chỉ truy cập được khi đã đăng nhập) từ menu tài khoản. */
  async openAccountManagement() {
    await this.owner.clickElement(this.owner.accountMenuButton);
    await expect(this.accountManagementItem, 'Menu tài khoản phải có mục Quản lý tài khoản').toBeVisible({ timeout: 10000 });
    await Promise.all([
      this.owner.page.waitForURL(this.accountManagementUrl, { timeout: 30000 }),
      this.owner.clickElement(this.accountManagementItem),
    ]);
    await this.owner.page.waitForLoadState('domcontentloaded');
  }

  async expectAccountManagementVisible() {
    await expect(this.owner.page, 'Trang Quản lý tài khoản không được chuyển hướng về trang khác').toHaveURL(this.accountManagementUrl);
    await this.expectLoggedIn();
  }

  /** Đăng xuất qua menu tài khoản; không thấy menu/nút thì xoá cookie + storage rồi về trang chủ. */
  async logout() {
    const owner = this.owner;
    if (await owner.accountMenuButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await owner.clickElement(owner.accountMenuButton);
      const logoutBtn = owner.page.getByRole('button', { name: /đăng xuất/i })
        .or(owner.page.getByRole('link', { name: /đăng xuất/i }))
        .or(owner.page.locator('text=/đăng xuất/i'))
        .first();
      if (await logoutBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await owner.actions.click(logoutBtn);
        const confirmLogoutBtn = owner.page.getByRole('button', { name: /đồng ý|xác nhận|đăng xuất/i }).filter({ hasNot: logoutBtn }).first();
        if (await confirmLogoutBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await owner.actions.click(confirmLogoutBtn);
        }
      } else {
        await owner.page.context().clearCookies();
        await owner.page.evaluate(() => {
          try { localStorage.clear(); sessionStorage.clear(); } catch (_) {}
        });
        await owner.navigate('/');
      }
    } else {
      await owner.page.context().clearCookies();
      await owner.page.evaluate(() => {
        try { localStorage.clear(); sessionStorage.clear(); } catch (_) {}
      });
      await owner.navigate('/');
    }
    await owner.page.waitForLoadState('domcontentloaded');
  }
}

module.exports = { HomeSessionHelper };
