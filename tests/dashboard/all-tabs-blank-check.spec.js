// @ts-check
const { test, expect } = require('@playwright/test');
const { startDashboardHarness } = require('./support/dashboardHarness');
const { createFixtureWorkspace } = require('./support/fixtureWorkspace');

const TABS = [
  { id: 'runner-view', name: 'Chạy test', isDropdown: false, keySelector: '#run-form' },
  { id: 'agent-view', name: 'AI Agent', isDropdown: false, keySelector: '#agent-form' },
  { id: 'builder-view', name: 'Kịch bản BDD', isDropdown: false, keySelector: '.builder-hero, .script-workspace-panel' },
  { id: 'page-manager-view', name: 'Quản lý Page', isDropdown: false, keySelector: '.page-manager-hero, #page-manager-workspace' },
  { id: 'resources-view', name: 'Báo cáo', isDropdown: false, keySelector: '#resource-list' },
  { id: 'docs-view', name: 'Hướng dẫn', isDropdown: false, keySelector: '.docs-hero, #docs-subpanel-prompts' },
  { id: 'suites-view', name: 'Kịch bản Test Suite', isDropdown: true, keySelector: '.suites-workspace, #suites-sidebar-list' },
  { id: 'recorder-view', name: 'Ghi kịch bản UI', isDropdown: true, keySelector: '#rec-form-panel, #rec-url' },
  { id: 'data-view', name: 'Dữ liệu test', isDropdown: true, keySelector: '#data-workspace-panel' },
  { id: 'fixtures-view', name: 'Hạ tầng & Fixtures', isDropdown: true, keySelector: '.fixtures-studio-workspace, #fixtures-list-container' },
  { id: 'compare-view', name: 'So sánh evidence', isDropdown: true, keySelector: '.compare-panel, iframe' },
  { id: 'qa-view', name: 'QA Docs & Automation', isDropdown: true, keySelector: '.qa-hero' },
  { id: 'git-view', name: 'Đồng bộ Git', isDropdown: false, isHeaderAction: true, selector: '#topbar-git-btn', keySelector: '.git-workspace' },
  { id: 'settings-view', name: 'Cấu hình hệ thống', isDropdown: false, isHeaderAction: true, selector: '#settings-tab', keySelector: '.settings-hero, #settings-form' },
];

test.describe('Dashboard Tabs Content & Blank Page Verification', () => {
  let fixture = null;
  let harness = null;
  let targetUrl = process.env.DASHBOARD_URL || '';

  test.beforeAll(async () => {
    if (!targetUrl) {
      fixture = createFixtureWorkspace();
      harness = await startDashboardHarness(fixture.rootPath);
      targetUrl = harness.url;
    }
  });

  test.afterAll(async () => {
    if (harness) await harness.stop();
    if (fixture) fixture.cleanup();
  });

  test('Verify all 14 tabs load content and are not blank', async ({ page }) => {
    const pageErrors = [];
    const consoleErrors = [];

    page.on('pageerror', (err) => {
      pageErrors.push(err.message || String(err));
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('favicon') && !text.includes('404')) {
          consoleErrors.push(text);
        }
      }
    });

    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.shell');
    await page.waitForFunction(() => Boolean(window.__STUDIO_CORE__));

    // Verify initial runner-view
    const runnerView = page.locator('#runner-view');
    await expect(runnerView).toBeVisible();
    await expect(runnerView).toHaveClass(/active/);

    const results = [];

    for (const tab of TABS) {
      if (tab.isHeaderAction && tab.selector) {
        await page.click(tab.selector);
      } else if (tab.isDropdown) {
        const dropdownMenu = page.locator('#nav-tools-menu');
        const isMenuVisible = await dropdownMenu.isVisible().catch(() => false);
        if (!isMenuVisible) {
          await page.click('#nav-tools-btn');
          await page.waitForTimeout(200);
        }
        await page.click(`.nav-dropdown-item[data-view="${tab.id}"]`);
      } else {
        await page.click(`.view-tab[data-view="${tab.id}"]`);
      }

      await page.waitForTimeout(400);

      const viewLocator = page.locator(`#${tab.id}`);
      await expect(viewLocator).toBeVisible({ timeout: 5000 });
      await expect(viewLocator).toHaveClass(/active/);

      const viewInfo = await page.evaluate((viewId) => {
        const el = document.getElementById(viewId);
        if (!el) return { exists: false };
        const text = el.innerText.trim();
        const children = el.childElementCount;
        const rect = el.getBoundingClientRect();
        return {
          exists: true,
          children,
          textLength: text.length,
          snippet: text.slice(0, 100).replace(/\s+/g, ' '),
          width: rect.width,
          height: rect.height,
        };
      }, tab.id);

      expect(viewInfo.exists).toBe(true);
      expect(viewInfo.children).toBeGreaterThan(0);
      expect(viewInfo.height).toBeGreaterThan(50);
      expect(viewInfo.width).toBeGreaterThan(200);

      const hasContent = viewInfo.textLength > 0 || tab.id === 'compare-view';
      expect(hasContent).toBe(true);

      const keyEl = page.locator(tab.keySelector).first();
      await expect(keyEl).toBeAttached();

      results.push({
        id: tab.id,
        name: tab.name,
        children: viewInfo.children,
        textLength: viewInfo.textLength,
        sample: viewInfo.snippet,
        status: 'OK',
      });
    }

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('TC-02: Rapid multi-roundtrip switching across all 14 views does not cause blank panels or console errors', async ({ page }) => {
    const pageErrors = [];
    const consoleErrors = [];

    page.on('pageerror', (err) => pageErrors.push(err.message || String(err)));
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('favicon') && !text.includes('404')) {
          consoleErrors.push(text);
        }
      }
    });

    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__STUDIO_CORE__));

    const viewIds = TABS.map((t) => t.id);
    for (let cycle = 0; cycle < 2; cycle++) {
      for (const viewId of viewIds) {
        await page.evaluate(async (vId) => {
          await window.__STUDIO_CORE__.featureRegistry.switchView(vId);
        }, viewId);

        const check = await page.evaluate((vId) => {
          const el = document.getElementById(vId);
          if (!el) return { found: false };
          return {
            found: true,
            hasActive: el.classList.contains('active'),
            notHidden: !el.hidden && !el.hasAttribute('hidden'),
            childCount: el.childElementCount,
          };
        }, viewId);

        expect(check.found).toBe(true);
        expect(check.hasActive).toBe(true);
        expect(check.notHidden).toBe(true);
        expect(check.childCount).toBeGreaterThan(0);
      }
    }

    await page.evaluate(async () => {
      await window.__STUDIO_CORE__.featureRegistry.switchView('runner-view');
    });
    const runnerEl = page.locator('#runner-view');
    await expect(runnerEl).toBeVisible();
    await expect(runnerEl).toHaveClass(/active/);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});
