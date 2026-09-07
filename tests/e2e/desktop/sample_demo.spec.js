const { test, expect } = require('../../../core/fixtures/baseTest');
const SamplePage = require('../../../pages/desktop/SamplePage');
const sampleData = require('../../../data/sampleData.json');

test.describe('Kịch bản kiểm thử mẫu Desktop (Starter Demo Suite)', () => {
  test('Kiểm tra tải trang mẫu và tiêu đề @smoke @e2e', async ({ page }, testInfo) => {
    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Môi trường sẵn sàng, người dùng truy cập trang web mẫu (Khách vãng lai)',
    });

    const samplePage = new SamplePage(page);

    await test.step('Given Tiền điều kiện: Mở trang web mẫu', async () => {
      await samplePage.open(sampleData.sampleUrl || 'https://example.com');
    });

    await test.step('When Đọc tiêu đề chính của trang', async () => {
      const heading = await samplePage.getHeadingText();
      expect(heading).toBeTruthy();
    });

    await test.step('Then Tiêu đề chính phải hiển thị nội dung hợp lệ', async () => {
      const heading = await samplePage.getHeadingText();
      expect(heading.trim().length).toBeGreaterThan(0);
    });
  });
});
