const { test, expect } = require('../../core/fixtures/apiTest');
const env = require('../../core/config/env');

test.describe('Kịch bản API mẫu (Starter API Suite)', () => {
  test('Kiểm tra gọi API mẫu GET status @api', async ({ request }) => {
    await test.step('1. Gửi request GET tới endpoint kiểm tra', async () => {
      const response = await request.get(new URL('/get', env.apiBaseURL).href);
      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty('url');
    });
  });
});
