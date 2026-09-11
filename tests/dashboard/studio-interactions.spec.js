/**
 * tests/dashboard/studio-interactions.spec.js
 * Verification test suite for Studio UI Interactions (Limit <= 250 lines)
 */
const { test, expect } = require('@playwright/test');
const { startDashboardHarness } = require('./support/dashboardHarness');
const { createFixtureWorkspace } = require('./support/fixtureWorkspace');

test.describe('Dashboard Studio UI Interactions Verification', () => {
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

  test('TC-10: Discord Guide step tabs navigate on direct click in settings view', async ({ page }) => {
    await page.goto(harness.url);
    await page.waitForFunction(() => Boolean(window.__STUDIO_CORE__));

    // Switch to settings view and discord subtab
    await page.click('.view-tab[data-view="settings-view"]');
    await page.waitForSelector('#settings-view:not([hidden])');
    await page.click('.settings-subtab[data-subtab="discord"]');
    await page.waitForSelector('.settings-discord:not([hidden])');

    // Click step 2 tab directly
    await page.click('.guide-nav-btn[data-guide-step="2"]');
    expect(await page.$eval('.guide-nav-btn[data-guide-step="2"]', (el) => el.classList.contains('active'))).toBe(true);
    expect(await page.$eval('#guide-pane-2', (el) => el.classList.contains('active'))).toBe(true);
    expect(await page.$eval('#guide-current-step-num', (el) => el.textContent)).toBe('2');

    // Click step 4 tab directly
    await page.click('.guide-nav-btn[data-guide-step="4"]');
    expect(await page.$eval('.guide-nav-btn[data-guide-step="4"]', (el) => el.classList.contains('active'))).toBe(true);
    expect(await page.$eval('#guide-pane-4', (el) => el.classList.contains('active'))).toBe(true);
    expect(await page.$eval('#guide-current-step-num', (el) => el.textContent)).toBe('4');
  });

  test('TC-11: Recorder Studio formats timestamp as YYYY-MM-DD HH:MM:SS and rec-clear-all-btn clears recordings cleanly', async ({ page }) => {
    await page.goto(harness.url);
    await page.waitForFunction(() => Boolean(window.__STUDIO_CORE__));

    // Switch to recorder-view via featureRegistry
    await page.evaluate(async () => {
      await window.__STUDIO_CORE__.featureRegistry.switchView('recorder-view');
    });
    await page.waitForSelector('#recorder-view:not([hidden])');

    // Test date formatting helper directly
    const formatted = await page.evaluate(() => {
      return window.formatRecordingDate('2026-09-11T05:33:43.000Z');
    });
    expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);

    // Mock window.confirm to return true for clear all
    await page.evaluate(() => {
      window.confirm = () => true;
    });

    // Populate mock recent recordings list
    await page.evaluate(() => {
      window.onRecorderStatusUpdate({
        isRecording: false,
        recentRecordings: [
          { fileName: 'rec_test_1.js', modifiedAt: '2026-09-11T05:33:43.000Z' }
        ]
      });
    });

    const renderedTime = await page.$eval('.rec-time', (el) => el.textContent.trim());
    expect(renderedTime).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);

    // Click #rec-clear-all-btn
    await page.click('#rec-clear-all-btn');

    // Verify empty state is rendered
    await page.waitForSelector('.rec-empty-hint');
    const emptyHint = await page.$eval('.rec-empty-hint', (el) => el.textContent);
    expect(emptyHint).toContain('Chưa có bản ghi nào');
  });

  test('TC-12: Suites view selects suites via sidebar list and dropdown picker, updating editor and preview', async ({ page }) => {
    await page.goto(harness.url);
    await page.waitForFunction(() => Boolean(window.__STUDIO_CORE__));

    await page.evaluate(async () => {
      await window.__STUDIO_CORE__.featureRegistry.switchView('suites-view');
    });
    await page.waitForSelector('#suites-sidebar-list .suite-nav-item');

    // Initial suite is loaded
    const initialKey = await page.$eval('#suite-field-key', (el) => el.value);
    expect(initialKey).toBeTruthy();

    // Select second suite if available via sidebar click
    const secondItem = await page.$('#suites-sidebar-list .suite-nav-item:nth-child(2)');
    if (secondItem) {
      const secondId = await secondItem.getAttribute('data-suite-id');
      await secondItem.click();
      await page.waitForTimeout(200);

      const activeKey = await page.$eval('#suite-field-key', (el) => el.value);
      const activeTitle = await page.$eval('#suite-active-title', (el) => el.textContent);
      expect(activeKey).toBe(secondId);
      expect(activeTitle).toBeTruthy();

      // Test dropdown picker change back to first
      await page.selectOption('#suite-picker-select', initialKey);
      await page.waitForTimeout(200);

      const revertedKey = await page.$eval('#suite-field-key', (el) => el.value);
      expect(revertedKey).toBe(initialKey);
    }
  });

  test('TC-13: Create suite flow does not trigger browser prompt dialog, creates inline suite, and toggling Suite Cha dynamically renders child suites checklist', async ({ page }) => {
    let dialogAppeared = false;
    page.on('dialog', async (dialog) => {
      dialogAppeared = true;
      await dialog.dismiss();
    });

    await page.goto(harness.url);
    await page.waitForFunction(() => Boolean(window.__STUDIO_CORE__));

    await page.evaluate(async () => {
      await window.__STUDIO_CORE__.featureRegistry.switchView('suites-view');
    });
    await page.waitForSelector('#suites-sidebar-list .suite-nav-item');

    // Click "Tạo Suite mới" button
    await page.click('#suites-subnav-create');
    await page.waitForTimeout(150);

    // Verify no prompt popup was shown
    expect(dialogAppeared).toBe(false);

    // Verify new suite form is loaded inline with default label
    const activeLabel = await page.$eval('#suite-field-label', (el) => el.value);
    expect(activeLabel).toBe('Kịch bản mới');

    const initialTypeBadge = await page.$eval('#suite-type-badge', (el) => el.textContent);
    expect(initialTypeBadge).toContain('Suite Con (Đơn lẻ)');

    // Toggle to Suite Cha (composite)
    await page.click('#suite-kind-pill-composite');
    await page.waitForTimeout(200);

    // Verify type badge updated
    const compositeTypeBadge = await page.$eval('#suite-type-badge', (el) => el.textContent);
    expect(compositeTypeBadge).toContain('Suite Cha (Tổng hợp)');

    // Verify composite section is displayed
    const compositeSectionDisplay = await page.$eval('#suite-composite-section', (el) => getComputedStyle(el).display);
    expect(compositeSectionDisplay).toBe('block');

    // Verify child suites checklist is populated with cards
    const childCards = await page.$$('#suite-composite-children-list .suite-child-card-label');
    expect(childCards.length).toBeGreaterThan(0);

    // Select the first child suite checkbox
    const firstCheckbox = await page.$('#suite-composite-children-list .suite-child-cb');
    expect(firstCheckbox).not.toBeNull();
    await firstCheckbox.check();
    await page.waitForTimeout(100);

    const isCardSelected = await page.$eval('#suite-composite-children-list .suite-child-card-label:first-child', (el) => el.classList.contains('selected'));
    expect(isCardSelected).toBe(true);
  });
});
