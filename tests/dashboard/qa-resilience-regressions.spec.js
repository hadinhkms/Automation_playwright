/**
 * tests/dashboard/qa-resilience-regressions.spec.js
 * E2E regressions for stale localStorage subtab fallback, Requirement Analyzer
 * Escape dirty-guard (UI-05), and Compare view /tools/visual_compare.html serving.
 */
const { test, expect } = require('@playwright/test');
const { startDashboardHarness } = require('./support/dashboardHarness');
const { createFixtureWorkspace } = require('./support/fixtureWorkspace');
const { watchErrors } = require('./support/batchE2e');

test.describe('Dashboard UI Resilience & Lifecycle Regressions', () => {
  let fixture;
  let harness;
  let errors;

  test.beforeAll(async () => {
    fixture = createFixtureWorkspace();
    harness = await startDashboardHarness(fixture.rootPath);
  });

  test.afterAll(async () => {
    if (harness) await harness.stop();
    if (fixture) fixture.cleanup();
  });

  test.beforeEach(async ({ page }) => {
    errors = watchErrors(page);
  });

  test.afterEach(async () => {
    expect(errors(), errors().join('\n')).toEqual([]);
  });

  test('Stale dashboard_qa_subtab in localStorage falls back cleanly to #qa-panel-docs', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('dashboard_qa_subtab', 'legacy-removed-subtab');
    });
    await page.goto(`${harness.url}/#/qa`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#qa-panel-docs')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-qa-tab="docs"]')).toHaveClass(/active/);
  });

  test('Requirement Analyzer Escape key honors BDD dirty guard (UI-05) and keeps modal open on stay', async ({ page }) => {
    await page.route('**/api/ai/format-bdd', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          acIds: ['AC-001'],
          scenarios: [{ acId: 'AC-001', title: 'T1', given: ['G'], when: ['W'], then: ['T'] }],
          proposals: [],
          openQuestions: [],
          markdown: '### AC-001: T1\n\n**Given** G\n**When** W\n**Then** T',
        }),
      });
    });

    await page.goto(`${harness.url}/#/qa`, { waitUntil: 'domcontentloaded' });
    await page.locator('#qa-btn-analyze-req').click();
    const modal = page.locator('#qa-req-analyzer-modal');
    await expect(modal).toBeVisible();

    await page.locator('#qa-req-analyzer-text').fill('### AC-001: Escape dirty guard test');
    await page.locator('#qa-req-btn-bdd').click();

    const bddMarkdown = page.locator('#qa-req-bdd-markdown');
    await expect(bddMarkdown).toBeVisible();

    await page.keyboard.press('Escape');
    const confirmDialog = page.locator('#qa-batch-confirm');
    await expect(confirmDialog).toBeVisible();

    await page.locator('#qa-batch-confirm [data-confirm-cancel]').click();
    await expect(confirmDialog).toBeHidden();
    await expect(modal).toBeVisible();
    await expect(bddMarkdown).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(confirmDialog).toBeVisible();
    await page.locator('#qa-batch-confirm [data-confirm-ok]').click();
    await expect(confirmDialog).toBeHidden();
    await expect(modal).toBeHidden();
  });

  test('Compare view loads /tools/visual_compare.html without 404 in satellite/fixture workspace', async ({ page }) => {
    await page.goto(`${harness.url}/#/compare`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#compare-view')).toBeVisible({ timeout: 10_000 });
    const frame = page.locator('#compare-view iframe[src*="visual_compare.html"]');
    await expect(frame).toHaveCount(1);
  });
});
