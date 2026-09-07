const { test, expect } = require('../../../core/fixtures/mobileWebTest');
const SampleMobilePage = require('../../../pages/mobile/SampleMobilePage');
const sampleData = require('../../../data/sampleData.json');

test.describe('Kịch bản Mobile Web mẫu (Starter Mobile Suite)', () => {
  test('Kiểm tra tải trang trên thiết bị di động @smoke @mobile', async ({ page }, testInfo) => {
    testInfo.annotations.push({
      type: 'Precondition',
      description: 'Giao diện Mobile Web khởi tạo thành công trên viewport di động',
    });

    const sampleMobilePage = new SampleMobilePage(page);

    await test.step('Given Tiền điều kiện: Mở trang web mẫu trên viewport mobile', async () => {
      await sampleMobilePage.open(sampleData.sampleUrl || 'https://example.com');
    });

    await test.step('When Đọc tiêu đề hiển thị trên mobile web', async () => {
      const heading = await sampleMobilePage.getHeadingText();
      expect(heading).toBeTruthy();
    });

    await test.step('Then Tiêu đề chính phải hiển thị đầy đủ và rõ ràng trên mobile', async () => {
      const heading = await sampleMobilePage.getHeadingText();
      expect(heading.trim().length).toBeGreaterThan(0);
    });
  });
});
