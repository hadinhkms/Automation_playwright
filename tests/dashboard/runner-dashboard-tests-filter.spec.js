/**
 * tests/dashboard/runner-dashboard-tests-filter.spec.js
 * L2 (after the Script Picker): tests/dashboard/* stay out of the "Theo Test Suite" previews (with a hidden
 * count); the suite data and the run payload keep them. The picker's own exclusion is in script-picker.spec.js.
 */
const { test, expect } = require('@playwright/test');
const { startDashboardHarness } = require('./support/dashboardHarness');
const { createRunnerFixture } = require('./support/runnerFixture');

const INTERNAL = 'tests/dashboard/internal.spec.js';

test.describe('Suite previews hide Dashboard-internal tests (L2)', () => {
  let fixture; let harness;
  test.beforeAll(async () => { fixture = createRunnerFixture(); harness = await startDashboardHarness(fixture.rootPath); });
  test.afterAll(async () => { if (harness) await harness.stop(); if (fixture) fixture.cleanup(); });

  test('a saved suite keeps its Dashboard file path in the run payload (data untouched, listed as hidden)', async ({ page }) => {
    const suites = { mixed: { label: 'Mixed', type: 'single', platform: 'desktop', project: 'all', specs: ['tests/e2e/desktop/alpha.spec.js', INTERNAL], spec: 'custom', grep: '', workers: 1, viewport: { preset: 'default', width: 1920, height: 1080 } } };
    const put = await fetch(`${harness.url}/api/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ suites }) });
    expect(put.status).toBe(200);
    let body = null;
    await page.route('**/api/run', (route) => { body = route.request().postDataJSON(); return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'x', status: 'running', command: [], logs: [] }) }); });
    await page.goto(harness.url);
    await page.waitForSelector('.runner-mode-tab[data-mode="suite"]');
    await page.click('.runner-mode-tab[data-mode="suite"]');
    await page.selectOption('#runner-suite-select', 'mixed');
    await expect(page.locator('#suite-sum-files-list .suite-summary-pill')).toHaveCount(1);
    await expect(page.locator('#suite-sum-count')).toContainText('đang ẩn');
    await page.click('#run-button');
    await expect.poll(() => body).not.toBeNull();
    expect(body.specs).toContain(INTERNAL);
    expect(body.specs).toContain('tests/e2e/desktop/alpha.spec.js');
    const saved = (await (await fetch(`${harness.url}/api/settings`)).json()).suites.mixed;
    expect(saved.specs).toContain(INTERNAL);
  });
});
