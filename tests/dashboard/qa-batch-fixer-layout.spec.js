/**
 * tests/dashboard/qa-batch-fixer-layout.spec.js
 * PLAN-18: vòng đời của batch fixer (OWN-01..05, rời view khi đang chờ) và bố cục toolbar +
 * modal ở 4 viewport × 2 theme (không tràn ngang, không lộ chữ debug). Đặt BATCH_FIXER_SHOTS=<thư mục>
 * để lưu ảnh chụp soát bằng mắt.
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const { startDashboardHarness } = require('./support/dashboardHarness');
const { createFixtureWorkspace } = require('./support/fixtureWorkspace');
const { LOGIN, prepareFixture, openFindings, waitScanDone, rowAt, watchErrors } = require('./support/batchE2e');

const SHOTS = process.env.BATCH_FIXER_SHOTS || '';

async function layoutOf(page, selector) {
  return page.evaluate((sel) => {
    const root = document.querySelector(sel);
    const bad = [...root.querySelectorAll('*')].filter((el) => {
      if (el.closest('.qa-diff')) return false; // khối mã được phép cuộn ngang
      return el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX === 'visible' && el.clientWidth > 0;
    }).map((el) => el.className || el.tagName);
    return {
      bad,
      doc: document.documentElement.scrollWidth - window.innerWidth,
      text: root.innerText,
    };
  }, selector);
}

test.describe('QA: batch fixer — vòng đời và bố cục (PLAN-18)', () => {
  test.describe.configure({ timeout: 90_000 });
  let fixture;
  let harness;
  let errors;

  test.beforeAll(async () => {
    fixture = createFixtureWorkspace();
    harness = await startDashboardHarness(fixture.rootPath);
  });

  test.afterAll(async () => {
    if (harness) await harness.stop();
    if (fixture) fixture.cleanup();
  });

  test.beforeEach(async ({ page }) => {
    await prepareFixture(fixture.rootPath, harness.url);
    errors = watchErrors(page);
  });

  test.afterEach(async () => {
    expect(errors(), errors().join('\n')).toEqual([]);
  });

  test('SelectionModel: tri-state theo mục hiển thị, không đụng mục ẩn, prune key cũ', async ({ page }) => {
    await page.goto(harness.url);
    const out = await page.evaluate(async () => {
      const { SelectionModel } = await import('/js/views/qa/batch/selectionModel.js');
      const s = new SelectionModel();
      const states = [s.visibleState(['a', 'b'])];
      s.toggle('a');
      states.push(s.visibleState(['a', 'b']));
      s.toggleVisible(['a', 'b']);
      states.push(s.visibleState(['a', 'b']));
      s.addKeys(['z']);
      const hidden = s.hiddenCount(['a', 'b']);
      s.toggleVisible(['a', 'b']);
      const afterClear = s.keys();
      const pruned = s.prune([]);
      return { states, hidden, afterClear, pruned, size: s.size };
    });
    expect(out).toEqual({ states: ['none', 'some', 'all'], hidden: 1, afterClear: ['z'], pruned: 1, size: 0 });
  });

  test('rời view khi đang lập kế hoạch: phản hồi đến muộn không mở modal (BATCH-37, OWN-05)', async ({ page }) => {
    await openFindings(page, harness.url);
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    await page.route('**/api/qa/finding/batch-plan', async (route) => {
      await gate;
      await route.continue();
    });
    await rowAt(page, `${LOGIN}:6`).getByRole('button', { name: 'Sửa lỗi' }).click();
    await page.evaluate(() => window.__STUDIO_CORE__.featureRegistry.switchView('runner-view'));
    const response = page.waitForResponse('**/api/qa/finding/batch-plan');
    release();
    await response;
    await page.evaluate(() => new Promise((resolve) => { setTimeout(resolve, 300); }));
    expect(await page.evaluate(() => document.getElementById('qa-batch-modal').open)).toBe(false);
  });

  test('20 vòng vào/ra view QA không nhân listener; destroy hai lần an toàn (BATCH-38, OWN-01..04)', async ({ page }) => {
    await openFindings(page, harness.url);
    const count = () => page.evaluate(async () => (await import('/js/views/qa/qaSlice.js')).qaSlice.batch.listenerCount);
    const baseline = await count();
    expect(baseline).toBeGreaterThan(0);
    for (let i = 0; i < 20; i += 1) {
      await page.evaluate(async () => {
        const { featureRegistry } = window.__STUDIO_CORE__;
        await featureRegistry.switchView('runner-view');
        await featureRegistry.switchView('qa-view');
      });
    }
    await waitScanDone(page);
    expect(await count()).toBe(baseline);

    const res = await page.evaluate(async () => {
      const { qaSlice } = await import('/js/views/qa/qaSlice.js');
      const { batch } = qaSlice;
      batch.destroy();
      batch.destroy();
      const afterDestroy = batch.listenerCount;
      const root = document.getElementById('qa-view');
      batch.init(root);
      batch.init(root);
      return { afterDestroy, afterInit: batch.listenerCount };
    });
    expect(res).toEqual({ afterDestroy: 0, afterInit: baseline });
  });

  for (const theme of ['dark', 'light']) {
    for (const [w, h] of [[1920, 1080], [1440, 900], [1280, 800], [390, 844]]) {
      test(`bố cục ${w}x${h} ${theme}: toolbar và modal không tràn ngang, không lộ chữ debug (BATCH-39)`, async ({ page }) => {
        await page.setViewportSize({ width: w, height: h });
        await openFindings(page, harness.url, theme);
        await page.locator('#qa-batch-master').check();

        const card = await layoutOf(page, '#qa-static-gaps-card');
        expect(card.doc).toBeLessThanOrEqual(1);
        expect(card.bad, card.bad.join(', ')).toEqual([]);
        expect(card.text).not.toMatch(/\bundefined\b|\bnull\b|TODO|\[object /);
        if (SHOTS) await page.locator('#qa-static-gaps-card').screenshot({ path: path.join(SHOTS, `card-${w}-${theme}.png`) });

        await page.locator('#qa-batch-preview').click();
        await expect(page.locator('#qa-batch-modal')).toBeVisible();
        await expect(page.locator('#qa-batch-modal-title')).toBeFocused();
        const modal = await layoutOf(page, '#qa-batch-modal');
        expect(modal.bad, modal.bad.join(', ')).toEqual([]);
        expect(modal.text).not.toMatch(/\bundefined\b|\bnull\b|TODO|\[object /);
        if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `modal-${w}-${theme}.png`) });
      });
    }
  }
});
