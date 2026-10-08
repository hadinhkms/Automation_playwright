/**
 * tests/dashboard/data-vn-generator-layout.spec.js
 * Layout, viewport, a11y, and theme tests for VN Data Generator Modal (PLAN-19a Phase 3)
 * Tests: TC-32 .. TC-39
 */

const { test, expect } = require('@playwright/test');
const { startDashboardHarness } = require('./support/dashboardHarness');
const { createFixtureWorkspace } = require('./support/fixtureWorkspace');

const VIEWPORTS = [
  { name: '1920x1080', width: 1920, height: 1080, tcLight: 'TC-32', tcDark: 'TC-33' },
  { name: '1440x900',  width: 1440, height: 900,  tcLight: 'TC-34', tcDark: 'TC-35' },
  { name: '1280x800',  width: 1280, height: 800,  tcLight: 'TC-36', tcDark: 'TC-37' },
  { name: '390x844',   width: 390,  height: 844,   tcLight: 'TC-38', tcDark: 'TC-39' },
];

async function openDataView(page, url) {
  await page.goto(url);
  await page.waitForSelector('.shell');
  await page.waitForFunction(() => Boolean(window.__STUDIO_CORE__));
  await page.evaluate(() => window.__STUDIO_CORE__.featureRegistry.switchView('data-view'));
  await page.waitForSelector('#data-view:not([hidden])');
}

test.describe('Test Data Studio: Layout & Viewport Tests (PLAN-19a)', () => {
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
        await openDataView(page, harness.url);

        // Áp dụng theme nếu cần
        await page.evaluate((th) => {
          document.documentElement.setAttribute('data-theme', th);
        }, theme);

        const openBtn = page.locator('#data-vn-gen-open-btn');
        await expect(openBtn).toBeVisible({ timeout: 10000 });
        await openBtn.click();

        const modal = page.locator('#data-vn-gen-modal');
        await expect(modal).toBeVisible();

        // Focus đúng tiêu đề khi mở
        const isTitleFocused = await page.evaluate(() => {
          return document.activeElement?.id === 'data-vn-gen-title';
        });
        expect(isTitleFocused).toBe(true);

        // Sinh 5 bản ghi persona để kiểm tra bảng và hiển thị
        await page.locator('#data-vn-count').fill('5');
        await page.locator('#data-vn-generate-btn').click();

        const rows = page.locator('#data-vn-preview .data-vn-table tbody tr');
        await expect(rows).toHaveCount(5);

        // Kiểm tra không tràn ngang giao diện
        const overflow = await page.evaluate(() => {
          return document.documentElement.scrollWidth > window.innerWidth + 5;
        });
        expect(overflow).toBe(false);

        // Kiểm tra không lộ chữ debug / undefined / null / NaN trên UI rendered
        const modalText = await modal.innerText();
        expect(modalText).not.toContain('undefined');
        expect(modalText).not.toContain('null');
        expect(modalText).not.toContain('NaN');
        expect(modalText).not.toContain('TODO');

        // Đóng modal bằng nút Đóng và chọn Bỏ
        await page.locator('#data-vn-close-btn').click();
        const confirm = page.locator('#data-vn-confirm');
        await expect(confirm).toBeVisible();
        await page.locator('#data-vn-confirm-leave-btn').click();
        await expect(modal).not.toBeVisible();

        // Zero unexpected console errors
        const unexpected = consoleErrors.filter((e) => !/^Failed to load resource/.test(e) && !e.includes('404'));
        expect(unexpected).toEqual([]);
      });
    }
  }
});
