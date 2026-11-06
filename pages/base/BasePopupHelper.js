/**
 * Đóng popup/banner chặn màn hình và auto-handler cho khách vãng lai.
 * Chỉ ẩn node (display:none), không remove() node do React quản lý.
 * Được BasePage sở hữu; dùng page/actions/screenshotHelper của owner (giữ nguyên API public của BasePage).
 */
class BasePopupHelper {
  /** @param {import('../BasePage').BasePage} owner */
  constructor(owner) {
    this.owner = owner;
  }

  /**
   * Đăng ký Playwright Locator Handler để tự động đóng popup nếu xuất hiện sau 30s
   * hoặc bất kỳ lúc nào khi người dùng chưa đăng nhập.
   */
  async registerGuestPopupAutoHandlers() {
    try {
      // 1. Popup "Khoan đã, Hình như bạn chưa đăng nhập?" (sau ~30s)
      const guestLoginPopup = this.owner.page.locator('.ReactModalPortal, [role="dialog"]')
        .filter({ hasText: /Khoan đã|chưa đăng nhập/i });

      await this.owner.page.addLocatorHandler(guestLoginPopup, async (overlay) => {
        const closeBtn = overlay.locator('button:has(.svicon-close), button, [class*="close" i], svg, i').first();
        if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await closeBtn.click({ force: true }).catch(() => null);
        } else {
          await this.owner.page.keyboard.press('Escape').catch(() => null);
        }
        await overlay.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => null);
      });

      // 2. Popup "TẢI APP NGAY" (Banner / mobileEntryPopup)
      const appBanner = this.owner.page.locator('.mbep-popup, .ReactModalPortal')
        .filter({ hasText: /Tải app ngay/i });

