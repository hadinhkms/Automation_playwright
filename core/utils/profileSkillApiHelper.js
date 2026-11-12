const { request } = require('@playwright/test');
const envConfig = require('../config/env');
const { RegistrationApiHelper } = require('./registrationApiHelper');

/**
 * Ghi đè danh sách kỹ năng của hồ sơ qua API (dùng làm precondition, vd. hồ sơ đã có 18/20 kỹ năng),
 * thay cho việc thêm từng kỹ năng trên giao diện.
 * @param {{ tokenAuth: string }} user - user tạo từ API đăng ký (có tokenAuth)
 * @param {string[]} skillNames - danh sách tên kỹ năng sẽ thay thế toàn bộ kỹ năng hiện có
 */
async function setProfileSkillsByApi(user, skillNames) {
  if (!user?.tokenAuth) {
    throw new Error('Precondition: tài khoản kiểm thử không có tokenAuth để gọi API lưu kỹ năng');
  }
  const requestContext = await request.newContext();
  try {
    const apiHelper = new RegistrationApiHelper(requestContext);
    const headers = apiHelper.buildHeaders({ authorization: `Bearer ${user.tokenAuth}` });
    const response = await requestContext.post(new URL('/seeker/fe/api/v1/user-profile', envConfig.apiBaseURL).href, {
      headers,
      data: { resume_skills: skillNames },
    });
    const body = await response.json().catch(() => null);
    if (response.status() !== 200 || body?.code !== 200) {
      throw new Error(`Precondition: API lưu kỹ năng trả về ${response.status()} / code=${body?.code} msg=${body?.msg}`);
    }
    return body.data;
  } finally {
    await requestContext.dispose();
  }
}

/** Sinh danh sách tên kỹ năng tự nhập, không trùng thư viện, vd. "Ky nang QA 01". */
function buildSeededSkillNames(prefix, count) {
  return Array.from({ length: count }, (_, index) => `${prefix} ${String(index + 1).padStart(2, '0')}`);
}

module.exports = { setProfileSkillsByApi, buildSeededSkillNames };
