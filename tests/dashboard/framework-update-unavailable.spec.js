/**
 * tests/dashboard/framework-update-unavailable.spec.js
 * Packaged installs answer 501 on /api/framework/update: the Git view must show the message and
 * re-enable the button instead of hanging on the spinner.
 */
const { test, expect } = require('@playwright/test');
const { startDashboardHarness } = require('./support/dashboardHarness');
const { createFixtureWorkspace } = require('./support/fixtureWorkspace');

test.describe('Git view: Framework update unavailable (501)', () => {
  let fixture;
  let harness;
  test.beforeAll(async () => { fixture = createFixtureWorkspace(); harness = await startDashboardHarness(fixture.rootPath); });
  test.afterAll(async () => { if (harness) await harness.stop(); if (fixture) fixture.cleanup(); });

  test('shows the 501 message and re-enables the button', async ({ page }) => {
    const message = 'Cập nhật Framework chỉ có trong bản checkout repo (git clone), không có trong bản cài từ package.';
    await page.route('**/api/framework/update', (route) => route.fulfill({
      status: 501, contentType: 'application/json', body: JSON.stringify({ ok: false, error: message }),
    }));
    await page.goto(harness.url);
    await page.waitForFunction(() => Boolean(window.__STUDIO_CORE__));
    await page.evaluate(() => window.__STUDIO_CORE__.featureRegistry.switchView('git-view'));
    await page.click('#btn-git-update-framework');
    await expect(page.locator('#toast')).toContainText('checkout repo');
    await expect(page.locator('#btn-git-update-framework')).toBeEnabled();
    await expect(page.locator('#btn-git-update-framework')).toContainText('Tải cập nhật Framework');
  });
});