      await this.owner.page.addLocatorHandler(appBanner, async (overlay) => {
        const closeBtn = overlay.locator('button:has(.svicon-close), button, [class*="close" i], svg, i').first();
        if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await closeBtn.click({ force: true }).catch(() => null);
        }
        await overlay.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => null);
      });

      // 3. Popup Banner quảng cáo / chiến dịch (ví dụ: "Việc vững vàng, đón xuân SANG" có img[alt="Banner"])
      const campaignBanner = this.owner.page.locator(
        '.ReactModalPortal img[alt*="Banner" i], [role="dialog"] img[alt*="Banner" i], dialog img[alt*="Banner" i], img[src*="popup-remind" i], .ReactModalPortal:has(.svicon-close)'
      ).filter({ visible: true }).first(); // portal cũ bị ẩn (display:none) vẫn nằm trong DOM → phải lọc visible, nếu không .first() trỏ vào node ẩn và handler không bao giờ chạy

      await this.owner.page.addLocatorHandler(campaignBanner, async (overlay) => {
        const closeBtn = this.owner.page.locator(
          '.ReactModalPortal .svicon-close, .ReactModal__Content .svicon-close, [role="dialog"] .svicon-close, button:has(.svicon-close), [class*="close" i]'
        ).first();
        if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await closeBtn.click({ force: true }).catch(() => null);
        } else {
          await this.owner.page.keyboard.press('Escape').catch(() => null);
        }
        await this.owner.page.evaluate(() => {
          document.querySelectorAll('.ReactModalPortal, [role="dialog"], dialog').forEach((el) => {
            if (
              el.querySelector('img[alt*="Banner" i]') ||
              el.querySelector('img[src*="popup-remind" i]') ||
              el.querySelector('.svicon-close') ||
              (el.innerText && (el.innerText.includes('Khoan đã') || el.innerText.includes('đón xuân') || el.innerText.includes('SANG')))
            ) {
              const btn = el.querySelector('button, [class*="close" i], .svicon-close');
              if (btn) btn.click();
              el.style.display = 'none'; // Ẩn, không remove(): xoá node React quản lý làm hỏng router (404 rồi redirect về /tim-kiem-viec-lam-nhanh).
            }
          });
          document.body.classList.remove('ReactModal__Body--open');
          document.body.style.overflow = 'auto';
        }).catch(() => null);
        await overlay.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => null);
      });
    } catch (_err) {
      // Bỏ qua nếu context/page không hỗ trợ
    }
  }

  /**
   * Quét và đóng sạch tất cả các popup, banner, modal cản trở đang hiển thị trên màn hình
   * trước khi thực hiện flow test.
   */
  async closeAllPopupsIfVisible() {
    try {
      // 1. Đóng popup "Khoan đã, Hình như bạn chưa đăng nhập?"
      const guestLoginPopup = this.owner.page.locator('.ReactModalPortal, [role="dialog"], dialog')
        .filter({ hasText: /Khoan đã|chưa đăng nhập/i });
      if (await guestLoginPopup.isVisible({ timeout: 1000 }).catch(() => false)) {
        const closeBtn = guestLoginPopup.locator('button:has(.svicon-close), button, [class*="close" i], [cursor="pointer"], svg, i').first();
        if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await closeBtn.click({ force: true }).catch(() => null);
        } else {
          await this.owner.page.keyboard.press('Escape').catch(() => null);
        }
        await guestLoginPopup.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => null);
      }

      // 2. Đóng popup "TẢI APP NGAY"
      const appModal = this.owner.page.locator('.mbep-popup, .ReactModalPortal')
        .filter({ hasText: /Tải app ngay/i });
      if (await appModal.isVisible({ timeout: 1000 }).catch(() => false)) {
        const closeBtn = appModal.locator('button:has(.svicon-close), button, [class*="close" i], [cursor="pointer"], svg, i').first();
        if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await closeBtn.click({ force: true }).catch(() => null);
        }
        await appModal.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => null);
      }

      // 3. Đóng popup Banner quảng cáo / chiến dịch (img[alt="Banner"] hoặc img[src*="popup-remind"])
      const bannerCloseBtn = this.owner.page.locator(
        '.ReactModalPortal .svicon-close, ' +
        '.ReactModal__Content .svicon-close, ' +
        '[role="dialog"] .svicon-close, ' +
        '.ReactModalPortal:has(img) button:has(.svicon-close), ' +
        '.ReactModalPortal:has(img) [class*="close" i], ' +
        '.ReactModalPortal button:has-text("Đóng"), ' +
        '.ReactModalPortal button:has-text("Bỏ qua")'
      ).first();
      if (await bannerCloseBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
        await bannerCloseBtn.click({ force: true }).catch(() => null);
        await bannerCloseBtn.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => null);
      } else {
        const bannerImg = this.owner.page.locator('.ReactModalPortal img[alt*="Banner" i], img[src*="popup-remind" i], [role="dialog"] img[alt*="Banner" i]').first();
        if (await bannerImg.isVisible({ timeout: 1000 }).catch(() => false)) {
          await this.owner.page.keyboard.press('Escape').catch(() => null);
        }
      }

      // 4. Đóng popup Đồng ý chính sách bảo mật
      const consentBtn = this.owner.page.getByRole('button', { name: 'Đồng ý', exact: true });
      if (await consentBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await this.owner.actions.click(consentBtn, { force: true });
        await consentBtn.waitFor({ state: 'hidden', timeout: 2500 }).catch(() => null);
      }

      // 5. Đóng generic modal / dialog nếu có
      const genericDialog = this.owner.page.getByRole('dialog');
      if (await genericDialog.isVisible({ timeout: 1000 }).catch(() => false)) {
        const closeBtn = genericDialog.locator('button:has(.svicon-close), button, [class*="close" i], [cursor="pointer"], svg, i').last();
        if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await closeBtn.click({ force: true }).catch(() => null);
        } else {
          await this.owner.page.keyboard.press('Escape').catch(() => null);
        }
      }

      // 6. Quét dọn các overlay còn sót bằng evaluate an toàn
      await this.owner.page.evaluate(() => {
        document.querySelectorAll('.ReactModalPortal, [role="dialog"], dialog').forEach((el) => {
          if (
            el.querySelector('img[alt*="Banner" i]') ||
            el.querySelector('img[src*="popup-remind" i]') ||
            el.querySelector('.svicon-close') ||
            (el.innerText && (
              el.innerText.includes('chưa đăng nhập') ||
              el.innerText.includes('Tải app') ||
              el.innerText.includes('Khoan đã') ||
              el.innerText.includes('đón xuân') ||
              el.innerText.includes('SANG')
            ))
          ) {
            const closeBtn = el.querySelector('button, [class*="close" i], [cursor="pointer"], .svicon-close, svg, i');
            if (closeBtn) closeBtn.click();
            el.style.display = 'none'; // Ẩn, không remove(): xoá node React quản lý làm hỏng router.
          }
        });
        document.querySelectorAll('.mbep-popup').forEach((el) => { el.style.display = 'none'; });
        document.querySelectorAll('[class*="notification-bar"], [class*="app-banner"]').forEach((el) => {
          if (el.offsetHeight < 100) el.style.display = 'none';
        });
        document.body.classList.remove('ReactModal__Body--open');
        document.body.style.overflow = 'auto';
      }).catch(() => null);
    } catch (_err) {
      // An toàn khi không có popup
    }
  }
}

module.exports = { BasePopupHelper };
