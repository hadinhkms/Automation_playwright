const { test, expect } = require('../../../core/fixtures/baseTest');

test.describe('Feature: Sức khỏe trang chủ sau khi deploy @guest @no-auth @home @desktop @e2e @smoke @smoke-desktop', () => {
  test('SMK-02 Trang chủ tải thành công, không lỗi máy chủ và hiển thị các khối chính', async ({ homePage }, testInfo) => {
    test.setTimeout(120000);
    testInfo.annotations.push({ type: 'Precondition', description: 'Khách vãng lai, chưa đăng nhập' });

    let monitor;

    await test.step('When Khách truy cập trang chủ', async () => {
      await homePage.registerGuestPopupAutoHandlers();
      monitor = homePage.startHealthMonitor();
      await homePage.navigate();
      await homePage.closeAdsIfVisible();
    });

    await test.step('Then Trang chủ hiển thị logo, nút đăng nhập, khu vực nhà tuyển dụng và các khối việc làm', async () => {
      await homePage.expectHomepageContentLoaded();
      await homePage.expectLoginAreaVisible();
      await homePage.expectEmployerSectionVisible();
      await homePage.expectImmediateJobsSectionVisible();
      await homePage.capture('homepage_health_loaded');
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
