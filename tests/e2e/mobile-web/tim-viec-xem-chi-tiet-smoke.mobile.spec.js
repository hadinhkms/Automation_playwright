const { test } = require('../../../core/fixtures/mobileWebTest');

test.describe('Mobile Feature: Tìm việc và xem chi tiết tin tuyển dụng trên Mobile Web @guest @no-auth @search @mobile @e2e @smoke @smoke-mobile', () => {
  test('SMK-03 Khách mobile mở trang tìm việc, thấy danh sách việc làm và mở được chi tiết tin', async ({
    homePage,
    jobSearchPage,
  }, testInfo) => {
    test.setTimeout(180000);
    testInfo.annotations.push({ type: 'Precondition', description: 'Khách vãng lai mobile, chưa đăng nhập' });

    let jobDetailTab;

    await test.step('Given Khách đang ở trang chủ mobile', async () => {
      await homePage.registerGuestPopupAutoHandlers();
      await homePage.navigate();
      await homePage.expectHomepageVisible();
    });

    await test.step('When Khách mở trang Tìm việc làm', async () => {
      await homePage.openJobSearch();
    });

    await test.step('Then Trang kết quả hiển thị danh sách việc làm', async () => {
      await jobSearchPage.expectJobsVisible();
      await jobSearchPage.capture('mobile_search_result_list');
    });

    await test.step('When Khách mở tin tuyển dụng đầu tiên', async () => {
      jobDetailTab = await jobSearchPage.clickFirstJob();
      await jobDetailTab.waitForLoadState('domcontentloaded');
    });

    await test.step('Then Trang chi tiết hiển thị tiêu đề việc làm và nút Ứng tuyển', async () => {
      await jobSearchPage.expectJobDetailOpened(jobDetailTab);
      await jobSearchPage.capture('mobile_job_detail_loaded', false);
    });
  });
});
