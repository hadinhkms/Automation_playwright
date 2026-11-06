const { generateRandomVNPhone } = require('../../../core/utils/commonUtils');

/**
 * Onboarding mini 3 bước trên Personalized Page (Vị trí → Khu vực → Mức lương) và các thao tác biên khu vực.
 * Gọi chéo qua `this.owner` để MobilePersonalizePage vẫn override được từng bước.
 */
class PersonalizeOnboardingHelper {
  /** @param {import('../PersonalizePage').PersonalizePage} owner */
  constructor(owner) {
    this.owner = owner;
  }

  khacBtn() {
    const o = this.owner;
    return o.step2Modal.getByRole('button', { name: /Khác/i }).or(o.page.getByRole('button', { name: /Khác/i })).first();
  }

  async completeDirectMiniOnboarding(jobTitle = 'nhân viên bán hàng', minSalary = '10', maxSalary = '15') {
    await this.owner.completeStep1JobTitle(jobTitle);
    await this.owner.completeStep2Locations(['TP.HCM']);
    await this.owner.completeStep3Salary(minSalary, maxSalary);
  }

  /** Chọn 5 khu vực hợp lệ ban đầu trong Onboarding mini */
  async select5Locations(options = {}) {
    const o = this.owner;
    await o.waitForElement(o.chonToiDa5Text, 15000);
    for (const name of ['TP.HCM', 'Hà Nội', 'Bình Dương', 'Đồng Nai', 'Cần Thơ']) {
      const btn = o.getLocationBtn(name);
      await o.waitForElement(btn, 5000);
      await o.actions.click(btn);
    }
    if (options.capture !== false) {
      await o.capture('step2_5_locations_selected');
    }
  }

  /** Thử chọn khu vực thứ 6 vượt biên tối đa 5 */
  async select6thLocationIfAvailable() {
    const o = this.owner;
    try {
      const khacBtn = this.khacBtn();
      if (await khacBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await khacBtn.click({ force: true });
        const sixthLocation = o.sixthLocationBtn;
        await sixthLocation.waitFor({ state: 'attached', timeout: 3000 }).catch(() => null);
        if (await sixthLocation.isVisible().catch(() => false) && !(await sixthLocation.isDisabled().catch(() => false))) {
          await sixthLocation.click({ force: true }).catch(() => null);
        }
      }
    } catch (_) {
      // Khu vực thứ 6 có thể bị khoá: đó chính là hành vi biên cần quan sát
    } finally {
      await o.capture('step2_6th_location_boundary_checked');
      // Đóng dropdown Khác để lộ nút Tiếp theo
      await this.khacBtn().click({ force: true }).catch(() => null);
      await o.step2Modal.getByText(/Bạn đang tìm việc làm|Chọn tối đa 5/i).first().click({ force: true }).catch(() => null);
      await o.tiepTheoBtn.waitFor({ state: 'visible', timeout: 5000 }).catch(() => null);
    }
  }

  /** Mở danh sách các khu vực mở rộng để kiểm tra giới hạn biên */
  async openExtendedLocationsDropdown() {
    const khacBtn = this.khacBtn();
    if (await khacBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await khacBtn.click({ force: true });
      await this.owner.sixthLocationBtn.waitFor({ state: 'attached', timeout: 3000 }).catch(() => null);
    }
  }

  /** Hoàn tất Bước 1: Vị trí công việc mong muốn */
  async completeStep1JobTitle(jobTitle = 'nhân viên bán hàng') {
    const o = this.owner;
    const input = o.dataTestId.first();
    await o.waitForElement(input, 15000);
    await o.capture('onboarding_01_job_title_before_input');
    await o.actions.click(input);
    await o.actions.fill(input, jobTitle);

    const suggestionItem = o.page.locator('div, li, span, p').filter({ hasText: new RegExp(`^${jobTitle}`, 'i') }).last();
    await suggestionItem.waitFor({ state: 'visible', timeout: 6000 }).catch(() => null);
    if (await suggestionItem.isVisible().catch(() => false)) {
      await o.actions.click(suggestionItem);
    }
    // Chụp sau khi input và chọn gợi ý (đồng thời là trước khi bấm nút Tiếp theo)
    await o.capture('onboarding_02_job_title_entered');

    if (await o.tiepTheoBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await o.actions.click(o.tiepTheoBtn);
    }
  }

  /** Hoàn tất Bước 2: Khu vực làm việc mong muốn */
  async completeStep2Locations(locations = ['TP.HCM']) {
    const o = this.owner;
    await o.waitForElement(o.chonToiDa5Text, 15000);
    await o.capture('onboarding_03_step2_locations_before_selection');
    for (const locName of locations) {
      const locBtn = o.getLocationBtn(locName);
      if (await locBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await o.actions.click(locBtn);
      }
    }
    await o.capture('onboarding_04_step2_locations_selected');
    await o.actions.click(o.tiepTheoBtn);
  }

  /** Hoàn tất Bước 3: Mức lương mong muốn */
  async completeStep3Salary(minSalary = '10', maxSalary = '15') {
    const o = this.owner;
    await o.capture('onboarding_05_salary_before_input');
    await o.waitForElement(o.salaryInputs.first(), 10000);
    if (await o.salaryInputs.count() >= 2) {
      await o.actions.fill(o.salaryInputs.nth(0), minSalary);
      await o.actions.fill(o.salaryInputs.nth(1), maxSalary);
    }
    await o.capture('onboarding_05_step3_salary_range_entered');
    await o.actions.click(o.hoanTatBtn);
  }

  /** Xác thực giao diện Personalized Page sau khi hoàn tất Onboarding mini */
  async verifyPersonalizedPageAfterOnboarding() {
    const o = this.owner;
    await o.waitForElement(o.finalPersonalizeHeading, 20000);
    await o.criteriaCard.waitFor({ state: 'visible', timeout: 10000 }).catch(() => null);
    await o.capture('onboarding_05_criteria_card_and_recommendations');
  }

  /** Mở trực tiếp Personalized Page và hoàn tất xác thực đến Bước 1 (Vị trí mong muốn) */
  async reachOnboardingStep1JobTitle(phone = null, otp = '1111', fullName = 'Hà Đinh') {
    const o = this.owner;
    await o.navigateToPersonalizedPage();
    await o.closeBannerIfVisible();
    await o.registerPhoneAndOtp(phone || generateRandomVNPhone(), otp);
    await o.enterFullNameAndAcceptConsent(fullName);
    await o.waitForElement(o.dataTestId.first(), 15000);
    await o.capture('onboarding_step1_job_title_ready');
  }

  /** Mở trực tiếp Personalized Page và đi tới Bước 2 (Khu vực làm việc) của Onboarding mini */
  async reachOnboardingStep2Locations(phone = null, otp = '1111', fullName = 'Hà Đinh') {
    const o = this.owner;
    await o.reachOnboardingStep1JobTitle(phone, otp, fullName);
    await o.completeStep1JobTitle('nhân viên bán hàng');
    await o.waitForElement(o.chonToiDa5Text, 15000);
    await o.capture('onboarding_step2_locations_ready');
  }

  /** Bấm một nút khu vực (bỏ chọn nếu đang chọn, chọn nếu chưa) */
  async toggleLocation(btnName, captureName, options = {}) {
    await this.owner.actions.click(this.owner.getLocationBtn(btnName));
    if (options.capture) {
      await this.owner.capture(captureName);
    }
  }
}

module.exports = { PersonalizeOnboardingHelper };
