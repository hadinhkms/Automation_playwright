const { UserProfilePage } = require('../desktop/UserProfilePage');

class MobileUserProfilePage extends UserProfilePage {
  constructor(page, featureName) {
    super(page, featureName);

    // Mobile specific navigation buttons
    this.btnUserAvatar = this.page
      .locator('#header-right-section img[alt*="avt_invalid"]')
      .or(this.page.locator('header figure:has(img)'))
      .or(this.page.locator('header img[alt*="avt_invalid"]'))
      .or(this.page.getByRole('button', { name: /avt_invalid/i }))
      .first();

    this.mobileMenuBtn = this.page.getByRole('button', { name: /menu|danh mục/i })
      .or(this.page.locator('button:has(.svicon-menu)'))
      .or(this.page.locator('[data-test-id="mobile-header-menu"]'))
      .first();

    this.mobileProfileLink = this.page.getByRole('link', { name: /Hồ sơ của tôi|Quản lý hồ sơ/i })
      .or(this.page.locator('a[href*="/ho-so-cua-toi"]'))
      .first();

    // Mobile modal save button (thường là fixed bottom trên mobile viewport)
    this.btnCommonSave = this.page
      .getByRole('button', { name: /Lưu thông tin|Lưu lại|Xác nhận/i })
      .or(this.page.locator('.fixed.bottom-0 button:has-text("Lưu")'))
      .or(this.page.locator('[data-test-id="common__actions-button"] button'))
      .first();

    // Mobile Search criteria button
    this.btnSearchCriteria = this.page
      .getByRole('button', { name: /Tiêu chí tìm việc/i })
      .or(this.page.getByText(/Tiêu chí tìm việc/i))
      .or(this.page.locator('[data-test-id*="search-criteria"]'))
      .first();
  }

  /**
   * Điều hướng vào trang Hồ sơ của tôi trên Mobile:
   * Ưu tiên mở qua menu mobile nếu có, hoặc điều hướng trực tiếp URL tương đối
   */
  async navigateToMyProfile() {
    try {
      const currentUrl = this.page.url();
      if (currentUrl.includes('/ho-so-cua-toi.html')) {
        await this.page.waitForLoadState('domcontentloaded');
        return;
      }

      // Thử mở từ mobile hamburger menu nếu hiển thị
      const isMenuVisible = await this.mobileMenuBtn.isVisible({ timeout: 2000 }).catch(() => false);
      if (isMenuVisible) {
        await this.actions.click(this.mobileMenuBtn);
        const isProfileLinkVisible = await this.mobileProfileLink.isVisible({ timeout: 3000 }).catch(() => false);
        if (isProfileLinkVisible) {
          await this.actions.click(this.mobileProfileLink);
          await this.page.waitForLoadState('domcontentloaded');
          return;
        }
      }
    } catch (e) {
      // Fallback
    }

    // Điều hướng trực tiếp URL tương đối chuẩn Playwright
    await this.navigate('/ho-so-cua-toi.html');
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Mở Tiêu chí tìm việc trên Mobile:
   * Click avatar trên header mobile để mở dropdown/drawer, sau đó chọn Tiêu chí tìm việc đang hiển thị
   */
  async clickSearchCriteria() {
    if (await this.btnUserAvatar.isVisible({ timeout: 3000 }).catch(() => false)) {
      await this.clickElement(this.btnUserAvatar);
    } else if (await this.mobileMenuBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.clickElement(this.mobileMenuBtn);
    }

    // Lọc phần tử visible=true vì trên mobile thanh sidebar desktop có class sm_cv:hidden vẫn nằm trong DOM
    const criteriaBtn = this.page
      .locator('p:has-text("Tiêu chí tìm việc"):visible, button:has-text("Tiêu chí tìm việc"):visible, [data-test-id*="search-criteria"]:visible')
      .first();

    await this.clickElement(criteriaBtn);
  }

  /**
   * Đóng overlay hoặc popup chặn trên mobile nếu xuất hiện
   */
  async closeMobileOverlaysIfVisible() {
    const commonCloseBtn = this.page.locator(
      '#common__modal button:has(.svicon-close), .mbep-popup button:has(.svicon-close)'
    ).first();
    if (await commonCloseBtn.isVisible().catch(() => false)) {
      await this.actions.click(commonCloseBtn, { force: true });
    }
  }

  /**
   * Tải lên CV trên Mobile Web:
   * Trình duyệt mobile có input file ẩn nhận .doc, .docx, .pdf hoặc icon button upload
   */
  async uploadProfileCV(filePath) {
    const fileInput = this.page.locator('input[type="file"][accept*=".pdf"], input[type="file"][accept*=".doc"]').first();
    const hasFileInput = (await fileInput.count().catch(() => 0)) > 0;
    if (hasFileInput) {
      await fileInput.setInputFiles(filePath);
      return;
    }

    const btnUpload = this.page
      .getByRole('button', { name: /Tải lên CV/i })
      .or(this.page.locator('button:has(.svicon-upload)'))
      .first();

    const [fileChooser] = await Promise.all([
      this.page.waitForEvent('filechooser', { timeout: 10000 }),
      this.clickElement(btnUpload),
    ]);
    await fileChooser.setFiles(filePath);
  }
}

module.exports = { MobileUserProfilePage };
