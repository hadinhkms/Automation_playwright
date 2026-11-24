/**
 * tests/dashboard/qa-scaffold-badge.spec.js
 * NB-04: scaffold wizard preview lists the 3 file paths (not "[object Object]").
 * NB-05: the "Vấn đề" tab badge uses the QA Core summary count, the same number as the health card.
 */
const { test, expect } = require('@playwright/test');
const { startDashboardHarness } = require('./support/dashboardHarness');
const { createFixtureWorkspace } = require('./support/fixtureWorkspace');

const finding = (severity, i) => ({ severity, kind: 'k', id: `F-${i}`, detail: 'd' });

test.describe('QA view: scaffold preview (NB-04) and findings badge (NB-05)', () => {
  let fixture; let harness;
  test.beforeAll(async () => { fixture = createFixtureWorkspace(); harness = await startDashboardHarness(fixture.rootPath); });
  test.afterAll(async () => { if (harness) await harness.stop(); if (fixture) fixture.cleanup(); });

  test('NB-04: preview step names the three files to create', async ({ page }) => {
    await page.goto(harness.url);
    await page.waitForFunction(() => Boolean(window.__STUDIO_CORE__));
    await page.evaluate(() => window.__STUDIO_CORE__.featureRegistry.switchView('qa-view'));
    await page.click('#qa-btn-scaffold');
    const modal = page.locator('#qa-scaffold-modal');
    await modal.locator('#qa-scaffold-raw-content').fill('# Tìm kiếm việc làm\n- AC-001: Given từ khóa Tester, When bấm Tìm, Then hiện danh sách việc làm.');
    await modal.locator('#qa-btn-extract-raw').click();
    await expect(modal.locator('#qa-scaffold-raw-preview')).toBeVisible();
    const items = modal.locator('#qa-scaffold-preview-files-list li');
    await expect(items).toHaveCount(3);
    const texts = await items.allTextContents();
    expect(texts.join('\n')).not.toContain('[object Object]');
    expect(texts[0]).toMatch(/\.md$/);
    expect(texts[1]).toMatch(/\.md$/);
    expect(texts[2]).toMatch(/\.spec\.js$/);
  });

  test('NB-05: tab badge equals the summary total (19), not summary + trace (32)', async ({ page }) => {
    const summaryFindings = [...Array(9)].map((_, i) => finding('blocker', i)).concat([...Array(10)].map((_, i) => finding('major', i + 9)));
    await page.route('**/api/qa/summary*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      systemHealth: 'CRITICAL', health: { status: 'CRITICAL', totalFindings: 19, blockers: 9, majors: 10 }, findings: summaryFindings,
      metrics: { coveragePercent: 0, coveredAcCount: 0, acceptanceCriteria: 0, automatedTests: 0, testCases: 0 },
    }) }));
    await page.route('**/api/qa/trace*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      available: true, counts: { requirements: 0, testCases: 0, specs: 0 }, majorCount: 10, automatedCount: 0, requirements: [],
      findings: { major: [...Array(10)].map((_, i) => finding('major', i)), minor: [finding('minor', 1), finding('minor', 2)], info: [finding('info', 1)] },
    }) }));
    await page.goto(harness.url);
    await page.waitForFunction(() => Boolean(window.__STUDIO_CORE__));
    await page.evaluate(() => window.__STUDIO_CORE__.featureRegistry.switchView('qa-view'));
    await expect(page.locator('#qa-health-findings-text')).toContainText('19 phát hiện');
    await expect(page.locator('#qa-tab-badge-findings')).toHaveText('19');
  });
});
