/**
 * core/ai/tasks/extractScaffold.js
 * AI task: Extracts structured REQ/AC/TC living documentation and Playwright spec scaffold from raw input.
 * Strict ceiling <= 150 lines.
 */
const { callAi } = require('../gateway/index');

const SCHEMA = {
  type: 'object',
  required: ['requirement', 'acceptanceCriteria', 'testCases'],
  properties: {
    requirement: {
      type: 'object',
      required: ['id', 'title'],
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        domain: { type: 'string' },
        description: { type: 'string' }
      }
    },
    acceptanceCriteria: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'title'],
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          given: { type: 'string' },
          when: { type: 'string' },
          then: { type: 'string' }
        }
      }
    },
    testCases: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'acId', 'title'],
        properties: {
          id: { type: 'string' },
          acId: { type: 'string' },
          title: { type: 'string' },
          priority: { type: 'string' },
          automation: { type: 'string' }
        }
      }
    },
    specCode: { type: 'string' }
  }
};

function buildScaffoldPrompts({ rawContent, inputType, reqId, domain } = {}) {
  const system = `Bạn là Senior QA Architect và Living Documentation Specialist.
Nhiệm vụ: Trích xuất và cấu trúc hóa toàn diện văn bản đầu vào thành 3 thực thể:
1. Requirement: mã ${reqId || 'REQ-001'}, domain ${domain || 'General'}, tiêu đề, mô tả.
2. Acceptance Criteria (Given/When/Then).
3. Test Cases (ID dạng TC-xxx gắn với AC-xxx tương ứng).
4. Mã spec Playwright hoàn chỉnh tương thích CommonJS hoặc ESM.
Chỉ trả về JSON thuần túy theo đúng schema.`;

  const user = `Dữ liệu đầu vào (${inputType === 'test_script' ? 'Mã test script Playwright' : 'Văn bản Spec / User story thô'}):\n\n${(rawContent || '').slice(0, 8000)}\n\nMã REQ ID dự kiến: ${reqId || 'REQ-001'}\nDomain đề xuất: ${domain || 'General'}`;

  return [{ role: 'system', content: system }, { role: 'user', content: user }];
}

async function runExtractScaffold({ rawContent, inputType = 'text', reqId = 'REQ-001', domain = 'General', clientConfig = null, root = process.cwd(), signal = null } = {}) {
  const messages = buildScaffoldPrompts({ rawContent, inputType, reqId, domain });
  const res = await callAi({
    task: 'extractScaffold',
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
  buildScaffoldPrompts,
  runExtractScaffold,
  SCHEMA
};
