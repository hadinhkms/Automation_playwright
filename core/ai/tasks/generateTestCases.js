/**
 * core/ai/tasks/generateTestCases.js
 * AI task: Generates comprehensive BDD Test Cases (Given-When-Then, BVA, Negative) from Acceptance Criteria (QA-1).
 * Strict ceiling <= 150 lines.
 */
const { callAi } = require('../gateway/index');

const SCHEMA = {
  type: 'object',
  properties: {
    testCases: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          tcId: { type: 'string' },
          acId: { type: 'string' },
          title: { type: 'string' },
          type: { type: 'string', enum: ['positive', 'negative', 'boundary', 'security'] },
          given: { type: 'string' },
          when: { type: 'string' },
          then: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } }
        }
      }
    },
    coverageNotes: { type: 'string' }
  }
};

function buildGenerateTcPrompts({ reqId = 'REQ-001', reqTitle = '', criteriaText = '', startTcNumber = 1 } = {}) {
  const system = `Bạn là Senior QA Automation Engineer kiêm Test Design Specialist (ISTQB).
Nhiệm vụ của bạn là phân tích các Acceptance Criteria (AC) trong tài liệu yêu cầu và sinh ra bộ Test Cases hoàn chỉnh đạt độ phủ 100%.
Quy chuẩn thiết kế:
1. Mỗi AC phải có ít nhất 1 test case Happy path (positive).
2. Các AC có nhập liệu hoặc tính toán phải có Test case biên (boundary value analysis - BVA) và kịch bản lỗi (negative).
3. Đặt mã TC theo thứ tự từ TC-${String(startTcNumber).padStart(3, '0')}.
4. Định dạng Given-When-Then rõ ràng, có thể tự động hóa bằng Playwright.

Phải trả về JSON đúng schema:
{
  "testCases": [
    {
      "tcId": "TC-001",
      "acId": "AC-001",
      "title": "Tên kịch bản kiểm thử súc tích",
      "type": "positive"|"negative"|"boundary"|"security",
      "given": "Tiền điều kiện",
      "when": "Thao tác người dùng",
      "then": "Kết quả mong đợi xác minh được",
      "tags": ["@smoke", "@e2e", "@p1"]
    }
  ],
  "coverageNotes": "Tóm tắt các góc độ kiểm thử đã bao phủ"
}`;

  const user = `YÊU CẦU CẦN SINH TEST CASES:
Mã Requirement: ${reqId}
Tiêu đề: ${reqTitle || '(Chưa đặt)'}

TIÊU CHÍ NGHIỆM THU (ACCEPTANCE CRITERIA):
${criteriaText.slice(0, 3500)}
---
Hãy sinh danh sách Test Cases toàn diện theo schema quy định.`;

  return [{ role: 'system', content: system }, { role: 'user', content: user }];
}

async function runGenerateTestCases({
  reqId = 'REQ-001',
  reqTitle = '',
  criteriaText = '',
  startTcNumber = 1,
  clientConfig = null,
  root = process.cwd(),
  signal = null
} = {}) {
  const messages = buildGenerateTcPrompts({ reqId, reqTitle, criteriaText, startTcNumber });

  const res = await callAi({
    task: 'generateTestCases',
    messages,
    schema: SCHEMA,
    clientConfig,
    root,
    signal,
    tier: 'fast',
    timeoutMs: 45000,
    temperature: 0.1
  });

  if (!res.ok) {
    const n1 = String(startTcNumber).padStart(3, '0');
    const n2 = String(startTcNumber + 1).padStart(3, '0');
    return {
      ok: true,
      testCases: [
        { tcId: `TC-${n1}`, acId: 'AC-001', title: `Kiểm thử luồng hợp lệ: ${reqTitle || 'Yêu cầu'}`, type: 'positive', given: 'Hệ thống sẵn sàng', when: 'Thao tác với dữ liệu hợp lệ', then: 'Hoàn tất thành công', tags: ['@smoke', '@e2e'] },
        { tcId: `TC-${n2}`, acId: 'AC-001', title: `Kiểm thử luồng ngoại lệ: ${reqTitle || 'Yêu cầu'}`, type: 'negative', given: 'Hệ thống sẵn sàng', when: 'Thao tác với dữ liệu rỗng', then: 'Báo lỗi hợp lệ', tags: ['@bva'] }
      ],
      coverageNotes: 'Kết quả từ luật (không dùng AI): ' + (res.message || 'AI offline'),
      source: 'rule'
    };
  }

  const rawCases = Array.isArray(res.data?.testCases) ? res.data.testCases : [];
  let currentNum = startTcNumber;

  const testCases = rawCases.map((tc, idx) => {
    const numStr = String(currentNum++).padStart(3, '0');
    return {
      tcId: String(tc.tcId || `TC-${numStr}`),
      acId: String(tc.acId || 'AC-001'),
      title: String(tc.title || `Test case ${numStr}`).trim(),
      type: ['positive', 'negative', 'boundary', 'security'].includes(tc.type) ? tc.type : 'positive',
      given: String(tc.given || '').trim(),
      when: String(tc.when || '').trim(),
      then: String(tc.then || '').trim(),
      tags: Array.isArray(tc.tags) && tc.tags.length ? tc.tags : ['@e2e']
    };
  });

  return {
    ok: true,
    testCases,
    coverageNotes: String(res.data?.coverageNotes || 'Đã sinh test cases thành công.').trim(),
    model: res.model,
    tier: res.tier,
    usage: res.usage,
    requestId: res.requestId
  };
}

module.exports = {
  SCHEMA,
  buildGenerateTcPrompts,
  runGenerateTestCases
};
