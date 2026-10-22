const { UserProfilePage } = require('../desktop/UserProfilePage');
const { MobileProfileCvHelper } = require('./MobileProfileCvHelper');

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

    this.btnCommonSave = this.page
      .getByRole('button', { name: /Lưu thông tin|Lưu lại|Xác nhận|Lưu thay đổi|^Lưu$/i })
      .or(this.page.locator('.fixed.bottom-0 button:has-text("Lưu")'))
      .or(this.page.locator('[data-test-id="common__actions-button"] button').filter({ hasText: /Lưu/i }))
      .first();

    this.btnSearchCriteria = this.page
      .getByRole('button', { name: /Tiêu chí tìm việc/i })
      .or(this.page.getByText(/Tiêu chí tìm việc/i))
      .or(this.page.locator('[data-test-id*="search-criteria"]'))
      .first();

    this.mobileCvHelper = new MobileProfileCvHelper(this);
  }

  async navigateToMyProfile() {
    try {
      const currentUrl = this.page.url();
      if (currentUrl.includes('/ho-so-cua-toi.html')) {
        await this.page.waitForLoadState('domcontentloaded');
        return;
      }
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
    } catch (_e) {
      // Fallback
    }

    await this.navigate('/ho-so-cua-toi.html');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async clickSearchCriteria() {
    if (await this.btnUserAvatar.isVisible({ timeout: 3000 }).catch(() => false)) {
      await this.clickElement(this.btnUserAvatar);
    } else if (await this.mobileMenuBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.clickElement(this.mobileMenuBtn);
    }

    const criteriaBtn = this.page
      .locator('p:has-text("Tiêu chí tìm việc"):visible, button:has-text("Tiêu chí tìm việc"):visible, [data-test-id*="search-criteria"]:visible')
      .first();

    await Promise.all([
      this.page.waitForURL(/tieu-chi-tim-viec/, { timeout: 15000 }).catch(() => null),
      this.clickElement(criteriaBtn),
    ]);
    await this.page.waitForLoadState('domcontentloaded');
    await this.waitForGlobalLoadingHidden(15000).catch(() => null);
  }

  async closeMobileOverlaysIfVisible() {
    const commonCloseBtn = this.page.locator('#common__modal button:has(.svicon-close), .mbep-popup button:has(.svicon-close)').first();
    if (await commonCloseBtn.isVisible().catch(() => false)) {
      await this.actions.click(commonCloseBtn, { force: true });
    }
  }

  async uploadProfileCV(filePath) {
    const fileInput = this.page.locator('input[type="file"][accept*=".pdf"], input[type="file"][accept*=".doc"]').first();
    if ((await fileInput.count().catch(() => 0)) > 0) {
      await fileInput.setInputFiles(filePath);
      return;
    }

    const btnUpload = this.page.getByRole('button', { name: /Tải lên CV/i }).or(this.page.locator('button:has(.svicon-upload)')).first();
    const [fileChooser] = await Promise.all([
      this.page.waitForEvent('filechooser', { timeout: 10000 }),
      this.clickElement(btnUpload),
    ]);
    await fileChooser.setFiles(filePath);
  }

  async enableCVSearch() {
    let cvSearchSwitch = this.page.locator('[data-test-id="user-profile__enable-search"] [data-test-id="common__switch"]:visible, [data-test-id="common__switch"]:visible').first();
    if (!(await cvSearchSwitch.isVisible().catch(() => false))) {
      const statusBtn = this.page.locator('div:has-text("Trạng thái tìm việc"):visible, span:has-text("Trạng thái tìm việc"):visible').first();
      if (await statusBtn.isVisible().catch(() => false)) {
        await this.clickElement(statusBtn);
        cvSearchSwitch = this.page.locator('[data-test-id="common__switch"]:visible, input[type="checkbox"]:visible, [role="switch"]:visible').first();
        if (await cvSearchSwitch.isVisible({ timeout: 3000 }).catch(() => false)) {
          await this.clickElement(cvSearchSwitch);
          return;
        }
      }
      await this.navigateToMyProfile();
      cvSearchSwitch = this.page.locator('[data-test-id="user-profile__enable-search"] [data-test-id="common__switch"]:visible, [data-test-id="common__switch"]:visible').first();
    }
    await this.clickElement(cvSearchSwitch);
  }

  isWizardOpen() { return this.mobileCvHelper.isWizardOpen(); }
  async clickContinueButton() { return this.mobileCvHelper.clickContinueButton(); }
  async fillVerificationCode(code) { return this.mobileCvHelper.fillVerificationCode(code); }
  async uploadCV(filePath) { return this.mobileCvHelper.uploadCV(filePath); }
  async clickAllowSearch() { return this.mobileCvHelper.clickAllowSearch(); }
}

module.exports = { MobileUserProfilePage };
