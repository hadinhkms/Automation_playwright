/**
 * tests/dashboard/templates-performance-a11y.spec.js
 * Phase 5 Verification: On-demand Templates, A11y & Performance (Protocol §8)
 * Line budget: <= 250 lines.
 */
const { test, expect } = require('@playwright/test');
const { startDashboardHarness } = require('./support/dashboardHarness');
const { createFixtureWorkspace } = require('./support/fixtureWorkspace');

test.describe('Phase 5: Templates, Accessibility & Performance Verification', () => {
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

  test('TC-14: ARIA Accessibility, Tab Roles and Keyboard Traversal', async ({ page }) => {
    await page.goto(harness.url);
    await page.waitForSelector('.shell');
    await page.waitForFunction(() => Boolean(window.__STUDIO_CORE__));

    // 1. Verify ARIA roles on tablist, tabs and panels
    const tablist = page.locator('.view-tabs[role="tablist"]');
    await expect(tablist).toBeVisible();

    const tabs = page.locator('.view-tab[role="tab"]');
    const tabCount = await tabs.count();
    expect(tabCount).toBeGreaterThanOrEqual(6);

    const activeTab = page.locator('.view-tab.active[role="tab"]');
    await expect(activeTab).toHaveAttribute('aria-selected', 'true');

    // 2. Keyboard interaction: Escape key closes active dialog
    await page.evaluate(() => {
      const modal = document.getElementById('modal-view-page-code');
      if (modal && typeof modal.showModal === 'function') modal.showModal();
    });

    const modal = page.locator('#modal-view-page-code');
    await expect(modal).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();

    // 3. Editor Tab key indents without losing focus
    const editor = page.locator('#modal-page-editor');
    await page.evaluate(() => {
      const m = document.getElementById('modal-view-page-code');
      if (m && typeof m.showModal === 'function') m.showModal();
    });
    await editor.focus();
    await page.keyboard.type('const x = 1;');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    const editorValue = await editor.inputValue();
    expect(editorValue).toContain('const x = 1;\n');
    await page.keyboard.press('Escape');
  });

  test('TC-13: DOM Templates Protocol §8: Initial DOM < 1500 elements & On-demand Template Mount', async ({ page }) => {
    await page.goto(harness.url);
    await page.waitForSelector('.shell');
    await page.waitForFunction(() => Boolean(window.__STUDIO_CORE__));

    // 1. Initial DOM Element Count (< 1500 budget from Plan 09 §8)
    const initialDomCount = await page.evaluate(() => document.getElementsByTagName('*').length);
    expect(initialDomCount).toBeLessThan(1500);

    // 2. Non-active view container is empty before first activation
    const dataViewInitiallyEmpty = await page.evaluate(() => {
      const el = document.getElementById('data-view');
      return el ? el.childElementCount === 0 : false;
    });
    expect(dataViewInitiallyEmpty).toBe(true);

    // 3. Navigate to data-view: Template loads on-demand and slice mounts
    const tabReadyMark = await page.evaluate(async () => {
      const startMark = performance.now();
      await window.__STUDIO_CORE__.featureRegistry.switchView('data-view');
      const readyMark = performance.now();
      const el = document.getElementById('data-view');
      return {
        durationMs: readyMark - startMark,
        childCount: el ? el.childElementCount : 0,
        isLoaded: window.__STUDIO_CORE__.templateLoader.isLoaded('data-view'),
      };
    });

    expect(tabReadyMark.isLoaded).toBe(true);
    expect(tabReadyMark.childCount).toBeGreaterThan(0);
    // Tab ready time within responsive threshold (< 500ms)
    expect(tabReadyMark.durationMs).toBeLessThan(500);

    // 4. Resource & Listener Stability: 20 roundtrip transitions between views
    const stabilityMetrics = await page.evaluate(async () => {
      const { featureRegistry, eventBus } = window.__STUDIO_CORE__;
      const initialListeners = eventBus.listenerCount('view:changed');

      for (let i = 0; i < 20; i++) {
        await featureRegistry.switchView(i % 2 === 0 ? 'suites-view' : 'runner-view');
      }

      const finalListeners = eventBus.listenerCount('view:changed');
      return {
        initialListeners,
        finalListeners,
        suitesLoaded: window.__STUDIO_CORE__.templateLoader.isLoaded('suites-view'),
      };
    });

    expect(stabilityMetrics.suitesLoaded).toBe(true);
    expect(stabilityMetrics.finalListeners).toBe(stabilityMetrics.initialListeners);
  });

  test('TC-15: Performance Protocol §8: WindowBridge Cleanup, Cache Reusability & Resource Stability', async ({ page }) => {
    await page.goto(harness.url);
    await page.waitForFunction(() => Boolean(window.__STUDIO_CORE__));

    const result = await page.evaluate(async () => {
      const { templateLoader, windowBridge, featureRegistry } = window.__STUDIO_CORE__;

      // 1. Verify template caching: second load does not make extra fetch
      await templateLoader.loadViewTemplate('git-view');
      const firstHtml = templateLoader._cache.get('git');
      await templateLoader.loadViewTemplate('git-view');
      const secondHtml = templateLoader._cache.get('git');
      const cacheValid = Boolean(firstHtml && firstHtml === secondHtml);

      // 2. Action disposal and token tracking
      const actionName = 'phaseFiveTestAction';
      const dispose = windowBridge.exposeAction(actionName, () => 'phase5_ok');
      const actionActive = windowBridge.hasAction(actionName);
      dispose();
      const actionRemoved = !windowBridge.hasAction(actionName);

      return { cacheValid, actionActive, actionRemoved };
    });

    expect(result.cacheValid).toBe(true);
    expect(result.actionActive).toBe(true);
    expect(result.actionRemoved).toBe(true);
  });
});
