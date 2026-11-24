/**
 * tests/dashboard/runner-mobile-layout.spec.js
 * L3: the Runner view must not overflow horizontally at 390px, and its tabs/panels stay usable.
 */
const { test, expect } = require('@playwright/test');
const { startDashboardHarness } = require('./support/dashboardHarness');
const { createRunnerFixture } = require('./support/runnerFixture');

test.describe('Runner view at 390px (L3)', () => {
  let fixture; let harness;
  test.beforeAll(async () => { fixture = createRunnerFixture(); harness = await startDashboardHarness(fixture.rootPath); });
  test.afterAll(async () => { if (harness) await harness.stop(); if (fixture) fixture.cleanup(); });

  const overflow = (page) => page.evaluate(() => ({
    doc: document.documentElement.scrollWidth - window.innerWidth,
    body: document.body.scrollWidth - window.innerWidth,
    wide: Array.from(document.querySelectorAll('#runner-view *')).filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.right > window.innerWidth + 1 && getComputedStyle(el).position !== 'fixed';
    }).slice(0, 8).map((el) => `${el.tagName.toLowerCase()}#${el.id}.${String(el.className).split(' ')[0]} right=${Math.round(el.getBoundingClientRect().right)}`),
  }));

  for (const mode of ['suite', 'manual']) {
    test(`no horizontal overflow in "${mode}" mode`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(harness.url);
      await page.waitForSelector('.runner-mode-tab[data-mode="manual"]');
      await page.click(`.runner-mode-tab[data-mode="${mode}"]`);
      await page.waitForTimeout(300);
      if (mode === 'manual') {
        for (const scope of ['file', 'grep', 'all']) {
          await page.click(`.runner-scope-tab-btn[data-manual-scope="${scope}"]`);
          const so = await overflow(page);
          expect(so.wide, `${scope}: ${JSON.stringify(so)}`).toEqual([]);
        }
      }
      const o = await overflow(page);
      expect(o.wide, JSON.stringify(o)).toEqual([]);
      expect(o.doc).toBeLessThanOrEqual(0);
      await expect(page.locator('#run-button')).toBeVisible();
      const box = await page.locator('#run-button').boundingBox();
      expect(box.x + box.width).toBeLessThanOrEqual(391);
    });
  }
});
