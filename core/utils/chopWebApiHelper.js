const { request } = require('@playwright/test');
const envConfig = require('../config/env');
const { RegistrationApiHelper } = require('./registrationApiHelper');

/**
 * Đặt tiêu chí tìm việc (job goal) cho tài khoản kiểm thử qua API onboarding,
 * thay cho việc đi qua 5 bước onboarding trên giao diện (dùng làm precondition).
 * @param {{ tokenAuth: string }} user - user tạo từ API đăng ký (có tokenAuth)
 * @param {object} jobGoal - payload job goal (xem data/chopWebData.json)
 */
async function setJobGoalByApi(user, jobGoal) {
  if (!user?.tokenAuth) {
    throw new Error('Precondition: tài khoản kiểm thử không có tokenAuth để gọi API job goal');
  }
  const requestContext = await request.newContext();
  try {
    const apiHelper = new RegistrationApiHelper(requestContext);
    const headers = apiHelper.buildHeaders({ authorization: `Bearer ${user.tokenAuth}` });
    const response = await requestContext.post(new URL('/seeker/fe/onboarding/job-goals', envConfig.apiBaseURL).href, {
      headers,
      data: jobGoal,
    });
    const body = await response.json().catch(() => null);
    if (response.status() !== 200 || body?.code !== 200) {
      throw new Error(`Precondition: API job goal trả về ${response.status()} / code=${body?.code} msg=${body?.msg}`);
    }
    return body.data;
  } finally {
    await requestContext.dispose();
  }
}

/**
 * Đọc cấu hình câu mẫu Chớp (`seeker_chatbot_default_prompts`) — cùng endpoint trang Seeker dùng.
 * Dùng token mặc định của RegistrationApiHelper (token seeker chung) nên không phụ thuộc tài khoản test.
 * @returns {Promise<Array<{slot_key: string, text: string}>>}
 */
async function getChopPromptConfigByApi() {
  const requestContext = await request.newContext();
  try {
    const apiHelper = new RegistrationApiHelper(requestContext);
    const url = new URL('/system/fe/configuration/detail', envConfig.apiBaseURL);
    url.searchParams.set('code', 'seeker_chatbot_default_prompts');
    const response = await requestContext.get(url.href, { headers: apiHelper.buildHeaders() });
    const body = await response.json().catch(() => null);
    if (response.status() !== 200 || body?.code !== 200) {
      throw new Error(`API cấu hình câu mẫu trả về ${response.status()} / code=${body?.code} msg=${body?.msg}`);
    }
    const prompts = JSON.parse(body.data?.value || '[]');
    if (!Array.isArray(prompts) || prompts.length === 0) {
      throw new Error('Cấu hình seeker_chatbot_default_prompts trống hoặc không phải mảng JSON');
    }
    return prompts;
  } finally {
    await requestContext.dispose();
  }
}

module.exports = { setJobGoalByApi, getChopPromptConfigByApi };
