/**
 * Bộ lọc tỉnh thành có 2 phiên bản danh sách (JS-8939):
 * "Tỉnh/thành cũ" (filter_version 1.0) và "Tỉnh/thành sau sáp nhập" (filter_version 2.0).
 * Lựa chọn chỉ được "commit" khi bấm Áp dụng rồi Tìm kiếm.
 */
const VERSION_LABEL = {
  old: 'Tỉnh/thành cũ',
  new: 'Tỉnh/thành sau sáp nhập',
};

class ProvinceFilterVersionHelper {
  /**
   * @param {import('../JobSearchPage').JobSearchPage} pageInstance
   */
  constructor(pageInstance) {
    this.owner = pageInstance;
    const { page } = pageInstance;
    // Dùng trigger chung của JobSearchPage: label đổi thành tên tỉnh sau khi Áp dụng nên không neo theo text.
    this.trigger = pageInstance.locTheoTinhThanhTrigger;
    this.searchByLabel = page.getByText('Tìm theo:').first();
    this.coachMarkOkBtn = page.getByRole('button', { name: 'Tôi đã hiểu' });
    this.applyBtn = page.getByRole('button', { name: 'Áp dụng' }).last();
    this.panel = page
      .locator('div')
      .filter({ has: this.searchByLabel })
      .filter({ has: this.applyBtn })
      .last();
  }

  /** Mở picker tỉnh thành; tự đóng coach-mark "Tôi đã hiểu" nếu lần đầu xuất hiện. */
  async openPicker() {
    await this.owner.closeAllPopupsIfVisible();
    await this.trigger.waitFor({ state: 'visible', timeout: 10000 });
    await this.owner.actions.click(this.trigger);
    const coachMarkShown = await this.coachMarkOkBtn
      .waitFor({ state: 'visible', timeout: 3000 })
      .then(() => true, () => false);
    if (coachMarkShown) {
      await this.owner.actions.click(this.coachMarkOkBtn);
      const panelOpen = await this.searchByLabel.isVisible();
      if (!panelOpen) await this.owner.actions.click(this.trigger);
    }
    await this.searchByLabel.waitFor({ state: 'visible', timeout: 8000 });
  }

  /** @param {'old'|'new'} version */
  async chooseVersion(version) {
    const label = VERSION_LABEL[version];
    if (!label) throw new Error(`[ProvinceFilterVersionHelper] Unknown filter version "${version}"`);
    await this.owner.actions.click(this.owner.page.getByText(label, { exact: true }).first());
    await this.panel.getByText('Toàn quốc', { exact: true }).first().waitFor({ state: 'visible', timeout: 5000 });
  }

  /** @param {string} provinceName Tên hiển thị, ví dụ 'Toàn quốc', 'Hà Nội' */
  async tickProvince(provinceName) {
    const option = this.panel.getByText(provinceName, { exact: true }).first();
    await option.waitFor({ state: 'visible', timeout: 5000 });
    await this.owner.actions.click(option);
  }

  async apply() {
    await this.owner.actions.click(this.applyBtn);
    await this.searchByLabel.waitFor({ state: 'hidden', timeout: 5000 });
  }

  /**
   * Chọn phiên bản + tỉnh, Áp dụng rồi Tìm kiếm (trình tự commit filter).
   * @param {'old'|'new'} version
   * @param {string} provinceName
   */
  async searchByProvince(version, provinceName) {
    await this.openPicker();
    await this.chooseVersion(version);
    await this.tickProvince(provinceName);
    await this.apply();
    await this.owner.clickSearch();
  }
}

module.exports = { ProvinceFilterVersionHelper };
