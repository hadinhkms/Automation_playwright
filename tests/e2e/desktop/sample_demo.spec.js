const { test, expect } = require('@playwright/test');
const SamplePage = require('../../../pages/desktop/SamplePage');
const sampleData = require('../../../data/sampleData.json');

test.describe('Kịch bản kiểm thử mẫu (Starter Demo Suite)', () => {
  test('Kiểm tra tải trang mẫu và tiêu đề @smoke @e2e', async ({ page }) => {
    const samplePage = new SamplePage(page);

    await test.step('1. Mở trang web mẫu', async () => {
      await samplePage.open(sampleData.sampleUrl || 'https://example.com');
    });

    await test.step('2. Kiểm tra tiêu đề chính hiển thị đúng', async () => {
      const heading = await samplePage.getHeadingText();
      expect(heading).toBeTruthy();
    });
  });
});
