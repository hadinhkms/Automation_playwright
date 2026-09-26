/**
 * core/ai/tasks/analyzeRequirement.js
 * AI task: Analyzes raw requirement text, assesses clarity, generates AC Given/When/Then and test scenarios.
 * Strict ceiling <= 150 lines.
 */
const { callAi } = require('../gateway/index');

const SCHEMA = {
  type: 'object',
  required: ['summary', 'clarityScore', 'acceptanceCriteria', 'potentialRisks', 'suggestedTestScenarios'],
  properties: {
    summary: { type: 'string' },
    clarityScore: { type: 'number' },
    ambiguities: { type: 'array', items: { type: 'string' } },
    acceptanceCriteria: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'given', 'when', 'then'],
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          given: { type: 'string' },
          when: { type: 'string' },
          then: { type: 'string' }
        }
      }
    },
    potentialRisks: { type: 'array', items: { type: 'string' } },
    suggestedTestScenarios: {
      type: 'array',
      items: {
        type: 'object',
        required: ['title', 'acId'],
        properties: {
          title: { type: 'string' },
          acId: { type: 'string' },
          type: { type: 'string' }
        }
      }
    }
  }
};

function buildRequirementPrompts({ rawText, contextStr = '' } = {}) {
  const system = `Bạn là Senior Business Analyst (BA) kiêm Principal QA Architect.
Nhiệm vụ: Phân tích tài liệu yêu cầu (Requirement / User Story), đánh giá độ rõ ràng (Clarity Score 0-100), bóc tách điểm mơ hồ (ambiguities), trích xuất tiêu chí nghiệm thu Acceptance Criteria (Given/When/Then chuẩn Gherkin), nhận diện rủi ro tiềm ẩn (potentialRisks) và đề xuất kịch bản kiểm thử (suggestedTestScenarios).
Trả về JSON thuần theo đúng schema yêu cầu.`;

  const user = `VĂN BẢN REQUIREMENT CẦN PHÂN TÍCH:
---
${(rawText || '').slice(0, 8000)}
---

NGỮ CẢNH HỆ THỐNG:
---
${contextStr || '(Chưa có nhiều specs mẫu)'}
---

Hãy phân tích toàn diện và trả về JSON theo schema.`;

  return [{ role: 'system', content: system }, { role: 'user', content: user }];
}

async function runAnalyzeRequirement({ rawText, contextStr = '', clientConfig = null, root = process.cwd(), signal = null } = {}) {
  const messages = buildRequirementPrompts({ rawText, contextStr });
  const res = await callAi({
    task: 'analyzeRequirement',
    messages,
    schema: SCHEMA,
    clientConfig,
    root,
    signal,
    tier: 'deep',
    timeoutMs: 60000,
    temperature: 0.2
  });

  if (!res.ok) {
    return { ok: false, error: res };
  }

  return {
    ok: true,
    data: res.data,
    model: res.model,
    tier: res.tier,
    aliasFallback: res.aliasFallback,
    usage: res.usage,
    requestId: res.requestId
  };
}

module.exports = {
  buildRequirementPrompts,
  runAnalyzeRequirement,
  SCHEMA
};
