/**
 * Nhận diện các bước của form xác thực SĐT và điền mã OTP theo nhiều dạng ô nhập.
 * Được BasePage sở hữu; dùng page/actions/screenshotHelper của owner (giữ nguyên API public của BasePage).
 */
class PhoneVerificationStepHelper {
  /** @param {import('../BasePage').BasePage} owner */
  constructor(owner) {
    this.owner = owner;
  }

  async isPhoneVerificationPhoneStepVisible(locators, timeout = 5000) {
    try {
      await locators.phoneInput.waitFor({ state: 'visible', timeout });
      return true;
    } catch {
      try {
        await locators.telCodeInputs.first().waitFor({ state: 'visible', timeout });
        return (await locators.telCodeInputs.count()) === 1;
      } catch {
        return false;
      }
    }
  }

  async isPhoneVerificationCodeInputVisible(locators, timeout = 5000) {
    try {
      await locators.codeTextboxes.first().waitFor({ state: 'visible', timeout });
      return true;
    } catch {
      try {
        await locators.codeInputs.first().waitFor({ state: 'visible', timeout });
        return true;
      } catch {
        try {
          await locators.telCodeInputs.first().waitFor({ state: 'visible', timeout });
          return (await locators.telCodeInputs.count()) > 1;
        } catch {
          return false;
        }
      }
    }
  }

  async isPhoneVerificationSubmitVisible(locators, timeout = 5000) {
    try {
      await locators.submitButton.waitFor({ state: 'visible', timeout });
      return true;
    } catch {
      return false;
    }
  }

  async waitForPhoneVerificationCodeStepVisible(locators, timeout = 10000) {
    try {
      await locators.codeTextboxes.first().waitFor({ state: 'visible', timeout });
      return;
    } catch {
      // Try the next supported OTP locator shape.
    }

    try {
      await locators.codeInputs.first().waitFor({ state: 'visible', timeout });
      return;
    } catch {
      // Try grouped tel inputs as a final OTP fallback.
    }

    await locators.telCodeInputs.first().waitFor({ state: 'visible', timeout });
    const telInputCount = await locators.telCodeInputs.count();
    if (telInputCount <= 1) {
      throw new Error('Phone verification code step was not visible after continuing phone verification.');
    }
  }

  async fillPhoneVerificationCode(locators, otpCode) {
    try {
      await locators.codeTextboxes.first().waitFor({ state: 'visible', timeout: 10000 });
      await this.owner.fillCodeInputs(locators.codeTextboxes, otpCode);
      return;
    } catch {
      // Try the next supported OTP locator shape.
    }

    try {
      await locators.codeInputs.first().waitFor({ state: 'visible', timeout: 10000 });
      await this.owner.fillCodeInputs(locators.codeInputs, otpCode);
      return;
    } catch {
      // Try grouped tel inputs as a final OTP fallback.
    }

    await locators.telCodeInputs.first().waitFor({ state: 'visible', timeout: 10000 });
    const telInputCount = await locators.telCodeInputs.count();
    if (telInputCount <= 1) {
      throw new Error('Phone verification OTP inputs were not visible after continuing phone verification.');
    }

    await this.owner.fillCodeInputs(locators.telCodeInputs, otpCode);
  }
}

module.exports = { PhoneVerificationStepHelper };
