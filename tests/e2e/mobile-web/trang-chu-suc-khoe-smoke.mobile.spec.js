const { test, expect } = require('../../../core/fixtures/mobileWebTest');

test.describe('Mobile Feature: Sức khỏe trang chủ sau khi deploy trên Mobile Web @guest @no-auth @home @mobile @e2e @smoke @smoke-mobile', () => {
  test('SMK-02 Trang chủ mobile tải thành công, không lỗi máy chủ và hiển thị các khối chính', async ({ homePage }, testInfo) => {
    test.setTimeout(120000);
    testInfo.annotations.push({ type: 'Precondition', description: 'Khách vãng lai mobile, chưa đăng nhập' });

    let monitor;

    await test.step('When Khách truy cập trang chủ trên mobile', async () => {
      await homePage.registerGuestPopupAutoHandlers();
      monitor = homePage.startHealthMonitor();
      await homePage.navigate();
    });

    await test.step('Then Trang chủ mobile hiển thị logo, nút đăng nhập và các khối việc làm', async () => {
      await homePage.expectHomepageContentLoaded();
      await homePage.expectGuestHeaderVisible();
      await homePage.expectImmediateJobsSectionVisible();
      await homePage.capture('mobile_homepage_health_loaded');
    });

    await test.step('And Document trả về HTTP 200 và không có response 5xx từ hệ thống', async () => {
      monitor.stop();
      testInfo.annotations.push({
        type: 'Lỗi JS / console (chỉ ghi nhận)',
        description: `pageerror: ${monitor.pageErrors.length}, console error: ${monitor.consoleErrors.length}`,
      });
      expect(monitor.documentStatus, 'Mã HTTP của trang chủ').toBe(200);
      expect(monitor.serverErrors, 'Response 5xx từ hệ thống khi tải trang chủ').toEqual([]);
    });
  });
});
