const { test, expect } = require('../../../core/fixtures/baseTest');
const { OnboardingPopup } = require('../../../pages/desktop/OnboardingPopup');
const { JobApplyPage } = require('../../../pages/desktop/JobApplyPage');
const { JobDetailPage } = require('../../../pages/desktop/JobDetailPage');
const applyData = require('../../../data/applyJobData.json');

/**
 * TC-042 (thiết kế lại 2026-11-06 theo hành vi QC):
 * - Tài khoản tạo qua API đã xác thực SĐT → không còn popup OTP chống spam khi ứng tuyển
 *   (luồng OTP được phủ bởi TC-016 / TC-038 cho khách vãng lai).
 * - Hồ sơ trực tuyến của tài khoản mới thiếu mục bắt buộc → nộp bằng Hồ sơ trực tuyến bị chặn, yêu cầu "Hoàn thành hồ sơ".
 * - Nộp bằng file CV không phụ thuộc 7 mục hồ sơ trực tuyến → nộp thành công.
 */
test.describe('Feature: Ứng tuyển việc làm - Điều kiện hoàn thiện hồ sơ khi nộp @auth @applyjob @desktop @e2e @REQ-003 @regression', () => {
  let newPage;

  test.afterEach(async () => {
    if (newPage) await newPage.close().catch(() => null);
  });

  test('TC-042 - AC-008 AC-009: Hồ sơ trực tuyến chưa hoàn thiện bị chặn nộp, nộp bằng CV thành công không cần đủ 7 mục hồ sơ', async ({
    page,
    pages,
    authenticatedUser,
  }, testInfo) => {
    const homePage = pages.homePage;
    const jobSearchPage = pages.jobSearchPage;
    const onboardingPopup = new OnboardingPopup(page);
    let jobDetailPage;
    let jobApplyPage;
    let jobDetailUrl;
    test.slow();
    test.setTimeout(300000);

    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Tài khoản ứng viên mới (SĐT đã xác thực, Hồ sơ trực tuyến còn thiếu mục bắt buộc), mở trang chi tiết việc làm chưa ứng tuyển',
    });

    await test.step('Given Tiền điều kiện: Tài khoản mới đã đăng nhập, hồ sơ trực tuyến chưa hoàn thiện, mở chi tiết một việc làm', async () => {
      await onboardingPopup.closeIfVisible(undefined, { modalTimeout: 15000, closeBtnTimeout: 5000, modalHiddenTimeout: 10000 });
      await homePage.closeBlockingModalIfVisible();
      await homePage.expectHomepageVisible();
      await homePage.openJobSearch();
      newPage = await jobSearchPage.clickFirstJob();
      await newPage.waitForLoadState('domcontentloaded');
      jobDetailPage = new JobDetailPage(newPage);
      jobApplyPage = new JobApplyPage(newPage);
      await jobDetailPage.verifyJobDetailPageLoaded();
      await expect(jobDetailPage.btnApplyNow).toBeVisible();
      jobDetailUrl = newPage.url();
      await jobDetailPage.capture('precondition_job_detail_opened');
    });

    await test.step('When [1] Bấm "Ứng tuyển ngay"', async () => {
      await jobApplyPage.startApply();
    });

    await test.step('Then [1] Modal ứng tuyển hiển thị 2 phương thức: Hồ sơ trực tuyến và CV, không bật popup OTP (SĐT đã xác thực)', async () => {
      await expect(jobApplyPage.optProfileMethod).toBeVisible();
      await expect(jobApplyPage.optCVMethod).toBeVisible();
      await expect(jobApplyPage.otpTitle).toBeHidden();
      await jobApplyPage.capture('apply_methods_displayed_without_otp');
    });

    await test.step('When [2] Chọn nộp bằng Hồ sơ trực tuyến', async () => {
      await jobApplyPage.applyByProfile();
    });

    await test.step('Then [2] Hệ thống yêu cầu hoàn thiện hồ sơ (CTA "Hoàn thành hồ sơ"), chưa cho nộp ngay', async () => {
      await expect(jobApplyPage.btnContinueProfile).toBeVisible({ timeout: 15000 });
      await expect(jobApplyPage.msgSuccess).toBeHidden();
      await jobApplyPage.capture('profile_completion_required');
    });

    await test.step('When [3] Bấm "Hoàn thành hồ sơ"', async () => {
      await jobApplyPage.continueApply();
    });

    await test.step('Then [3] Form hồ sơ mở ra với các mục bắt buộc còn trống cần bổ sung (Giới thiệu / Kinh nghiệm / Học vấn...)', async () => {
      await expect(jobApplyPage.btnAddIntro.or(jobApplyPage.btnAddExperience).or(jobApplyPage.btnAddEdu).first()).toBeVisible({ timeout: 15000 });
      await expect(jobApplyPage.msgSuccess).toBeHidden();
      await jobApplyPage.capture('missing_profile_sections_listed');
    });

    await test.step('When [4] Mở lại tin tuyển dụng, bấm "Ứng tuyển ngay", chọn nộp bằng CV và tải lên file CV hợp lệ', async () => {
      await newPage.goto(jobDetailUrl, { waitUntil: 'domcontentloaded' });
      await jobDetailPage.verifyJobDetailPageLoaded();
      await jobApplyPage.startApply();
      await jobApplyPage.applyByCV();
      await jobApplyPage.uploadCV(applyData.cvPath);
      await jobApplyPage.capture('cv_uploaded');
      await jobApplyPage.continueApplyCV();
    });

    await test.step('Then [4] Ứng tuyển thành công bằng CV dù hồ sơ trực tuyến chưa đủ 7 mục', async () => {
      await expect(jobApplyPage.cvUploadError).toBeHidden();
      await expect(jobApplyPage.msgSuccess.or(jobDetailPage.btnAlreadyApplied).first()).toBeVisible({ timeout: 30000 });
      await jobApplyPage.capture('applied_by_cv_successfully');
    });

    await test.step('When [5] Mở lại trang chi tiết việc làm vừa nộp', async () => {
      await newPage.goto(jobDetailUrl, { waitUntil: 'domcontentloaded' });
      await jobDetailPage.verifyJobDetailPageLoaded();
    });

    await test.step('Then [5] Nút ứng tuyển chuyển trạng thái "Đã ứng tuyển" / "Nộp lại hồ sơ"', async () => {
      await expect(jobDetailPage.btnAlreadyApplied.first()).toBeVisible({ timeout: 15000 });
      await jobDetailPage.capture('applied_status_shown');
    });
  });
});
