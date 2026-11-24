/**
 * tests/dashboard/script-picker-layout.spec.js
 * Script Picker at 390 / 768 / 1440 px in light and dark: no horizontal overflow (page and body), run button
 * reachable, very long file names stay inside the frame. Optional screenshots: PICKER_SHOTS=<dir>.
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const { startDashboardHarness } = require('./support/dashboardHarness');
const { createPickerFixture, historyRun } = require('./support/pickerFixture');

const LONG = `tests/e2e/desktop/${'very-long-script-name-'.repeat(5)}end.spec.js`;
const SIZES = [[390, 844], [768, 1024], [1440, 900]];

test.describe('Script Picker layout', () => {
  let fixture; let harness;
  test.beforeAll(async () => { const failed = { file: LONG, status: 'failed', passed: 0, failed: 1, flaky: 0, skipped: 0, durationMs: 5 };
    fixture = createPickerFixture({ files: { [LONG]: "const { test } = require('@playwright/test');\ntest('long @e2e', async () => {});\n" }, history: [historyRun({ id: 'l1', status: 'failed', specs: [LONG], projects: ['Desktop Regression Tests'], files: [failed] })] }); harness = await startDashboardHarness(fixture.rootPath); });
  test.afterAll(async () => { if (harness) await harness.stop(); if (fixture) fixture.cleanup(); });

  for (const [width, height] of SIZES) {
    for (const theme of ['light', 'dark']) {
      test(`${width}px ${theme}: no overflow, run button reachable, long name contained`, async ({ page }) => {
        await page.setViewportSize({ width, height });
        await page.addInitScript((t) => { try { localStorage.setItem('theme', t); localStorage.setItem('qa-theme', t); } catch (_) {} document.documentElement.setAttribute('data-theme', t); }, theme);
        await page.goto(harness.url);
        await page.waitForSelector('.sp-file');
        await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
        if (!(await page.locator('#sp-filters').evaluate((d) => d.open))) await page.click('#sp-filters summary'); // phones collapse the filters
        await page.click('.sp-chip[data-tag="@smoke"]');
        await page.click('[data-act="select-found"]');
        await page.click('.sp-chip[data-tag="@smoke"]'); // off: whole list incl. the long name is visible
        await page.waitForTimeout(250);
        const o = await page.evaluate(() => ({
          doc: document.documentElement.scrollWidth - innerWidth, body: document.body.scrollWidth - innerWidth,
          tree: (() => { const t = document.querySelector('#sp-body'); return { sw: t.scrollWidth - t.clientWidth, nested: t.scrollHeight > t.clientHeight + 1 && getComputedStyle(t).overflowY !== 'visible' }; })(),
          wide: Array.from(document.querySelectorAll('#script-picker *')).filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > innerWidth + 1; }).slice(0, 5).map((e) => `${e.tagName}.${e.className}`),
        }));
        expect(o.doc, JSON.stringify(o)).toBeLessThanOrEqual(0);
        expect(o.body, JSON.stringify(o)).toBeLessThanOrEqual(0);
        expect(o.wide).toEqual([]);
        expect(o.tree.sw, 'tree scrolls sideways').toBeLessThanOrEqual(0);
        if (width < 768) expect(o.tree.nested, 'no nested scroll on phones').toBe(false);
        await page.locator('#sp-run').scrollIntoViewIfNeeded();
        const box = await page.locator('#sp-run').boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
        expect(box.height).toBeGreaterThanOrEqual(40);
        const ratio = await page.locator('#sp-run').evaluate((el) => {
          const lum = (c) => { const [r, g, b] = c.match(/[\d.]+/g).slice(0, 3).map((v) => { const x = Number(v) / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
          const cs = getComputedStyle(el); const [a, b] = [lum(cs.color), lum(cs.backgroundColor)].sort((x, y) => y - x);
          return (a + 0.05) / (b + 0.05);
        });
        expect(ratio, `run button text contrast in ${theme}`).toBeGreaterThanOrEqual(4.5);
        if (process.env.PICKER_SHOTS) {
          fs.mkdirSync(process.env.PICKER_SHOTS, { recursive: true });
          await page.screenshot({ path: `${process.env.PICKER_SHOTS}/picker-${width}-${theme}.png`, fullPage: false });
        }
      });
    }
  }
});
