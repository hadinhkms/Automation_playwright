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
      const o = await overflow(page);
      expect(o.wide, JSON.stringify(o)).toEqual([]);
      expect(o.doc).toBeLessThanOrEqual(0);
      expect(o.body, `body.scrollWidth exceeds the viewport by ${o.body}px (top bar buttons?)`).toBeLessThanOrEqual(0);
      const runButton = mode === 'manual' ? '#sp-run' : '#run-button'; // manual mode = Script Picker's own run button
      await expect(page.locator(runButton)).toBeVisible();
      const box = await page.locator(runButton).boundingBox();
      expect(box.x + box.width).toBeLessThanOrEqual(391);
    });
  }
});

test.describe('Header at tablet width and accessible names', () => {
  let fixture; let harness;
  test.beforeAll(async () => { fixture = createRunnerFixture(); harness = await startDashboardHarness(fixture.rootPath); });
  test.afterAll(async () => { if (harness) await harness.stop(); if (fixture) fixture.cleanup(); });

  for (const view of ['runner-view', 'settings-view', 'git-view', 'resources-view', 'fixtures-view']) {
    test(`768px: page is not wider than the viewport in ${view}`, async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 900 });
      await page.goto(`${harness.url}/#/${view}`);
      await page.waitForSelector('.header-actions');
      await page.waitForTimeout(400);
      const o = await page.evaluate(() => ({ body: document.body.scrollWidth - innerWidth, doc: document.documentElement.scrollWidth - innerWidth }));
      expect(o.body, `body.scrollWidth exceeds 768 by ${o.body}px`).toBeLessThanOrEqual(0);
      expect(o.doc).toBeLessThanOrEqual(0);
    });
  }

  test('320px: the Runner page is not wider than the viewport (header included)', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto(harness.url);
    await page.waitForSelector('.header-actions');
    await page.waitForTimeout(400);
    const o = await page.evaluate(() => ({ body: document.body.scrollWidth - innerWidth, doc: document.documentElement.scrollWidth - innerWidth }));
    expect(o.body, `body.scrollWidth exceeds 320 by ${o.body}px`).toBeLessThanOrEqual(0);
    expect(o.doc).toBeLessThanOrEqual(0);
  });

  test('every header button has a meaningful accessible name (gear included)', async ({ page }) => {
    await page.goto(harness.url);
    await page.waitForSelector('#settings-tab');
    await expect(page.getByRole('tab', { name: 'Cấu hình hệ thống' })).toHaveCount(1);
    await expect(page.locator('#settings-tab')).toHaveAttribute('aria-label', 'Cấu hình hệ thống');
    await expect(page.locator('#settings-tab')).toHaveAttribute('title', 'Cấu hình hệ thống');
    const unnamed = await page.locator('.header-actions button, .header-actions a').evaluateAll((els) => els.filter((e) => !(e.getAttribute('aria-label') || e.textContent || '').trim()).map((e) => e.id || e.className));
    expect(unnamed).toEqual([]);
    // WCAG 2.5.3 Label in Name: buttons with visible text ("v1.0.0", "main") keep that text as their name;
    // the explanation is the title (description), not an aria-label that would replace the visible text.
    for (const [id, text, title] of [['#system-update-btn', /^\s*v?\d/, /cập nhật/], ['#topbar-git-btn', /\S/, /Git/]]) {
      await expect(page.locator(id)).not.toHaveAttribute('aria-label', /.*/);
      await expect(page.locator(id)).toHaveAttribute('title', title);
      expect((await page.locator(id).textContent()).trim()).toMatch(text);
    }
  });
});
