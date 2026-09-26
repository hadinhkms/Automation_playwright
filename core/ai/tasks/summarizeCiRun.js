/**
 * core/ai/tasks/summarizeCiRun.js
 * AI task: Synthesizes CI test run reports (JUnit XML) into executive summaries (DEV-3).
 * Strict ceiling <= 150 lines.
 */
const { callAi } = require('../gateway/index');

const SCHEMA = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['SUCCESS', 'FAILURE', 'UNSTABLE'] },
    headline: { type: 'string' },
    summaryMarkdown: { type: 'string' },
    hotspotFiles: { type: 'array', items: { type: 'string' } },
    actionableAdvice: { type: 'array', items: { type: 'string' } }
  },
  required: ['status', 'headline', 'summaryMarkdown']
};

function parseJunitCounts(xml = '') {
  const testsMatch = xml.match(/tests=["'](\d+)["']/i);
  const failuresMatch = xml.match(/failures=["'](\d+)["']/i);
  const errorsMatch = xml.match(/errors=["'](\d+)["']/i);
  const skippedMatch = xml.match(/skipped=["'](\d+)["']/i);

  const total = testsMatch ? parseInt(testsMatch[1], 10) : 0;
  const failures = failuresMatch ? parseInt(failuresMatch[1], 10) : 0;
  const errors = errorsMatch ? parseInt(errorsMatch[1], 10) : 0;
  const skipped = skippedMatch ? parseInt(skippedMatch[1], 10) : 0;
  const failedTotal = failures + errors;
  const passed = Math.max(0, total - failedTotal - skipped);

  return { total, passed, failed: failedTotal, skipped };
}

function heuristicCiSummary(junitXml = '', metadata = {}) {
  const counts = parseJunitCounts(junitXml);
  const status = counts.failed > 0 ? 'FAILURE' : 'SUCCESS';

  const md = [
    `### 🚀 CI Run Summary: ${status === 'SUCCESS' ? '✅ PASSED' : '❌ FAILED'}`,
    `* **Nhánh:** \`${metadata.branch || 'main'}\` | **Commit:** \`${metadata.commit || 'HEAD'}\``,
    `* **Kết quả:** ${counts.passed}/${counts.total} passed (${counts.failed} failed, ${counts.skipped} skipped)`,
    '',
    counts.failed > 0
      ? '⚠️ Phát hiện lỗi test trong đợt chạy CI. Khuyến nghị kiểm tra log runner hoặc chạy lại cục bộ.'
      : '🎉 Tất cả test suite đều vượt qua thành công trên môi trường CI.'
  ].join('\n');

  return {
    source: 'rule',
    status,
    headline: `CI Build ${metadata.buildId || ''}: ${counts.passed}/${counts.total} passed`,
    summaryMarkdown: md,
    hotspotFiles: counts.failed > 0 ? ['tests/regression/'] : [],
    actionableAdvice: counts.failed > 0 ? ['Chạy npx playwright test --last-failed để tái hiện cục bộ'] : ['Sẵn sàng merge vào production']
  };
}

async function runSummarizeCiRun({
  junitXml = '',
  metadata = {},
  signal = null,
  clientConfig = null
} = {}) {
  const fallback = heuristicCiSummary(junitXml, metadata);

  const system = `Bạn là Senior DevOps & QA Automation Specialist.
Nhiệm vụ: Phân tích kết quả đợt chạy CI từ log/báo cáo JUnit XML và tạo bản tóm tắt súc tích, chuyên nghiệp cho đội phát triển.
Trả về JSON đúng schema.`;
  const user = `Metadata: ${JSON.stringify(metadata)}
Nội dung JUnit XML (trích đoạn):
\`\`\`xml
${junitXml.slice(0, 3500)}
\`\`\``;

  try {
    const result = await callAi({
      task: 'summarizeCiRun',
      system,
      user,
      schema: SCHEMA,
      signal,
      clientConfig
    });

    if (result && result.status && result.summaryMarkdown) {
      return {
        source: 'ai',
        status: result.status,
        headline: result.headline || fallback.headline,
        summaryMarkdown: result.summaryMarkdown,
        hotspotFiles: result.hotspotFiles || fallback.hotspotFiles,
        actionableAdvice: result.actionableAdvice || fallback.actionableAdvice
      };
    }
  } catch (err) {
    // Return fallback
  }

  return fallback;
}

module.exports = {
  runSummarizeCiRun,
  heuristicCiSummary,
  parseJunitCounts,
  SCHEMA
};
