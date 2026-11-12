const { test, expect } = require('../../../core/fixtures/baseTest');
const jnmData = require('../../../data/jobNearMeData.json');

test.describe('Feature: Job Near Me – tìm việc làm theo bán kính quanh vị trí @REQ-009 @search @desktop @e2e @regression', () => {
  test('TC-160 - AC-060 Khách vãng lai mở "Khám phá việc làm gần tôi" từ Home và lọc việc làm trong bán kính đã chọn', async ({ pages }, testInfo) => {
    test.slow();
    const homePage = pages.homePage;
    const jobNearMe = pages.jobNearMePage;
    const { query, suggestion } = jnmData.manualLocation;
    const radiusKm = jnmData.presetRadiusKm;

    testInfo.annotations.push({ type: 'Precondition', description: 'Khách vãng lai truy cập trang chủ (Chưa đăng nhập)' });

    await test.step('Given Tiền điều kiện: Khách vãng lai đang ở trang chủ', async () => {
      await jobNearMe.registerOverlayHandlersKeepingJobNearMe();
      await homePage.navigate();
      await homePage.expectHomepageVisible();
      await homePage.capture('01_homepage_ready');
    });

    await test.step('When Khách chọn "Khám phá việc làm gần tôi" trong dropdown Địa điểm', async () => {
      await jobNearMe.openFromHomeLocationDropdown();
      await jobNearMe.capture('02_job_near_me_popup_opened_from_home', false);
    });

    await test.step(`And Khách nhập "${query}", chọn gợi ý và chọn bán kính ${radiusKm}km`, async () => {
      await jobNearMe.searchAndSelectLocation(query, suggestion);
      await jobNearMe.selectPresetRadius(radiusKm);
      await jobNearMe.capture('03_location_and_radius_selected', false);
    });

    await test.step('And Khách bấm "Áp dụng"', async () => {
      await jobNearMe.applyFilter(radiusKm);
    });

    await test.step(`Then Danh sách việc làm được lọc theo vị trí đã chọn và mọi job nằm trong bán kính ${radiusKm}km`, async () => {
      await jobNearMe.expectRadiusFilterApplied(radiusKm);
      const distances = await jobNearMe.getVisibleJobDistancesKm();
      expect(distances.length, 'Phải có việc làm trong bán kính').toBeGreaterThan(0);
      expect(Math.max(...distances), `Mọi việc làm phải nằm trong bán kính ${radiusKm}km`).toBeLessThanOrEqual(radiusKm);
      await jobNearMe.capture('04_jobs_filtered_by_radius');
    });
  });

  test('TC-161 - AC-061 Pop-up tự điền vị trí và bán kính lần trước, lưu lịch sử, nhập bán kính tuỳ chỉnh và bỏ lọc vị trí', async ({ pages }, testInfo) => {
    test.slow();
    const jobSearchPage = pages.jobSearchPage;
    const jobNearMe = pages.jobNearMePage;
    const { query, suggestion } = jnmData.manualLocation;
    const presetKm = jnmData.presetRadiusKm;
    const customKm = jnmData.customRadiusKm;

    testInfo.annotations.push({ type: 'Precondition', description: `Khách vãng lai đã áp dụng lọc bán kính "${suggestion}" – ${presetKm}km trên trang tìm kiếm` });

    await test.step(`Given Tiền điều kiện: Khách vãng lai đã áp dụng lọc "${query}" bán kính ${presetKm}km trên trang tìm kiếm`, async () => {
      await jobNearMe.registerOverlayHandlersKeepingJobNearMe();
      await jobSearchPage.navigate();
      await jobSearchPage.expectJobSearchPageVisible();
      await jobNearMe.openFromSearchBar();
      await jobNearMe.searchAndSelectLocation(query, suggestion);
      await jobNearMe.selectPresetRadius(presetKm);
      await jobNearMe.applyFilter(presetKm);
      await jobNearMe.expectRadiusFilterApplied(presetKm);
      await jobNearMe.capture('01_radius_filter_applied');
    });

    await test.step('When Khách mở lại pop-up từ thanh tìm kiếm', async () => {
      await jobNearMe.openFromSearchBar(suggestion);
    });

    await test.step('Then Pop-up tự điền vị trí, bán kính lần trước và vị trí xuất hiện trong lịch sử tìm kiếm', async () => {
      await jobNearMe.expectPopupSelection({ location: suggestion, presetKm });
      await jobNearMe.expectHistoryContains(suggestion);
      await jobNearMe.capture('02_popup_autofilled_with_history', false);
    });

    await test.step(`When Khách nhập bán kính tuỳ chỉnh ${customKm}km và bấm "Áp dụng"`, async () => {
      await jobNearMe.enterCustomRadius(customKm);
      await jobNearMe.expectPopupSelection({ location: suggestion, customKm });
      await jobNearMe.applyFilter(customKm);
    });

    await test.step(`Then Danh sách việc làm được lọc lại trong bán kính ${customKm}km`, async () => {
      await jobNearMe.expectRadiusFilterApplied(customKm);
      const distances = await jobNearMe.getVisibleJobDistancesKm();
      expect(distances.length, 'Phải có việc làm trong bán kính').toBeGreaterThan(0);
      expect(Math.max(...distances), `Mọi việc làm phải nằm trong bán kính ${customKm}km`).toBeLessThanOrEqual(customKm);
      await jobNearMe.capture('03_jobs_filtered_by_custom_radius');
    });

    await test.step('When Khách mở lại pop-up và bấm "Bỏ lọc vị trí"', async () => {
      await jobNearMe.openFromSearchBar(suggestion);
      await jobNearMe.expectPopupSelection({ location: suggestion, customKm });
      await jobNearMe.clearLocationFilter();
    });

    await test.step('Then Bộ lọc bán kính bị bỏ, lịch sử tìm kiếm vẫn được giữ', async () => {
      await jobNearMe.expectRadiusFilterCleared();
      await jobNearMe.capture('04_radius_filter_cleared');
      await jobNearMe.openFromSearchBar();
      await jobNearMe.expectHistoryContains(suggestion);
      await jobNearMe.capture('05_history_kept_after_clear', false);
    });
  });
});
