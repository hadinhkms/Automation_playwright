// master-process-disable-size-check: QA Docs Subtab Navigation and Dynamic Badge spec
/**
 * tests/dashboard/qa-subtab-navigation.spec.js
 * Kiểm tra thứ tự các subtab trong QA Docs (Vấn đề ở vị trí 2), badge số lượng và chuyển panel.
 */
const { test, expect } = require('@playwright/test');
const { startDashboardHarness } = require('./support/dashboardHarness');
const { createFixtureWorkspace } = require('./support/fixtureWorkspace');

test.describe('QA Docs: Thứ tự subtab và badge trạng thái', () => {
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

  async function openQaView(page) {
    await page.goto(harness.url);
    await page.waitForSelector('.shell');
    await page.waitForFunction(() => Boolean(window.__STUDIO_CORE__));
    await page.evaluate(() => window.__STUDIO_CORE__.featureRegistry.switchView('qa-view'));
    await page.waitForFunction(() => {
      const el = document.getElementById('qa-view');
      return el && !el.hidden && el.childElementCount > 0;
    });
  }

  test('thứ tự các subtab: Vấn đề được đặt ở vị trí thứ 2', async ({ page }) => {
    await openQaView(page);

    const tabs = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('#qa-subnav [data-qa-tab]'));
      return btns.map((btn) => ({
        tab: btn.dataset.qaTab,
        text: btn.textContent.replace(/\s+/g, ' ').trim(),
      }));
    });

    expect(tabs.length).toBeGreaterThanOrEqual(4);
    // Vị trí 1: Tài liệu
    expect(tabs[0].tab).toBe('docs');
    expect(tabs[0].text).toContain('Tài liệu');
    // Vị trí 2: Vấn đề (được ưu tiên ngay sau Tài liệu)
    expect(tabs[1].tab).toBe('findings');
    expect(tabs[1].text).toContain('Vấn đề');
    // Vị trí 3: Ứng viên automation
    expect(tabs[2].tab).toBe('candidates');
    expect(tabs[2].text).toContain('Ứng viên automation');
    // Vị trí 4: Quyết định
    expect(tabs[3].tab).toBe('decisions');
    expect(tabs[3].text).toContain('Quyết định');
  });

  test('badge số lượng xuất hiện trên các tab và tab Vấn đề có badge cảnh báo', async ({ page }) => {
    await openQaView(page);

    const badges = await page.evaluate(() => {
      const findingsBadge = document.querySelector('#qa-tab-badge-findings');
      const candidatesBadge = document.querySelector('#qa-tab-badge-candidates');
      const docsBadge = document.querySelector('#qa-tab-badge-docs');
      return {
        findingsBadge: findingsBadge ? {
          visible: !findingsBadge.hidden && getComputedStyle(findingsBadge).display !== 'none',
          text: findingsBadge.textContent.trim(),
          isDanger: findingsBadge.classList.contains('qa-tab-badge-danger'),
          isSuccess: findingsBadge.classList.contains('qa-tab-badge-success'),
        } : null,
        candidatesBadge: candidatesBadge ? {
          visible: !candidatesBadge.hidden && getComputedStyle(candidatesBadge).display !== 'none',
          text: candidatesBadge.textContent.trim(),
        } : null,
        docsBadge: docsBadge ? {
          visible: !docsBadge.hidden && getComputedStyle(docsBadge).display !== 'none',
          text: docsBadge.textContent.trim(),
        } : null,
      };
    });

    expect(badges.findingsBadge).not.toBeNull();
    expect(badges.findingsBadge.visible).toBe(true);
    expect(badges.candidatesBadge).not.toBeNull();
    expect(badges.candidatesBadge.visible).toBe(true);
  });

  test('chuyển tab hoạt động chính xác giữa Vấn đề, Ứng viên và Tài liệu', async ({ page }) => {
    await openQaView(page);

    // 1. Mặc định là tab docs
    const isDocsActive = await page.evaluate(() => {
      const docsBtn = document.querySelector('[data-qa-tab="docs"]');
      const docsPanel = document.querySelector('#qa-panel-docs');
      return docsBtn.classList.contains('active') && !docsPanel.hidden;
    });
    expect(isDocsActive).toBe(true);

    // 2. Chuyển sang tab Vấn đề (vị trí 2)
    await page.click('[data-qa-tab="findings"]');
    const isFindingsActive = await page.evaluate(() => {
      const findingsBtn = document.querySelector('[data-qa-tab="findings"]');
      const findingsPanel = document.querySelector('#qa-panel-findings');
      const docsPanel = document.querySelector('#qa-panel-docs');
      return findingsBtn.classList.contains('active') && !findingsPanel.hidden && docsPanel.hidden;
    });
    expect(isFindingsActive).toBe(true);

    // 3. Chuyển sang tab Ứng viên automation (vị trí 3)
    await page.click('[data-qa-tab="candidates"]');
    const isCandidatesActive = await page.evaluate(() => {
      const candBtn = document.querySelector('[data-qa-tab="candidates"]');
      const candPanel = document.querySelector('#qa-panel-candidates');
      const findingsPanel = document.querySelector('#qa-panel-findings');
      return candBtn.classList.contains('active') && !candPanel.hidden && findingsPanel.hidden;
    });
    expect(isCandidatesActive).toBe(true);

    // 4. Chuyển quay lại tab Tài liệu
    await page.click('[data-qa-tab="docs"]');
    const isBackDocsActive = await page.evaluate(() => {
      const docsBtn = document.querySelector('[data-qa-tab="docs"]');
      const docsPanel = document.querySelector('#qa-panel-docs');
      const candPanel = document.querySelector('#qa-panel-candidates');
      return docsBtn.classList.contains('active') && !docsPanel.hidden && candPanel.hidden;
    });
    expect(isBackDocsActive).toBe(true);
  });
});
