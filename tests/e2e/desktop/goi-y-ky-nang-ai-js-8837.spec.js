const { test, expect } = require('../../../core/fixtures/baseTest');
const suggestData = require('../../../data/aiSuggestedSkillData.json');
const { OnboardingPopup } = require('../../../pages/desktop/OnboardingPopup');
const { setJobGoalByApi } = require('../../../core/utils/chopWebApiHelper');
const { setProfileSkillsByApi, buildSeededSkillNames } = require('../../../core/utils/profileSkillApiHelper');

const { jobGoal, maxChips, maxSkills } = suggestData;

test.describe('Feature: AI gợi ý kỹ năng theo job title tại Hồ sơ của tôi (Skill Standardization v1.1 – JS-8837) @auth @profile @desktop @e2e @REQ-005 @regression', () => {
  // Timeout cấp describe áp dụng cả bước setup fixture authenticatedUser
  test.describe.configure({ timeout: 600000 });

  /** Đóng popup sau đăng nhập và mở trang Hồ sơ của tôi (dùng trong bước Given của mọi kịch bản). */
  async function openMyProfile(page, pages) {
    const onboardingPopup = new OnboardingPopup(page);
    await onboardingPopup.closeIfVisible(undefined, { modalTimeout: 15000, closeBtnTimeout: 5000, modalHiddenTimeout: 10000 });
    await pages.homePage.closeBlockingModalIfVisible();
    await pages.userProfilePage.navigateToMyProfile();
    await pages.profileSkillPage.expectSkillsSectionVisible();
  }

  test('TC-175 - AC-074 Job goal có job title thì modal Kỹ năng hiển thị khu vực gợi ý với tối đa 5 chip đúng thứ tự gợi ý', async ({
    page,
    authenticatedUser,
    workerUserData,
    pages,
  }, testInfo) => {
    const skillPage = pages.profileSkillPage;
    const suggestions = skillPage.suggestions;
    testInfo.annotations.push({
      type: 'Precondition',
      description: `Đã đăng nhập tài khoản ứng viên mới (authSetup: ${authenticatedUser.phone || authenticatedUser.email}); Job goal đặt qua API với job title "${jobGoal.job_title}"; hồ sơ chưa có kỹ năng`,
    });
    let suggested;

    await test.step(`Given Tiền điều kiện: Job goal có job title "${jobGoal.job_title}" và người dùng đang ở trang Hồ sơ của tôi`, async () => {
      await setJobGoalByApi(workerUserData.user, jobGoal);
      await openMyProfile(page, pages);
      await skillPage.capture('profile_page_opened', true);
    });

    await test.step('When Người dùng mở modal Kỹ năng', async () => {
      suggested = await suggestions.openEditorWithSuggestions();
      await suggestions.expectCardVisibleForJobTitle(jobGoal.job_title);
      await skillPage.capture('skills_modal_with_suggestions', false);
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

  test('TC-176 - AC-074 Job goal chưa có job title thì modal Kỹ năng không hiển thị khu vực gợi ý và không gọi API gợi ý', async ({
    page,
    authenticatedUser,
    pages,
  }, testInfo) => {
    const skillPage = pages.profileSkillPage;
    const suggestions = skillPage.suggestions;
    testInfo.annotations.push({
      type: 'Precondition',
      description: `Đã đăng nhập tài khoản ứng viên mới (authSetup: ${authenticatedUser.phone || authenticatedUser.email}); Job goal chưa có job title`,
    });

    await test.step('Given Tiền điều kiện: Người dùng chưa khai job title và đang ở trang Hồ sơ của tôi', async () => {
      await openMyProfile(page, pages);
      suggestions.startSuggestRequestLog();
      await skillPage.capture('profile_page_opened_without_job_title', true);
    });

    await test.step('When Người dùng mở modal Kỹ năng', async () => {
      await suggestions.openEditor();
      await skillPage.capture('skills_modal_without_suggestions', false);
    });

    await test.step('Then Không có khu vực gợi ý và hệ thống không gọi API gợi ý kỹ năng', async () => {
      await suggestions.expectCardHidden();
      await suggestions.expectSelectedCount(0);
      expect(suggestions.suggestRequests, 'Không được gọi API gợi ý khi Job goal chưa có job title').toHaveLength(0);
    });
  });

  test('TC-177 - AC-075 Chọn chip gợi ý thì skill lên đầu danh sách đã chọn, chip kế tiếp bù chỗ và lưu được vào hồ sơ', async ({
    page,
    authenticatedUser,
    workerUserData,
    pages,
  }, testInfo) => {
    const skillPage = pages.profileSkillPage;
    const suggestions = skillPage.suggestions;
    testInfo.annotations.push({
      type: 'Precondition',
      description: `Đã đăng nhập tài khoản ứng viên mới (authSetup: ${authenticatedUser.phone || authenticatedUser.email}); Job goal đặt qua API với job title "${jobGoal.job_title}"; hồ sơ chưa có kỹ năng`,
    });
    let suggested;
    let firstPick;
    let secondPick;

    await test.step(`Given Tiền điều kiện: Job goal có job title "${jobGoal.job_title}" và modal Kỹ năng đang hiển thị gợi ý`, async () => {
      await setJobGoalByApi(workerUserData.user, jobGoal);
      await openMyProfile(page, pages);
      suggested = await suggestions.openEditorWithSuggestions();
      expect(suggested.skillNames.length, 'Cần nhiều hơn 6 gợi ý để kiểm tra chip bù chỗ').toBeGreaterThan(maxChips + 1);
      await suggestions.expectChips(suggested.skillNames.slice(0, maxChips));
      await skillPage.capture('skills_modal_with_suggestions', false);
    });

    await test.step('When Người dùng chọn chip gợi ý thứ hai', async () => {
      firstPick = suggested.skillNames[1];
      const selectedLog = await suggestions.selectChip(firstPick);
      expect(selectedLog.selected_id, 'Request selected phải ghi đúng skill vừa chọn').toBe(suggested.skillIds[1]);
      expect(selectedLog.session_id).toBe(suggested.sessionId);
      await skillPage.capture('first_suggestion_selected', false);
    });

    await test.step('Then Skill đó lên đầu danh sách đã chọn, bộ đếm tăng 1 và chip kế tiếp xuất hiện ở cuối để đủ 5 chip', async () => {
      await suggestions.expectSelectedCount(1);
      await suggestions.expectSelectedOnTop(firstPick);
      const names = suggested.skillNames;
      await suggestions.expectChips([names[0], names[2], names[3], names[4], names[5]]);
    });

    await test.step('When Người dùng chọn tiếp chip đầu tiên rồi lưu', async () => {
      secondPick = suggested.skillNames[0];
      await suggestions.selectChip(secondPick);
      await suggestions.expectSelectedCount(2);
      await suggestions.expectSelectedOnTop(secondPick);
      await skillPage.capture('second_suggestion_selected', false);
      await suggestions.saveEditor();
    });

    await test.step('Then Hồ sơ hiển thị cả hai skill vừa chọn và giữ nguyên sau khi tải lại trang', async () => {
      await skillPage.reloadProfile();
      await expect(skillPage.profileSkill(firstPick)).toBeVisible();
      await expect(skillPage.profileSkill(secondPick)).toBeVisible();
      await skillPage.capture('profile_skills_saved_from_suggestions', true);
    });
  });

  test('TC-178 - AC-076 Chọn chip trùng skill vừa thêm trong phiên thì không tạo trùng, số lượng giữ nguyên và skill đó lên đầu', async ({
    page,
    authenticatedUser,
    workerUserData,
    pages,
  }, testInfo) => {
    const skillPage = pages.profileSkillPage;
    const suggestions = skillPage.suggestions;
    testInfo.annotations.push({
      type: 'Precondition',
      description: `Đã đăng nhập tài khoản ứng viên mới (authSetup: ${authenticatedUser.phone || authenticatedUser.email}); Job goal đặt qua API với job title "${jobGoal.job_title}"; hồ sơ chưa có kỹ năng`,
    });
    let suggested;
    let duplicateSkill;

    await test.step(`Given Tiền điều kiện: Job goal có job title "${jobGoal.job_title}" và modal Kỹ năng đang hiển thị gợi ý`, async () => {
      await setJobGoalByApi(workerUserData.user, jobGoal);
      await openMyProfile(page, pages);
      suggested = await suggestions.openEditorWithSuggestions();
      expect(suggested.skillNames.length, 'Cần nhiều hơn 5 gợi ý để kiểm tra chip bù chỗ').toBeGreaterThan(maxChips);
      await suggestions.expectChips(suggested.skillNames.slice(0, maxChips));
    });

    await test.step('And Người dùng tự tìm và thêm từ thư viện đúng skill đang được gợi ý ở chip đầu tiên (chưa lưu)', async () => {
      duplicateSkill = suggested.skillNames[0];
      await skillPage.searchSkill(duplicateSkill);
      await skillPage.selectLibrarySkill(duplicateSkill);
      await suggestions.expandCard();
      await suggestions.expectSelectedCount(1);
      await expect(suggestions.chip(duplicateSkill)).toBeVisible();
      await skillPage.capture('library_skill_added_same_as_suggestion', false);
    });

    await test.step('When Người dùng bấm chip gợi ý trùng với skill vừa thêm', async () => {
      await suggestions.selectChip(duplicateSkill);
      await skillPage.capture('duplicate_suggestion_selected', false);
    });

    await test.step('Then Không tạo skill trùng, bộ đếm giữ nguyên, skill đó đứng đầu và chip trùng được thay bằng chip kế tiếp', async () => {
      await suggestions.expectSelectedCount(1);
      await suggestions.expectSelectedOnTop(duplicateSkill);
      await expect(suggestions.chip(duplicateSkill)).toHaveCount(0);
      await suggestions.expectChips(suggested.skillNames.slice(1, maxChips + 1));
    });
  });

  test('TC-179 - AC-077 Chạm 20/20 khi đang chọn thì gợi ý vẫn hiển thị nhưng không thêm được, mở lại khi đã đủ 20 thì không còn gợi ý', async ({
    page,
    authenticatedUser,
    workerUserData,
    pages,
  }, testInfo) => {
    const skillPage = pages.profileSkillPage;
    const suggestions = skillPage.suggestions;
    const seededCount = suggestData.seededSkillCountNearLimit;
    testInfo.annotations.push({
      type: 'Precondition',
      description: `Đã đăng nhập tài khoản ứng viên mới (authSetup: ${authenticatedUser.phone || authenticatedUser.email}); Job goal đặt qua API với job title "${jobGoal.job_title}"; hồ sơ có sẵn ${seededCount}/${maxSkills} kỹ năng (đặt qua API)`,
    });
    let suggested;

    await test.step(`Given Tiền điều kiện: Hồ sơ có ${seededCount}/${maxSkills} kỹ năng, Job goal có job title và modal Kỹ năng đang hiển thị gợi ý`, async () => {
      await setJobGoalByApi(workerUserData.user, jobGoal);
      await setProfileSkillsByApi(workerUserData.user, buildSeededSkillNames(suggestData.seededSkillPrefix, seededCount));
      await openMyProfile(page, pages);
      suggested = await suggestions.openEditorWithSuggestions();
      expect(suggested.skillNames.length, 'Cần ít nhất 7 gợi ý để còn chip sau khi chọn 2').toBeGreaterThan(maxChips + 1);
      await suggestions.expectSelectedCount(seededCount);
      await suggestions.expectChips(suggested.skillNames.slice(0, maxChips));
      await skillPage.capture('skills_modal_near_limit', false);
    });

    await test.step('When Người dùng chọn 2 chip gợi ý để đạt 20/20', async () => {
      await suggestions.selectChip(suggested.skillNames[0]);
      await suggestions.selectChip(suggested.skillNames[1]);
      await skillPage.capture('skills_limit_reached', false);
    });

    await test.step('Then Bộ đếm là 20/20 và khu vực gợi ý vẫn hiển thị đủ 5 chip', async () => {
      await suggestions.expectSelectedCount(maxSkills);
      await suggestions.expectChips(suggested.skillNames.slice(2, maxChips + 2));
    });

    await test.step('When Người dùng bấm thêm 1 chip gợi ý khi đã đủ 20/20', async () => {
      await suggestions.clickChipAtLimit(suggested.skillNames[2]);
      await skillPage.capture('suggestion_clicked_at_limit', false);
    });

    await test.step('Then Hệ thống không thêm skill: bộ đếm vẫn 20/20 và chip đó vẫn nằm trong khu vực gợi ý', async () => {
      await suggestions.expectSelectedCount(maxSkills);
      await expect(suggestions.selectedSkill(suggested.skillNames[2])).toHaveCount(0);
      await suggestions.expectChips(suggested.skillNames.slice(2, maxChips + 2));
    });

    await test.step('When Người dùng lưu 20 kỹ năng rồi mở lại modal Kỹ năng', async () => {
      await suggestions.saveEditor();
      await skillPage.reloadProfile();
      await suggestions.openEditor();
      await skillPage.capture('skills_modal_reopened_at_limit', false);
    });

    await test.step('Then Hồ sơ đã đủ 20/20 nên modal không hiển thị khu vực gợi ý', async () => {
      await suggestions.expectSelectedCount(maxSkills);
      await suggestions.expectCardHidden();
    });
  });
});
