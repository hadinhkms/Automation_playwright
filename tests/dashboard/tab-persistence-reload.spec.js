/**
 * tests/dashboard/tab-persistence-reload.spec.js
 * Verification of Tab & View Persistence Across Page Reloads.
 * Budget: <= 180 lines.
 */

const { test, expect } = require('@playwright/test');
const { startDashboardHarness } = require('./support/dashboardHarness');
const { createFixtureWorkspace } = require('./support/fixtureWorkspace');

test.describe('Dashboard View & Tab Persistence Across Page Reloads', () => {
  let fixture;
  let harness;

  test.beforeAll(async () => {
    fixture = createFixtureWorkspace();
    harness = await startDashboardHarness(fixture.root);
  });

  test.afterAll(async () => {
    if (harness) await harness.stop();
    if (fixture) fixture.cleanup();
  });

  test('TC-RELOAD-01: Direct navigation to URL with hash #/builder-view stays on builder-view upon reload', async ({ page }) => {
    await page.goto(`${harness.url}/#/builder-view`);
    await page.waitForSelector('.shell');
    await page.waitForFunction(() => Boolean(window.__STUDIO_CORE__));

    const builderTab = page.locator('.view-tab[data-view="builder-view"]');
    const builderView = page.locator('#builder-view');

    await expect(builderTab).toHaveClass(/active/);
    await expect(builderView).toBeVisible();

    // Reload the page
    await page.reload();
    await page.waitForSelector('.shell');
    await page.waitForFunction(() => Boolean(window.__STUDIO_CORE__));

    // Verify it remains on builder-view
    await expect(builderTab).toHaveClass(/active/);
    await expect(builderView).toBeVisible();
    await expect(page.locator('#runner-view')).toBeHidden();
  });

  test('TC-RELOAD-02: Switching tabs updates localStorage and URL hash, and reload preserves tab', async ({ page }) => {
    await page.goto(harness.url);
    await page.waitForSelector('.shell');
    await page.waitForFunction(() => Boolean(window.__STUDIO_CORE__));

    // Click "Quản lý Page"
    const pageTab = page.locator('.view-tab[data-view="page-manager-view"]');
    await pageTab.click();
    await page.waitForTimeout(100);

    const pageView = page.locator('#page-manager-view');
    await expect(pageTab).toHaveClass(/active/);
    await expect(pageView).toBeVisible();

    // Verify localStorage & hash
    const storedView = await page.evaluate(() => localStorage.getItem('dashboard_active_view'));
    expect(storedView).toBe('page-manager-view');
    const currentHash = await page.evaluate(() => window.location.hash);
    expect(currentHash).toMatch(/#\/page-manager-view/);

    // Reload page
    await page.reload();
    await page.waitForSelector('.shell');
    await page.waitForFunction(() => Boolean(window.__STUDIO_CORE__));

    // Must still be on page-manager-view
    await expect(page.locator('.view-tab[data-view="page-manager-view"]')).toHaveClass(/active/);
    await expect(page.locator('#page-manager-view')).toBeVisible();
    await expect(page.locator('#runner-view')).toBeHidden();
  });

  test('TC-RELOAD-03: Dropdown tool view (e.g. data-view) persists across reload with active dropdown state', async ({ page }) => {
    await page.goto(harness.url);
    await page.waitForSelector('.shell');
    await page.waitForFunction(() => Boolean(window.__STUDIO_CORE__));

    // Open tools dropdown and click data-view
    const toolsBtn = page.locator('#nav-tools-btn');
    await toolsBtn.click();
    const dataTab = page.locator('.view-tab[data-view="data-view"]');
    await dataTab.click();
    await page.waitForTimeout(100);

    const dataView = page.locator('#data-view');
    await expect(dataView).toBeVisible();
    await expect(toolsBtn).toHaveClass(/active/);

    // Reload
    await page.reload();
    await page.waitForSelector('.shell');
    await page.waitForFunction(() => Boolean(window.__STUDIO_CORE__));

    // Verify data-view is still active and visible
    await expect(page.locator('#data-view')).toBeVisible();
    await expect(page.locator('#nav-tools-btn')).toHaveClass(/active/);
  });

  test('TC-RELOAD-04: Subtabs inside views (e.g. Resources category) persist across reload', async ({ page }) => {
    await page.goto(`${harness.url}/#/resources-view`);
    await page.waitForSelector('.shell');
    await page.waitForFunction(() => Boolean(window.__STUDIO_CORE__));

    // Switch to evidence category
    const evidenceBtn = page.locator('.resource-seg-btn[data-category="evidence"]');
    if (await evidenceBtn.isVisible()) {
      await evidenceBtn.click();
      await page.waitForTimeout(100);
      await expect(evidenceBtn).toHaveClass(/active/);

      // Reload
      await page.reload();
      await page.waitForSelector('.shell');
      await page.waitForFunction(() => Boolean(window.__STUDIO_CORE__));

      // Check evidence button is still active
      await expect(page.locator('.resource-seg-btn[data-category="evidence"]')).toHaveClass(/active/);
    }
  });

  test('TC-RELOAD-05: Hashchange event dynamically switches active view without page reload', async ({ page }) => {
    await page.goto(harness.url);
    await page.waitForSelector('.shell');
    await page.waitForFunction(() => Boolean(window.__STUDIO_CORE__));

    // Initially on runner-view
    await expect(page.locator('#runner-view')).toBeVisible();

    // Programmatically change hash to #/builder-view
    await page.evaluate(() => {
      window.location.hash = '#/builder-view';
    });
    await page.waitForTimeout(200);

    await expect(page.locator('#builder-view')).toBeVisible();
    await expect(page.locator('.view-tab[data-view="builder-view"]')).toHaveClass(/active/);

    // Change hash to #/settings-view
    await page.evaluate(() => {
      window.location.hash = '#/settings-view';
    });
    await page.waitForTimeout(200);

    await expect(page.locator('#settings-view')).toBeVisible();
    await expect(page.locator('.view-tab[data-view="settings-view"]')).toHaveClass(/active/);
  });
});
