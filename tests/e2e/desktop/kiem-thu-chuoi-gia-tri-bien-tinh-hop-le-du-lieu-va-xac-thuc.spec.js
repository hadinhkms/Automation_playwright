const { test, expect } = require('../../../core/fixtures/baseTest');
const userData = require('../../../data/users.json');
const { generateRandomVNPhone } = require('../../../core/utils/commonUtils');
const { LoginPopup } = require('../../../pages/desktop/LoginPopup');
const { PopupConsent } = require('../../../pages/desktop/PopupConsent');
const { createRegisteredUserForPrecondition } = require('../../../core/utils/authSetup');

test.describe('Feature: Đăng ký tài khoản người tìm việc - Kiểm thử chuỗi giá trị biên @guest @no-auth @register @desktop @e2e @REQ-001', () => {
  test('TC-040 - AC-001 AC-002: Kiểm thử chuỗi giá trị biên, tính hợp lệ dữ liệu và xác thực đăng ký tài khoản', async ({ page, pages }, testInfo) => {
    const homePage = pages.homePage;
    const loginPopup = new LoginPopup(page);
    const popupConsent = new PopupConsent(page);
    // 4 bước đăng ký + 2 lần gửi OTP: chạy đơn ~170s trên QC, chạy song song dễ vượt 180s.
    test.setTimeout(300000);

    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Chưa đăng nhập, đang ở trang chủ hoặc popup Đăng ký tài khoản',
    });

    const invalidPhone = '0912abcXYZ';
    // SĐT đã tồn tại: tạo mới qua API mỗi lần chạy vì QC giới hạn 5 lần gửi OTP/ngày/SĐT
    // (số cố định 0988888888 dùng chung sẽ hết lượt và báo "Bạn đã yêu cầu nhận OTP quá 5 lần/ngày").
    const existingUser = await createRegisteredUserForPrecondition();
    const existingPhone = existingUser?.phone || '0988888888';
    const testOtpCode = '1111';
    const randomValidPhone = generateRandomVNPhone();
    const user = userData[0] || {};
    const testFullName = user.fullName || 'Automation Tester';

    await test.step('Given Tiền điều kiện: Chưa đăng nhập, đang ở trang chủ hoặc popup Đăng ký tài khoản', async () => {
      await homePage.navigate();
      await homePage.expectHomepageVisible();
      await homePage.closeAdsIfVisible().catch(() => null);
      await homePage.closeBlockingModalIfVisible().catch(() => null);
      await homePage.capture('precondition_homepage_ready');

      await loginPopup.clickLoginHeader();
      await loginPopup.waitForModalVisible();
      await expect(loginPopup.phoneInput).toBeVisible();
      await loginPopup.capture('login_modal_opened');
    });

    await test.step('When [1] Mở popup Đăng ký/Đăng nhập, nhập số điện thoại sai định dạng 0912abcXYZ', async () => {
      await loginPopup.fillPhone(invalidPhone);
      await loginPopup.capture('invalid_phone_filled');
      if (await loginPopup.requestOtpBtn.isEnabled()) {
        await loginPopup.actions.click(loginPopup.requestOtpBtn).catch(() => null);
      }
    });

    await test.step('Then [1] Hệ thống báo lỗi "Số điện thoại không hợp lệ" hoặc vô hiệu hóa nút gửi OTP', async () => {
      const isErrorVisible = await loginPopup.phoneError.isVisible({ timeout: 3000 }).catch(() => false);
      const isContinueDisabled = !(await loginPopup.requestOtpBtn.isEnabled().catch(() => true));
      expect(isErrorVisible || isContinueDisabled).toBeTruthy();
      await loginPopup.capture('invalid_phone_rejected');
    });

    await test.step('When [2] Nhập số điện thoại đã tồn tại trong hệ thống và yêu cầu OTP', async () => {
      await loginPopup.clearPhone();
      await loginPopup.fillPhone(existingPhone);
      await loginPopup.capture('existing_phone_filled');
      await loginPopup.clickRequestSmsOtp();
    });

    // Hành vi quan sát trên QC 2026-11-06 (popup gộp Đăng nhập/Đăng ký) — chờ PO xác nhận, xem TC-040
    await test.step('Then [2] Popup chuyển sang màn Xác thực OTP cho đúng số đã tồn tại (luồng đăng nhập), không mở form Tạo tài khoản mới', async () => {
      await loginPopup.expectOtpScreenForPhone(existingPhone);
      await expect(loginPopup.registerFormTitle).toBeHidden();
      await loginPopup.capture('existing_phone_routed_to_login_otp');
    });

    await test.step('When [3] Bấm Sửa số điện thoại, nhập số điện thoại mới hợp lệ và yêu cầu OTP', async () => {
      // SĐT đã tồn tại ở bước [2] đưa popup sang màn "Xác thực OTP" (luồng đăng nhập) → quay lại bước nhập số
      await loginPopup.backToPhoneStep();
      await loginPopup.clearPhone();
      await loginPopup.fillPhone(randomValidPhone);
      await loginPopup.capture('valid_phone_entered');
      await loginPopup.requestSmsOtp({ maxAttempts: 3 }); // Zalo OTP mặc định: OTP cố định 1111 của QC chỉ áp dụng kênh SMS
      await expect(loginPopup.otpModalTitle.or(loginPopup.otpInputs.first()).first()).toBeVisible();
      await loginPopup.capture('otp_screen_transition_ready');
    });

    await test.step('When [4] Nhập mã OTP "1111", điền Họ tên, để trống Email (tùy chọn) và bấm Hoàn tất', async () => {
      await loginPopup.waitForOtpVisible();
      await loginPopup.fillOtpCode(testOtpCode);
      await loginPopup.capture('otp_code_filled');

      await loginPopup.waitForRegisterFormVisible();
      await loginPopup.fillName(testFullName);
      await loginPopup.clearRegisterPhone().catch(() => null);
      // AC-002 (Confirmed): form SĐT không có mật khẩu; Email là trường tùy chọn nên để trống
      await expect(loginPopup.passwordInput).toBeHidden();
      await loginPopup.capture('register_form_filled_email_empty');

      await expect(loginPopup.submitBtn).toBeVisible();
      await loginPopup.clickSubmit();
    });

    await test.step('Then [4] Hoàn tất tạo tài khoản thành công, người dùng được cấp phiên đăng nhập', async () => {
      await popupConsent.waitForConsentOrHomepageReady(homePage);
      await popupConsent.agreeIfVisible().catch(() => null);
      await homePage.expectHomepageContentLoaded();
      // Chỉ menu tài khoản chứng minh đã có phiên đăng nhập (logo luôn hiện → .or(logo) vô nghĩa và vi phạm strict mode)
      await expect(homePage.accountMenuButton).toBeVisible({ timeout: 15000 });
      await homePage.capture('registration_completed_successfully');
    });
  });
});
