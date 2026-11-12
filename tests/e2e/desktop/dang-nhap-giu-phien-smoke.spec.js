const { test } = require('../../../core/fixtures/baseTest');
const { OnboardingPopup } = require('../../../pages/desktop/OnboardingPopup');

test.describe('Feature: Đăng nhập, giữ phiên và đăng xuất @auth @login @desktop @e2e @smoke @smoke-desktop', () => {
  test.describe.configure({ timeout: 240000 });

  test('SMK-01 Đăng nhập bằng số điện thoại + OTP, giữ phiên sau khi tải lại trang, mở được trang Quản lý tài khoản và đăng xuất', async ({
    page,
    authenticatedUser,
    homePage,
  }, testInfo) => {
    const onboardingPopup = new OnboardingPopup(page);
    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Tài khoản người tìm việc đã đăng ký; đăng nhập qua giao diện bằng số điện thoại và OTP SMS',
    });

    await test.step('Given Người dùng đã đăng nhập bằng số điện thoại và OTP', async () => {
      await onboardingPopup.closeIfVisible(undefined, { modalTimeout: 15000 });
      await homePage.closeBlockingModalIfVisible();
      await homePage.expectHomepageVisible();
    });

    await test.step('Then Header hiển thị menu tài khoản thay cho nút Đăng ký/Đăng nhập', async () => {
      await homePage.expectLoggedIn();
      await homePage.capture('logged_in_header', false);
    });

    await test.step('When Tôi tải lại trang', async () => {
      await homePage.reloadPage();
      await onboardingPopup.closeIfVisible(undefined, { modalTimeout: 10000 });
    });

    await test.step('Then Phiên đăng nhập được giữ nguyên', async () => {
      await homePage.expectLoggedIn();
    });

    await test.step('When Tôi mở Quản lý tài khoản từ menu tài khoản', async () => {
      await homePage.closeBlockingModalIfVisible();
      await homePage.openAccountManagement();
    });

    await test.step('Then Trang Quản lý tài khoản (yêu cầu đăng nhập) mở được và vẫn giữ phiên', async () => {
      await homePage.expectAccountManagementVisible();
      await homePage.capture('account_management_opened', false);
    });

    await test.step('When Tôi mở trang Hồ sơ của tôi và đăng xuất', async () => {
      await homePage.openMyProfile();
      await homePage.logoutFromMyProfile();
    });

    await test.step('Then Tôi về trạng thái khách: header hiển thị nút Đăng ký/Đăng nhập', async () => {
      await homePage.expectLoggedOut();
      await homePage.capture('logged_out_header', false);
    });

    await test.step('And Trang Hồ sơ của tôi yêu cầu đăng nhập lại', async () => {
      await homePage.openMyProfile();
      await homePage.expectMyProfileRequiresLogin();
    });
  });
});
