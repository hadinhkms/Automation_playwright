const { expect } = require('@playwright/test');
const { ChopWebEntryPage } = require('../desktop/ChopWebEntryPage');
const { MobileHomePage } = require('./MobileHomePage');

/**
 * MobileChopWebEntryPage — điểm vào Chớp trên Mobile Web.
 * Dùng chung locator với desktop (cùng DOM responsive), chỉ thay HomePage bằng bản mobile để
 * điều hướng và đóng đúng các popup/bottom sheet của mobile (popup mở app, modal chung).
 */
class MobileChopWebEntryPage extends ChopWebEntryPage {
  constructor(page, featureName) {
    super(page, featureName);
    this.homePage = new MobileHomePage(page, featureName);
    // Mobile có thêm thanh tìm kiếm dự phòng #search-mobile-fallback (opacity-0, vẫn tính là visible)
    // chứa nút "Hỏi Chớp" và ô tìm kiếm trùng tên → scope vào thanh tìm kiếm chính
    const mainSearchBox = page.locator('#search-box-version2');
    this.askChopButton = mainSearchBox.getByRole('button', { name: 'Hỏi Chớp' });
    this.searchInput = mainSearchBox.getByPlaceholder(/Nhập vị trí muốn/);
  }

  /**
   * Trên mobile ô tìm kiếm là input readonly có lớp phủ (absolute inset-0) nhận thao tác chạm
   * để mở màn tìm kiếm → chạm thẳng vào vị trí ô (force) thay vì chờ input nhận pointer.
   */
  async openSearchDropdown() {
    await this.actions.click(this.searchInput, { force: true });
    await expect(this.searchChopSection).toBeVisible({ timeout: 10000 });
  }
}

module.exports = { MobileChopWebEntryPage };
