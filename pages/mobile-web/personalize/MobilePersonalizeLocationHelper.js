/**
 * Bước 2 Onboarding mini (chọn khu vực) trên Mobile Web.
 * Owner-delegating: gọi qua `this.owner` để dùng getLocationBtn() override của MobilePersonalizePage.
 */
class MobilePersonalizeLocationHelper {
  /** @param {import('../MobilePersonalizePage').MobilePersonalizePage} owner */
  constructor(owner) {
    this.owner = owner;
  }

  /** Chọn lần lượt 5 khu vực hợp lệ ban đầu trên Mobile Web */
  async select5Locations(options = {}) {
    const o = this.owner;
    await o.waitForElement(o.chonToiDa5Text, 15000);
    const locationNames = ['TP.HCM', 'Hà Nội', 'Bình Dương', 'Đồng Nai', 'Cần Thơ'];
    for (const name of locationNames) {
      const btn = o.getLocationBtn(name);
      await o.waitForElement(btn, 10000);
      await btn.click({ force: true });
    }
    if (options.capture !== false) {
      await o.capture('step2_5_locations_selected');
    }
  }

  /** Bỏ chọn / chọn lại một khu vực (click force vì drawer mobile hay che pointer) */
  async deselectLocation(btnName = 'Cần Thơ', options = {}) {
    const o = this.owner;
    await o.getLocationBtn(btnName).click({ force: true });
    if (options.capture) await o.capture('location_deselected');
  }

  async selectSingleLocation(btnName = 'Cần Thơ', options = {}) {
    const o = this.owner;
    await o.getLocationBtn(btnName).click({ force: true });
    if (options.capture) await o.capture('location_selected');
  }

  /** Mở danh sách khu vực mở rộng trên mobile */
  async openExtendedLocationsDropdown() {
    const o = this.owner;
    const khacBtn = o.page.getByRole('button', { name: /Khác/i }).first();
    if (await khacBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await khacBtn.click({ force: true });
      await o.sixthLocationBtn.waitFor({ state: 'attached', timeout: 3000 }).catch(() => null);
    }
  }

  /**
   * Thử chọn khu vực thứ 6 vượt biên tối đa 5 trên mobile và đóng drawer bằng nút 'Áp dụng'
   */
  async select6thLocationIfAvailable() {
    const o = this.owner;
    try {
      const khacBtn = o.page.getByRole('button', { name: /Khác/i }).first();
      if (await khacBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await khacBtn.click({ force: true });
        const sixthLocation = o.page.getByRole('button', { name: /An Giang/i }).first();
        await sixthLocation.waitFor({ state: 'attached', timeout: 3000 }).catch(() => null);
        if (await sixthLocation.isVisible().catch(() => false)) {
          const isDisabled = await sixthLocation.isDisabled().catch(() => false);
          if (!isDisabled) {
            await sixthLocation.click({ force: true }).catch(() => null);
          }
        }
      }
    } catch (_) {
    } finally {
      await o.capture('step2_6th_location_boundary_checked');
      // Đóng drawer Khác trên mobile bằng nút "Áp dụng" hoặc phím Escape
      const applyBtn = o.page.getByRole('button', { name: /Áp dụng/i })
        .or(o.page.locator('button:has-text("Áp dụng")'))
        .first();
      if (await applyBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await applyBtn.click({ force: true }).catch(() => null);
      } else {
        await o.page.keyboard.press('Escape').catch(() => null);
      }
      await applyBtn.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => null);
      await o.tiepTheoBtn.waitFor({ state: 'visible', timeout: 5000 }).catch(() => null);
    }
  }
}

module.exports = { MobilePersonalizeLocationHelper };
