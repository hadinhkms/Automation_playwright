/**
 * tests/e2e/desktop/saucedemo_login.spec.js
 * Kịch bản kiểm thử E2E thực tế trên trang SauceDemo (https://www.saucedemo.com)
 * Sử dụng Test Data thật từ data/saucedemo_users.json kết hợp Page Object Model và BDD.
 */
const { test, expect } = require('../../../core/fixtures/baseTest');
const SauceDemoLoginPage = require('../../../pages/desktop/SauceDemoLoginPage');
const testData = require('../../../data/saucedemo_users.json');

test.describe('Kiểm thử Xác thực Người dùng SauceDemo (E2E Real Web Suite) @e2e @saucedemo', () => {
  let loginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new SauceDemoLoginPage(page);
  });

  test('TC-LOGIN-01: Đăng nhập thành công với tài khoản hợp lệ (Standard User) @smoke', async ({ page }, testInfo) => {
    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Khách truy cập mở trang đăng nhập SauceDemo chưa xác thực',
    });

    const { validCredentials, targetSite } = testData;

    await test.step('Given Tiền điều kiện: Mở trang đăng nhập SauceDemo', async () => {
      await loginPage.open(targetSite.url);
    });

    await test.step(`When Người dùng đăng nhập với username "${validCredentials.username}"`, async () => {
      await loginPage.login(validCredentials.username, validCredentials.password);
    });

    await test.step('Then Hệ thống chuyển hướng thành công đến trang sản phẩm (Inventory)', async () => {
      await loginPage.expectInventoryPageVisible();
      await expect(page).toHaveURL(validCredentials.expectedUrl);
    });
  });

  test('TC-LOGIN-02: Đăng nhập thất bại với tài khoản bị khóa (Locked Out User) @regression', async ({ page }, testInfo) => {
    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Tài khoản locked_out_user đã bị khóa quyền truy cập trong hệ thống',
    });

    const { lockedOutCredentials, targetSite } = testData;

    await test.step('Given Tiền điều kiện: Mở trang đăng nhập SauceDemo', async () => {
      await loginPage.open(targetSite.url);
    });

    await test.step(`When Nhập thông tin tài khoản bị khóa "${lockedOutCredentials.username}"`, async () => {
      await loginPage.login(lockedOutCredentials.username, lockedOutCredentials.password);
    });

    await test.step('Then Hiển thị thông báo lỗi tài khoản bị khóa', async () => {
      const errorText = await loginPage.getErrorMessage();
      expect(errorText).toContain(lockedOutCredentials.expectedError);
    });
  });

  test('TC-LOGIN-03: Kiểm tra thông báo lỗi khi để trống trường thông tin đăng nhập @validation', async ({ page }, testInfo) => {
    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Người dùng truy cập form đăng nhập và bỏ trống cả hai trường username và password',
    });

    const { emptyCredentials, targetSite } = testData;

    await test.step('Given Tiền điều kiện: Mở trang đăng nhập SauceDemo', async () => {
      await loginPage.open(targetSite.url);
    });

    await test.step('When Nhấn đăng nhập khi để trống dữ liệu', async () => {
      await loginPage.login(emptyCredentials.username, emptyCredentials.password);
    });

    await test.step('Then Hiển thị cảnh báo yêu cầu nhập Username', async () => {
      const errorText = await loginPage.getErrorMessage();
      expect(errorText).toContain(emptyCredentials.expectedError);
    });
  });
});
