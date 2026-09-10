// @ts-check
const { test, expect } = require('@playwright/test');
const { createFixtureWorkspace } = require('./support/fixtureWorkspace');
const { startDashboardHarness } = require('./support/dashboardHarness');

test.describe('Dashboard Studio Baseline Smoke Test', () => {
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

  test('TC-SMOKE-01: Dashboard boots on isolated port and renders Shell container', async ({ page }) => {
    const consoleErrors = [];
    page.on('pageerror', (err) => consoleErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    const response = await page.goto(harness.url, { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBe(200);

    // Verify Shell container & title
    const title = await page.title();
    expect(title).toBeTruthy();

    // Verify main navigation bar exists
    const navTabs = page.locator('.view-tab, [data-view]');
    await expect(navTabs.first()).toBeVisible({ timeout: 10000 });

    // Assert zero critical unhandled crashes on boot
    const criticalCrashes = consoleErrors.filter(e => !e.includes('favicon') && !e.includes('404'));
    expect(criticalCrashes.length).toBe(0);
  });
});
