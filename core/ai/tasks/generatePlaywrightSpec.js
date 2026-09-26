/**
 * core/ai/tasks/generatePlaywrightSpec.js
 * Generates Playwright test spec from BDD Test Cases with Level 1 Safety Sandbox (QA-2).
 * Validates syntax via vm.Script without executing. Strict ceiling <= 150 lines.
 */
const vm = require('vm');
const { callAi } = require('../gateway/index');

const SCHEMA = {
  type: 'object',
  properties: {
    specCode: { type: 'string' },
    fileName: { type: 'string' },
    usedPageObjects: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' }
  },
  required: ['specCode', 'fileName']
};

function validateScriptSyntax(code = '') {
  try {
    new vm.Script(code);
    return { valid: true, error: null };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

function buildSkeletonSpec(reqId = 'REQ-001', tcList = []) {
  const safeId = reqId.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  const fileName = `${safeId}.spec.js`;
  const tests = tcList.length ? tcList : [{ id: 'TC-01', title: 'Kiểm thử mặc định', acId: 'AC-01' }];

  const formatId = (id) => (id.startsWith('@') ? id : `@${id}`);
  const formatAc = (ac) => (ac.startsWith('@') ? ac : `@${ac}`);

  const code = `// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('${reqId} - Automated Suite', () => {
${tests.map((tc) => `  test('${formatId(tc.id || 'TC-01')}: ${tc.title || 'Scenario'} ${formatAc(tc.acId || 'AC-01')}', async ({ page }) => {
    // 1. Arrange & Navigate
    await page.goto('/');

    // 2. Act
    const heading = page.locator('h1, h2, .main-title').first();

    // 3. Assert
    await expect(heading).toBeVisible();
  });`).join('\n\n')}
});
`;

  return {
    source: 'rule',
    fileName,
    specCode: code,
    usedPageObjects: [],
    syntaxValid: true,
    summary: `Heuristic skeleton spec sinh cho ${tests.length} test case của ${reqId}.`
  };
}

async function runGeneratePlaywrightSpec({
  reqId = 'REQ-001',
  requirementTitle = '',
  tcList = [],
  availablePageObjects = [],
  signal = null,
  clientConfig = null
} = {}) {
  const fallback = buildSkeletonSpec(reqId, tcList);

  const system = `Bạn là Senior Playwright Automation Architect.
Nhiệm vụ: Chuyển đổi danh sách BDD Test Cases thành mã nguồn spec Playwright JavaScript (.spec.js) chuẩn mực.
Quy chuẩn bắt buộc:
1. @ts-check ở đầu file.
2. Tiêu đề mỗi test phải chứa mã @TC-xxx và @AC-yyy.
3. Dùng web-first assertions (expect(locator).toBeVisible()).
4. Tuyệt đối không dùng waitForTimeout(), không dùng xpath giòn.
Trả về JSON đúng schema.`;
  const user = `Yêu cầu: ${reqId} - ${requirementTitle}
Page Objects sẵn có: ${JSON.stringify(availablePageObjects.slice(0, 5))}
Danh sách Test Cases:
${JSON.stringify(tcList.slice(0, 10), null, 2)}`;

  try {
    const result = await callAi({
      task: 'generatePlaywrightSpec',
      system,
      user,
      schema: SCHEMA,
      signal,
      clientConfig
    });

    if (result && result.specCode) {
      const syntaxCheck = validateScriptSyntax(result.specCode);
      if (syntaxCheck.valid) {
        return {
          source: 'ai',
          fileName: result.fileName || fallback.fileName,
          specCode: result.specCode,
          usedPageObjects: result.usedPageObjects || [],
          syntaxValid: true,
          summary: result.summary || 'Playwright spec sinh bởi AI đã qua Level 1 Safety Sandbox.'
        };
      }
    }
  } catch (err) {
    // Fall back to skeleton
  }

  return fallback;
}

module.exports = {
  runGeneratePlaywrightSpec,
  validateScriptSyntax,
  buildSkeletonSpec,
  SCHEMA
};
