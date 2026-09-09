const { test, expect } = require('../../../core/fixtures/baseTest');
const searchCriteria = require('../../../data/searchCriteria.json');


test.describe('Kịch bản kiểm thử vòng đời Fixture & Tự động dọn dẹp (Setup/Teardown)', () => {
  test('Tự động cấp phát và xóa User tạm thời thông qua custom fixture ephemeralUser @smoke @e2e', async ({ pages, ephemeralUser, cleanupQueue }, testInfo) => {
    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Hệ thống tự động cấp phát user tạm từ ephemeralUser fixture và đăng ký dọn dẹp vào cleanupQueue',
    });

        await test.step('Given User tạm được khởi tạo thành công với thông tin hợp lệ', async () => {
expect(ephemeralUser).toBeDefined();
      expect(ephemeralUser.id).toMatch(/^usr_/);
      expect(ephemeralUser.status).toBe('active');
      expect(ephemeralUser.cleanedUp).toBe(false);
    });

    await test.step('When Người dùng mở trang web mẫu với phiên làm việc của user tạm', async () => {
await pages.sample.open(sampleData.sampleUrl || 'https://example.com');
      const heading = await pages.sample.getHeadingText();
      expect(heading).toBeTruthy();
    });

    await test.step('Then Đăng ký thêm một tác vụ dọn dẹp trực tiếp qua cleanupQueue', async () => {
let customLog = 'pending';
      cleanupQueue.register(async () => {
        customLog = 'done';
      }, 'Dọn dẹp nhật ký session kiểm thử');
      expect(customLog).toBe('pending');
    });
  });
});
