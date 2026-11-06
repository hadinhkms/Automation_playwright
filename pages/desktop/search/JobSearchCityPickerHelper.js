const { expect } = require('@playwright/test');

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Accessible name của option trong picker có icon glyph đứng trước tên (vd. " Hà Nội"),
 * nên neo ở ranh giới không phải chữ/số thay vì `^`. Quận/huyện cho phép tiền tố hành chính.
 */
const optionName = (label, allowAdminPrefix = false) => {
  const prefix = allowAdminPrefix ? '(?:(?:Quận|Huyện|Thị xã|Thành phố|Thị trấn) )?' : '';
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])${prefix}${escapeRegex(label)}$`, 'iu');
};

/**
 * Picker tỉnh thành "Chọn địa điểm" (UI 11/2026): mở picker, chọn tỉnh/quận, Áp dụng, Tìm kiếm và kiểm tra kết quả.
 * Được JobSearchPage sở hữu qua `this.cityPickerHelper`; locator đọc từ owner.
 */
class JobSearchCityPickerHelper {
  /** @param {import('../JobSearchPage').JobSearchPage} owner */
  constructor(owner) {
    this.owner = owner;
  }

  /**
   * Xác nhận bộ lọc tỉnh thành (và tùy chọn quận/huyện) đã được áp dụng
   * @param {string} cityName Tên tỉnh thành (ví dụ: 'TP.HCM')
   * @param {string} [districtName] Tên quận/huyện nếu có (ví dụ: 'Quận 1')
   */
  async expectCityFilterApplied(cityName = 'TP.HCM', districtName = null) {
    await this.owner.page.waitForLoadState('domcontentloaded');
    // Trigger hiển thị tên tỉnh (kể cả khi chọn quận/huyện); H1 kết quả chứa quận/huyện nếu có.
    const triggerText = districtName
      ? new RegExp(`${escapeRegex(cityName)}|${escapeRegex(districtName)}`, 'i')
      : new RegExp(escapeRegex(cityName), 'i');
    await expect(this.owner.locTheoTinhThanhTrigger).toContainText(triggerText, { timeout: 15000 });
    await expect(this.owner.jobSearchResultTitle).toContainText(districtName || cityName, { timeout: 15000 });
  }

  /**
   * Banner nhắc nhở (popup-remind) có thể bật lên giữa chừng khi picker đang mở và chặn click.
   * Handler riêng chỉ ẩn đúng portal chứa banner, không đụng tới dialog "Chọn địa điểm".
   */
  async ensureRemindBannerHandler() {
    if (this.remindBannerHandlerRegistered) return;
    this.remindBannerHandlerRegistered = true;
    const { page } = this.owner;
    const banner = page
      .locator('.ReactModalPortal img[alt="Banner"], .ReactModalPortal img[src*="popup-remind"]')
      .filter({ visible: true })
      .first();
    await page.addLocatorHandler(banner, async () => {
      await page.evaluate(() => {
        document.querySelectorAll('.ReactModalPortal').forEach((portal) => {
          if (portal.querySelector('img[alt="Banner"], img[src*="popup-remind"]')) portal.style.display = 'none';
        });
      }).catch(() => null);
    }, { noWaitAfter: true });
  }

  async openCityDropdown() {
    const { locTheoTinhThanhTrigger: trigger, cityDropdownContainer: dialog, cityPickerCoachMarkBtn: coachMarkBtn } = this.owner;
    await this.ensureRemindBannerHandler();
    await this.owner.closeAllPopupsIfVisible();
    await trigger.waitFor({ state: 'visible', timeout: 10000 });
    await this.owner.actions.click(trigger);
    // Lần đầu mở picker có coach-mark "Tôi đã hiểu" che panel.
    const coachMarkShown = await coachMarkBtn
      .waitFor({ state: 'visible', timeout: 3000 })
      .then(() => true, () => false);
    if (coachMarkShown) {
      await this.owner.actions.click(coachMarkBtn);
      if (!(await dialog.isVisible())) await this.owner.actions.click(trigger);
    }
    await dialog.waitFor({ state: 'visible', timeout: 8000 });
  }

  /**
   * Chọn tỉnh thành (và tùy chọn quận/huyện) trong picker "Chọn địa điểm" rồi bấm Áp dụng.
   * Picker là multi-select nên lựa chọn cũ được bỏ chọn trước để mỗi lần chỉ lọc đúng 1 địa điểm.
   * @param {string} cityName Tên tỉnh thành (ví dụ: 'TP.HCM', 'Hà Nội', 'Bình Dương', 'Toàn quốc')
   * @param {string} [districtName] Tên quận/huyện, có hoặc không kèm tiền tố (ví dụ: 'Quận 1', 'Cầu Giấy')
   */
  async selectCityOption(cityName = 'TP.HCM', districtName = null) {
    const dialog = this.owner.cityDropdownContainer;
    const oldVersionRadio = this.owner.cityPickerOldVersionRadio;
    if (await oldVersionRadio.isVisible().catch(() => false) && !(await oldVersionRadio.isChecked())) {
      await this.owner.actions.click(oldVersionRadio);
    }
    if (await this.owner.cityPickerClearAllBtn.isEnabled().catch(() => false)) {
      await this.owner.actions.click(this.owner.cityPickerClearAllBtn);
    }

    if (districtName) {
      const expandBtn = dialog.getByRole('button', { name: `Xem quận huyện của ${cityName}`, exact: true });
      await expandBtn.scrollIntoViewIfNeeded({ timeout: 5000 });
      await this.owner.actions.click(expandBtn);
      const districtCheckbox = dialog.getByRole('checkbox', { name: optionName(districtName, true) }).first();
      await districtCheckbox.waitFor({ state: 'visible', timeout: 5000 });
      await districtCheckbox.scrollIntoViewIfNeeded({ timeout: 5000 });
      await this.owner.actions.click(districtCheckbox);
    } else {
      const cityCheckbox = dialog.getByRole('checkbox', { name: optionName(cityName) }).first();
      await cityCheckbox.scrollIntoViewIfNeeded({ timeout: 5000 });
      await this.owner.actions.click(cityCheckbox);
    }

    await this.owner.actions.click(this.owner.cityPickerApplyBtn);
    await dialog.waitFor({ state: 'hidden', timeout: 5000 });
  }

  /**
   * Bấm nút "Tìm kiếm" để thực thi truy vấn và làm mới danh sách việc làm
   */
  async clickSearch() {
    await this.owner.timKiemBtn.waitFor({ state: 'visible', timeout: 10000 });
    await this.owner.actions.click(this.owner.timKiemBtn);
    await this.owner.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Quy trình đầy đủ để lọc việc làm theo tỉnh thành
   * @param {string} [cityName='TP.HCM']
   * @param {string} [districtName]
   */
  async filterByCity(cityName = 'TP.HCM', districtName = null) {
    await this.openCityDropdown();
    await this.selectCityOption(cityName, districtName);
    await this.clickSearch();
  }
}

module.exports = { JobSearchCityPickerHelper };
