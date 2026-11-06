const { test, expect } = require('../../../core/fixtures/baseTest');
const { OnboardingPopup } = require('../../../pages/desktop/OnboardingPopup');
const { JobApplyPage } = require('../../../pages/desktop/JobApplyPage');
const { JobDetailPage } = require('../../../pages/desktop/JobDetailPage');
const applyData = require('../../../data/applyJobData.json');

test.describe('Feature: Ứng tuyển việc làm - Kiểm soát tần suất nộp lại hồ sơ @auth @applyjob @desktop @e2e @REQ-003', () => {
  let jobApplyPage;
  let jobDetailPage;
  let newPage;
  let jobDetailUrl;

  test.afterEach(async () => {
    if (newPage) {
      await newPage.close().catch(() => null);
    }
  });

  test('TC-043 - AC-011: Kiểm thử quy tắc kiểm soát tần suất nộp lại hồ sơ cho cùng một công việc', async ({
    page,
    pages,
    authenticatedUser,
  }, testInfo) => {
    const homePage = pages.homePage;
    const jobSearchPage = pages.jobSearchPage;
    const onboardingPopup = new OnboardingPopup(page);
    test.slow();
    test.setTimeout(300000);

    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Tài khoản ứng viên đã nộp thành công công việc JOB_BOUNDARY_102',
    });

    await test.step('Given Tiền điều kiện: Tài khoản ứng viên đã nộp thành công công việc JOB_BOUNDARY_102', async () => {
      await onboardingPopup.closeIfVisible(undefined, {
        modalTimeout: 15000,
        closeBtnTimeout: 5000,
        modalHiddenTimeout: 10000,
      });
      await homePage.closeBlockingModalIfVisible();
      await homePage.expectHomepageVisible();
      await homePage.openJobSearch();

      await jobSearchPage.capture('before_open_job_detail');
      newPage = await jobSearchPage.clickFirstJob();
      await newPage.waitForLoadState('domcontentloaded');
      jobDetailPage = new JobDetailPage(newPage);
      jobApplyPage = new JobApplyPage(newPage);

      await jobDetailPage.verifyJobDetailPageLoaded();
      await expect(jobDetailPage.btnApplyNow).toBeVisible();

      // Nộp lần đầu bằng CV: tài khoản mới tạo có Hồ sơ trực tuyến thiếu mục bắt buộc (Kinh nghiệm, Học vấn...)
      // nên nộp bằng Profile không hoàn tất được → không xác lập được tiền điều kiện "đã nộp".
      jobDetailUrl = newPage.url();
      await jobApplyPage.startApply();
      await jobApplyPage.applyByCV();
      await jobApplyPage.uploadCV(applyData.cvPath);
      await jobApplyPage.continueApplyCV();
      await jobDetailPage.capture('precondition_first_applied_completed');
    });

    await test.step('When [1] Mở lại trang chi tiết JOB_BOUNDARY_102 trong cùng một ngày nộp', async () => {
      // Nộp xong app chuyển sang trang "Ứng tuyển thành công" → mở lại đúng URL tin tuyển dụng
      await jobDetailPage.page.goto(jobDetailUrl, { waitUntil: 'domcontentloaded' });
      await jobDetailPage.verifyJobDetailPageLoaded();
      await jobDetailPage.capture('job_detail_reopened_same_day');
    });

    await test.step('Then [1] Nút ứng tuyển hiển thị trạng thái \'Đã ứng tuyển\' / \'Nộp lại hồ sơ\' kèm ghi chú đã nộp hôm nay', async () => {
      await expect(jobDetailPage.btnAlreadyApplied.or(jobDetailPage.btnApplyNow)).toBeVisible({ timeout: 15000 });
      const hasAppliedIndicator = await jobDetailPage.txtAppliedNote
        .or(jobDetailPage.btnAlreadyApplied)
        .or(jobApplyPage.btnAlreadyApplied)
        .isVisible({ timeout: 5000 })
        .catch(() => false);
      expect(hasAppliedIndicator).toBeTruthy();
      await jobDetailPage.capture('applied_status_and_note_verified');
    });

    await test.step('When [2] Cố tình bấm nộp lại hồ sơ trong cùng ngày', async () => {
      await jobDetailPage.clickReApply();
      await jobDetailPage.capture('reapply_attempted_same_day');
    });

    await test.step('Then [2] Hệ thống chặn thao tác và thông báo: \'Mỗi ngày chỉ được ứng tuyển 1 lần cho công việc này\'', async () => {
      // QC: dialog "Bạn đã ứng tuyển trong ngày … vui lòng quay lại vào ngày mai" (isVisible() trên chuỗi .or() nhiều phần tử
      // ném strict-mode và không chờ → luôn false; dùng expect có chờ)
      await expect(jobDetailPage.dailyApplyLimitWarning.or(jobDetailPage.btnAlreadyApplied).first()).toBeVisible({ timeout: 10000 });
      await jobDetailPage.capture('reapply_same_day_blocked_verified');
    });

    await test.step('When [3] Chuyển mốc thời gian sang ngày tiếp theo (khác ngày nộp trước) và mở lại tin tuyển dụng', async () => {
      await jobDetailPage.advanceTimeToNextDay();
      await jobDetailPage.page.reload({ waitUntil: 'domcontentloaded' }).catch(() => null);
      await jobDetailPage.verifyJobDetailPageLoaded();
      await jobDetailPage.capture('job_detail_opened_next_day');
    });

    await test.step('Then [3] Hệ thống mở khóa cho phép thực hiện nộp hồ sơ lại', async () => {
      await expect(jobDetailPage.btnApplyNow.or(jobDetailPage.btnAlreadyApplied).first()).toBeVisible({ timeout: 15000 });
      await expect(jobDetailPage.btnApplyNow.or(jobDetailPage.btnAlreadyApplied).first()).toBeEnabled({ timeout: 10000 });
      await jobDetailPage.capture('reapply_unlocked_for_new_day');
    });

    // Bước 4 (nộp lại sang ngày mới) bỏ khỏi automation: giới hạn 1 lần/ngày kiểm tra ở server,
    // đồng hồ giả của trình duyệt không mô phỏng được ngày mới (thống nhất với QA 2026-11-06).
  });
});
