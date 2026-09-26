/**
 * tests/dashboard-api/gatewayProductivity.test.js
 * API contract and task tests for Plan-17d Core Productivity.
 * Strict ceiling <= 150 lines.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildAiContext, maskSecrets } = require('../../core/ai/context/contextBuilder');
const { loadVersionedPrompt } = require('../../core/ai/prompts/promptLoader');
const {
  runSuggestLocator,
  staticSpecReview,
  runAnalyzeTestImpact,
  runGenerateReleaseBriefing,
  runAnalyzeRequirementChange,
  runGeneratePlaywrightSpec
} = require('../../core/ai/tasks/index');
const { handleAiProductivityRoutes } = require('../../dashboard/routes/aiProductivityRoutes');

test('Plan-17d Core Productivity Suite', async (t) => {
  await t.test('P17D-TC-01: buildAiContext masks secrets and lists page objects', () => {
    const masked = maskSecrets('const API_KEY = "sk-1234567890abcdef";');
    assert.ok(masked.includes('[MASKED_SECRET]'));

    const ctx = buildAiContext({ task: 'test', budgetTokens: 1000 });
    assert.equal(ctx.task, 'test');
    assert.ok(Array.isArray(ctx.pageObjects));
  });

  await t.test('P17D-TC-02: loadVersionedPrompt interpolates vars with fallback', () => {
    const res = loadVersionedPrompt({
      task: 'suggestLocator',
      vars: { brokenLocator: '#btn-submit', pageUrl: '/login' },
      defaultSystem: 'Sys',
      defaultUser: 'Loc: {{brokenLocator}} on {{pageUrl}}'
    });
    assert.ok(res.user.includes('#btn-submit'));
    assert.ok(res.user.includes('/login'));
  });

  await t.test('P17D-TC-03: runSuggestLocator heuristic detects role and testid', async () => {
    const dom = '<button data-testid="checkout-btn" aria-label="Thanh toán">Thanh toán ngay</button>';
    const res = await runSuggestLocator({ brokenLocator: '.btn-pay', domSnippet: dom });
    assert.ok(res.primarySuggestion);
    assert.ok(res.primarySuggestion.code.includes('getByTestId') || res.primarySuggestion.code.includes('getByRole'));
  });

  await t.test('P17D-TC-04: staticSpecReview flags waitForTimeout, brittle xpath, and missing TC tag', () => {
    const code = `
      test('Login flow', async ({ page }) => {
        await page.waitForTimeout(3000);
        await page.locator('/div[1]/div[2]').click();
      });
    `;
    const res = staticSpecReview(code);
    assert.ok(res.score < 100);
    assert.ok(res.findings.some((f) => f.ruleId === 'PW-NO-WAIT-TIMEOUT'));
    assert.ok(res.findings.some((f) => f.ruleId === 'PW-BRITTLE-XPATH'));
    assert.ok(res.findings.some((f) => f.ruleId === 'PW-MISSING-TC-TAG'));
  });

  await t.test('P17D-TC-05: runAnalyzeTestImpact maps changed page objects to specs', async () => {
    const res = await runAnalyzeTestImpact({ changedFiles: ['pages/checkoutPage.js'], diffText: '+ async submitOrder() {}' });
    assert.ok(res.affectedSpecs.some((s) => s.specPath.includes('checkoutPage')));
    assert.ok(['high', 'medium', 'low'].includes(res.riskLevel));
  });

  await t.test('P17D-TC-06: runGenerateReleaseBriefing computes GO/NO_GO verdict', async () => {
    const noGoRes = await runGenerateReleaseBriefing({ testMetrics: { total: 10, passed: 8, failed: 2 }, openBlockersCount: 1 });
    assert.equal(noGoRes.verdict, 'NO_GO');

    const goRes = await runGenerateReleaseBriefing({ testMetrics: { total: 20, passed: 20, failed: 0 }, openBlockersCount: 0 });
    assert.ok(goRes.verdict === 'GO' || goRes.verdict === 'GO_WITH_CAUTION');
  });

  await t.test('P17D-TC-07: runAnalyzeRequirementChange detects added/removed ACs', async () => {
    const oldReq = '### Acceptance Criteria\n- AC-01: Cho phép tìm kiếm';
    const newReq = '### Acceptance Criteria\n- AC-01: Cho phép tìm kiếm\n- AC-02: Lọc theo giá';
    const res = await runAnalyzeRequirementChange({ reqId: 'REQ-002', oldContent: oldReq, newContent: newReq });
    assert.ok(res.changedAcs.some((a) => a.acId === 'AC-02' && a.changeType === 'added'));
  });

  await t.test('P17D-TC-08: runGeneratePlaywrightSpec produces valid syntax spec with tags', async () => {
    const tcList = [{ id: 'TC-01', title: 'Đăng nhập thành công', acId: 'AC-01' }];
    const res = await runGeneratePlaywrightSpec({ reqId: 'REQ-01', tcList });
    assert.equal(res.syntaxValid, true);
    assert.ok(res.specCode.includes('@TC-01'));
    assert.ok(res.specCode.includes('@AC-01'));
  });

  await t.test('P17D-TC-09: handleAiProductivityRoutes handles POST /api/ai/release-briefing', async () => {
    let sentStatus = null;
    let sentData = null;
    const mockReq = {
      method: 'POST',
      headers: {},
      on: (event, handler) => {
        if (event === 'data') handler(Buffer.from(JSON.stringify({ testMetrics: { total: 5, passed: 5, failed: 0 } })));
        if (event === 'end') handler();
      }
    };
    const mockRes = {
      writeHead: (status) => { sentStatus = status; },
      end: (data) => { sentData = JSON.parse(data); },
      once: () => {}
    };
    const handled = await handleAiProductivityRoutes(mockReq, mockRes, new URL('http://localhost:3000/api/ai/release-briefing'), null);
    assert.equal(handled, true);
    assert.equal(sentStatus, 200);
    assert.ok(sentData.verdict);
  });
});
