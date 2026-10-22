class MobileProfileCvHelper {
  constructor(pageInstance) {
    this.owner = pageInstance;
  }

  isWizardOpen() {
    return this.owner.page.getByText('Thiết lập tìm kiếm hồ sơ')
      .or(this.owner.page.getByRole('button', { name: /Bước tiếp theo/i }))
      .or(this.owner.page.getByRole('button', { name: /Cho phép tìm kiếm/i }))
      .or(this.owner.page.locator('[data-test-id="user-profile__enable-search-info"]'))
      .or(this.owner.page.locator('[data-test-id="user-profile__enable-search-cv"]'));
  }

  async clickContinueButton() {
    const isWizard = await this.isWizardOpen().first().isVisible().catch(() => false);
    if (isWizard) {
      return;
    }

    const btnContinue = this.owner.page.getByRole('button', { name: /Tiếp tục/i }).first();
    if (await btnContinue.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.owner.clickElement(btnContinue);
    }
  }

  async fillVerificationCode(code) {
    const isWizard = await this.isWizardOpen().first().isVisible().catch(() => false);
    if (isWizard) {
      return;
    }

    await this.owner.cvHelper.fillVerificationCode(code);
  }

  async uploadCV(filePath) {
    const fileInput = this.owner.page.locator(
      '[data-test-id="user-profile__upload-cv"] ~ input[type="file"], [data-test-id="user-profile__upload-cv"] + input[type="file"], [data-test-id="user-profile__upload-cv"] input[type="file"]'
    ).first();

    if ((await fileInput.count().catch(() => 0)) > 0) {
      await fileInput.setInputFiles(filePath);
    } else {
      const uploadButton = this.owner.page.locator('[data-test-id="user-profile__upload-cv"] [data-test-id="common__button"], button:has-text("Tải lên CV có sẵn")').first();
      await uploadButton.click({ force: true });
    }

    await this.owner.waitForGlobalLoadingHidden(20000);

    const btnAddToProfile = this.owner.page.getByRole('button', { name: /Thêm vào Hồ sơ của tôi/i })
      .or(this.owner.page.locator('button:has-text("Thêm vào Hồ sơ của tôi")'))
      .first();
    if (await btnAddToProfile.isVisible({ timeout: 5000 }).catch(() => false)) {
      await this.owner.clickElement(btnAddToProfile);
      try {
        await btnAddToProfile.waitFor({ state: 'hidden', timeout: 30000 });
      } catch (_e) {
        // ignore
      }
      await this.owner.waitForGlobalLoadingHidden(20000);
    }

    const btnNextStep = this.owner.page.getByRole('button', { name: /Bước tiếp theo/i })
      .or(this.owner.page.locator('button:has-text("Bước tiếp theo")'))
      .first();
    if (await btnNextStep.isVisible({ timeout: 5000 }).catch(() => false)) {
      await this.owner.clickElement(btnNextStep);
      await this.owner.waitForGlobalLoadingHidden(15000);
    }
  }

  async clickAllowSearch() {
    const btnAddToProfile = this.owner.page.getByRole('button', { name: /Thêm vào Hồ sơ của tôi/i })
      .or(this.owner.page.locator('button:has-text("Thêm vào Hồ sơ của tôi")'))
      .first();
    if (await btnAddToProfile.isVisible({ timeout: 3000 }).catch(() => false)) {
      await this.owner.clickElement(btnAddToProfile);
      try {
        await btnAddToProfile.waitFor({ state: 'hidden', timeout: 30000 });
      } catch (_e) {
        // ignore
      }
      await this.owner.waitForGlobalLoadingHidden(15000);
    }

    const btnNextStep = this.owner.page.getByRole('button', { name: /Bước tiếp theo/i })
      .or(this.owner.page.locator('button:has-text("Bước tiếp theo")'))
      .first();
    if (await btnNextStep.isVisible({ timeout: 3000 }).catch(() => false)) {
      await this.owner.clickElement(btnNextStep);
      await this.owner.waitForGlobalLoadingHidden(15000);
    }

    const btnAllowSearch = this.owner.page.getByRole('button', { name: /Cho phép tìm kiếm/i })
      .or(this.owner.page.locator('button:has-text("Cho phép tìm kiếm")'))
      .first();
    await this.owner.clickElement(btnAllowSearch);
  }
}

module.exports = { MobileProfileCvHelper };
