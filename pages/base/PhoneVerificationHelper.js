/**
 * Luồng xác thực số điện thoại sau khi ứng tuyển: locator, bước SĐT, gửi OTP.
 * Được BasePage sở hữu; dùng page/actions/screenshotHelper của owner (giữ nguyên API public của BasePage).
 */
class PhoneVerificationHelper {
  /** @param {import('../BasePage').BasePage} owner */
  constructor(owner) {
    this.owner = owner;
  }

  getPhoneVerificationLocators() {
    return {
      title: this.owner.page.getByText(/Xác thực số điện thoại|Xác thực OTP|Mã OTP/i).first(),
      phoneInput: this.owner.page.getByRole('textbox', { name: /Số điện thoại|Nhập số điện thoại/i }).first(),
      codeInputs: this.owner.page.locator(
        [
          'input[maxlength="1"]:visible',
          'input[autocomplete="one-time-code"]:visible',
          'input[aria-label*="Digit"]:visible',
          'input[name*="otp"]:visible',
          'input[id*="otp"]:visible',
        ].join(', ')
      ),
      telCodeInputs: this.owner.page.locator('input[type="tel"]:visible'),
      codeTextboxes: this.owner.page.getByRole('textbox', { name: /Digit|Please enter verification|OTP|Mã xác thực/i }),
      submitButton: this.owner.page.getByRole('button', { name: /Xác thực|Xác nhận|Tiếp tục|Hoàn tất/i }).first(),
    };
  }

  async handlePhoneVerificationAfterApplyIfVisible(otpCode) {
    const locators = this.owner.getPhoneVerificationLocators();

    try {
      await locators.title.waitFor({ state: 'visible', timeout: 5000 });
    } catch {
      return false;
    }

    await this.owner.capture('phone_verification_visible');

    if (!otpCode) {
      throw new Error('Phone verification appeared after clicking apply, but no otpCode was provided.');
    }

    await this.owner.continuePhoneVerificationPhoneStepIfNeeded(locators);
    await this.owner.capture('phone_verification_code_step');
    await this.owner.fillPhoneVerificationCode(locators, otpCode);
    await this.owner.clickPhoneVerificationSubmitIfVisible(locators);
    await this.owner.waitForGlobalLoadingHidden(15000);
    return true;
  }

  async continuePhoneVerificationPhoneStepIfNeeded(locators, options = {}) {
    const {
      maxAttempts = 3,
      codeStepTimeout = 10000,
      loadingTimeout = 15000,
    } = options;

    if (await this.owner.isPhoneVerificationCodeInputVisible(locators, 1500)) {
      return false;
    }

    let lastCodeStepError;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const hasPhoneStep = await this.owner.isPhoneVerificationPhoneStepVisible(locators, 1500);
      const hasContinueButton = await this.owner.isPhoneVerificationSubmitVisible(locators, 1500);

      if (!hasPhoneStep && !hasContinueButton) {
        break;
      }

      await this.owner.clickElement(locators.submitButton, { timeout: 15000 });

      try {
        await this.owner.waitForPhoneVerificationCodeStepVisible(locators, codeStepTimeout);
        return true;
      } catch (error) {
        lastCodeStepError = error;
      }

      await this.owner.waitForGlobalLoadingHidden(loadingTimeout);

      const canRetry = await this.owner.isPhoneVerificationSubmitVisible(locators, 1500);
      if (!canRetry || attempt === maxAttempts) {
        break;
      }

      console.warn(`Phone verification code step did not appear after Continue attempt ${attempt}; retrying.`);
    }

    throw new Error(
      `Phone verification code step did not appear after clicking Continue ${maxAttempts} time(s). ` +
      `Last wait error: ${lastCodeStepError?.message || 'unknown'}`
    );
  }

  async submitPhoneVerificationOtp(otpCode, options = {}) {
    if (!otpCode) {
      throw new Error('OTP code is required to complete phone verification.');
    }

    const {
      codeStepTimeout = 15000,
      loadingTimeout = 15000,
      confirmButton,
    } = options;
    const locators = this.owner.getPhoneVerificationLocators();

    await this.owner.waitForPhoneVerificationCodeStepVisible(locators, codeStepTimeout);
    await this.owner.fillPhoneVerificationCode(locators, otpCode);

    if (confirmButton) {
      await this.owner.clickElement(confirmButton);
      await this.owner.waitForGlobalLoadingHidden(loadingTimeout);
    }
  }

  async clickPhoneVerificationSubmitIfVisible(locators) {
    try {
      await locators.submitButton.waitFor({ state: 'visible', timeout: 5000 });
    } catch {
      return false;
    }

    await this.owner.clickElement(locators.submitButton);
    return true;
  }
}

module.exports = { PhoneVerificationHelper };
