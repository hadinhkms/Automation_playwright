const { test, expect } = require('../../../core/fixtures/baseTest');
const sampleData = require('../../../data/sampleData.json');

test.describe('Kịch bản kiểm thử mẫu với Lazy Page Container 10/10', () => {
  test('Tự động nạp SamplePage qua pages fixture @smoke @e2e', async ({ pages }, testInfo) => {
    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Môi trường sẵn sàng, tự động nạp Page Object qua pages container mà không cần import hay khởi tạo thủ công',
    });

    await test.step('Given Mở trang web mẫu thông qua pages.sample', async () => {
      await pages.sample.open(sampleData.sampleUrl || 'https://example.com');
    });

    await test.step('When Đọc tiêu đề chính của trang', async () => {
      const heading = await pages.sample.getHeadingText();
      expect(heading).toBeTruthy();
    });

    await test.step('Then Tiêu đề chính phải hiển thị nội dung hợp lệ', async () => {
      const heading = await pages.sample.getHeadingText();
      expect(heading.trim().length).toBeGreaterThan(0);
    });
  });
});
