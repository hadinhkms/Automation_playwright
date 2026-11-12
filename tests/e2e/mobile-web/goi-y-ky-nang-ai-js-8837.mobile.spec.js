const { test, expect } = require('../../../core/fixtures/mobileWebTest');
const suggestData = require('../../../data/aiSuggestedSkillData.json');
const { MobileHomePage } = require('../../../pages/mobile-web/MobileHomePage');
const { MobileOnboardingPopup } = require('../../../pages/mobile-web/MobileOnboardingPopup');
const { MobileUserProfilePage } = require('../../../pages/mobile-web/MobileUserProfilePage');
const { setJobGoalByApi } = require('../../../core/utils/chopWebApiHelper');

const { jobGoal, maxChips } = suggestData;

test.describe('Mobile Feature: AI gợi ý kỹ năng theo job title tại Hồ sơ của tôi trên Mobile Web (Skill Standardization v1.1 – JS-8837) @auth @profile @mobile @e2e @REQ-005 @regression', () => {
  // Timeout cấp describe áp dụng cả bước setup fixture authenticatedUser (WebKit đăng nhập chậm)
  test.describe.configure({ timeout: 600000 });

  /** Đóng popup sau đăng nhập và mở trang Hồ sơ của tôi (dùng trong bước Given của mọi kịch bản). */
  async function openMyProfile(page, skillPage) {
    const onboardingPopup = new MobileOnboardingPopup(page);
    await onboardingPopup.closeIfVisible(undefined, { modalTimeout: 15000, closeBtnTimeout: 5000, modalHiddenTimeout: 10000 });
    await new MobileHomePage(page).closeBlockingModalIfVisible();
    await new MobileUserProfilePage(page).navigateToMyProfile();
    await skillPage.expectSkillsSectionVisible();
  }

  test('TC-180 - AC-074 Job goal có job title thì trang Kỹ năng trên mobile web hiển thị khu vực gợi ý với tối đa 5 chip đúng thứ tự gợi ý', async ({
    page,
    authenticatedUser,
    workerUserData,
    pages,
  }, testInfo) => {
    const skillPage = pages.mobileProfileSkillPage;
    const suggestions = skillPage.suggestions;
    testInfo.annotations.push({
      type: 'Precondition',
      description: `Đã đăng nhập Mobile Web bằng tài khoản ứng viên mới (authSetup: ${authenticatedUser.phone || authenticatedUser.email}); Job goal đặt qua API với job title "${jobGoal.job_title}"; hồ sơ chưa có kỹ năng`,
    });
    let suggested;

    await test.step(`Given Tiền điều kiện: Job goal có job title "${jobGoal.job_title}" và người dùng mobile đang ở trang Hồ sơ của tôi`, async () => {
      await setJobGoalByApi(workerUserData.user, jobGoal);
      await openMyProfile(page, skillPage);
      await skillPage.capture('mobile_profile_page_opened', true);
    });

    await test.step('When Người dùng mở trang Kỹ năng', async () => {
      suggested = await suggestions.openEditorWithSuggestions();
      await suggestions.expectCardVisibleForJobTitle(jobGoal.job_title);
      await skillPage.capture('mobile_skills_page_with_suggestions', false);
    });

    await test.step('Then Khu vực gợi ý nằm riêng phía trên ô tìm kiếm, ghi rõ job title và hiển thị tối đa 5 chip không trùng, đúng thứ tự gợi ý', async () => {
      expect(suggested.jobTitle, 'API gợi ý phải được gọi theo job title của Job goal').toBe(jobGoal.job_title);
      expect(suggested.skillNames.length, 'Job title phổ biến phải có skill gợi ý').toBeGreaterThan(0);
      expect(new Set(suggested.skillIds).size, 'Danh sách gợi ý không được trùng lặp').toBe(suggested.skillIds.length);
      await suggestions.expectCardAboveSearchInput();
      await suggestions.expectChips(suggested.skillNames.slice(0, maxChips));
      await suggestions.expectSelectedCount(0);
    });

    await test.step('And Hệ thống ghi nhận lượt hiển thị đúng các skill đang hiện, cùng phiên với lần gọi gợi ý', async () => {
      expect(suggested.impression.skill_ids).toEqual(suggested.skillIds.slice(0, maxChips));
      expect(suggested.impression.session_id).toBe(suggested.sessionId);
    });
  });

  test('TC-181 - AC-075 Chọn chip gợi ý trên mobile web thì skill lên đầu danh sách đã chọn, chip kế tiếp bù chỗ và lưu được vào hồ sơ', async ({
    page,
    authenticatedUser,
    workerUserData,
    pages,
  }, testInfo) => {
    const skillPage = pages.mobileProfileSkillPage;
    const suggestions = skillPage.suggestions;
    testInfo.annotations.push({
      type: 'Precondition',
      description: `Đã đăng nhập Mobile Web bằng tài khoản ứng viên mới (authSetup: ${authenticatedUser.phone || authenticatedUser.email}); Job goal đặt qua API với job title "${jobGoal.job_title}"; hồ sơ chưa có kỹ năng`,
    });
    let suggested;
    let firstPick;
    let secondPick;

    await test.step(`Given Tiền điều kiện: Job goal có job title "${jobGoal.job_title}" và trang Kỹ năng đang hiển thị gợi ý`, async () => {
      await setJobGoalByApi(workerUserData.user, jobGoal);
      await openMyProfile(page, skillPage);
      suggested = await suggestions.openEditorWithSuggestions();
      expect(suggested.skillNames.length, 'Cần nhiều hơn 6 gợi ý để kiểm tra chip bù chỗ').toBeGreaterThan(maxChips + 1);
      await suggestions.expectChips(suggested.skillNames.slice(0, maxChips));
      await skillPage.capture('mobile_skills_page_with_suggestions', false);
    });

    await test.step('When Người dùng chọn chip gợi ý thứ hai', async () => {
      firstPick = suggested.skillNames[1];
      const selectedLog = await suggestions.selectChip(firstPick);
      expect(selectedLog.selected_id, 'Request selected phải ghi đúng skill vừa chọn').toBe(suggested.skillIds[1]);
      expect(selectedLog.session_id).toBe(suggested.sessionId);
      await skillPage.capture('mobile_first_suggestion_selected', false);
    });

    await test.step('Then Skill đó lên đầu danh sách đã chọn, bộ đếm tăng 1 và chip kế tiếp xuất hiện ở cuối để đủ 5 chip', async () => {
      await suggestions.expectSelectedCount(1);
      await suggestions.expectSelectedOnTop(firstPick);
      const names = suggested.skillNames;
      await suggestions.expectChips([names[0], names[2], names[3], names[4], names[5]]);
    });

    await test.step('When Người dùng chọn tiếp chip đầu tiên rồi bấm Lưu thay đổi', async () => {
      secondPick = suggested.skillNames[0];
      await suggestions.selectChip(secondPick);
      await suggestions.expectSelectedCount(2);
      await suggestions.expectSelectedOnTop(secondPick);
      await skillPage.capture('mobile_second_suggestion_selected', false);
      await suggestions.saveEditor();
    });

    await test.step('Then Hồ sơ hiển thị cả hai skill vừa chọn và giữ nguyên sau khi tải lại trang', async () => {
      await skillPage.reloadProfile();
      await expect(skillPage.profileSkill(firstPick)).toBeVisible();
      await expect(skillPage.profileSkill(secondPick)).toBeVisible();
      await skillPage.capture('mobile_profile_skills_saved_from_suggestions', true);
    });
  });
});
