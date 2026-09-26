/**
 * core/ai/tasks/draftDecisionRecord.js
 * AI task: Decision log assistant & ADR generator (PO-3).
 * Checks conflicts with existing decisions. Strict ceiling <= 150 lines.
 */
const { callAi } = require('../gateway/index');

const SCHEMA = {
  type: 'object',
  properties: {
    decisionId: { type: 'string' },
    title: { type: 'string' },
    status: { type: 'string', enum: ['proposed', 'accepted', 'superseded'] },
    context: { type: 'string' },
    decision: { type: 'string' },
    consequences: {
      type: 'object',
      properties: {
        positive: { type: 'array', items: { type: 'string' } },
        negative: { type: 'array', items: { type: 'string' } }
      }
    },
    conflictWarning: { type: 'string' }
  },
  required: ['decisionId', 'title', 'decision']
};

function heuristicDecisionRecord({
  topic = 'Kiến trúc',
  contextText = '',
  proposedDecision = '',
  existingDecisions = []
} = {}) {
  const nextId = `ADR-${String(existingDecisions.length + 1).padStart(3, '0')}`;
  let conflictWarning = null;

  const lowerProp = proposedDecision.toLowerCase();
  for (const d of existingDecisions) {
    const dLower = (d.decision || d.title || '').toLowerCase();
    if (lowerProp.includes('chặn') && dLower.includes('cho phép')) {
      conflictWarning = `Quyết định này có thể xung đột với [${d.id || d.decisionId}]: "${d.title}".`;
      break;
    }
  }

  return {
    source: 'rule',
    decisionId: nextId,
    title: `Quyết định về: ${topic}`,
    status: 'proposed',
    context: contextText || 'Cần chuẩn hóa hướng đi kỹ thuật hoặc nghiệp vụ.',
    decision: proposedDecision || 'Thống nhất áp dụng giải pháp theo đề xuất.',
    consequences: {
      positive: ['Tăng tính nhất quán trong toàn dự án', 'Dễ bảo trì và đối soát'],
      negative: ['Cần thời gian chuyển đổi các thành phần cũ']
    },
    conflictWarning
  };
}

async function runDraftDecisionRecord({
  topic = 'Kiến trúc',
  contextText = '',
  proposedDecision = '',
  existingDecisions = [],
  signal = null,
  clientConfig = null
} = {}) {
  const fallback = heuristicDecisionRecord({ topic, contextText, proposedDecision, existingDecisions });

  const system = `Bạn là Senior Technical Program Manager kiêm Enterprise Architect.
Nhiệm vụ: Soạn thảo bản ghi quyết định kiến trúc (ADR) chuẩn mực, phát hiện các mâu thuẫn tiềm tàng với các quyết định đã có trong sổ quyết định.
Trả về JSON đúng schema.`;
  const user = `Chủ đề: ${topic}
Bối cảnh: ${contextText}
Quyết định đề xuất: ${proposedDecision}
Danh sách quyết định hiện có:
${JSON.stringify(existingDecisions.slice(0, 10), null, 2)}`;

  try {
    const result = await callAi({
      task: 'draftDecisionRecord',
      system,
      user,
      schema: SCHEMA,
      signal,
      clientConfig
    });

    if (result && result.title && result.decision) {
      return {
        source: 'ai',
        decisionId: result.decisionId || fallback.decisionId,
        title: result.title,
        status: result.status || 'proposed',
        context: result.context || fallback.context,
        decision: result.decision,
        consequences: result.consequences || fallback.consequences,
        conflictWarning: result.conflictWarning || fallback.conflictWarning
      };
    }
  } catch (err) {
    // Return fallback
  }

  return fallback;
}

module.exports = {
  runDraftDecisionRecord,
  heuristicDecisionRecord,
  SCHEMA
};
