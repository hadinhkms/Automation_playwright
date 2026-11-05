const { test, expect } = require('../../../core/fixtures/baseTest');
const skillData = require('../../../data/skillNormalizationData.json');
const { OnboardingPopup } = require('../../../pages/desktop/OnboardingPopup');

test.describe('Feature: Chuẩn hóa kỹ năng khi thêm vào hồ sơ (Skill Normalization v1.1 – JS-8828) @auth @profile @desktop @e2e @REQ-005', () => {
  // Timeout cấp describe áp dụng cả bước setup fixture authenticatedUser
  test.describe.configure({ timeout: 600000 });

  test('TC-170 - AC-070 Keyword trùng thư viện sau chuẩn hóa không hiện nút Thêm, keyword mới thêm được và hồ sơ lưu tên chuẩn', async ({
    page,
    authenticatedUser,
    pages,
  }, testInfo) => {
    const homePage = pages.homePage;
    const onboardingPopup = new OnboardingPopup(page);
    const userProfilePage = pages.userProfilePage;
    const skillPage = pages.profileSkillPage;
    const [caseTrimSkill, spacingSkill] = skillData.librarySkills;
    const { manualSkill } = skillData;
    testInfo.annotations.push({
      type: 'Precondition',
      description: `Đã đăng nhập tài khoản ứng viên mới (authSetup: ${authenticatedUser.phone || authenticatedUser.email}), hồ sơ chưa có kỹ năng`,
    });

    await test.step('Given Tiền điều kiện: Người dùng đã đăng nhập và đang ở trang Hồ sơ của tôi', async () => {
      await onboardingPopup.closeIfVisible(undefined, { modalTimeout: 15000, closeBtnTimeout: 5000, modalHiddenTimeout: 10000 });
      await homePage.closeBlockingModalIfVisible();
      await userProfilePage.navigateToMyProfile();
      await skillPage.capture('profile_page_opened', true);
    });

    await test.step('When Người dùng mở modal Kỹ năng', async () => {
      await skillPage.openSkillsEditor();
      await skillPage.capture('skills_modal_opened', false);
    });

    await test.step(`And Người dùng tìm "${caseTrimSkill.keyword}" (${caseTrimSkill.rule})`, async () => {
      await skillPage.searchSkill(caseTrimSkill.keyword);
    });

    await test.step(`Then Không hiển thị nút Thêm mới, chỉ gợi ý skill thư viện "${caseTrimSkill.canonicalName}"`, async () => {
      await expect(skillPage.libraryOption(caseTrimSkill.canonicalName)).toBeVisible();
      await expect(skillPage.btnAddNewSkill).toBeHidden();
      await skillPage.capture('exact_match_trim_case_no_add_button', false);
    });

    await test.step(`And Người dùng chọn "${caseTrimSkill.canonicalName}" từ thư viện`, async () => {
      await skillPage.selectLibrarySkill(caseTrimSkill.canonicalName);
    });

    await test.step(`When Người dùng tìm "${spacingSkill.keyword}" (${spacingSkill.rule})`, async () => {
      await skillPage.searchSkill(spacingSkill.keyword);
    });

    await test.step(`Then Không hiển thị nút Thêm mới, chọn được skill thư viện "${spacingSkill.canonicalName}"`, async () => {
      await expect(skillPage.libraryOption(spacingSkill.canonicalName)).toBeVisible();
      await expect(skillPage.btnAddNewSkill).toBeHidden();
      await skillPage.selectLibrarySkill(spacingSkill.canonicalName);
      await skillPage.capture('exact_match_spacing_selected', false);
    });

    await test.step(`When Người dùng tìm keyword chưa có trong thư viện "${manualSkill.keyword}"`, async () => {
      await skillPage.searchSkill(manualSkill.keyword);
    });

    await test.step(`Then Hiển thị nút "Thêm mới: ${manualSkill.savedName}" và thêm được skill tự nhập`, async () => {
      await expect(skillPage.btnAddNewSkill).toBeVisible();
      await expect(skillPage.suggestionPanel).toContainText(`Thêm mới: ${manualSkill.savedName}`);
      await skillPage.capture('no_match_add_button_visible', false);
      await skillPage.addNewSkill(manualSkill.savedName);
      await skillPage.capture('manual_skill_added', false);
    });

    await test.step('When Người dùng bấm Lưu thông tin', async () => {
      await skillPage.saveSkills();
    });

    await test.step('Then Hồ sơ hiển thị đúng tên chuẩn của thư viện và skill tự nhập đã chuẩn hóa, giữ nguyên sau khi tải lại trang', async () => {
      await skillPage.reloadProfile();
      for (const savedSkill of [caseTrimSkill.canonicalName, spacingSkill.canonicalName, manualSkill.savedName]) {
        await expect(skillPage.profileSkill(savedSkill)).toBeVisible();
      }
      await expect(skillPage.profileSkill(caseTrimSkill.keyword.trim())).toHaveCount(0);
      await skillPage.capture('profile_skills_saved_canonical', true);
    });
  });
});
