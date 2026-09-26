/**
 * core/ai/tasks/arbitrateConflict.js
 * AI task: Traceability conflict arbitration between Playwright spec assertions and living docs.
 * Strict ceiling <= 150 lines.
 */
const { callAi } = require('../gateway/index');

const SCHEMA = {
  type: 'object',
  properties: {
    recommendation: { type: 'string', enum: ['sync_doc_to_spec', 'sync_spec_to_doc'] },
    confidence: { type: 'number' },
    reason: { type: 'string' }
  }
};

function buildArbitratePrompts(ctx = {}) {
  const safeCtx = ctx || {};
  const defs = Object.values(safeCtx.acDefinitions || {}).map((d) => `- ${d.text} (${d.file}:${d.line})`).join('\n') || '(không tìm thấy định nghĩa AC trong requirements)';
  const blocks = (safeCtx.blocks || []).map((b) => `// ${safeCtx.specFile || ''}:${b.line}\n${b.snippet}`).join('\n\n') || '(không đọc được test)';
  const docLines = (safeCtx.docLocations || []).map((l) => `- ${l.file}:${l.line}: ${l.text}`).join('\n') || '(không có)';
  const steps = safeCtx.docDetails?.steps?.length
    ? safeCtx.docDetails.steps.map((s) => `${s.no}. ${s.action} => ${s.expected}`).join('\n')
    : '(tài liệu không có bảng bước)';

  const system = `Bạn là Principal QA Architect kiêm Lead BA, làm TRỌNG TÀI cho một xung đột truy vết.
Test case ${ctx.tcId}: spec gắn [${(ctx.specAcs || []).join(', ')}], tài liệu khai [${(ctx.docAcs || []).join(', ')}].
Đọc code test (assertion thực tế) và định nghĩa Given-When-Then của từng AC, rồi kết luận test đang THỰC SỰ kiểm chứng AC nào.
- "sync_doc_to_spec": spec đúng, sửa tài liệu thành [${(ctx.specAcs || []).join(', ')}].
- "sync_spec_to_doc": tài liệu đúng, sửa tiêu đề test thành [${(ctx.docAcs || []).join(', ')}].
Chỉ trả về JSON theo schema: {"recommendation":"sync_doc_to_spec"|"sync_spec_to_doc","confidence":0-100,"reason":"1-2 câu tiếng Việt nêu căn cứ cụ thể"}`;

  const user = `ĐỊNH NGHĨA AC:\n${defs}\n\nCODE TEST:\n${blocks}\n\nDÒNG KHAI TRONG TÀI LIỆU:\n${docLines}\n\nBƯỚC TRONG TÀI LIỆU:\n${steps}`;
  return [{ role: 'system', content: system }, { role: 'user', content: user }];
}

async function runArbitrateConflict({ ctx, clientConfig = null, root = process.cwd(), signal = null } = {}) {
  const messages = buildArbitratePrompts(ctx);
  const res = await callAi({
    task: 'arbitrateConflict',
    messages,
    schema: SCHEMA,
    clientConfig,
    root,
    signal,
    tier: 'fast',
    timeoutMs: 45000,
    temperature: 0.1
  });

  const rec = ['sync_doc_to_spec', 'sync_spec_to_doc'].includes(res.data?.recommendation)
    ? res.data.recommendation
    : null;
  if (!rec) {
    return { ok: false, error: { message: 'Không tìm thấy phán quyết hợp lệ từ AI.' } };
  }

  const confidence = Math.max(0, Math.min(100, Math.round(Number(res.data.confidence) || 0)));
  const reason = String(res.data.reason || '').trim().slice(0, 600);

  return {
    ok: true,
    recommendation: rec,
    confidence,
    reason,
    model: res.model,
    tier: res.tier,
    aliasFallback: res.aliasFallback,
    usage: res.usage,
    requestId: res.requestId
  };
}

module.exports = {
  buildArbitratePrompts,
  runArbitrateConflict
};
