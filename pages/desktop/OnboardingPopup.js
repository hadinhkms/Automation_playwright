const { expect } = require('@playwright/test');
const { BasePage } = require('../BasePage');
const { ScreenshotHelper } = require('../../core/utils/commonUtils');

class OnboardingPopup extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    super(page);
    this.screenshotHelper = new ScreenshotHelper(page, 'onboarding-flow');

    this.nextBtn = page.locator('button:has-text("Tiếp theo")').first();
    // UI 11/2026: bước cuối đổi nút "Xem công việc phù hợp" → "Hoàn tất"
    this.submitBtn = page.getByRole('button', { name: /Xem công việc phù hợp|Hoàn tất/ }).first();
    // Sau "Hoàn tất": màn Chớp hỏi "Xem công việc Chớp gợi ý cho bạn" / "Tôi muốn tự khám phá" (vẫn trong modal)
    this.exploreSelfBtn = page.getByRole('button', { name: 'Tôi muốn tự khám phá' });
    this.modal = page.locator('#common__modal, [data-test-id="common__form-modal"], [role="dialog"]').filter({
      hasText: /Bạn đang tìm việc ở khu vực nào\?|Bạn đang quan tâm đến ngành nghề nào\?|Bạn đang muốn tìm công việc gì\?/i,
    }).first();
    this.closeBtn = page.locator('#common__modal [data-test-id="common__close-button"], [data-test-id="common__form-modal"] [data-test-id="common__close-button"], [role="dialog"] [data-test-id="common__close-button"]').first();
    this.skipBtn = this.modal.locator('button:has-text("Bỏ qua"), button:has-text("Để sau"), [data-test-id*="skip"]')
      .or(page.getByRole('button', { name: /bỏ qua|để sau/i }))
      .first();
    this.overlayLoading = page.locator('.overlay-loading'); // Thêm locator cho overlay loading

    this.step1Title = this.modal.getByText('Bạn đang tìm việc ở khu vực nào?');
    this.locationInput = this.modal.getByText('Tìm khu vực tỉnh thành');
    this.hcmLocationBtn = this.modal.getByRole('button', { name: 'TP.HCM', exact: true });
    this.hnLocationBtn = this.modal.getByRole('button', { name: 'Hà Nội' });
    this.anGiangLocationOption = page.locator('.custom-scrollbar').getByRole('heading', { name: 'An Giang' });

    this.step2Title = this.modal.getByText('Bạn đang quan tâm đến ngành nghề nào?');
    this.industryDropdown = this.modal.getByText(/Chọn ngành nghề/i);
    this.adminIndustryOption = page.locator('[data-test-id="common__select-menu"]').getByRole('heading', { name: 'Hành chính - Thư ký' });

    this.step3Title = this.modal.getByText('Bạn đang muốn tìm công việc gì?');
    this.jobTitleInput = this.modal.getByPlaceholder('VD: Nhân viên bán hàng; Thu ngân,...');
    this.selectItem = page.locator('[data-test-id="common__select-dropdown"] li').filter({ hasText: /^nhân viên văn phòng$/i });

    this.step4Title = this.modal.getByText('Mức lương mong muốn của bạn?');
    this.salaryOption1 = this.modal.getByRole('button', { name: '10 - 15 triệu', exact: true });
    this.salaryOption2 = this.modal.getByRole('button', { name: '15 - 20 triệu', exact: true });

    this.step5Title = this.modal.getByText('Bạn đã có bao nhiêu năm kinh nghiệm?');
    this.yearsOption1 = this.modal.getByRole('button', { name: '1 năm', exact: true });
    this.yearsOption2 = this.modal.getByRole('button', { name: '2 năm', exact: true });
  }

  /**
   * Chụp theo viewport: ảnh fullPage của Playwright (giả lập viewport cao) làm app mount lại và
   * MỞ LẠI modal onboarding vừa đóng (đã xác minh: cuộn/resize thật không gây ra).
   */
  async capture(stepName, fullPage = false, options = {}) {
    return super.capture(stepName, fullPage, options);
  }

  async clickLocationInput() {
    return this.clickElement(this.locationInput, { force: true });
  }

  async clickNext() {
    return this.clickElement(this.nextBtn);
  }

  async clickNextAndWaitForNextStep(nextStepElement, opts = {}) {
    await this.clickNext();

    // If overlay appears, wait for it to hide. If it doesn't appear within a short window, continue.
    try {
      const detectTimeout = opts.detectTimeout ?? 2000; // short wait to see if overlay shows up
      const waitHiddenTimeout = opts.overlayTimeout ?? 30000;
      if (await this.overlayLoading.isVisible({ timeout: detectTimeout })) {
        await this.overlayLoading.waitFor({ state: 'hidden', timeout: waitHiddenTimeout });
      }
    } catch (err) {
      // Don't fail the whole step just because overlay didn't hide — continue to wait for the next step element.
      // Log for diagnostics; avoid throwing so tests can continue and surface the real failure on the next-step check.
      console.warn('Overlay loading did not hide within expected time:', err.message || err);
    }

    await this.waitForElement(nextStepElement); // Chờ element của bước tiếp theo ổn định
  }

  async clickSubmit() {
    await this.clickElement(this.submitBtn);
    if (await this.exploreSelfBtn.waitFor({ state: 'visible', timeout: 10000 }).then(() => true, () => false)) {
      await this.clickElement(this.exploreSelfBtn);
    }
  }

  async clickClose() {
    // Modal mount lại khi app tải xong hồ sơ: đóng quá sớm thì nó hiện lại → bấm tới khi đóng ổn định 3s
    await expect(async () => {
      if (await this.modal.isVisible()) await this.closeBtn.click({ timeout: 5000 });
      await expect(this.modal).toBeHidden({ timeout: 3000 });
      await expect(this.modal).toBeVisible({ timeout: 3000 }).then(() => { throw new Error('Onboarding modal mở lại'); }, () => null);
    }).toPass({ timeout: 45000 });
  }

  async clickSkip() {
    if (await this.skipBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      return this.clickElement(this.skipBtn);
    }
    return this.clickClose();
  }

  async skipOrClose() {
    if (await this.skipBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      return this.clickElement(this.skipBtn);
    }
    return this.clickClose();
  }

  async closeIfVisible(captureName, opts = {}) {
    const visible = await this.modal.waitFor({ state: 'visible', timeout: opts.modalTimeout ?? 15000 }).then(() => true, () => false);
    if (!visible) return;
    if (captureName) {
      await this.capture(captureName);
    }
    await this.clickClose();
  }

  async selectLocationButton(location) {
    await expect(this.step1Title).toBeVisible({ timeout: 15000 });
    await this.actions.waitForVisible(this.step1Title);
    const locationBtn = this.modal.getByRole('button', { name: location });
    return this.clickElement(locationBtn);
  }

  async selectLocationOption(location) {
    await this.actions.waitForVisible(this.step1Title);
    await expect(this.locationInput).toBeVisible({ timeout: 15000 });
    await this.clickElement(this.locationInput, { force: true });
    const locationOption = this.page.locator('.custom-scrollbar').getByRole('heading', { name: location });
    return this.clickElement(locationOption);
  }

  async selectIndustry(industry) {
    await this.actions.waitForVisible(this.step2Title);
    await this.clickElement(this.industryDropdown);
    const industryOption = this.page.locator('[data-test-id="common__select-menu"]').getByRole('heading', { name: industry });
    return this.clickElement(industryOption);
  }

  async inputJobTitle(jobTitle) {
    await expect(this.step3Title).toBeVisible({ timeout: 15000 });
    await this.actions.waitForVisible(this.step3Title);
    return this.fillInput(this.jobTitleInput, jobTitle);
  }

  async selectSuggestedJobTitle() {
    await expect(this.step3Title).toBeVisible({ timeout: 15000 });
    await this.actions.waitForVisible(this.selectItem);
    return this.clickElement(this.selectItem, { force: true });
  }

  async selectSalary(salary) {
    await expect(this.step4Title).toBeVisible({ timeout: 15000 });
    await this.actions.waitForVisible(this.step4Title);
    const salaryBtn = this.modal.getByRole('button', { name: salary });
    return this.clickElement(salaryBtn);
  }

  async selectYears(years) {
    await expect(this.step5Title).toBeVisible({ timeout: 15000 });
    await this.actions.waitForVisible(this.step5Title);
    const yearsBtn = this.modal.getByRole('button', { name: years });
    return this.clickElement(yearsBtn);
  }

}

module.exports = { OnboardingPopup };
