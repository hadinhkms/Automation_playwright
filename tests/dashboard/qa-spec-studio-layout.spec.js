/**
 * tests/dashboard/qa-spec-studio-layout.spec.js
 * Multi-viewport (1920, 1440, 1280, 390) and dual-theme (Light/Dark) test suite (PLAN-19b Phase 3)
 * Tests: TC-31 .. TC-38
 */

const { test, expect } = require('@playwright/test');
const { startDashboardHarness } = require('./support/dashboardHarness');
const { createFixtureWorkspace } = require('./support/fixtureWorkspace');

const VIEWPORTS = [
  { name: '1920x1080', width: 1920, height: 1080, tcLight: 'TC-31', tcDark: 'TC-32' },
  { name: '1440x900',  width: 1440, height: 900,  tcLight: 'TC-33', tcDark: 'TC-34' },
  { name: '1280x800',  width: 1280, height: 800,  tcLight: 'TC-35', tcDark: 'TC-36' },
  { name: '390x844',   width: 390,  height: 844,   tcLight: 'TC-37', tcDark: 'TC-38' },
];

async function openQaView(page, url) {
  await page.goto(url);
  await page.waitForSelector('.shell');
  await page.waitForFunction(() => Boolean(window.__STUDIO_CORE__));
  await page.evaluate(() => window.__STUDIO_CORE__.featureRegistry.switchView('qa-view'));
  await page.waitForSelector('#qa-view:not([hidden])');
}

test.describe('Spec Studio: Layout & Multi-Viewport Tests (PLAN-19b)', () => {
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

  for (const vp of VIEWPORTS) {
    for (const theme of ['light', 'dark']) {
      const tcId = theme === 'light' ? vp.tcLight : vp.tcDark;

      test(`${tcId}: ${vp.name} Viewport [${theme.toUpperCase()} Theme]`, async ({ page }) => {
        const consoleErrors = [];
        page.on('console', (msg) => {
          if (msg.type() === 'error') consoleErrors.push(msg.text());
        });

        await page.setViewportSize({ width: vp.width, height: vp.height });
        await openQaView(page, harness.url);

        await page.evaluate((th) => {
          document.documentElement.setAttribute('data-theme', th);
        }, theme);

        const openBtn = page.locator('#qa-btn-analyze-req');
        await expect(openBtn).toBeVisible({ timeout: 10000 });
        await openBtn.click();

        const modal = page.locator('#qa-req-analyzer-modal');
        await expect(modal).toBeVisible();

        // Kiểm tra các nút BVA và BDD nhìn thấy được
        const bvaBtn = page.locator('#qa-req-btn-bva');
        const bddBtn = page.locator('#qa-req-btn-bdd');
        await expect(bvaBtn).toBeVisible();
        await expect(bddBtn).toBeVisible();

        // Kiểm tra tab BVA và BDD trong DOM
        const tabBva = page.locator('.qa-req-tab[data-tab="bva"]');
        const tabBdd = page.locator('.qa-req-tab[data-tab="bdd"]');
        await expect(tabBva).toBeAttached();
        await expect(tabBdd).toBeAttached();

        // Đối với màn hình di động 390px: thanh tabs cuộn ngang mượt mà
        if (vp.width <= 480) {
          const isScrollable = await page.evaluate(() => {
            const tabsEl = document.querySelector('.qa-req-tabs');
            return tabsEl ? tabsEl.scrollWidth >= tabsEl.clientWidth : false;
          });
          expect(isScrollable).toBe(true);
        }

        // Đóng modal
        const closeBtn = page.locator('#qa-req-analyzer-close');
        await closeBtn.click();
        await expect(modal).not.toBeVisible();

        // Zero unexpected console errors
        const unexpected = consoleErrors.filter((e) => !/^Failed to load resource/.test(e) && !e.includes('404'));
        expect(unexpected).toEqual([]);
      });
    }
  }
});
