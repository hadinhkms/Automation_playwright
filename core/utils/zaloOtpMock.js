/**
 * Mock BE cho luồng Zalo OTP (REQ-012).
 *
 * Vì sao phải mock: Zalo OTP gửi tin thật tới tài khoản Zalo của số điện thoại. Số ngẫu nhiên của
 * automation không có Zalo (BE trả ZALO_PHONE_UNAVAILABLE) và QC không có mã cố định cho kênh Zalo,
 * nên happy case Zalo chỉ kiểm được phần FE bằng cách giả lập đúng contract BE:
 *   - Request OTP: GET same-origin `/<nonce>?phone=..&platform=..&m=s&channel=zalo`
 *     → text `1|<seconds>|<request_id>|<expiredAt ISO>`
 *   - Verify: POST `/fe/api/v1/guest/auth/zalo/verify-otp-and-list-accounts` body {phone, code, request_id}
 *     → JSON {code:200, msg, data:{phone, token, list:[]}}  (list rỗng = SĐT chưa có tài khoản)
 * Chỉ chặn request của kênh Zalo; kênh SMS và mọi API khác vẫn đi BE thật.
 */

const ZALO_VERIFY_PATH = '/fe/api/v1/guest/auth/zalo/verify-otp-and-list-accounts';

function isZaloOtpRequest(url) {
  return url.searchParams.has('phone') && url.searchParams.get('channel') === 'zalo';
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {{ ttlSeconds?: number, requestId?: string, accounts?: Array<object> }} [options]
 */
async function mockZaloOtpBackend(page, options = {}) {
  const {
    ttlSeconds = 120,
    requestId = `zalo_req_qa_${Date.now()}`,
    accounts = [],
  } = options;

  const calls = { otpRequests: [], verifyRequests: [] };

  await page.route(isZaloOtpRequest, async (route) => {
    const url = new URL(route.request().url());
    calls.otpRequests.push({
      phone: url.searchParams.get('phone'),
      platform: url.searchParams.get('platform'),
      channel: url.searchParams.get('channel'),
    });
    const expiredAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    await route.fulfill({
      status: 200,
      contentType: 'text/plain; charset=utf-8',
      body: `1|${ttlSeconds}|${requestId}|${expiredAt}`,
    });
  });

  await page.route(`**${ZALO_VERIFY_PATH}*`, async (route) => {
    const body = route.request().postDataJSON() || {};
    calls.verifyRequests.push(body);
    await route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify({
        code: 200,
        msg: 'Successfully',
        data: { phone: body.phone, token: 'qa-mock-token', list: accounts },
      }),
    });
  });

  return { requestId, calls };
}

module.exports = { mockZaloOtpBackend, isZaloOtpRequest, ZALO_VERIFY_PATH };
