/**
 * tests/dashboard/runner-dashboard-tests-filter.spec.js
 * L2: tests/dashboard/* are hidden from the Runner's file list, tag chips and previews by default;
 * the "Hiện test của Dashboard" switch shows them again and is remembered. Saved suites are untouched.
 */
const { test, expect } = require('@playwright/test');
const { startDashboardHarness } = require('./support/dashboardHarness');
const { createRunnerFixture } = require('./support/runnerFixture');

const INTERNAL = 'tests/dashboard/internal.spec.js';

test.describe('Runner hides Dashboard-internal tests (L2)', () => {
  let fixture; let harness;
  test.beforeAll(async () => { fixture = createRunnerFixture(); harness = await startDashboardHarness(fixture.rootPath); });
  test.afterAll(async () => { if (harness) await harness.stop(); if (fixture) fixture.cleanup(); });

  const openManual = async (page) => {
    await page.goto(harness.url);
    await page.waitForSelector('.runner-mode-tab[data-mode="manual"]');
    await page.click('.runner-mode-tab[data-mode="manual"]');
  };
  const specOptions = (page) => page.locator('#spec option').evaluateAll((os) => os.map((o) => o.value));

  test('file list and tag chips hide internal tests by default, switch shows them, choice is remembered', async ({ page }) => {
    await openManual(page);
    expect(await specOptions(page)).not.toContain(INTERNAL);
    expect(await specOptions(page)).toContain('tests/e2e/desktop/alpha.spec.js');
    await expect(page.locator('#runner-tag-chips .tag-chip-btn[data-tag="@dashboardonly"]')).toHaveCount(0);
    await expect(page.locator('#runner-tag-chips .tag-chip-btn[data-tag="@smoke"]')).toHaveCount(1);

    await page.check('#runner-show-dashboard-tests');
    expect(await specOptions(page)).toContain(INTERNAL);
    await expect(page.locator('#runner-tag-chips .tag-chip-btn[data-tag="@dashboardonly"]')).toHaveCount(1);

    await page.reload();
    await page.waitForSelector('.runner-mode-tab[data-mode="manual"]');
    await expect(page.locator('#runner-show-dashboard-tests')).toBeChecked();
    expect(await specOptions(page)).toContain(INTERNAL);
  });

  test('tag preview excludes internal files by default and counts only visible ones', async ({ page }) => {
    await openManual(page);
    await page.click('.runner-scope-tab-btn[data-manual-scope="grep"]');
    await page.click('#runner-tag-chips .tag-chip-btn[data-tag="@smoke"]');
    const pills = page.locator('#manual-specs-preview-list .suite-summary-pill');
    await expect(pills).toHaveCount(1);
    await expect(page.locator('#manual-specs-preview-list')).not.toContainText('internal.spec.js');
    await expect(page.locator('#manual-specs-preview-count')).toContainText('1');
    await page.check('#runner-show-dashboard-tests');
    await expect(pills).toHaveCount(2);
  });

  test('a saved suite that contains a Dashboard test still runs it (data untouched, shown as hidden)', async ({ page }) => {
    const suites = { mixed: { label: 'Mixed', type: 'single', platform: 'desktop', project: 'all', specs: ['tests/e2e/desktop/alpha.spec.js', INTERNAL], spec: 'custom', grep: '', workers: 1, viewport: { preset: 'default', width: 1920, height: 1080 } } };
    const put = await fetch(`${harness.url}/api/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ suites }) });
    expect(put.status).toBe(200);
    let body = null;
    await page.route('**/api/run', (route) => { body = route.request().postDataJSON(); return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'x', status: 'running', command: [], logs: [] }) }); });
    await page.goto(harness.url);
    await page.waitForSelector('#runner-suite-select');
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
