const { test, expect } = require('../../../core/fixtures/baseTest');
const chopWebData = require('../../../data/chopWebData.json');
const { ChopWebEntryPage } = require('../../../pages/desktop/ChopWebEntryPage');
const { setJobGoalByApi, getChopPromptConfigByApi } = require('../../../core/utils/chopWebApiHelper');

test.describe('Feature: Câu mẫu Chớp Web hiển thị theo cấu hình admin @chatbot @desktop @e2e @REQ-007', () => {
  test.setTimeout(180000);

  test('TC-107 - AC-027 Khách vãng lai thấy 3 câu mẫu đầu của cấu hình ở floating panel, dialog Hỏi Chớp và dropdown tìm kiếm', async ({ page }, testInfo) => {
    const chopWeb = new ChopWebEntryPage(page, 'chop_web_cau_mau_guest');
    testInfo.annotations.push({ type: 'Precondition', description: 'Khách vãng lai truy cập trang chủ (Chưa đăng nhập)' });

    let promptConfig;
    let expectedPrompts;
    let floatingPrompts;
    await test.step('Given Tiền điều kiện: Khách mở trang chủ; cấu hình câu mẫu hiện tại đọc từ API', async () => {
      promptConfig = await getChopPromptConfigByApi();
      await chopWeb.openGuestHome();
      expectedPrompts = ChopWebEntryPage.expectedGuestPrompts(promptConfig);
      floatingPrompts = await chopWeb.getFloatingPromptTexts();
      await chopWeb.capture('home_floating_panel_opened', false);
    });

    await test.step('Then Floating panel hiển thị đúng 3 câu đầu của cấu hình theo thứ tự', async () => {
      expect(floatingPrompts).toEqual(expectedPrompts);
    });

    await test.step('When Khách đóng floating panel và mở dialog Hỏi Chớp', async () => {
      await chopWeb.closeFloatingPanel();
      await chopWeb.openAskDialog();
      await chopWeb.capture('ask_dialog_opened', false);
    });

    await test.step('Then Dialog Hỏi Chớp hiển thị đúng 3 câu đầu của cấu hình theo thứ tự', async () => {
      expect(await chopWeb.getAskDialogPromptTexts()).toEqual(expectedPrompts);
    });

    await test.step('When Khách đóng dialog và bấm vào ô tìm kiếm', async () => {
      await chopWeb.closeAskDialog();
      await chopWeb.openSearchDropdown();
      await chopWeb.capture('search_dropdown_opened', false);
    });

    await test.step('Then Section Hỏi Chớp trong dropdown hiển thị đúng 3 câu đầu của cấu hình', async () => {
      expect(await chopWeb.getSearchDropdownPromptTexts()).toEqual(expectedPrompts);
    });
  });

  test('TC-108 - AC-028 Khách chọn câu mẫu ở floating panel, gửi và đăng nhập thì Chớp nhận đúng câu đã chọn', async ({ page, workerUserData }, testInfo) => {
    const chopWeb = new ChopWebEntryPage(page, 'chop_web_cau_mau_send');
    testInfo.annotations.push({
      type: 'Precondition',
      description: `Khách vãng lai truy cập trang chủ; tài khoản đăng nhập tạo từ API (${workerUserData.user?.phone || 'Test User'})`,
    });

    let selectedPrompt;
    await test.step('Given Tiền điều kiện: Khách mở trang chủ, floating panel hiển thị câu mẫu', async () => {
      const promptConfig = await getChopPromptConfigByApi();
      await chopWeb.openGuestHome();
      [selectedPrompt] = ChopWebEntryPage.expectedGuestPrompts(promptConfig);
      await chopWeb.expectFloatingPanelVisible();
      await chopWeb.capture('home_floating_panel_opened', false);
    });

    await test.step('When Khách chọn câu mẫu đầu tiên', async () => {
      await chopWeb.selectFloatingPrompt(selectedPrompt);
      await chopWeb.capture('floating_prompt_selected', false);
    });

    await test.step('And Khách gửi câu hỏi và đăng nhập trên trang Chớp', async () => {
      await chopWeb.sendFloatingMessage();
      await chopWeb.loginOnChopPage(workerUserData.user);
      await chopWeb.capture('chop_page_logged_in');
    });

    await test.step('Then Hội thoại Chớp chứa đúng câu mẫu khách đã chọn', async () => {
      await chopWeb.expectChopConversationContains(selectedPrompt);
      await chopWeb.capture('chop_history_contains_prompt');
    });
  });

  test('TC-109 - AC-029 Ứng viên có job goal không có mức lương thấy chip lương lấy câu salary_min đầu tiên của cấu hình', async ({ page, workerUserData }, testInfo) => {
    const chopWeb = new ChopWebEntryPage(page, 'chop_web_cau_mau_fallback');
    testInfo.annotations.push({
      type: 'Precondition',
      description: `Tài khoản tạo từ API (${workerUserData.user?.phone || 'Test User'}); job goal đặt qua API: Hà Nội / Kế toán / lương Thoả thuận`,
    });

    let promptConfig;
    await test.step('Given Tiền điều kiện: Ứng viên có job goal không có mức lương và đăng nhập ở trang chủ', async () => {
      await setJobGoalByApi(workerUserData.user, chopWebData.jobGoalWithoutSalary);
      promptConfig = await getChopPromptConfigByApi();
      await chopWeb.openGuestHome();
      await chopWeb.loginFromHeader(workerUserData.user);
      await chopWeb.homePage.navigate();
      await chopWeb.homePage.expectHomepageVisible();
      await chopWeb.capture('home_logged_in_with_job_goal', false);
    });

    await test.step('When Ứng viên mở dialog Hỏi Chớp', async () => {
      await chopWeb.openAskDialog();
      await chopWeb.capture('ask_dialog_opened', false);
    });

    await test.step('Then Hai chip đầu cá nhân hoá theo job goal, chip lương dùng câu salary_min đầu tiên của cấu hình', async () => {
      const chips = await chopWeb.getAskDialogPromptTexts();
      expect(chips).toHaveLength(3);
      expect(chips[0].startsWith(chopWebData.personalizedPromptPrefix)).toBeTruthy();
      expect(chips[1].startsWith(chopWebData.personalizedPromptPrefix)).toBeTruthy();
      expect(chips[2]).toBe(ChopWebEntryPage.firstPromptOfSlot(promptConfig, 'salary_min'));
    });
  });
});
