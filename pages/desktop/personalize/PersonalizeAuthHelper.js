const { generateRandomVNPhone } = require('../../../core/utils/commonUtils');
const { PopupConsent } = require('../PopupConsent');

// Chụp bằng chứng OTP ngay lập tức, trước khi hệ thống tự submit và chuyển màn hình
const INSTANT_CAPTURE = {
  waitForNetworkIdle: false,
  waitForAnimations: false,
  waitForStability: false,
  waitForVisualLoading: false,
  waitForDomContentLoaded: false,
  waitForLoadState: false,
};

/**
 * Xác thực tài khoản (SĐT → OTP → Họ tên → Consent) trên Personalized Page.
 * Gọi chéo qua `this.owner` để MobilePersonalizePage vẫn override được từng bước.
 */
class PersonalizeAuthHelper {
  /** @param {import('../PersonalizePage').PersonalizePage} owner */
  constructor(owner) {
    this.owner = owner;
  }

  async registerAndAcceptConsentOnPersonalizedPage(phone, otp = '1111', fullName = 'Hà Đinh') {
    await this.owner.registerPhoneAndOtp(phone, otp);
    await this.owner.enterFullNameAndAcceptConsent(fullName);
  }

  /** Bước 1 Xác thực: Điền số điện thoại, yêu cầu OTP qua SMS và nhập mã OTP 4 chữ số */
  async registerPhoneAndOtp(phone, otp = '1111') {
    const o = this.owner;
    await o.waitForElement(o.nhapSoDienThoaiInput, 15000);
    await o.actions.fill(o.nhapSoDienThoaiInput, phone);
    await o.capture('auth_01_phone_entered');
    await o.otpRequest.clickRequestSmsOtp();

    const otpReady = o.pleaseEnterVerificationInput.or(o.page.locator('input[type="tel"]').first());
    await o.waitForElement(otpReady, 15000);
    await o.capture('auth_02_otp_before_input');
    await o.fillOtpDigits(otp, { captureStep: 'auth_03_otp_entered' });
  }

  /** Bước 2 Xác thực: Nhập Họ và tên và chấp thuận điều khoản xử lý dữ liệu cá nhân (Consent modal) */
  async enterFullNameAndAcceptConsent(fullName = 'Hà Đinh') {
    const o = this.owner;
    await o.waitForElement(o.fullNameInput, 10000);
    await o.capture('auth_04_fullname_before_input');
    await o.actions.fill(o.fullNameInput, fullName);
    await o.capture('auth_05_fullname_entered');
    await o.actions.click(o.hoanTatBtn);

    await o.waitForElement(o.consentAgreeBtn, 15000);
    await o.capture('auth_06_consent_modal_displayed');
    // "Đồng ý" khoá tới khi cuộn hết văn bản consent (thấy rõ trên WebKit)
    await new PopupConsent(o.page, o.featureName).scrollContentToEndIfDisabled();
    await o.actions.click(o.consentAgreeBtn, { force: true });
    await o.consentAgreeBtn.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => null);
  }

  /** Mở modal xác thực tài khoản từ khối việc làm dành riêng */
  async openPersonalizeAuthModal() {
    const o = this.owner;
    await o.closeBannerIfVisible();

    if (await o.nhapSoDienThoaiInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      return;
    }

    if (await o.xemViecLamDanhBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await o.actions.click(o.xemViecLamDanhBtn);
    } else if (await o.item10ViecLamCoLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await o.actions.click(o.item10ViecLamCoLink);
    } else {
      await o.item10ViecLamCoLink.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => null);
      if (await o.item10ViecLamCoLink.isVisible({ timeout: 2000 }).catch(() => false)) {
        await o.actions.click(o.item10ViecLamCoLink);
      } else {
        const headerLogin = o.page.locator('#btn-login-header, [class*="login-header"]').or(o.page.getByText(/Đăng ký\/Đăng nhập/i)).first();
        await o.actions.click(headerLogin, { force: true });
      }
    }

    await o.waitForElement(o.nhapSoDienThoaiInput, 15000);
  }

  /** Điền số điện thoại và yêu cầu OTP (SMS khi Zalo OTP bật, "Tiếp tục" khi tắt) */
  async fillPhoneAndContinue(phone) {
    const o = this.owner;
    await o.actions.fill(o.nhapSoDienThoaiInput, phone);
    await o.capture('phone_entered_in_personalize_flow');
    await o.otpRequest.clickRequestSmsOtp();
  }

  async captureInstant(stepName) {
    const helper = this.owner.screenshotHelper;
    if (stepName && helper) {
      await helper.takeScreenshot(stepName, false, INSTANT_CAPTURE).catch(() => null);
    }
  }

  /** Nhập mã OTP 4 chữ số vào form xác thực và chụp bằng chứng ngay sau khi nhập */
  async fillOtpDigits(otp = '1111', options = {}) {
    const o = this.owner;
    const digits = String(otp).split('');
    const telInputs = o.page.locator('input[type="tel"]:visible, input[maxlength="1"]:visible, input[aria-label*="Digit"]:visible');

    try {
      await o.waitForElement(o.pleaseEnterVerificationInput.or(telInputs.first()), 15000);
      if (await telInputs.count() >= 4) {
        for (let i = 0; i < 4; i++) {
          await o.actions.fill(telInputs.nth(i), digits[i] || '1');
        }
      } else {
        await o.actions.fill(o.pleaseEnterVerificationInput, digits[0] || '1');
        if (await o.digit2Input.isVisible({ timeout: 2000 }).catch(() => false)) {
          await o.actions.fill(o.digit2Input, digits[1] || '1');
          await o.actions.fill(o.digit3Input, digits[2] || '1');
          await o.actions.fill(o.digit4Input, digits[3] || '1');
        }
      }
    } catch (_) {
      // Fallback trực tiếp với các input tel nếu có
      await o.fillCodeInputs(o.page.locator('input[type="tel"]'), otp).catch(() => null);
    }
    await this.captureInstant(options.captureStep);
  }

  /** Xác thực tài khoản với số điện thoại và OTP, sau đó chấp thuận điều khoản */
  async loginOrRegisterWithOtp(phone = null, otp = '1111', fullName = 'Hà Đinh') {
    const o = this.owner;
    await o.actions.fill(o.nhapSoDienThoaiInput, phone || generateRandomVNPhone());
    await o.capture('phone_number_entered');
    await o.otpRequest.clickRequestSmsOtp();

    await o.fillOtpDigits(otp, { captureStep: 'otp_digits_filled' });

    // Form Họ và tên chỉ xuất hiện với tài khoản mới
    try {
      await o.waitForElement(o.nhapHoVaTenInput, 8000);
      await o.actions.click(o.nhapHoVaTenInput);
      await o.actions.fill(o.nhapHoVaTenInput, fullName);
      await o.capture('full_name_entered');
      await o.actions.click(o.hoanTatBtn);
    } catch (_) { /* tài khoản đã tồn tại: không có form Họ tên */ }

    // Modal chấp thuận điều khoản dữ liệu cá nhân (nếu có)
    try {
      await o.waitForElement(o.dongYBtn, 6000);
      await o.actions.click(o.dongYBtn);
      await o.capture('consent_agreed');
    } catch (_) { /* không có modal consent */ }
  }
}

module.exports = { PersonalizeAuthHelper };
