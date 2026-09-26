/**
 * core/ai/tasks/generateReleaseBriefing.js
 * AI task: Generates release readiness briefing and Go / No-Go verdict for PO (PO-1).
 * Strict ceiling <= 150 lines.
 */
const { callAi } = require('../gateway/index');

const SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['GO', 'NO_GO', 'GO_WITH_CAUTION'] },
    readinessScore: { type: 'number' },
    headline: { type: 'string' },
    rationale: { type: 'string' },
    blockers: { type: 'array', items: { type: 'string' } },
    residualRisks: { type: 'array', items: { type: 'string' } },
    highlights: { type: 'array', items: { type: 'string' } }
  },
  required: ['verdict', 'readinessScore', 'headline', 'rationale']
};

function heuristicReleaseBriefing({
  testMetrics = {},
  uncoveredReqCount = 0,
  openBlockersCount = 0,
  releaseName = 'Next Release'
} = {}) {
  const { total = 0, passed = 0, failed = 0 } = testMetrics;
  const passRate = total > 0 ? (passed / total) * 100 : 100;

  let verdict = 'GO';
  const blockers = [];
  const residualRisks = [];

  if (openBlockersCount > 0) {
    verdict = 'NO_GO';
    blockers.push(`Còn ${openBlockersCount} lỗi nghiêm trọng (Blocker/Critical) chưa xử lý.`);
  } else if (failed > 2) {
    verdict = 'NO_GO';
    residualRisks.push(`Hiện có ${failed}/${total} test case bị thất bại.`);
  } else if (failed > 0) {
    verdict = 'GO_WITH_CAUTION';
    residualRisks.push(`Hiện có ${failed}/${total} test case bị thất bại.`);
  }

  if (uncoveredReqCount > 0) {
    residualRisks.push(`Còn ${uncoveredReqCount} Requirement chưa được phủ tự động hóa.`);
    if (verdict === 'GO') verdict = 'GO_WITH_CAUTION';
  }

  const readinessScore = Math.max(0, Math.min(100, Math.round(passRate - uncoveredReqCount * 5 - openBlockersCount * 20)));

  return {
    source: 'rule',
    verdict,
    readinessScore,
    headline: `Đánh giá sẵn sàng phát hành cho ${releaseName}: ${verdict}`,
    rationale: `Tỷ lệ pass test đạt ${passRate.toFixed(1)}% (${passed}/${total}). Phán quyết dựa trên quy chuẩn cổng nghiệm thu.`,
    blockers,
    residualRisks,
    highlights: [
      `Tổng số kịch bản kiểm thử: ${total}`,
      `Tỷ lệ vượt qua: ${passRate.toFixed(1)}%`,
      `Requirement chưa phủ: ${uncoveredReqCount}`
    ]
  };
}

async function runGenerateReleaseBriefing({
  testMetrics = {},
  uncoveredReqCount = 0,
  openBlockersCount = 0,
  releaseName = 'Next Release',
  signal = null,
  clientConfig = null
} = {}) {
  const fallback = heuristicReleaseBriefing({ testMetrics, uncoveredReqCount, openBlockersCount, releaseName });

  const system = `Bạn là Senior QA Director & Release Manager.
Hãy phân tích các chỉ số kiểm thử, độ phủ yêu cầu và lỗi tồn đọng để viết bản tin sẵn sàng phát hành sắc sảo (Executive Brief) kèm khuyến nghị Go/No-Go cho Product Owner.
Trả về JSON đúng schema.`;
  const user = `Phiên bản: ${releaseName}
Chỉ số kiểm thử: ${JSON.stringify(testMetrics)}
Requirement chưa phủ: ${uncoveredReqCount}
Số lỗi Blocker mở: ${openBlockersCount}`;

  try {
    const result = await callAi({
      task: 'generateReleaseBriefing',
      system,
      user,
      schema: SCHEMA,
      signal,
      clientConfig
    });

    if (result && result.verdict && typeof result.readinessScore === 'number') {
      return {
        source: 'ai',
        verdict: result.verdict,
        readinessScore: result.readinessScore,
        headline: result.headline || fallback.headline,
        rationale: result.rationale || fallback.rationale,
        blockers: result.blockers || fallback.blockers,
        residualRisks: result.residualRisks || fallback.residualRisks,
        highlights: result.highlights || fallback.highlights
      };
    }
  } catch (err) {
    // Return fallback
  }

  return fallback;
}

module.exports = {
  runGenerateReleaseBriefing,
  heuristicReleaseBriefing,
  SCHEMA
};
