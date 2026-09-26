/**
 * core/ai/tasks/inferTestCases.js
 * AI task: Infers missing test cases based on ADR decisions and existing specs.
 * Strict ceiling <= 150 lines.
 */
const { callAi } = require('../gateway/index');

const SCHEMA = {
  type: 'object',
  required: ['suggestedTestCases'],
  properties: {
    suggestedTestCases: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'title'],
        properties: {
          id: { type: 'string' },
          acId: { type: 'string' },
          title: { type: 'string' },
          priority: { type: 'string' },
          automation: { type: 'string' },
          rationale: { type: 'string' }
        }
      }
    }
  }
};

function buildInferPrompts({ reqId, decisions = [], specContent = '' } = {}) {
  const decisionsStr = decisions.length > 0
    ? decisions.map((d, i) => `${i + 1}. [${d.date || 'N/A'}] ${d.title || d.id}: ${d.description || d.rationale || ''}`).join('\n')
    : '(Không có quyết định kiến trúc nào)';

  const system = `Bạn là Senior QA Automation Lead. Nhiệm vụ của bạn là phân tích mã kiểm thử Playwright hiện có và các quyết định kỹ thuật (ADR/Decisions) để suy luận các Test Case BỔ SUNG còn thiếu.
Trả về định dạng JSON thuần theo schema:
{
  "suggestedTestCases": [
    {
      "id": "TC-xxx",
      "acId": "AC-xxx",
      "title": "Tên test case mô tả rõ hành vi",
      "priority": "P1|P2|P3",
      "automation": "Yes|No",
      "rationale": "Lý do vì sao cần bổ sung test case này"
    }
  ]
}`;

  const user = `MÃ REQUIREMENT: ${reqId || 'REQ-UNKNOWN'}

MÃ PLAYWRIGHT SPEC HIỆN TẠI:
---
${specContent ? specContent.slice(0, 8000) : '(Chưa có spec)'}
---

CÁC QUYẾT ĐỊNH KỸ THUẬT / THAY ĐỔI GẦN ĐÂY:
---
${decisionsStr}
---

Hãy đề xuất các Test Case còn thiếu dựa trên các quyết định mới trên. Trả về đúng JSON schema quy định.`;

  return [{ role: 'system', content: system }, { role: 'user', content: user }];
}

async function runInferTestCases({ reqId, decisions = [], specContent = '', clientConfig = null, root = process.cwd(), signal = null } = {}) {
  const messages = buildInferPrompts({ reqId, decisions, specContent });
  const res = await callAi({
    task: 'inferTestCases',
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
    suggestedTestCases: res.data.suggestedTestCases || [],
    model: res.model,
    tier: res.tier,
    aliasFallback: res.aliasFallback,
    usage: res.usage,
    requestId: res.requestId
  };
}

module.exports = {
  buildInferPrompts,
  runInferTestCases,
  SCHEMA
};
