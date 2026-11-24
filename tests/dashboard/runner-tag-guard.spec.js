/**
 * tests/dashboard/runner-tag-guard.spec.js
 * R1: typed text without a valid @tag in "Theo Tag" must not run everything: buttons blocked, warning shown,
 * preview makes no match claim, no /api/run request is sent.
 */
const { test, expect } = require('@playwright/test');
const { startDashboardHarness } = require('./support/dashboardHarness');
const { createRunnerFixture } = require('./support/runnerFixture');

const WARNING = 'Chỉ lọc được theo tag bắt đầu bằng @, ví dụ @smoke';

test.describe('Runner tag box without a valid @tag (R1)', () => {
  let fixture; let harness;
  test.beforeAll(async () => { fixture = createRunnerFixture(); harness = await startDashboardHarness(fixture.rootPath); });
  test.afterAll(async () => { if (harness) await harness.stop(); if (fixture) fixture.cleanup(); });

  test('"login" (QA NB-06) and "smoke" block Chạy test, warns, previews no match and sends nothing; "@smoke" runs', async ({ page }) => {
    const bodies = [];
    await page.route('**/api/run', (route) => { bodies.push(route.request().postDataJSON()); return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'x', status: 'running', command: [], logs: [] }) }); });
    await page.goto(harness.url);
    await page.waitForSelector('.runner-mode-tab[data-mode="manual"]');
    await page.click('.runner-mode-tab[data-mode="manual"]');
    await page.click('.runner-scope-tab-btn[data-manual-scope="grep"]');
    await page.fill('#grep', 'login');
    await expect(page.locator('#runner-tag-warning')).toContainText(WARNING);
    await page.fill('#grep', 'smoke');
    await expect(page.locator('#runner-tag-warning')).toContainText(WARNING);
    await expect(page.locator('#run-button')).toBeDisabled();
    await expect(page.locator('#ui-button')).toBeDisabled();
    await expect(page.locator('#manual-specs-preview-count')).toHaveText('0');
    await expect(page.locator('#manual-specs-preview-list .suite-summary-pill')).toHaveCount(0);
    await page.locator('#run-form').dispatchEvent('submit'); // even if a button were re-enabled
    await page.waitForTimeout(300);
    expect(bodies).toEqual([]);

    await page.fill('#grep', '@smoke');
    await expect(page.locator('#runner-tag-warning')).toBeHidden();
    await expect(page.locator('#run-button')).toBeEnabled();
    await page.click('#run-button');
    await expect.poll(() => bodies.length).toBe(1);
    expect(bodies[0].grep).toBe('@smoke');
  });

  test('the warning does not appear outside the tag scope or for an empty box', async ({ page }) => {
    await page.goto(harness.url);
    await page.waitForSelector('.runner-mode-tab[data-mode="manual"]');
    await page.click('.runner-mode-tab[data-mode="manual"]');
    await page.click('.runner-scope-tab-btn[data-manual-scope="grep"]');
    await page.fill('#grep', 'zzz');
    await expect(page.locator('#runner-tag-warning')).toBeVisible();
    await page.fill('#grep', '');
    await expect(page.locator('#runner-tag-warning')).toBeHidden();
    await page.fill('#grep', 'zzz');
    await page.click('.runner-scope-tab-btn[data-manual-scope="all"]');
    await expect(page.locator('#runner-tag-warning')).toBeHidden();
    await expect(page.locator('#run-button')).toBeEnabled();
  });

  test('N1: the guard gives back the app\'s own disabled state (run in progress), never a blind enable', async ({ page }) => {
    await page.goto(harness.url);
    await page.waitForSelector('.runner-mode-tab[data-mode="manual"]');
    await page.click('.runner-mode-tab[data-mode="manual"]');
    await page.click('.runner-scope-tab-btn[data-manual-scope="grep"]');
    const setApp = (disabled) => page.evaluate((d) => { document.querySelector('#run-button').disabled = d; }, disabled);
    await setApp(true); // app.js: a run is active
    await page.fill('#grep', 'login');
    await page.fill('#grep', '@smoke');
    await expect(page.locator('#run-button')).toBeDisabled(); // still the app's disabled, not enabled by the guard
    await setApp(false); // run finished
    await expect(page.locator('#run-button')).toBeEnabled();

    await page.fill('#grep', 'login'); // locked by the guard
    await setApp(true); await setApp(false); // app runs and finishes while we hold the lock
    await expect(page.locator('#run-button')).toBeDisabled();
    await page.fill('#grep', '@smoke');
    await expect(page.locator('#run-button')).toBeEnabled(); // not stuck on a stale "disabled"
  });
});
