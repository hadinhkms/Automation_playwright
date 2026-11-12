const { test, expect } = require('../../../core/fixtures/baseTest');
const userData = require('../../../data/users.json');
const { generateRandomVNPhone, generateRandomEmail } = require('../../../core/utils/commonUtils');
const { mockZaloOtpBackend } = require('../../../core/utils/zaloOtpMock');
const { LoginPopup } = require('../../../pages/desktop/LoginPopup');
const { PopupConsent } = require('../../../pages/desktop/PopupConsent');

test.describe('Feature: Xác thực OTP qua Zalo (mặc định) và SMS khi đăng ký bằng Số điện thoại @guest @no-auth @register @desktop @e2e @REQ-012 @regression', () => {
  async function openLoginPopupFromHomepage(homePage, loginPopup) {
    await homePage.navigate();
    await homePage.expectHomepageVisible();
    try {
      await homePage.closeAdsIfVisible();
      await homePage.closeBlockingModalIfVisible();
    } catch (e) {
      await homePage.capture('no_popup_found');
    }
    await loginPopup.clickLoginHeader();
    await loginPopup.waitForModalVisible();
  }

  test('TC-150 - AC-050 Nhận OTP qua Zalo mặc định, xác thực thành công và chuyển sang form tạo tài khoản', async ({ page, pages }, testInfo) => {
    const homePage = pages.homePage;
    const loginPopup = new LoginPopup(page);
    test.setTimeout(180000);

    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Chưa đăng nhập; build bật Zalo OTP. BE Zalo được mock theo contract (số ngẫu nhiên không có Zalo, QC không có mã Zalo cố định).',
    });

    const randomPhone = generateRandomVNPhone();
    let zaloMock;

    await test.step('Given Tôi là khách vãng lai đã mở popup "Đăng nhập hoặc Đăng ký" từ trang chủ', async () => {
      await openLoginPopupFromHomepage(homePage, loginPopup);
      test.skip(!(await loginPopup.isZaloOtpEnabled()), 'Zalo OTP đang tắt trên môi trường này (kill switch) — luồng SMS đã phủ ở TC-152');
      zaloMock = await mockZaloOtpBackend(page);
      await loginPopup.capture('after_login_modal_opened');
    });

    await test.step('Then Nút "Nhận OTP qua Zalo" là lựa chọn chính và "Phương thức khác" đang thu gọn', async () => {
      await loginPopup.expectZaloIsDefaultChannel();
    });

    await test.step('When Tôi nhập số điện thoại mới và bấm "Nhận OTP qua Zalo"', async () => {
      await loginPopup.fillPhone(randomPhone);
      await loginPopup.clickReceiveOtpViaZalo();
    });

    await test.step('Then Màn nhập OTP hiển thị kênh Zalo, số điện thoại vừa nhập và thời gian hiệu lực', async () => {
      await loginPopup.expectOtpScreenForChannel('Zalo', randomPhone);
      expect(zaloMock.calls.otpRequests).toHaveLength(1);
      expect(zaloMock.calls.otpRequests[0]).toMatchObject({ phone: randomPhone, channel: 'zalo', platform: 'web' });
      await loginPopup.capture('after_zalo_otp_screen');
    });

    await test.step('When Tôi nhập đủ 4 số OTP nhận qua Zalo', async () => {
      await loginPopup.fillOtpCode('1111');
    });

    await test.step('Then FE xác thực đúng request_id và chuyển sang form "Tạo tài khoản mới" với SĐT đã điền sẵn', async () => {
      await loginPopup.expectRegisterPhonePrefilled(randomPhone);
      expect(zaloMock.calls.verifyRequests).toHaveLength(1);
      expect(zaloMock.calls.verifyRequests[0]).toMatchObject({
        phone: randomPhone,
        code: '1111',
        request_id: zaloMock.requestId,
      });
      await loginPopup.capture('after_register_form_opened');
    });
  });

  test('TC-152 - AC-051 Đăng ký bằng SĐT với OTP qua SMS (Phương thức khác hoặc Tiếp tục khi tắt Zalo)', async ({ page, pages }, testInfo) => {
    const homePage = pages.homePage;
    const loginPopup = new LoginPopup(page);
    const popupConsent = new PopupConsent(page);
    test.setTimeout(180000);

    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Chưa đăng nhập; BE thật, OTP cố định của môi trường test là 1111',
    });

    const randomPhone = generateRandomVNPhone();
    const randomEmail = generateRandomEmail();

    await test.step('Given Tôi là khách vãng lai đã mở popup "Đăng nhập hoặc Đăng ký" từ trang chủ', async () => {
      await openLoginPopupFromHomepage(homePage, loginPopup);
      await loginPopup.capture('after_login_modal_opened');
    });

    await test.step('When Tôi nhập số điện thoại mới và yêu cầu OTP qua SMS', async () => {
      await loginPopup.fillPhone(randomPhone);
      const path = await loginPopup.requestSmsOtp({ maxAttempts: 3 });
      testInfo.annotations.push({ type: 'SMS entry', description: path === 'sms' ? 'Phương thức khác → Nhận OTP qua SMS' : 'Tiếp tục (Zalo OTP tắt)' });
    });

    await test.step('And Tôi nhập mã OTP của môi trường test', async () => {
      await loginPopup.waitForOtpVisible();
      await loginPopup.capture('before_fill_otp');
      await loginPopup.fillOtpCode('1111');
    });

    await test.step('Then Form "Tạo tài khoản mới" xuất hiện', async () => {
      await loginPopup.waitForRegisterFormVisible();
      await loginPopup.capture('after_register_form_opened');
    });

    await test.step('When Tôi điền họ tên, email và bấm Hoàn tất', async () => {
      const user = userData[0];
      await loginPopup.fillName(user.fullName || 'Automation Tester');
      await loginPopup.fillRegisterEmail(randomEmail);
      await expect(loginPopup.submitBtn).toBeVisible();
      await loginPopup.clickSubmit();
      await popupConsent.waitForConsentOrHomepageReady(homePage);
    });

    await test.step('Then Tôi đồng ý Consent và nội dung trang chủ được tải', async () => {
      await popupConsent.agreeIfVisible();
      await homePage.expectHomepageContentLoaded();
      await popupConsent.capture('after_agree_consent_successfully');
    });
  });
});
