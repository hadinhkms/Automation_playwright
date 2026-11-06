const { expect } = require('@playwright/test');

/**
 * Yêu cầu OTP từ popup Đăng nhập/Đăng ký: kênh Zalo (mặc định, REQ-012), SMS qua "Phương thức khác",
 * hoặc nút "Tiếp tục" khi build tắt Zalo OTP (NEXT_PUBLIC_ZALO_OTP_ENABLED).
 * Được LoginPopup sở hữu; dùng chung page, actions và locator OTP/đăng ký của popup.
 */
class LoginOtpRequest {
  constructor(popup) {
    this.popup = popup;
    this.page = popup.page;
    this.actions = popup.actions;
    // Accessible name có ký tự icon font (svicon) ở đầu/cuối nên không dùng exact: true
    this.zaloOtpBtn = this.page.getByRole('button', { name: /Nhận OTP qua Zalo\s*$/ }).first();
    this.smsOtpBtn = this.page.getByRole('button', { name: /Nhận OTP qua SMS\s*$/ }).first();
    this.otherMethodsBtn = this.page.getByRole('button', { name: /^\s*Phương thức khác/ }).first();
    this.otpExpiryText = this.page.getByText(/Mã OTP hết hiệu lực trong/i).first();
    // Nút gửi chính của bước nhập SĐT, không phụ thuộc kênh: "Nhận OTP qua Zalo" (mặc định) hoặc "Tiếp tục" (Zalo tắt)
    this.requestOtpBtn = this.zaloOtpBtn.or(popup.continueBtn).first();
    // Nút bút chì cạnh SĐT trên màn "Xác thực OTP": quay lại bước nhập số
    this.editPhoneBtn = this.page.getByRole('button', { name: 'Sửa số điện thoại' });
  }

  /** Màn "Xác thực OTP" hiển thị đúng SĐT vừa yêu cầu (dạng "SMS số <strong>phone</strong>"). */
  async expectOtpScreenForPhone(phone) {
    await this.popup.waitForOtpVisible();
    await expect(this.page.getByText(phone, { exact: true })).toBeVisible();
  }

  /** Từ màn OTP quay lại bước nhập SĐT (không phải đóng/mở lại popup). */
  async backToPhoneStep() {
    if (await this.editPhoneBtn.isVisible().catch(() => false)) {
      await this.actions.click(this.editPhoneBtn);
    }
    await this.popup.phoneInput.waitFor({ state: 'visible', timeout: 10000 });
  }

  /** Bấm yêu cầu OTP qua SMS nhưng không chờ màn OTP (dùng cho case số đã tồn tại / bị chặn). */
  async clickRequestSmsOtp() {
    if (await this.isZaloOtpEnabled()) return this.clickReceiveOtpViaSms();
    return this.popup.clickContinue();
  }

  async isZaloOtpEnabled(timeout = 5000) {
    return this.zaloOtpBtn.waitFor({ state: 'visible', timeout }).then(() => true, () => false);
  }

  async expectZaloIsDefaultChannel() {
    await expect(this.zaloOtpBtn).toBeVisible();
    await expect(this.zaloOtpBtn).toBeEnabled();
    await expect(this.otherMethodsBtn).toHaveAttribute('aria-expanded', 'false');
    await expect(this.smsOtpBtn).toBeHidden();
  }

  async clickReceiveOtpViaZalo() {
    return this.actions.click(this.zaloOtpBtn);
  }

  async expandOtherMethods() {
    if ((await this.otherMethodsBtn.getAttribute('aria-expanded')) !== 'true') {
      await this.actions.click(this.otherMethodsBtn);
    }
    await expect(this.otherMethodsBtn).toHaveAttribute('aria-expanded', 'true');
  }

  async clickReceiveOtpViaSms() {
    await this.expandOtherMethods();
    await expect(this.smsOtpBtn).toBeEnabled();
    return this.actions.click(this.smsOtpBtn);
  }

