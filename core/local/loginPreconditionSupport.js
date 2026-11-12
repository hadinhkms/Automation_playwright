const { test: playwrightTest } = require('@playwright/test');

// Đăng nhập tiền điều kiện trên QC mất 45-75s (tải trang chủ + đóng popup + OTP) và chạy trong setup của fixture
// authenticatedUser, tức dùng chung testTimeout 60s với thân test → cộng thêm ngân sách riêng cho bước này.
const LOGIN_PRECONDITION_BUDGET_MS = 120000;

function extendTimeoutForLoginPrecondition() {
  let testInfo;
  try {
    testInfo = playwrightTest.info();
  } catch {
    return; // Gọi ngoài phạm vi test (vd. global setup): không có timeout để nới
  }
  if (testInfo.timeout > 0) testInfo.setTimeout(testInfo.timeout + LOGIN_PRECONDITION_BUDGET_MS);
}

async function trustRuntimeEmailVerification(page) {
  const markEmailVerified = async (route) => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.pathname !== '/seeker/fe/me') {
      await route.continue();
      return;
    }

    const response = await route.fetch();
    const body = await response.json().catch(() => null);
    if (!body) {
      await route.fulfill({ response });
      return;
    }

    if (body?.data?.token_email === 'no_verified') {
      body.data.token_email = 'verified';
    }

    await route.fulfill({ response, json: body });
  };

  await page.route('**/seeker/fe/me', markEmailVerified);
  await page.route('**/seeker/fe/me?*', markEmailVerified);
}

module.exports = { extendTimeoutForLoginPrecondition, trustRuntimeEmailVerification };
