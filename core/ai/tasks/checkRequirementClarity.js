/**
 * core/ai/tasks/checkRequirementClarity.js
 * AI task: Analyzes requirement clarity, flags ambiguous phrases, and proposes sharpened BDD criteria (BA-1).
 * Strict ceiling <= 150 lines.
 */
const { callAi } = require('../gateway/index');

const AMBIGUOUS_WORDS = [
  'nhanh chóng', 'đẹp mắt', 'dễ dàng', 'tiện lợi', 'nếu cần', 'thích hợp',
  'tùy ý', 'vừa phải', 'sớm', 'kịp thời', 'ổn định', 'thân thiện', 'mượt mà',
  'fast', 'quick', 'easy', 'user-friendly', 'as needed', 'appropriate',
  'suitable', 'reasonable', 'promptly'
];

const SCHEMA = {
  type: 'object',
  properties: {
    score: { type: 'number' },
    status: { type: 'string', enum: ['clear', 'needs_clarification', 'ambiguous'] },
    summary: { type: 'string' },
    ambiguities: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          phrase: { type: 'string' },
          reason: { type: 'string' },
          suggestion: { type: 'string' }
        }
      }
    },
    missingAspects: { type: 'array', items: { type: 'string' } },
    clarifiedDraft: { type: 'string' }
  }
};

function detectHeuristicAmbiguities(text = '') {
  if (!text || typeof text !== 'string') return [];
  const lower = text.toLowerCase();
  const matched = [];
  for (const word of AMBIGUOUS_WORDS) {
    if (lower.includes(word)) {
      matched.push(word);
    }
  }
  return matched;
}

function buildClarityPrompts({ requirementText = '', title = '', source = '' } = {}) {
  const detected = detectHeuristicAmbiguities(requirementText);
  const hint = detected.length ? `\nTừ ngữ định tính phát hiện qua luật: ${detected.join(', ')}` : '';

  const system = `Bạn là Senior Business Analyst (BA) kiêm Requirements Engineer chuyên nghiệp.
Nhiệm vụ của bạn là rà soát độ rõ ràng của tài liệu đặc tả yêu cầu (Requirement / Story) và phát hiện các câu từ mơ hồ, định tính, thiếu tiêu chí đo lường được (Testability & Measurability).
Quy tắc chấm điểm:
- "clear" (score 85-100): Tiêu chuẩn nghiệm thu đo được, có dữ liệu biên, rõ điều kiện thành công và thất bại.
- "needs_clarification" (score 60-84): Có tiêu chí nhưng còn chứa 1-3 từ định tính hoặc thiếu trạng thái lỗi.
- "ambiguous" (score 0-59): Quá mơ hồ, không có Given-When-Then, không kiểm thử tự động được.${hint}

Phải trả về JSON đúng schema:
{
  "score": 0-100,
  "status": "clear"|"needs_clarification"|"ambiguous",
  "summary": "Tóm tắt đánh giá chất lượng đặc tả (1-2 câu tiếng Việt)",
  "ambiguities": [
    { "phrase": "cụm từ mơ hồ", "reason": "tại sao khó kiểm thử", "suggestion": "cách viết lại đo lường được" }
  ],
  "missingAspects": ["thiếu timeout", "thiếu kịch bản lỗi", ...],
  "clarifiedDraft": "Đoạn văn bản đề xuất viết lại rõ ràng theo chuẩn BDD (Given-When-Then)"
}`;

  const user = `NỘI DUNG REQUIREMENT CẦN RÀ SOÁT:
Tiêu đề: ${title || '(Chưa đặt)'}
Nguồn gốc: ${source || 'Nội bộ'}
---
${requirementText.slice(0, 4000)}
---
Hãy phân tích và trả về đúng JSON schema quy định.`;

  return [{ role: 'system', content: system }, { role: 'user', content: user }];
}

async function runCheckRequirementClarity({
  requirementText = '',
  title = '',
  source = '',
  clientConfig = null,
  root = process.cwd(),
  signal = null
} = {}) {
  const detectedHeuristics = detectHeuristicAmbiguities(requirementText);
  const messages = buildClarityPrompts({ requirementText, title, source });

  const res = await callAi({
    task: 'checkRequirementClarity',
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
    const ambiguities = detectedHeuristics.map((phrase) => ({
      phrase, reason: 'Cụm từ định tính không đo lường được', suggestion: 'Bổ sung tiêu chí số lượng hoặc SLA'
    }));
    const score = Math.max(30, 95 - ambiguities.length * 15);
    return {
      ok: true, score, status: score >= 85 ? 'clear' : score >= 60 ? 'needs_clarification' : 'ambiguous',
      summary: 'Phát hiện các từ định tính mơ hồ bằng quy chuẩn Heuristic (0 token).',
      ambiguities, missingAspects: ['Tiêu chí đo lường định lượng', 'Thời gian phản hồi SLA'],
      clarifiedDraft: requirementText ? `Given hệ thống sẵn sàng When ${requirementText.slice(0, 80)} Then kết quả đo lường rõ ràng` : '',
      detectedHeuristics, fallbackNotice: 'Kết quả từ luật (không dùng AI): ' + (res.message || 'AI offline'), source: 'rule'
    };
  }

  const score = Math.max(0, Math.min(100, Math.round(Number(res.data?.score) || 70)));
  const status = ['clear', 'needs_clarification', 'ambiguous'].includes(res.data?.status)
    ? res.data.status
    : score >= 85 ? 'clear' : score >= 60 ? 'needs_clarification' : 'ambiguous';

  return {
    ok: true,
    score,
    status,
    summary: String(res.data?.summary || 'Đã phân tích độ rõ yêu cầu.').trim(),
    ambiguities: Array.isArray(res.data?.ambiguities) ? res.data.ambiguities : [],
    missingAspects: Array.isArray(res.data?.missingAspects) ? res.data.missingAspects : [],
    clarifiedDraft: String(res.data?.clarifiedDraft || '').trim(),
    detectedHeuristics,
    model: res.model,
    tier: res.tier,
    usage: res.usage,
    requestId: res.requestId
  };
}

module.exports = {
  SCHEMA,
  detectHeuristicAmbiguities,
  buildClarityPrompts,
  runCheckRequirementClarity
};
