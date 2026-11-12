const { test, expect } = require('../../../core/fixtures/baseTest');
const { JobDetailPage } = require('../../../pages/desktop/JobDetailPage');

test.describe('Feature: Tìm việc và xem chi tiết tin tuyển dụng @guest @no-auth @search @desktop @e2e @smoke @smoke-desktop', () => {
  let jobDetailTab = null;

  test.afterEach(async ({ page }) => {
    if (jobDetailTab && jobDetailTab !== page && !jobDetailTab.isClosed()) {
      await jobDetailTab.close().catch(() => null);
    }
    jobDetailTab = null;
  });

  test('SMK-03 Khách mở trang tìm việc từ trang chủ, thấy danh sách việc làm và mở được chi tiết tin', async ({
    homePage,
    jobSearchPage,
  }, testInfo) => {
    test.setTimeout(180000);
    testInfo.annotations.push({ type: 'Precondition', description: 'Khách vãng lai, chưa đăng nhập' });

    await test.step('Given Khách đang ở trang chủ', async () => {
      await homePage.registerGuestPopupAutoHandlers();
      await homePage.navigate();
      await homePage.closeAllPopupsIfVisible();
      await homePage.expectHomepageVisible();
    });

    await test.step('When Khách mở Tìm việc làm từ menu', async () => {
      await homePage.openJobSearch();
    });

    await test.step('Then Trang kết quả hiển thị danh sách việc làm', async () => {
      await jobSearchPage.expectJobSearchPageVisible();
      await expect(jobSearchPage.firstJobLink).toBeVisible({ timeout: 20000 });
      await jobSearchPage.capture('search_result_list');
    });

    await test.step('When Khách mở tin tuyển dụng đầu tiên', async () => {
      jobDetailTab = await jobSearchPage.clickFirstJob();
      await jobDetailTab.waitForLoadState('domcontentloaded');
    });

    await test.step('Then Trang chi tiết hiển thị tiêu đề việc làm và nút Ứng tuyển', async () => {
      const jobDetailPage = new JobDetailPage(jobDetailTab, 'tim_viec_xem_chi_tiet_smoke');
      await jobDetailPage.verifyJobDetailPageLoaded();
      await expect(jobDetailTab).toHaveURL(/id\d+\.html/);
      await jobDetailPage.capture('job_detail_loaded');
    });
  });
});
