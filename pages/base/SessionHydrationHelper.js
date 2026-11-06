const { expect } = require('@playwright/test');

/**
 * Sau đăng nhập / tải trang mới, header (đặc biệt WebKit) render tạm trạng thái khách với nút "Đăng nhập"
 * trước khi hydrate phiên. Click menu header trong khoảng này sẽ mở popup đăng nhập thay vì menu tài khoản.
 * Chờ header về trạng thái đã đăng nhập; nếu quá hạn mà cookie phiên vẫn còn thì tải lại trang một lần.
 */
async function waitForLoggedInHeader(page, { timeout = 15000 } = {}) {
  const guestLoginBtn = page.getByRole('button', { name: /^Đăng nhập$/ }).first();
  const hydrated = await expect(guestLoginBtn).toBeHidden({ timeout }).then(() => true, () => false);
  if (hydrated) return true;
  const cookies = await page.context().cookies().catch(() => []);
  if (!cookies.some((c) => c.name === 'access_token')) return false;
  await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => null);
  return expect(guestLoginBtn).toBeHidden({ timeout }).then(() => true, () => false);
}

module.exports = { waitForLoggedInHeader };
