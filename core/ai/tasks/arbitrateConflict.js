/**
 * core/ai/tasks/arbitrateConflict.js
 * Traceability conflict arbitration between Playwright spec assertions and living docs.
 * Deterministic rule-first arbiter (0 token) with optional AI fallback. Strict ceiling <= 150 lines.
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

function heuristicArbitrateConflict(ctx = {}) {
  const specAcs = Array.isArray(ctx.specAcs) ? ctx.specAcs : [];
  const docAcs = Array.isArray(ctx.docAcs) ? ctx.docAcs : [];
  const blocks = (ctx.blocks || []).map((b) => b.snippet || '').join('\n').toLowerCase();
  const defs = ctx.acDefinitions || {};

  let specMatchScore = 0;
  for (const ac of specAcs) {
    const acText = (defs[ac]?.text || '').toLowerCase();
    const acWords = acText.split(/\s+/).filter(w => w.length > 3);
    for (const w of acWords) {
      if (blocks.includes(w)) specMatchScore += 1;
    }
    if (blocks.includes(ac.toLowerCase())) specMatchScore += 5;
  }

  let docMatchScore = 0;
  for (const ac of docAcs) {
    const acText = (defs[ac]?.text || '').toLowerCase();
    const acWords = acText.split(/\s+/).filter(w => w.length > 3);
    for (const w of acWords) {
      if (blocks.includes(w)) docMatchScore += 1;
    }
    if (blocks.includes(ac.toLowerCase())) docMatchScore += 5;
  }

  const recommendation = (docMatchScore > specMatchScore && docAcs.length) ? 'sync_spec_to_doc' : 'sync_doc_to_spec';
  const confidence = Math.min(95, Math.max(70, Math.round(75 + Math.abs(specMatchScore - docMatchScore) * 5)));
  const reason = recommendation === 'sync_doc_to_spec'
    ? 'Mã nguồn kiểm thử thực tế và các assertion khớp với tiêu chí khai báo trong Spec. Cần đồng bộ tài liệu theo Spec.'
    : 'Đặc tả trong tài liệu phản ánh chính xác mục tiêu nghiệp vụ. Cần cập nhật lại tag AC trong kịch bản test Spec.';

  return { ok: true, source: 'rule', recommendation, confidence, reason };
}

function buildArbitratePrompts(ctx = {}) {
  const safeCtx = ctx || {};
  const defs = Object.values(safeCtx.acDefinitions || {}).map((d) => `- ${d.text} (${d.file}:${d.line})`).join('\n') || '(không có)';
  const blocks = (safeCtx.blocks || []).map((b) => `// ${safeCtx.specFile || ''}:${b.line}\n${b.snippet}`).join('\n\n') || '(không có)';
  const docLines = (safeCtx.docLocations || []).map((l) => `- ${l.file}:${l.line}: ${l.text}`).join('\n') || '(không có)';
  const steps = safeCtx.docDetails?.steps?.length ? safeCtx.docDetails.steps.map((s) => `${s.no}. ${s.action} => ${s.expected}`).join('\n') : '(không có)';

  const system = `Bạn là Trọng tài QA Architect. Đọc code test và AC để kết luận test đang thực sự kiểm chứng AC nào. Trả về JSON: {"recommendation":"sync_doc_to_spec"|"sync_spec_to_doc","confidence":0-100,"reason":"cụ thể"}`;
  const user = `ĐỊNH NGHĨA AC:\n${defs}\n\nCODE TEST:\n${blocks}\n\nDÒNG KHAI:\n${docLines}\n\nBƯỚC:\n${steps}`;
  return [{ role: 'system', content: system }, { role: 'user', content: user }];
}

async function runArbitrateConflict({ ctx, clientConfig = null, root = process.cwd(), signal = null } = {}) {
  if (!clientConfig || !clientConfig.apiKey) {
    return heuristicArbitrateConflict(ctx);
  }

  const messages = buildArbitratePrompts(ctx);
  const res = await callAi({
    task: 'arbitrateConflict', messages, schema: SCHEMA, clientConfig, root, signal,
    tier: 'fast', timeoutMs: 30000, temperature: 0.1
  });

  if (!res.ok || !res.data) {
    return heuristicArbitrateConflict(ctx);
  }

  const rec = ['sync_doc_to_spec', 'sync_spec_to_doc'].includes(res.data?.recommendation) ? res.data.recommendation : 'sync_doc_to_spec';
  const confidence = Math.max(0, Math.min(100, Math.round(Number(res.data.confidence) || 75)));
  const reason = String(res.data.reason || '').trim().slice(0, 600);

  return {
    ok: true, source: 'ai', recommendation: rec, confidence, reason,
    model: res.model, usage: res.usage, requestId: res.requestId
  };
}

module.exports = { buildArbitratePrompts, heuristicArbitrateConflict, runArbitrateConflict };
