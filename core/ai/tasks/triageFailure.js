/**
 * core/ai/tasks/triageFailure.js
 * Automated failure triage and Root Cause Analysis (RCA) for Playwright test runs.
 * Deterministic rule-first diagnostics (0 token) with optional AI fallback. Strict ceiling <= 150 lines.
 */
const { callAi } = require('../gateway/index');
const { analyzeDiagnostics } = require('../../diagnostics/diagnosticsAnalyzer');

const SCHEMA = {
  type: 'object',
  properties: {
    category: { type: 'string', enum: ['product_bug', 'test_bug', 'environment', 'flaky'] },
    confidence: { type: 'number' },
    summary: { type: 'string' },
    evidence: { type: 'string' },
    suggestedFix: { type: 'string' }
  }
};

function formatLogSnippet(text, maxLen = 4000) {
  if (!text || text.length <= maxLen) return text || '';
  const headLen = Math.min(800, Math.floor(maxLen * 0.25));
  const tailLen = maxLen - headLen - 50;
  return `${text.slice(0, headLen)}\n\n...[cắt bớt ${text.length - maxLen} ký tự log]...\n\n${text.slice(text.length - tailLen)}`;
}

function heuristicTriage({ errorText = '', testTitle = '', locator = '', snippet = '', consoleLogs = '', url = '' } = {}) {
  const diag = analyzeDiagnostics({ error: errorText, message: errorText, testTitle, locator, snippet, consoleLogs, url });
  const top = diag.findings[0] || {};
  const category = ['product_bug', 'test_bug', 'environment', 'flaky'].includes(diag.topCategory) ? diag.topCategory : 'test_bug';
  const confidence = Math.round((top.confidence || 0.85) * 100);
  const summary = top.message || 'Lỗi kiểm thử Playwright.';
  const evidence = (top.evidence && top.evidence.map(e => e.value).join('\n')) || errorText.slice(0, 500);
  const suggestedFix = (top.suggestedFix && top.suggestedFix.preview) || 'Kiểm tra lại kịch bản kiểm thử hoặc locator.';
  return { ok: true, source: 'rule', category, confidence, summary, evidence, suggestedFix, findings: diag.findings };
}

function buildTriagePrompts(params = {}) {
  const system = `Bạn là Senior QA RCA Specialist. Phân loại lỗi vào đúng 1 trong 4 nhóm: "product_bug", "test_bug", "environment", "flaky". Trả về JSON theo đúng schema.`;
  const user = `LỖI PLAYWRIGHT:\nTest: ${params.testTitle}\nURL: ${params.url}\nLocator: ${params.locator}\nError:\n${formatLogSnippet(params.errorText, 3000)}\nSnippet:\n${formatLogSnippet(params.snippet, 2000)}`;
  return [{ role: 'system', content: system }, { role: 'user', content: user }];
}

async function runTriageFailure({
  errorText = '', testTitle = '', locator = '', snippet = '', consoleLogs = '', url = '',
  clientConfig = null, root = process.cwd(), signal = null
} = {}) {
  if (!clientConfig || !clientConfig.apiKey) {
    return heuristicTriage({ errorText, testTitle, locator, snippet, consoleLogs, url });
  }

  const messages = buildTriagePrompts({ errorText, testTitle, locator, snippet, consoleLogs, url });
  const res = await callAi({
    task: 'triageFailure', messages, schema: SCHEMA, clientConfig, root, signal,
    tier: 'fast', timeoutMs: 30000, temperature: 0.1
  });

  if (!res.ok || !res.data) {
    return heuristicTriage({ errorText, testTitle, locator, snippet, consoleLogs, url });
  }

  const category = ['product_bug', 'test_bug', 'environment', 'flaky'].includes(res.data?.category) ? res.data.category : 'test_bug';
  const confidence = Math.max(0, Math.min(100, Math.round(Number(res.data?.confidence) || 75)));
  const summary = String(res.data?.summary || 'Đã phân tích lỗi kiểm thử.').trim().slice(0, 500);
  const evidence = String(res.data?.evidence || '').trim().slice(0, 1000);
  const suggestedFix = String(res.data?.suggestedFix || 'Kiểm tra lại kịch bản test.').trim().slice(0, 1000);

  return {
    ok: true, source: 'ai', category, confidence, summary, evidence, suggestedFix,
    model: res.model, usage: res.usage, requestId: res.requestId
  };
}

module.exports = { SCHEMA, heuristicTriage, buildTriagePrompts, runTriageFailure };
