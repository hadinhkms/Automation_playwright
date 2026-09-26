/**
 * core/ai/tasks/suggestLocator.js
 * AI task: Analyzes failed locator and DOM snippet to suggest resilient Playwright locators (QA-5).
 * Strict ceiling <= 150 lines.
 */
const { callAi } = require('../gateway/index');
const { loadVersionedPrompt } = require('../prompts/promptLoader');

const SCHEMA = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['success', 'fallback'] },
    primarySuggestion: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        type: { type: 'string' },
        confidence: { type: 'number' },
        rationale: { type: 'string' }
      },
      required: ['code', 'type', 'confidence', 'rationale']
    },
    alternatives: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          type: { type: 'string' },
          confidence: { type: 'number' }
        }
      }
    },
    rootCause: { type: 'string' }
  },
  required: ['primarySuggestion']
};

function heuristicLocatorRepair(brokenLocator = '', domSnippet = '') {
  const suggestions = [];
  const testIdMatch = domSnippet.match(/data-testid=["']([^"']+)["']/i);
  if (testIdMatch) {
    suggestions.push({
      code: `page.getByTestId('${testIdMatch[1]}')`,
      type: 'getByTestId',
      confidence: 0.95,
      rationale: 'Phát hiện thuộc tính data-testid duy nhất trong DOM'
    });
  }

  const roleMatch = domSnippet.match(/<(button|a|input|select|textarea)\b([^>]*)>(?:([^<]+)<\/\1>)?/i);
  if (roleMatch) {
    const tag = roleMatch[1].toLowerCase();
    const role = tag === 'a' ? 'link' : tag === 'button' ? 'button' : 'textbox';
    const text = (roleMatch[3] || '').trim();
    if (text) {
      suggestions.push({
        code: `page.getByRole('${role}', { name: '${text}' })`,
        type: 'getByRole',
        confidence: 0.9,
        rationale: `Phát hiện thẻ <${tag}> với văn bản nhãn trực quan "${text}"`
      });
    }
  }

  const ariaMatch = domSnippet.match(/aria-label=["']([^"']+)["']/i);
  if (ariaMatch) {
    suggestions.push({
      code: `page.getByLabel('${ariaMatch[1]}')`,
      type: 'getByLabel',
      confidence: 0.85,
      rationale: `Phát hiện thuộc tính aria-label="${ariaMatch[1]}"`
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      code: `page.locator('${brokenLocator.replace(/['"]/g, '') || '.fallback-target'}')`,
      type: 'locator',
      confidence: 0.5,
      rationale: 'Không tìm thấy thuộc tính ngữ nghĩa rõ ràng, giữ lại selector cơ bản'
    });
  }

  return {
    status: 'fallback',
    source: 'rule',
    primarySuggestion: suggestions[0],
    alternatives: suggestions.slice(1),
    rootCause: 'DOM thay đổi hoặc phần tử chưa sẵn sàng khi truy vấn.'
  };
}

async function runSuggestLocator({
  brokenLocator = '',
  errorMessage = '',
  domSnippet = '',
  pageUrl = '',
  signal = null,
  clientConfig = null
} = {}) {
  const fallback = heuristicLocatorRepair(brokenLocator, domSnippet);

  const defaultSystem = 'Bạn là Senior Playwright Automation Architect. Đề xuất locator thay thế bền vững (getByRole, getByTestId, getByText). Trả về JSON đúng schema.';
  const defaultUser = `Locator lỗi: ${brokenLocator}\nLỗi: ${errorMessage}\nURL: ${pageUrl}\nDOM:\n\`\`\`html\n${domSnippet.slice(0, 3000)}\n\`\`\``;

  const { system, user } = loadVersionedPrompt({
    task: 'suggestLocator',
    vars: { brokenLocator, errorMessage, domSnippet: domSnippet.slice(0, 3000), pageUrl },
    defaultSystem,
    defaultUser
  });

  try {
    const result = await callAi({
      task: 'suggestLocator',
      system,
      user,
      schema: SCHEMA,
      signal,
      clientConfig
    });

    if (result && result.primarySuggestion && result.primarySuggestion.code) {
      return {
        status: 'success',
        source: 'ai',
        primarySuggestion: result.primarySuggestion,
        alternatives: result.alternatives || [],
        rootCause: result.rootCause || 'Locator bị lệch do cấu trúc DOM thay đổi'
      };
    }
  } catch (err) {
    // Graceful fallback to heuristic
  }

  return fallback;
}

module.exports = {
  runSuggestLocator,
  heuristicLocatorRepair,
  SCHEMA
};
