/**
 * core/ai/tasks/draftBugReport.js
 * AI task: Generates structured, professional Bug Report drafts from Playwright test failures (QA-4).
 * Strict ceiling <= 150 lines.
 */
const { callAi } = require('../gateway/index');

const SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    severity: { type: 'string', enum: ['Blocker', 'Critical', 'Major', 'Minor', 'Trivial'] },
    stepsToReproduce: { type: 'array', items: { type: 'string' } },
    expectedResult: { type: 'string' },
    actualResult: { type: 'string' },
    environment: { type: 'string' },
    suggestedFix: { type: 'string' },
    markdownReport: { type: 'string' }
  }
};

function buildBugReportPrompts({
  testTitle = '',
  errorText = '',
  locator = '',
  snippet = '',
  url = '',
  triageCategory = '',
  triageSummary = ''
} = {}) {
  const system = `Bạn là Senior QA Lead chuyên lập Bug Report chuẩn quốc tế (ISTQB / Jira / GitHub Issues).
Nhiệm vụ của bạn là đọc thông tin kiểm thử thất bại và tự động sinh bản thảo Bug Report chi tiết, chính xác, khách quan.
Quy định mức độ nghiêm trọng (Severity):
- "Blocker": Vỡ luồng thanh toán, crash hệ thống, chặn hoàn toàn người dùng.
- "Critical": Chức năng chính fail không có workaround.
- "Major": Lỗi nghiệp vụ quan trọng hoặc assertion sai lệch kết quả.
- "Minor": Lỗi giao diện, layout lệch nhẹ hoặc test locator cần cập nhật.
- "Trivial": Lỗi chính tả, định dạng nhỏ.

Phải trả về JSON đúng schema:
{
  "title": "[Bug] Tóm tắt súc tích sự cố",
  "severity": "Blocker"|"Critical"|"Major"|"Minor"|"Trivial",
  "stepsToReproduce": ["Bước 1: Mở URL...", "Bước 2: Nhập...", "Bước 3: Bấm..."],
  "expectedResult": "Hành vi mong đợi theo nghiệp vụ",
  "actualResult": "Hành vi thực tế xảy ra kèm mã lỗi",
  "environment": "Môi trường kiểm thử, URL, trình duyệt",
  "suggestedFix": "Gợi ý nguyên nhân và hướng khắc phục cho Dev",
  "markdownReport": "Toàn văn bản báo cáo lỗi định dạng Markdown hoàn chỉnh sẵn sàng copy dán lên Jira/GitHub"
}`;

  const user = `THÔNG TIN LỖI KIỂM THỬ PLAYWRIGHT CẦN SOẠN BUG REPORT:
Tên test case: ${testTitle || '(không rõ)'}
URL: ${url || '(không rõ)'}
Locator: ${locator || '(không rõ)'}
Phân loại RCA trước đó: ${triageCategory || '(chưa rõ)'} - ${triageSummary || ''}

CHI TIẾT LỖI:
${errorText.slice(0, 3500)}

ĐOẠN CODE TEST XẢY RA LỖI:
${snippet.slice(0, 2000)}
---
Hãy soạn thảo Bug Report đầy đủ theo đúng schema quy định.`;

  return [{ role: 'system', content: system }, { role: 'user', content: user }];
}

async function runDraftBugReport({
  testTitle = '',
  errorText = '',
  locator = '',
  snippet = '',
  url = '',
  triageCategory = '',
  triageSummary = '',
  clientConfig = null,
  root = process.cwd(),
  signal = null
} = {}) {
  const messages = buildBugReportPrompts({
    testTitle,
    errorText,
    locator,
    snippet,
    url,
    triageCategory,
    triageSummary
  });

  const res = await callAi({
    task: 'draftBugReport',
    messages,
    schema: SCHEMA,
    clientConfig,
    root,
    signal,
    tier: 'fast',
    timeoutMs: 45000,
    temperature: 0.1
  });

  const d = res.ok ? (res.data || {}) : {
    title: `[Bug] ${testTitle || 'Test failure: ' + (errorText.slice(0, 50))}`,
    severity: triageCategory === 'product_bug' ? 'Critical' : 'Major',
    stepsToReproduce: ['1. Khởi chạy Playwright test: ' + (testTitle || 'spec'), '2. Chờ thao tác: ' + (locator || 'phần tử'), '3. Kiểm tra assertion'],
    expectedResult: 'Thao tác hoàn tất và assertion vượt qua thành công.',
    actualResult: errorText.slice(0, 500),
    environment: `URL: ${url || 'Local/Staging'}, Runner: Playwright Chromium`,
    suggestedFix: triageSummary || 'Kiểm tra backend response và cập nhật locator nếu UI thay đổi.'
  };

  const title = String(d.title || `[Bug] ${testTitle || 'Test case failure'}`).trim();
  const severity = ['Blocker', 'Critical', 'Major', 'Minor', 'Trivial'].includes(d.severity)
    ? d.severity
    : 'Major';

  const stepsToReproduce = Array.isArray(d.stepsToReproduce) && d.stepsToReproduce.length
    ? d.stepsToReproduce
    : ['1. Chạy kịch bản kiểm thử: ' + (testTitle || 'Playwright spec')];

  const expectedResult = String(d.expectedResult || 'Kịch bản kiểm thử chạy thành công vượt qua mọi assertions.').trim();
  const actualResult = String(d.actualResult || errorText.slice(0, 500)).trim();
  const environment = String(d.environment || `URL: ${url || 'Local/Staging'}, Runner: Playwright Chromium`).trim();
  const suggestedFix = String(d.suggestedFix || 'Kiểm tra backend API hoặc cập nhật test locator.').trim();

  const markdownReport = String(d.markdownReport || `## ${title}\n\n**Severity:** ${severity}\n**Environment:** ${environment}\n\n### Steps to Reproduce:\n${stepsToReproduce.map(s => `- ${s}`).join('\n')}\n\n### Expected Result:\n${expectedResult}\n\n### Actual Result:\n${actualResult}\n\n### Suggested Fix:\n${suggestedFix}`).trim();

  return {
    ok: true,
    title,
    severity,
    stepsToReproduce,
    expectedResult,
    actualResult,
    environment,
    suggestedFix,
    markdownReport,
    model: res.model,
    tier: res.tier,
    usage: res.usage,
    requestId: res.requestId
  };
}

module.exports = {
  SCHEMA,
  buildBugReportPrompts,
  runDraftBugReport
};
