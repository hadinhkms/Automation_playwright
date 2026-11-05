const { test, expect } = require('../../../core/fixtures/mobileWebTest');
const { MobileChopWebEntryPage } = require('../../../pages/mobile-web/MobileChopWebEntryPage');
const { getChopPromptConfigByApi } = require('../../../core/utils/chopWebApiHelper');

test.describe('Mobile Feature: Câu mẫu Chớp Web hiển thị theo cấu hình admin @chatbot @mobile @e2e @REQ-007', () => {
  test.setTimeout(180000);

  test('TC-107 - AC-027 Khách vãng lai trên Mobile Web thấy 3 câu mẫu đầu của cấu hình ở floating panel, dialog Hỏi Chớp và dropdown tìm kiếm', async ({ page }, testInfo) => {
    const chopWeb = new MobileChopWebEntryPage(page, 'mobile_chop_web_cau_mau_guest');
    testInfo.annotations.push({ type: 'Precondition', description: 'Khách vãng lai truy cập trang chủ trên Mobile Web (Chưa đăng nhập)' });

    let expectedPrompts;
    let floatingPrompts;
    await test.step('Given Tiền điều kiện: Khách mở trang chủ trên mobile; cấu hình câu mẫu hiện tại đọc từ API', async () => {
      const promptConfig = await getChopPromptConfigByApi();
      expectedPrompts = MobileChopWebEntryPage.expectedGuestPrompts(promptConfig);
      await chopWeb.openGuestHome();
      floatingPrompts = await chopWeb.getFloatingPromptTexts();
      await chopWeb.capture('mobile_home_floating_panel_opened', false);
    });

    await test.step('Then Floating panel hiển thị đúng 3 câu đầu của cấu hình theo thứ tự', async () => {
      expect(floatingPrompts).toEqual(expectedPrompts);
    });

    await test.step('When Khách đóng floating panel và mở dialog Hỏi Chớp', async () => {
      await chopWeb.closeFloatingPanel();
      await chopWeb.openAskDialog();
      await chopWeb.capture('mobile_ask_dialog_opened', false);
    });

    await test.step('Then Dialog Hỏi Chớp hiển thị đúng 3 câu đầu của cấu hình theo thứ tự', async () => {
      expect(await chopWeb.getAskDialogPromptTexts()).toEqual(expectedPrompts);
    });

    await test.step('When Khách đóng dialog và chạm vào ô tìm kiếm', async () => {
      await chopWeb.closeAskDialog();
      await chopWeb.openSearchDropdown();
      await chopWeb.capture('mobile_search_dropdown_opened', false);
    });

    await test.step('Then Section Hỏi Chớp trong dropdown hiển thị đúng 3 câu đầu của cấu hình', async () => {
      expect(await chopWeb.getSearchDropdownPromptTexts()).toEqual(expectedPrompts);
    });
  });
});
