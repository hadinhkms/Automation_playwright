/**
 * core/ai/tasks/checkRequirementClarity.js
 * Analyzes requirement clarity, flags ambiguous phrases, and proposes sharpened BDD criteria (BA-1).
 * Deterministic rule-first engine (0 token) with optional AI fallback. Strict ceiling <= 150 lines.
 */
const { callAi } = require('../gateway/index');

const AMBIGUOUS_WORDS = [
  'nhanh chóng', 'đẹp mắt', 'dễ dàng', 'tiện lợi', 'nếu cần', 'thích hợp',
  'tùy ý', 'vừa phải', 'sớm', 'kịp thời', 'ổn định', 'thân thiện', 'mượt mà',
  'fast', 'quick', 'easy', 'user-friendly', 'as needed', 'appropriate',
  'suitable', 'reasonable', 'promptly'
];

const PHRASE_SUGGESTIONS = {
  'nhanh chóng': { reason: 'Thiếu mốc thời gian SLA cụ thể', suggestion: 'Xử lý phản hồi dưới 2000ms' },
  'đẹp mắt': { reason: 'Cảm tính giao diện, không đo lường được', suggestion: 'Tuân thủ Figma Design Tokens & chuẩn WCAG' },
  'dễ dàng': { reason: 'Thiếu định nghĩa số bước thao tác', suggestion: 'Hoàn tất trong tối đa 3 lần click' },
  'nếu cần': { reason: 'Thiếu điều kiện rẽ nhánh logic rõ ràng', suggestion: 'Xác định rõ tiền điều kiện và quyền hạn vai trò' },
  'mượt mà': { reason: 'Thiếu chỉ số khung hình hoặc độ trễ', suggestion: 'Tốc độ khung hình >= 60fps, không giật lag' },
  'tiện lợi': { reason: 'Khái niệm định tính', suggestion: 'Tự động điền dữ liệu mặc định từ phiên trước' }
};

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
        properties: { phrase: { type: 'string' }, reason: { type: 'string' }, suggestion: { type: 'string' } }
      }
    },
    missingAspects: { type: 'array', items: { type: 'string' } },
    clarifiedDraft: { type: 'string' }
  }
};

function detectHeuristicAmbiguities(text = '') {
  if (!text || typeof text !== 'string') return [];
  const lower = text.toLowerCase();
  return AMBIGUOUS_WORDS.filter(w => lower.includes(w));
}

function heuristicCheckClarity({ requirementText = '', title = '' } = {}) {
  const detected = detectHeuristicAmbiguities(requirementText);
  const ambiguities = detected.map(phrase => ({
    phrase,
    reason: PHRASE_SUGGESTIONS[phrase]?.reason || 'Cụm từ định tính không đo lường kiểm thử được',
    suggestion: PHRASE_SUGGESTIONS[phrase]?.suggestion || 'Bổ sung tiêu chí số lượng hoặc SLA đo lường cụ thể'
  }));

  const missingAspects = [];
  if (!/\b(\d+|ms|s|giây|phút|giờ|mb|kb|%)\b/i.test(requirementText)) missingAspects.push('Tiêu chí đo lường định lượng / Thời gian SLA');
  if (!/\b(given|when|then|cho|khi|thì)\b/i.test(requirementText)) missingAspects.push('Cấu trúc BDD (Given-When-Then)');
  if (!/\b(lỗi|thất bại|fail|chặn|cảnh báo|không hợp lệ|trống)\b/i.test(requirementText)) missingAspects.push('Kịch bản xử lý ngoại lệ và thông báo lỗi');

  let score = 100;
  score -= Math.min(45, ambiguities.length * 15);
  score -= missingAspects.length * 10;
  if (requirementText.trim().length < 40) score -= 15;
  score = Math.max(20, Math.min(100, score));

  const status = score >= 85 ? 'clear' : score >= 60 ? 'needs_clarification' : 'ambiguous';
  const summary = ambiguities.length
    ? `Phát hiện ${ambiguities.length} từ ngữ định tính cần chuẩn hóa tiêu chí đo lường.`
    : 'Requirement rõ ràng, có tiêu chí nghiệm thu cụ thể và đo lường được.';

  const cleanReq = requirementText.slice(0, 120).trim().replace(/\s+/g, ' ');
  const clarifiedDraft = `Given hệ thống và tài khoản người dùng sẵn sàng\nWhen thực hiện ${cleanReq} (phản hồi trong 2 giây)\nThen hệ thống xử lý thành công và hiển thị kết quả đo lường rõ ràng`;

  return {
    source: 'rule', ok: true, score, status, summary, ambiguities, missingAspects,
    clarifiedDraft, detectedHeuristics: detected
  };
}

function buildClarityPrompts({ requirementText = '', title = '', source = '' } = {}) {
  const system = `Bạn là Senior BA. Rà soát độ rõ ràng requirement và trả về JSON: { score (0-100), status ("clear"|"needs_clarification"|"ambiguous"), summary, ambiguities: [{ phrase, reason, suggestion }], missingAspects: [], clarifiedDraft }`;
  const user = `YÊU CẦU: ${title || '(Chưa đặt)'} (${source || 'Nội bộ'})\n${requirementText.slice(0, 4000)}`;
  return [{ role: 'system', content: system }, { role: 'user', content: user }];
}

async function runCheckRequirementClarity({
  requirementText = '', title = '', source = '', clientConfig = null, root = process.cwd(), signal = null
} = {}) {
  if (!clientConfig || !clientConfig.apiKey) {
    return heuristicCheckClarity({ requirementText, title, source });
  }
  const messages = buildClarityPrompts({ requirementText, title, source });
  const res = await callAi({ task: 'checkRequirementClarity', messages, schema: SCHEMA, clientConfig, root, signal, tier: 'fast', timeoutMs: 30000, temperature: 0.1 });
  if (!res.ok || !res.data) {
    return heuristicCheckClarity({ requirementText, title, source });
  }
  const d = res.data;
  const score = Math.max(0, Math.min(100, Math.round(Number(d.score) || 70)));
  const status = ['clear', 'needs_clarification', 'ambiguous'].includes(d.status) ? d.status : (score >= 85 ? 'clear' : score >= 60 ? 'needs_clarification' : 'ambiguous');
  return {
    ok: true, source: 'ai', score, status, summary: String(d.summary || 'Đã phân tích độ rõ yêu cầu.').trim(),
    ambiguities: Array.isArray(d.ambiguities) ? d.ambiguities : [], missingAspects: Array.isArray(d.missingAspects) ? d.missingAspects : [],
    clarifiedDraft: String(d.clarifiedDraft || '').trim(), detectedHeuristics: detectHeuristicAmbiguities(requirementText),
    model: res.model, usage: res.usage, requestId: res.requestId
  };
}

module.exports = { SCHEMA, detectHeuristicAmbiguities, heuristicCheckClarity, buildClarityPrompts, runCheckRequirementClarity };
