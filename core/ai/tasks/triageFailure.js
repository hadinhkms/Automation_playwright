/**
 * core/ai/tasks/triageFailure.js
 * AI task: Automated failure triage and Root Cause Analysis (RCA) for Playwright test runs.
 * Classifies failure into: product_bug, test_bug, environment, flaky.
 * Strict ceiling <= 150 lines.
 */
const { callAi } = require('../gateway/index');

const SCHEMA = {
  type: 'object',
  properties: {
    category: { type: 'string', enum: ['product_bug', 'test_bug', 'environment', 'flaky'] },
    confidence: { type: 'number' },
    summary: { type: 'string' },
    evidence: { type: 'string' },
    suggestedFix: { type: 'string' }
  }
};

function buildTriagePrompts({ errorText = '', testTitle = '', locator = '', snippet = '', consoleLogs = '', url = '' } = {}) {
  const system = `Bạn là Senior QA Automation Architect kiêm Root Cause Analysis (RCA) Specialist với hơn 10 năm kinh nghiệm xử lý lỗi Playwright.
Nhiệm vụ của bạn là phân tích thông tin lỗi kiểm thử và phân loại chính xác nguyên nhân gốc rễ vào ĐÚNG MỘT trong 4 nhóm:
1. "product_bug": Lỗi sản phẩm (giao diện thực tế sai nghiệp vụ, crash 500, dữ liệu không hiển thị, hành vi tính năng sai lệch so với mong đợi).
2. "test_bug": Lỗi kịch bản kiểm thử (locator cũ bị trôi, selector sai, assertion sai logic, viết thiếu bước chuẩn bị).
3. "environment": Lỗi hạ tầng / mạng (máy chủ backend offline, DNS fail, navigation timeout do mạng chậm, crash trình duyệt).
4. "flaky": Lỗi chập chờn (race condition do animation chưa xong, timing click quá nhanh, phụ thuộc thứ tự chạy test).

Phải trả về JSON thuần túy theo schema:
{
  "category": "product_bug"|"test_bug"|"environment"|"flaky",
  "confidence": 0-100,
  "summary": "1-2 câu tiếng Việt tóm tắt súc tích nguyên nhân cốt lõi",
  "evidence": "Trích đoạn log/stack/locator ngắn gọn làm bằng chứng xác đáng",
  "suggestedFix": "Hướng dẫn cụ thể, hành động được để QA hoặc Dev xử lý"
}`;

  const user = `THÔNG TIN LỖI KIỂM THỬ PLAYWRIGHT:
---
Tên test case: ${testTitle || '(không rõ)'}
URL trang: ${url || '(không rõ)'}
Locator liên quan: ${locator || '(không rõ)'}

CHI TIẾT LỖI / STACK TRACE:
${errorText.slice(0, 4000)}

ĐOẠN CODE TEST XẢY RA LỖI:
${snippet.slice(0, 3000)}

CONSOLE LOGS:
${consoleLogs.slice(0, 2000)}
---
Hãy phân tích và trả về đúng JSON schema quy định.`;

  return [{ role: 'system', content: system }, { role: 'user', content: user }];
}

async function runTriageFailure({
  errorText = '',
  testTitle = '',
  locator = '',
  snippet = '',
  consoleLogs = '',
  url = '',
  clientConfig = null,
  root = process.cwd(),
  signal = null
} = {}) {
  const messages = buildTriagePrompts({ errorText, testTitle, locator, snippet, consoleLogs, url });

  const res = await callAi({
    task: 'triageFailure',
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
    return { ok: false, error: res };
  }

  const category = ['product_bug', 'test_bug', 'environment', 'flaky'].includes(res.data?.category)
    ? res.data.category
    : 'test_bug';

  const confidence = Math.max(0, Math.min(100, Math.round(Number(res.data?.confidence) || 75)));
  const summary = String(res.data?.summary || 'Đã phân tích lỗi kiểm thử.').trim().slice(0, 500);
  const evidence = String(res.data?.evidence || '').trim().slice(0, 1000);
  const suggestedFix = String(res.data?.suggestedFix || 'Kiểm tra lại kịch bản test.').trim().slice(0, 1000);

  return {
    ok: true,
    category,
    confidence,
    summary,
    evidence,
    suggestedFix,
    model: res.model,
    tier: res.tier,
    aliasFallback: res.aliasFallback,
    usage: res.usage,
    requestId: res.requestId
  };
}

module.exports = {
  SCHEMA,
  buildTriagePrompts,
  runTriageFailure
};
