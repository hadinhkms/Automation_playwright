/**
 * core/ai/tasks/draftBugReport.js
 * Generates structured, professional Bug Report drafts from Playwright test failures (QA-4).
 * Deterministic rule-first engine (0 token) with optional AI fallback. Strict ceiling <= 150 lines.
 */
const { callAi } = require('../gateway/index');

const SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    severity: { type: 'string', enum: ['Blocker', 'Critical', 'Major', 'Minor', 'Trivial'] },
    stepsToReproduce: { type: 'array', items: { type: 'string' } },
    expectedResult: { type: 'string' },
    actualResult: { type: 'string' },
    environment: { type: 'string' },
    suggestedFix: { type: 'string' },
    markdownReport: { type: 'string' }
  }
};

function extractStepsFromSnippet(snippet = '', testTitle = '', locator = '', url = '') {
  const steps = [];
  if (snippet) {
    for (const line of snippet.split(/\r?\n/)) {
      const gotoM = line.match(/page\.goto\((.*?)\)/i);
      if (gotoM) steps.push(`Điều hướng đến: ${gotoM[1].replace(/['"`]/g, '')}`);
      const clickM = line.match(/(?:page\.)?(?:locator|getBy[A-Za-z]+)\(([\s\S]*?)\)\.click\(\)/i) || line.match(/page\.click\(([\s\S]*?)\)/i);
      if (clickM) steps.push(`Click vào phần tử: ${clickM[1].replace(/['"`]/g, '').trim()}`);
      const fillM = line.match(/(?:page\.)?(?:locator|getBy[A-Za-z]+)\(([\s\S]*?)\)\.fill\(\s*['"`](.*?)['"`]\s*\)/i);
      if (fillM) steps.push(`Nhập "${fillM[2]}" vào ô: ${fillM[1].replace(/['"`]/g, '').trim()}`);
      const expectM = line.match(/expect\((.*?)\)\.([a-zA-Z]+)\((.*?)\)/i);
      if (expectM) steps.push(`Kiểm tra xác nhận: expect(${expectM[1]}).${expectM[2]}(${expectM[3] || ''})`);
    }
  }
  if (!steps.length) {
    steps.push(`1. Khởi chạy kịch bản kiểm thử: ${testTitle || 'Playwright spec'}`);
    steps.push(`2. Thao tác trên phần tử giao diện: ${locator || 'phần tử kiểm thử'}`);
    steps.push(`3. Kiểm tra assertion và trạng thái phản hồi`);
  } else {
    return steps.map((s, i) => `${i + 1}. ${s}`);
  }
  return steps;
}

function heuristicBugReport({ testTitle = '', errorText = '', locator = '', snippet = '', url = '', triageCategory = '', triageSummary = '' } = {}) {
  const isBlocker = /500|crash|fatal|unhandled|system\s*down/i.test(errorText);
  const severity = isBlocker ? 'Critical' : triageCategory === 'product_bug' ? 'Critical' : triageCategory === 'test_bug' ? 'Major' : 'Major';
  const title = `[Bug] ${testTitle || 'Kiểm thử thất bại: ' + (locator || errorText.slice(0, 40))}`;
  const stepsToReproduce = extractStepsFromSnippet(snippet, testTitle, locator, url);
  const lines = (errorText || '').split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('at ') && !l.includes('node_modules'));
  const receivedLine = lines.find(l => /^Received[:\s]/i.test(l));
  const expectedLine = lines.find(l => /^Expected[:\s]/i.test(l));
  const actualResult = (receivedLine ? receivedLine : lines[0] || 'Lỗi kiểm thử Playwright').slice(0, 300);
  const expectedResult = expectedLine ? expectedLine.slice(0, 300) : 'Kịch bản kiểm thử chạy thành công, phần tử phản hồi đúng nghiệp vụ và vượt qua mọi assertions.';
  const environment = `URL: ${url || 'Local/Staging/CI'}, Runner: Playwright Chromium, OS: ${process.platform}`;
  const suggestedFix = triageSummary || (triageCategory === 'product_bug' ? 'Kiểm tra backend API và dữ liệu phản hồi.' : 'Kiểm tra selector DOM hoặc cập nhật Page Object.');
  const markdownReport = [
    `## ${title}`, '', `**Severity:** ${severity}`, `**Environment:** ${environment}`, '',
    '### Steps to Reproduce:', ...stepsToReproduce.map(s => `- ${s}`), '',
    '### Expected Result:', expectedResult, '',
    '### Actual Result:', actualResult, '',
    '### Suggested Fix:', suggestedFix
  ].join('\n');

  return { source: 'rule', ok: true, title, severity, stepsToReproduce, expectedResult, actualResult, environment, suggestedFix, markdownReport };
}

function buildBugReportPrompts(params = {}) {
  const system = `Bạn là Senior QA Lead. Sinh bản thảo Bug Report chi tiết (title, severity, stepsToReproduce, expectedResult, actualResult, environment, suggestedFix, markdownReport). Trả về JSON đúng schema.`;
  const user = `LỖI PLAYWRIGHT:\nTest: ${params.testTitle}\nURL: ${params.url}\nLocator: ${params.locator}\nChi tiết: ${params.errorText?.slice(0, 2000)}\nSnippet: ${params.snippet?.slice(0, 1000)}`;
  return [{ role: 'system', content: system }, { role: 'user', content: user }];
}

async function runDraftBugReport({ testTitle = '', errorText = '', locator = '', snippet = '', url = '', triageCategory = '', triageSummary = '', clientConfig = null, root = process.cwd(), signal = null } = {}) {
  if (!clientConfig || !clientConfig.apiKey) {
    return heuristicBugReport({ testTitle, errorText, locator, snippet, url, triageCategory, triageSummary });
  }
  const messages = buildBugReportPrompts({ testTitle, errorText, locator, snippet, url, triageCategory, triageSummary });
  const res = await callAi({ task: 'draftBugReport', messages, schema: SCHEMA, clientConfig, root, signal, tier: 'fast', timeoutMs: 30000, temperature: 0.1 });
  if (!res.ok || !res.data) {
    return heuristicBugReport({ testTitle, errorText, locator, snippet, url, triageCategory, triageSummary });
  }
  const d = res.data;
  const title = String(d.title || `[Bug] ${testTitle || 'Test case failure'}`).trim();
  const severity = ['Blocker', 'Critical', 'Major', 'Minor', 'Trivial'].includes(d.severity) ? d.severity : 'Major';
  const stepsToReproduce = Array.isArray(d.stepsToReproduce) && d.stepsToReproduce.length ? d.stepsToReproduce : [`1. Chạy test: ${testTitle}`];
  const expectedResult = String(d.expectedResult || '').trim();
  const actualResult = String(d.actualResult || errorText.slice(0, 300)).trim();
  const environment = String(d.environment || `URL: ${url || 'Local'}, Playwright`).trim();
  const suggestedFix = String(d.suggestedFix || '').trim();
  const markdownReport = String(d.markdownReport || `## ${title}\n\n**Severity:** ${severity}\n\n### Steps to Reproduce:\n${stepsToReproduce.map(s => `- ${s}`).join('\n')}\n\n### Expected Result:\n${expectedResult}\n\n### Actual Result:\n${actualResult}\n\n### Suggested Fix:\n${suggestedFix}`).trim();
  return { ok: true, source: 'ai', title, severity, stepsToReproduce, expectedResult, actualResult, environment, suggestedFix, markdownReport, model: res.model, usage: res.usage, requestId: res.requestId };
}

module.exports = { SCHEMA, heuristicBugReport, buildBugReportPrompts, runDraftBugReport };
