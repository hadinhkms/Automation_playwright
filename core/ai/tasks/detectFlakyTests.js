/**
 * core/ai/tasks/detectFlakyTests.js
 * AI task: Analyzes historical test runs to identify intermittent / flaky test cases (QA-6).
 * Strict ceiling <= 150 lines.
 */
const { callAi } = require('../gateway/index');

const SCHEMA = {
  type: 'object',
  properties: {
    flakyCount: { type: 'number' },
    summary: { type: 'string' },
    flakyTests: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          testId: { type: 'string' },
          flakinessRate: { type: 'number' },
          flipCount: { type: 'number' },
          probableCause: { type: 'string' },
          remediation: { type: 'string' }
        },
        required: ['testId', 'flakinessRate']
      }
    }
  },
  required: ['flakyCount', 'flakyTests']
};

function heuristicFlakyDetection(history = []) {
  const flakyList = [];

  for (const item of history) {
    const { testId = 'TC-?', runs = [] } = item;
    if (runs.length < 2) continue;

    let flips = 0;
    for (let i = 1; i < runs.length; i++) {
      if (runs[i] !== runs[i - 1]) flips++;
    }

    const flakinessRate = Math.round((flips / (runs.length - 1)) * 100) / 100;
    if (flakinessRate >= 0.2) {
      flakyList.push({
        testId,
        flakinessRate,
        flipCount: flips,
        probableCause: 'Chập chờn trạng thái (Race condition hoặc phụ thuộc dữ liệu phiên trước)',
        remediation: 'Thêm web-first assertion hoặc reset state trong beforeEach hook'
      });
    }
  }

  return {
    source: 'rule',
    flakyCount: flakyList.length,
    summary: flakyList.length
      ? `Phát hiện ${flakyList.length} test case có tỷ lệ lật kết quả (flaky) bất thường.`
      : 'Không phát hiện test case nào có dấu hiệu flaky trong tập mẫu.',
    flakyTests: flakyList
  };
}

async function runDetectFlakyTests({ history = [], signal = null, clientConfig = null } = {}) {
  const fallback = heuristicFlakyDetection(history);

  const system = `Bạn là Senior QA Reliability Engineer.
Hãy phân tích chuỗi lịch sử kết quả chạy test (pass/fail) để xác định các test case bị flaky (chập chờn) và phân tích nguyên nhân kỹ thuật cốt lõi (timing, DOM hydration, shared state).
Trả về JSON đúng schema.`;
  const user = `Lịch sử chạy test:
${JSON.stringify(history.slice(0, 20), null, 2)}`;

  try {
    const result = await callAi({
      task: 'detectFlakyTests',
      system,
      user,
      schema: SCHEMA,
      signal,
      clientConfig
    });

    if (result && Array.isArray(result.flakyTests)) {
      return {
        source: 'ai',
        flakyCount: result.flakyCount || result.flakyTests.length,
        summary: result.summary || fallback.summary,
        flakyTests: result.flakyTests
      };
    }
  } catch (err) {
    // Return fallback
  }

  return fallback;
}

module.exports = {
  runDetectFlakyTests,
  heuristicFlakyDetection,
  SCHEMA
};
