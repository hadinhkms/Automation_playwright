/**
 * tests/dashboard/qa-ai-productivity.spec.js
 * E2E test suite for Plan-17d Core Productivity:
 * Release Readiness Briefing (PO-1), Playwright Spec Generator (QA-2),
 * and Locator Repair Suggestion (QA-5).
 */
const { test, expect } = require('@playwright/test');
const { startDashboardHarness } = require('./support/dashboardHarness');
const { createFixtureWorkspace } = require('./support/fixtureWorkspace');

test.describe('Plan-17d: Core Productivity UI E2E Suite', () => {
  test.describe.configure({ timeout: 60_000 });
  let fixture;
  let harness;

  test.beforeAll(async () => {
    fixture = createFixtureWorkspace();
    harness = await startDashboardHarness(fixture.rootPath);
  });

  test.afterAll(async () => {
    if (harness) await harness.stop();
    if (fixture) fixture.cleanup();
  });

  test('P17D-TC-10: PO-1 Release Readiness Briefing modal displays verdict and readiness score', async ({ page }) => {
    await page.route('**/api/ai/release-briefing', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          source: 'ai',
          verdict: 'GO_WITH_CAUTION',
          readinessScore: 88,
          headline: 'Đánh giá phát hành: GO WITH CAUTION',
          rationale: 'Tất cả test suite cốt lõi đều đạt, nhưng còn 1 test case biên cần theo dõi.',
          highlights: ['18/20 test cases pass', 'Độ phủ 90%']
        })
      });
    });

    await page.goto(harness.url);
    await page.waitForLoadState('domcontentloaded');

    // Switch to QA view
    await page.evaluate(async () => {
      const core = window.__STUDIO_CORE__;
      if (core?.featureRegistry) {
        await core.featureRegistry.switchView('qa-view');
      }
    });

    const briefingBtn = page.locator('#qa-btn-release-briefing');
    await expect(briefingBtn).toBeVisible({ timeout: 10000 });
    await briefingBtn.click();

    const modal = page.locator('#qa-release-briefing-modal');
    await expect(modal).toBeVisible({ timeout: 10000 });

    const verdictEl = page.locator('#qa-release-briefing-content');
    await expect(verdictEl).toContainText('GO_WITH_CAUTION');
    await expect(verdictEl).toContainText('88/100');

    // Close modal
    const closeBtn = page.locator('#qa-release-briefing-dismiss');
    await closeBtn.click();
    await expect(modal).not.toBeVisible();
  });

  test('P17D-TC-11: QA-2 Playwright Spec Generator produces valid code within Requirement modal', async ({ page }) => {
    await page.route('**/api/ai/generate-spec', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          source: 'ai',
          fileName: 'user_profile.spec.js',
          specCode: `// @ts-check\nconst { test, expect } = require('@playwright/test');\ntest.describe('Profile Suite', () => {\n  test('TC-01: Edit profile @AC-01', async ({ page }) => {\n    await expect(page.locator('h1')).toBeVisible();\n  });\n});`,
          usedPageObjects: ['profilePage.js'],
          summary: 'Playwright spec sinh thành công với Level 1 Sandbox.'
        })
      });
    });

    await page.goto(harness.url);
    await page.waitForLoadState('domcontentloaded');

    await page.evaluate(async () => {
      const core = window.__STUDIO_CORE__;
      if (core?.featureRegistry) {
        await core.featureRegistry.switchView('qa-view');
      }
    });

    const openBtn = page.locator('#qa-btn-analyze-req');
    await expect(openBtn).toBeVisible({ timeout: 10000 });
    await openBtn.click();

    const textarea = page.locator('#qa-req-analyzer-text');
    await textarea.fill('Yêu cầu: Người dùng cập nhật hồ sơ cá nhân và lưu thành công.');

    const genSpecBtn = page.locator('#qa-req-btn-generate-spec');
    await expect(genSpecBtn).toBeVisible();
    await genSpecBtn.click();

    // Spec tab should become active and display code
    const specResult = page.locator('#qa-req-spec-result');
    await expect(specResult).toBeVisible({ timeout: 10000 });
    await expect(specResult).toContainText('user_profile.spec.js');
    await expect(specResult).toContainText('Profile Suite');
  });

  test('P17D-TC-12: QA-5 Locator Repair button suggests resilient locator in diagnostics panel', async ({ page }) => {
    await page.route('**/api/ai/triage-failure', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          source: 'ai',
          category: 'test_defect',
          confidence: 90,
          summary: 'Locator không tìm thấy phần tử sau timeout 5000ms',
          evidence: '<button data-testid="submit-order-btn">Xác nhận</button>',
          locator: '#btn-submit',
          suggestedFix: 'Đổi sang getByTestId'
        })
      });
    });

    await page.route('**/api/ai/suggest-locator', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          source: 'ai',
          primarySuggestion: {
            code: "page.getByTestId('submit-order-btn')",
            type: 'getByTestId',
            confidence: 0.95,
            rationale: 'Phát hiện data-testid duy nhất trong DOM'
          },
          alternatives: [],
          rootCause: 'DOM thay đổi cấu trúc class'
        })
      });
    });

    await page.goto(harness.url);
    await page.waitForLoadState('domcontentloaded');

    // Trigger diagnostics panel via test error input
    const diagInput = page.locator('#diagnostics-error-input');
    await expect(diagInput).toBeVisible({ timeout: 10000 });
    await diagInput.fill('Error: Timed out 5000ms waiting for expect(locator).toBeVisible()\nLocator: #btn-submit');

    const triageBtn = page.locator('#diagnostics-analyze-btn');
    await triageBtn.click();

    const suggestBtn = page.locator('#btn-diagnostics-suggest-locator');
    await expect(suggestBtn).toBeVisible({ timeout: 10000 });
    await suggestBtn.click();

    const bugContainer = page.locator('#diagnostics-bug-report-container');
    await expect(bugContainer).toBeVisible({ timeout: 10000 });
    await expect(bugContainer).toContainText("page.getByTestId('submit-order-btn')");
    await expect(bugContainer).toContainText('getByTestId (Độ tin cậy: 95%)');
  });
});
