const { test, expect } = require('../../../core/fixtures/baseTest');
const { OnboardingPopup } = require('../../../pages/desktop/OnboardingPopup');
const { JobApplyPage } = require('../../../pages/desktop/JobApplyPage');
const { JobDetailPage } = require('../../../pages/desktop/JobDetailPage');
const applyData = require('../../../data/applyJobData.json');

test.describe('Feature: Ứng tuyển việc làm @auth @applyjob @desktop @e2e @REQ-003', () => {
  test('TC-037 - AC-011 Kiểm tra trạng thái việc làm đã nộp (Nộp lại hồ sơ hoặc Đã ứng tuyển)', async ({
    page,
    authenticatedUser,
    pages,
  }, testInfo) => {
    const homePage = pages.homePage;
    const onboardingPopup = new OnboardingPopup(page);
    test.slow();
    test.setTimeout(300000);

    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Người dùng đã đăng nhập và có việc làm trong danh sách đã ứng tuyển',
    });

    await test.step('Given Tiền điều kiện: Người dùng đã đăng nhập và đã ứng tuyển 1 việc làm bất kỳ bằng CV', async () => {
      await onboardingPopup.closeIfVisible(undefined, {
        modalTimeout: 15000,
        closeBtnTimeout: 5000,
        modalHiddenTimeout: 10000,
      });
      await homePage.closeBlockingModalIfVisible();
      await homePage.expectHomepageVisible();
      await expect(homePage.logo).toBeVisible();
      await homePage.capture('after_homepage_loaded', false); // fullPage capture mở lại onboarding vừa đóng

      // Tài khoản mới chưa có đơn nào → nộp 1 việc bằng CV (hồ sơ trực tuyến còn thiếu mục bắt buộc nên không nộp bằng Profile)
      await homePage.openJobSearch();
      const jobPage = await pages.jobSearchPage.clickFirstJob();
      await jobPage.waitForLoadState('domcontentloaded');
      const jobDetailPage = new JobDetailPage(jobPage);
      const jobApplyPage = new JobApplyPage(jobPage);
      await jobDetailPage.verifyJobDetailPageLoaded();
      await jobApplyPage.startApply();
      await jobApplyPage.applyByCV();
      await jobApplyPage.uploadCV(applyData.cvPath);
      await jobApplyPage.continueApplyCV();
      await expect(jobApplyPage.msgSuccess.or(jobDetailPage.btnAlreadyApplied).first()).toBeVisible({ timeout: 30000 });
      await jobApplyPage.capture('precondition_job_applied_by_cv');
      if (jobPage !== page) await jobPage.close().catch(() => null);
      await page.bringToFront();
    });

    await test.step('When [1] Tôi mở danh sách Việc làm đã ứng tuyển từ tài khoản cá nhân', async () => {
      await homePage.closeBlockingModalIfVisible();
      await homePage.openAppliedJobs();
      // Tài khoản chưa hoàn tất onboarding: modal hiện lại ở mỗi lần tải trang mới
      await onboardingPopup.closeIfVisible(undefined, { modalTimeout: 10000 });
      await homePage.capture('applied_jobs_menu_opened', false);
    });

    await test.step('Then [1] Danh sách việc làm đã ứng tuyển hiển thị trạng thái hồ sơ đã nộp thành công', async () => {
      await homePage.expectAppliedJobsVisible();
      await expect(homePage.appliedJobsList).toBeVisible({ timeout: 30000 });
      await homePage.capture('applied_jobs_list_verified');
    });
  });
});
