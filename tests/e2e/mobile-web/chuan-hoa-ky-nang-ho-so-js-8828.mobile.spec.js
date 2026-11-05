const { test, expect } = require('../../../core/fixtures/mobileWebTest');
const skillData = require('../../../data/skillNormalizationData.json');
const { MobileHomePage } = require('../../../pages/mobile-web/MobileHomePage');
const { MobileOnboardingPopup } = require('../../../pages/mobile-web/MobileOnboardingPopup');
const { MobileUserProfilePage } = require('../../../pages/mobile-web/MobileUserProfilePage');

test.describe('Mobile Feature: Chuẩn hóa kỹ năng khi thêm vào hồ sơ trên Mobile Web (Skill Normalization v1.1 – JS-8828) @auth @profile @mobile @e2e @REQ-005', () => {
  // Timeout cấp describe áp dụng cả bước setup fixture authenticatedUser (WebKit đăng nhập chậm)
  test.describe.configure({ timeout: 600000 });

  test('TC-171 - AC-070 Bottom sheet Kỹ năng ẩn nút Thêm khi trùng thư viện sau chuẩn hóa, thêm skill mới và lưu tên chuẩn trên mobile web', async ({
    page,
    authenticatedUser,
    pages,
  }, testInfo) => {
    const homePage = new MobileHomePage(page);
    const onboardingPopup = new MobileOnboardingPopup(page);
    const userProfilePage = new MobileUserProfilePage(page);
    const skillPage = pages.mobileProfileSkillPage;
    const [caseTrimSkill, spacingSkill] = skillData.librarySkills;
    const { manualSkill } = skillData;
    testInfo.annotations.push({
      type: 'Precondition',
      description: `Đã đăng nhập Mobile Web bằng tài khoản ứng viên mới (authSetup: ${authenticatedUser.phone || authenticatedUser.email}), hồ sơ chưa có kỹ năng`,
    });

    await test.step('Given Tiền điều kiện: Người dùng mobile đã đăng nhập và đang ở trang Hồ sơ của tôi', async () => {
      await onboardingPopup.closeIfVisible(undefined, { modalTimeout: 15000, closeBtnTimeout: 5000, modalHiddenTimeout: 10000 });
      await homePage.closeBlockingModalIfVisible();
      await userProfilePage.navigateToMyProfile();
      await skillPage.expectSkillsSectionVisible();
      await skillPage.capture('mobile_profile_page_opened', true);
    });

    await test.step('When Người dùng mở trang Kỹ năng và chạm ô tìm kiếm để mở bottom sheet', async () => {
      await skillPage.openSkillsEditor();
      await skillPage.capture('mobile_skills_sheet_opened', false);
    });

    await test.step(`And Người dùng tìm "${caseTrimSkill.keyword}" (${caseTrimSkill.rule})`, async () => {
      await skillPage.searchSkill(caseTrimSkill.keyword);
    });

    await test.step(`Then Không hiển thị nút Thêm mới, chỉ gợi ý skill thư viện "${caseTrimSkill.canonicalName}"`, async () => {
      await expect(skillPage.libraryOption(caseTrimSkill.canonicalName)).toBeVisible();
      await expect(skillPage.btnAddNewSkill).toBeHidden();
      await skillPage.capture('mobile_exact_match_trim_case_no_add_button', false);
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
      await skillPage.capture('mobile_exact_match_spacing_selected', false);
    });

    await test.step(`When Người dùng tìm keyword chưa có trong thư viện "${manualSkill.keyword}"`, async () => {
      await skillPage.searchSkill(manualSkill.keyword);
    });

    await test.step(`Then Hiển thị nút "Thêm mới: ${manualSkill.savedName}" và thêm được skill tự nhập`, async () => {
      await expect(skillPage.btnAddNewSkill).toBeVisible();
      await expect(skillPage.suggestionPanel).toContainText(`Thêm mới: ${manualSkill.savedName}`);
      await skillPage.capture('mobile_no_match_add_button_visible', false);
      await skillPage.addNewSkill(manualSkill.savedName);
      await skillPage.capture('mobile_manual_skill_added', false);
    });

    await test.step('When Người dùng bấm "Lưu kỹ năng" tại bottom sheet', async () => {
      await skillPage.saveSkills();
    });

    await test.step('Then Hồ sơ hiển thị đúng tên chuẩn của thư viện và skill tự nhập đã chuẩn hóa sau khi tải lại trang', async () => {
      await skillPage.reloadProfile();
      for (const savedSkill of [caseTrimSkill.canonicalName, spacingSkill.canonicalName, manualSkill.savedName]) {
        await expect(skillPage.profileSkill(savedSkill)).toBeVisible();
      }
      await expect(skillPage.profileSkill(caseTrimSkill.keyword.trim())).toHaveCount(0);
      await skillPage.capture('mobile_profile_skills_saved_canonical', true);
    });
  });
});
