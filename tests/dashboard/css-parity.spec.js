const { test, expect } = require('@playwright/test');
const { startDashboardHarness } = require('./support/dashboardHarness');
const { createFixtureWorkspace } = require('./support/fixtureWorkspace');

test.describe('TC-10: CSS Modularization & Visual Parity Verification', () => {
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

  test('TC-10-A: All modular CSS files are delivered with HTTP 200 and no 404 errors', async ({ page }) => {
    const failedRequests = [];
    const cssRequests = [];

    page.on('requestfailed', (req) => {
      failedRequests.push({ url: req.url(), failure: req.failure()?.errorText });
    });

    page.on('response', (res) => {
      if (res.url().includes('.css')) {
        cssRequests.push({ url: res.url(), status: res.status() });
      }
    });

    await page.goto(harness.url, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.shell');
    await page.waitForTimeout(1000);

    // Expect zero failed requests
    expect(failedRequests).toEqual([]);

    // Verify main styles.css loaded successfully with 200 OK
    const mainCss = cssRequests.find((r) => r.url.includes('/styles.css'));
    expect(mainCss).toBeDefined();
    expect(mainCss.status).toBe(200);

    // Verify all sub-stylesheets loaded with 200 OK
    const subCssFiles = cssRequests.filter((r) => r.url.includes('/styles/'));
    expect(subCssFiles.length).toBeGreaterThanOrEqual(10);
    for (const css of subCssFiles) {
      expect(css.status).toBe(200);
    }

    // Verify exact cascade order: resources.css MUST precede toggle-switch.css
    const resourcesIndex = subCssFiles.findIndex((r) => r.url.includes('/styles/views/resources.css'));
    const toggleIndex = subCssFiles.findIndex((r) => r.url.includes('/styles/components/toggle-switch.css'));
    const commonScaleIndex = subCssFiles.findIndex((r) => r.url.includes('/styles/components/common-scale.css'));
    expect(resourcesIndex).toBeGreaterThan(-1);
    expect(toggleIndex).toBeGreaterThan(-1);
    expect(commonScaleIndex).toBeGreaterThan(-1);
    expect(resourcesIndex).toBeLessThan(toggleIndex);
    expect(toggleIndex).toBeLessThan(commonScaleIndex);
  });

  test('TC-10-B: Design Tokens and Theme Switcher parity between Dark and Light mode', async ({ page }) => {
    await page.goto(harness.url);
    await page.waitForSelector('.shell');

    // Test Dark mode tokens
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
    });
    const darkBg = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    });
    expect(darkBg.toUpperCase()).toBe('#0A0514');

    const darkSurface = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--surface').trim();
    });
    expect(darkSurface.toUpperCase()).toBe('#120A24');

    // Test Light mode tokens
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'light');
    });
    const lightBg = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    });
    expect(lightBg.toUpperCase()).toBe('#F5F3FA');

    const lightSurface = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--surface').trim();
    });
    expect(lightSurface.toUpperCase()).toBe('#FFFFFF');
  });

  test('TC-10-C: Responsive layout integrity across 1920x1080, 1440x900, 1280x800, and 390x844', async ({ page }) => {
    const viewports = [
      { width: 1920, height: 1080 },
      { width: 1440, height: 900 },
      { width: 1280, height: 800 },
      { width: 390, height: 844 },
    ];

    for (const vp of viewports) {
      await page.setViewportSize(vp);
      await page.goto(harness.url);
      await page.waitForSelector('.shell');

      const shell = page.locator('.shell');
      await expect(shell).toBeVisible();

      const topbar = page.locator('.topbar');
      await expect(topbar).toBeVisible();

      const box = await topbar.boundingBox();
      expect(box).not.toBeNull();
      expect(box.width).toBeLessThanOrEqual(vp.width);
      expect(box.height).toBeGreaterThan(40);
    }
  });
});
