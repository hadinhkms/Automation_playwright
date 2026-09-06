const { test, expect } = require('@playwright/test');
const SamplePage = require('../../../pages/desktop/SamplePage');
const sampleData = require('../../../data/sampleData.json');

test.describe('Kịch bản Mobile Web mẫu (Starter Mobile Suite)', () => {
  test('Kiểm tra tải trang trên thiết bị di động @smoke @mobile', async ({ page }) => {
    const samplePage = new SamplePage(page);

    await test.step('1. Mở trang web mẫu trên mobile', async () => {
      await samplePage.open(sampleData.sampleUrl || 'https://example.com');
    });

    await test.step('2. Kiểm tra phần tử hiển thị', async () => {
      const heading = await samplePage.getHeadingText();
      expect(heading).toBeTruthy();
    });
  });
});
