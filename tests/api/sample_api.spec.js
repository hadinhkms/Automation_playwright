const { test, expect } = require('@playwright/test');

test.describe('Kịch bản API mẫu (Starter API Suite)', () => {
  test('Kiểm tra gọi API mẫu GET status @api', async ({ request }) => {
    await test.step('1. Gửi request GET tới endpoint kiểm tra', async () => {
      const response = await request.get('https://httpbin.org/get');
      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('url');
    });
  });
});
