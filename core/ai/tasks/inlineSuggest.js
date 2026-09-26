/**
 * core/ai/tasks/inlineSuggest.js
 * AI task: Fast inline code and spec completion suggestions (<10s, fast tier).
 * Strict ceiling <= 150 lines.
 */
const { callAi } = require('../gateway/index');

async function runInlineSuggest({ promptText = '', clientConfig = null, root = process.cwd(), signal = null } = {}) {
  if (!promptText || !promptText.trim()) {
    return { ok: true, suggestion: '' };
  }

  const messages = [{ role: 'user', content: promptText }];
  const res = await callAi({
    task: 'inlineSuggest',
    messages,
    schema: null,
    clientConfig,
    root,
    signal,
    tier: 'fast',
    timeoutMs: 10000,
    temperature: 0.1
  });

  if (!res.ok) {
    return { ok: false, error: res, suggestion: '' };
  }

  const raw = String(res.text || '');
  const clean = raw.replace(/^```[a-z]*\s*/i, '').replace(/```$/g, '').trimEnd();

  return {
    ok: true,
    suggestion: clean,
    model: res.model,
    tier: res.tier,
    usage: res.usage,
    requestId: res.requestId
  };
}

module.exports = {
  runInlineSuggest
};
