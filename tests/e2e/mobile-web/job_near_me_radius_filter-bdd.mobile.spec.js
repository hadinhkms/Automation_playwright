const { test, expect } = require('../../../core/fixtures/mobileWebTest');
const jnmData = require('../../../data/jobNearMeData.json');

test.describe('Mobile Feature: Job Near Me – tìm việc làm theo bán kính quanh vị trí hiện tại @REQ-009 @search @mobile @e2e @regression', () => {
  test.use({ geolocation: jnmData.gps.coords, permissions: ['geolocation'] });

  test('TC-162 - AC-062 Khách vãng lai mở Job Near Me từ Home mobile, dùng "Vị trí hiện tại" và lọc việc làm trong bán kính', async ({ pages }, testInfo) => {
    test.slow();
    const homePage = pages.mobileHomePage;
    const jobNearMe = pages.mobileJobNearMePage;
    const radiusKm = jnmData.gps.radiusKm;

    testInfo.annotations.push({ type: 'Precondition', description: 'Khách vãng lai truy cập trang chủ Mobile Web (Chưa đăng nhập), trình duyệt đã cấp quyền vị trí' });

    await test.step('Given Tiền điều kiện: Khách vãng lai đang ở trang chủ Mobile Web, popup điều hướng đã được đóng', async () => {
      // navigate() tự đóng popup điều hướng; chỉ đăng ký handler cho popup xuất hiện sau đó để hai cơ chế không tranh nhau
      await homePage.navigate();
      await jobNearMe.registerOverlayHandlersKeepingJobNearMe();
      await homePage.expectHomepageVisible();
      await homePage.capture('01_mobile_homepage_ready');
    });

    await test.step('When Khách chạm "Việc làm gần tôi" trên trang chủ', async () => {
      await jobNearMe.openFromHomeEntryPoint();
      await jobNearMe.capture('02_job_near_me_sheet_opened', false);
    });

    await test.step(`And Khách bấm "Vị trí hiện tại" và chọn bán kính ${radiusKm}km`, async () => {
      await jobNearMe.useCurrentLocation();
      await jobNearMe.selectPresetRadius(radiusKm);
      await jobNearMe.capture('03_current_location_and_radius_selected', false);
    });

    await test.step('And Khách bấm "Áp dụng"', async () => {
      await jobNearMe.applyFilter(radiusKm);
    });

    await test.step(`Then Danh sách việc làm được lọc quanh vị trí hiện tại và mọi job nằm trong bán kính ${radiusKm}km`, async () => {
      await jobNearMe.expectRadiusFilterApplied(radiusKm);
      const distances = await jobNearMe.getVisibleJobDistancesKm();
      expect(distances.length, 'Phải có việc làm trong bán kính').toBeGreaterThan(0);
      expect(Math.max(...distances), `Mọi việc làm phải nằm trong bán kính ${radiusKm}km`).toBeLessThanOrEqual(radiusKm);
      await jobNearMe.capture('04_jobs_filtered_by_current_location');
    });
  });
});
