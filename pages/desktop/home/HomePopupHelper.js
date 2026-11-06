/**
 * Đóng modal chặn màn hình, banner thông báo và popup quảng cáo ở trang chủ.
 * Chỉ ẩn node (display:none), không remove() node do React quản lý.
 * Được HomePage sở hữu qua `this.homePopupHelper`; mọi state/locator đọc từ owner (giữ nguyên API public).
 */
class HomePopupHelper {
  /** @param {import('../HomePage').HomePage} owner */
  constructor(owner) {
    this.owner = owner;
  }

  async closeBlockingModalIfVisible() {
    await this.owner.closeAllPopupsIfVisible();

    if (await this.owner.privacyConsentAgreeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.owner.actions.click(this.owner.privacyConsentAgreeBtn, { force: true });
      await this.owner.privacyConsentAgreeBtn.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => null);
    }

    if (await this.owner.genericModalCloseBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.owner.actions.click(this.owner.genericModalCloseBtn, { force: true });
      await this.owner.genericModalCloseBtn.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => null);
    }

    const dialog = this.owner.page.getByRole('dialog');
    if (await dialog.isVisible({ timeout: 2000 }).catch(() => false)) {
      const closeEl = dialog.locator('i, svg, button, [class*="close" i]').last();
      if (await closeEl.isVisible({ timeout: 1000 }).catch(() => false)) {
        await closeEl.click({ force: true }).catch(() => null);
      }
      await this.owner.page.keyboard.press('Escape').catch(() => null);
      if (await dialog.isVisible({ timeout: 1000 }).catch(() => false)) {
        await this.owner.page.evaluate(() => {
          document.querySelectorAll('.ReactModalPortal').forEach(el => { el.style.display = 'none'; }); // không remove() node React (hỏng router)
        }).catch(() => null);
      }
    }
  }

  async closeAdsIfVisible() {
    try {
      await this.owner.closeBlockingModalIfVisible();

      // Dismiss notification banner ("Tải app ngay", thông báo nâng cấp hệ thống...)
      // Banner này thường ở sticky top, không có nút X nhưng có button dẫn đến app
      const notificationBanner = this.owner.page.locator(
        'div:has(img[alt*="notification" i]):has(button), ' +
        'div:has(img[alt*="mobile" i]):has(button), ' +
        '[class*="notification-bar"], [class*="notify-bar"], [class*="app-banner"], ' +
        '[class*="top-bar"]:has(button)'
      ).first();
      if (await notificationBanner.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Tìm nút X / close trong banner
        const bannerClose = notificationBanner.locator(
          'button:not(:has-text("Tải app")):not(:has-text("Download")), [class*="close" i], i.svicon-close'
        ).first();
        if (await bannerClose.isVisible({ timeout: 1000 }).catch(() => false)) {
          await bannerClose.click({ force: true }).catch(() => null);
        } else {
          // Nếu không có nút close, ẩn bằng JS
          await this.owner.page.evaluate(() => {
            document.querySelectorAll(
              'div:has(img[alt*="notification"]), div:has(img[alt*="mobile"]), [class*="notification-bar"], [class*="app-banner"]'
            ).forEach(el => { if (el.offsetHeight < 100) el.style.display = 'none'; });
          }).catch(() => null);
        }
      }

      if (await this.owner.mobileEntryPopup.isVisible({ timeout: 2000 }).catch(() => false)) {
        const mbepClose = this.owner.mobileEntryPopup.locator('button:has(.svicon-close), [class*="close" i], button, i, svg').first();
        if (await mbepClose.isVisible({ timeout: 1000 }).catch(() => false)) {
          await mbepClose.click({ force: true }).catch(() => null);
        }
        await this.owner.mobileEntryPopup.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => null);
        if (await this.owner.mobileEntryPopup.isVisible().catch(() => false)) {
          await this.owner.page.evaluate(() => {
            document.querySelectorAll('.mbep-popup').forEach(el => { el.style.display = 'none'; });
          }).catch(() => null);
        }
      }

      const count = await this.owner.closeAdsBtns.count();
      for (let i = 0; i < count; i++) {
        const btn = this.owner.closeAdsBtns.nth(i);
        if (await btn.isVisible().catch(() => false)) {
          await btn.click({ force: true }).catch(() => null);
        }
      }
    } catch (error) {
      // Bỏ qua nếu không có popup
    }
  }
}

module.exports = { HomePopupHelper };