  /**
   * Yêu cầu OTP qua SMS cho số đã nhập: khi Zalo OTP bật thì mở "Phương thức khác" → "Nhận OTP qua SMS";
   * khi Zalo OTP tắt (kill switch) thì dùng nút "Tiếp tục" như luồng cũ.
   */
  async requestSmsOtp(options = {}) {
    if (await this.isZaloOtpEnabled()) {
      await this.clickReceiveOtpViaSms();
      await this.waitForOtpOrRetryAfterCooldown();
      return 'sms';
    }
    await this.clickContinueUntilOtpVisible(options);
    return 'continue';
  }

  /**
   * QC chặn gửi lại OTP cho cùng SĐT trong ~2 phút ("Yêu cầu đã tồn tại. Vui lòng thử lại sau m:ss", nút OTP bị khoá)
   * → chờ nút SMS mở lại rồi gửi lại. Chờ đúng ô nhập mã OTP: otpModalTitle cũng khớp chữ "OTP" của nút gửi.
   */
  async waitForOtpOrRetryAfterCooldown() {
    const otpCodeInput = this.page.locator('input[autocomplete="one-time-code"], input[aria-label*="verification code" i]').first();
    const cooldownMsg = this.page.getByText(/Vui lòng thử lại sau/i).first();
    await otpCodeInput.or(cooldownMsg).first().waitFor({ state: 'visible', timeout: 30000 });
    if (await otpCodeInput.isVisible()) return;
    await expect(this.smsOtpBtn).toBeEnabled({ timeout: 180000 });
    await this.actions.click(this.smsOtpBtn);
    await otpCodeInput.waitFor({ state: 'visible', timeout: 30000 });
  }

  /** Sau khi số chưa có tài khoản: form Đăng ký hiện và ô SĐT điền sẵn số vừa nhập. */
  async expectRegisterPhonePrefilled(phone) {
    await this.popup.waitForRegisterFormVisible();
    await expect(this.popup.registerPhoneInput).toHaveValue(phone);
  }

  async expectOtpScreenForChannel(channel, phone) {
    await this.popup.waitForOtpVisible();
    await expect(this.page.getByText(new RegExp(`${channel}[\\s\\S]*${phone}`)).first()).toBeVisible();
    await expect(this.otpExpiryText).toBeVisible();
  }

  async clickContinueUntilOtpVisible(options = {}) {
    const {
      maxAttempts = 3,
      otpTimeout = 10000,
      loadingTimeout = 15000,
    } = options;
    const popup = this.popup;

    let lastOtpError;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await this.actions.waitForVisible(popup.continueBtn, { timeout: 5000 });
      await popup.clickContinue({ timeout: 15000 });

      try {
        await popup.waitForOtpVisible({ timeout: otpTimeout });
        return;
      } catch (error) {
        lastOtpError = error;
      }

      if (await popup.isRegisterFormVisible(1000)) {
        throw new Error('Login precondition account was not found; register form appeared instead of OTP screen.');
      }

      await popup.waitForGlobalLoadingHidden(loadingTimeout);

      let canRetry = false;
      try {
        canRetry = await popup.continueBtn.isVisible();
      } catch (error) {
        canRetry = false;
      }

      if (!canRetry || attempt === maxAttempts) {
        break;
      }

      console.warn(`OTP screen did not appear after Continue attempt ${attempt}; retrying.`);
    }

    throw new Error(
      `OTP screen did not appear after clicking Continue ${maxAttempts} time(s). ` +
      `Last wait error: ${lastOtpError?.message || 'unknown'}`
    );
  }
}

// Các method LoginPopup ủy quyền sang đây (giữ nguyên tên gọi cũ trong spec / page object)
LoginOtpRequest.DELEGATED_METHODS = [
  'isZaloOtpEnabled', 'expectZaloIsDefaultChannel', 'clickReceiveOtpViaZalo', 'expandOtherMethods',
  'clickReceiveOtpViaSms', 'requestSmsOtp', 'expectOtpScreenForChannel', 'clickContinueUntilOtpVisible',
  'expectRegisterPhonePrefilled', 'clickRequestSmsOtp', 'backToPhoneStep', 'expectOtpScreenForPhone',
];

module.exports = { LoginOtpRequest };
