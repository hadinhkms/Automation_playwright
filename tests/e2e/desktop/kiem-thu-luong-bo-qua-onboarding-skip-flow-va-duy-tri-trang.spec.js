const { test, expect } = require('../../../core/fixtures/baseTest');
const { OnboardingPopup } = require('../../../pages/desktop/OnboardingPopup');
const { LoginPopup } = require('../../../pages/desktop/LoginPopup');

test.describe('Feature: Onboarding tiêu chí tìm việc sau khi đăng nhập @auth @onboarding @desktop @e2e @REQ-002', () => {
  test('TC-041 - AC-005: Kiểm thử luồng Bỏ qua Onboarding (Skip flow) và hiển thị lại Onboarding khi đăng nhập lại mà tiêu chí còn thiếu', async ({ page, pages, authenticatedUser }, testInfo) => {
    const homePage = pages.homePage;
    const onboardingPopup = new OnboardingPopup(page);
    const loginPopup = new LoginPopup(page);
    test.setTimeout(240000);

    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Tài khoản người dùng mới tạo chưa từng onboarding, đang ở màn hình trang chủ sau khi đăng nhập lần đầu',
    });

    await test.step('Given Tiền điều kiện: Tài khoản người dùng mới tạo chưa từng onboarding, đang ở màn hình trang chủ sau khi đăng nhập lần đầu', async () => {
      // Fixture authenticatedUser tự động tạo tài khoản kiểm thử cô lập và thực hiện đăng nhập lần đầu
      // Sau khi đăng xuất, popup guest "Khoan đã…" bật sau ~30s và che nút Đăng nhập
      await homePage.registerGuestPopupAutoHandlers();
      await homePage.expectHomepageVisible();
      await homePage.capture('precondition_first_login_homepage_ready');
    });

    await test.step('When [1] Đăng nhập tài khoản mới vào hệ thống', async () => {
      // Khẳng định sau phiên đăng nhập đầu tiên, màn hình Onboarding hiển thị
      await expect(onboardingPopup.locationInput.or(onboardingPopup.step1Title).first()).toBeVisible({ timeout: 30000 });
      await onboardingPopup.capture('onboarding_modal_step1_displayed');
    });

    await test.step('Then [1] Modal Onboarding hiển thị tại Bước 1 kèm nút "Bỏ qua" (Skip)', async () => {
      await expect(onboardingPopup.step1Title.or(onboardingPopup.locationInput).first()).toBeVisible();
      await expect(onboardingPopup.skipBtn.or(onboardingPopup.closeBtn).first()).toBeVisible();
      await onboardingPopup.capture('onboarding_step1_with_skip_btn_verified');
    });

    await test.step('When [2] Nhấn nút "Bỏ qua" (Skip) trên modal Onboarding', async () => {
      await onboardingPopup.clickSkip();
      await onboardingPopup.capture('skip_onboarding_clicked');
    });

    await test.step('Then [2] Modal đóng lại ngay lập tức, overlay biến mất, người dùng truy cập trang chủ bình thường', async () => {
      await expect(onboardingPopup.modal).toBeHidden({ timeout: 15000 });
      await homePage.expectHomepageVisible();
      await expect(homePage.accountMenuButton.or(homePage.logo).first()).toBeVisible();
      await homePage.capture('homepage_accessible_after_skip', false); // fullPage capture mở lại onboarding vừa đóng
    });

    await test.step('When [3] Thực hiện Đăng xuất khỏi hệ thống', async () => {
      await homePage.logout();
      await homePage.capture('after_logout_invoked');
    });

    await test.step('Then [3] Đăng xuất thành công, chuyển hướng về trang Đăng nhập', async () => {
      await expect(loginPopup.loginHeaderBtn.or(loginPopup.modalTitle).or(loginPopup.phoneInput)).toBeVisible({ timeout: 15000 });
      await homePage.capture('logout_successfully_verified');
    });

    await test.step('When [4] Đăng nhập lại với tài khoản vừa thao tác', async () => {
      if (!(await loginPopup.phoneInput.isVisible().catch(() => false))) {
        // Sau đăng xuất, banner quảng cáo trang chủ che nút "Đăng ký/Đăng nhập" ở header
        await homePage.closeAllPopupsIfVisible();
        await loginPopup.clickLoginHeader();
        await loginPopup.waitForModalVisible();
      }
      const userPhone = authenticatedUser.phone || authenticatedUser.username;
      const userEmail = authenticatedUser.email;
      if (userPhone) {
        await loginPopup.fillPhone(userPhone);
        // Zalo OTP mặc định: OTP cố định 1111 của QC chỉ áp dụng kênh SMS (không còn mật khẩu)
        await loginPopup.requestSmsOtp({ maxAttempts: 3 });
        await loginPopup.fillOtpCode(authenticatedUser.otp || '1111');
      } else if (userEmail) {
        await loginPopup.clickEmailLoginOption().catch(() => null);
        await loginPopup.fillEmail(userEmail);
        await loginPopup.clickContinue();
        if (await loginPopup.loginPasswordInput.isVisible({ timeout: 5000 }).catch(() => false)) {
          await loginPopup.loginPasswordInput.fill(authenticatedUser.password || 'Test@1234');
          await loginPopup.clickSubmit();
        } else if (await loginPopup.otpInputs.first().isVisible({ timeout: 5000 }).catch(() => false)) {
          await loginPopup.fillOtpCode(authenticatedUser.otp || '1111');
        }
      }
      await homePage.capture('re_login_submitted', false);
    });

    await test.step('Then [4] Đăng nhập thành công; tiêu chí tìm việc còn thiếu (đã Bỏ qua) nên Onboarding hiển thị lại từ Bước 1, vẫn bỏ qua được', async () => {
      // Môi trường test cấu hình Onboarding hiện lại nhiều lần/ngày khi tiêu chí tìm việc còn thiếu (PO xác nhận 2026-11-06)
      await homePage.expectHomepageVisible();
      await expect(homePage.accountMenuButton.or(homePage.logo).first()).toBeVisible();
      await expect(onboardingPopup.step1Title.or(onboardingPopup.locationInput).first()).toBeVisible({ timeout: 30000 });
      await expect(onboardingPopup.skipBtn.or(onboardingPopup.closeBtn).first()).toBeVisible();
      await onboardingPopup.capture('onboarding_reappeared_because_criteria_missing');
      await onboardingPopup.clickSkip();
      await expect(onboardingPopup.modal).toBeHidden({ timeout: 15000 });
      await homePage.capture('onboarding_skipped_again_homepage_accessible', false);
    });
  });
});
