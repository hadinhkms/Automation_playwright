/**
 * tests/dashboard/runner-tag-run.spec.js
 * L1: two tag chips run with OR semantics (the same grep the preview assumes), regex-escaped.
 */
const { test, expect } = require('@playwright/test');
const { startDashboardHarness } = require('./support/dashboardHarness');
const { createRunnerFixture } = require('./support/runnerFixture');

test.describe('Runner: manual tag run (L1)', () => {
  let fixture; let harness;
  test.beforeAll(async () => { fixture = createRunnerFixture(); harness = await startDashboardHarness(fixture.rootPath); });
  test.afterAll(async () => { if (harness) await harness.stop(); if (fixture) fixture.cleanup(); });

  test('two tag chips send an OR grep and the preview agrees', async ({ page }) => {
    let body = null;
    await page.route('**/api/run', (route) => {
      body = route.request().postDataJSON();
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'x', status: 'running', command: [], logs: [] }) });
    });
    await page.goto(harness.url);
    await page.waitForSelector('.runner-mode-tab[data-mode="manual"]');
    await page.click('.runner-mode-tab[data-mode="manual"]');
    await page.click('.runner-scope-tab-btn[data-manual-scope="grep"]');
    await page.click('#runner-tag-chips .tag-chip-btn[data-tag="@e2e"]');
    await page.click('#runner-tag-chips .tag-chip-btn[data-tag="@mobile"]');
    await expect(page.locator('#manual-specs-preview-count')).toContainText('2');
    await page.click('#run-button');
    await expect.poll(() => body).not.toBeNull();
    expect(body.grep).toMatch(/@e2e\|@mobile/);
    expect(body.grep).not.toMatch(/@e2e @mobile/);
  });
});
