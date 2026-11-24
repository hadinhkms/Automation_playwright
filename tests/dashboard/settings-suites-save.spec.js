/**
 * tests/dashboard/settings-suites-save.spec.js
 * NB-01: Settings save before the Suites view was visited must not overwrite stored suites.
 * NB-02: a rejected save (HTTP 400) must show the server error, never the success toast.
 */
const { test, expect } = require('@playwright/test');
const { startDashboardHarness } = require('./support/dashboardHarness');
const { createFixtureWorkspace } = require('./support/fixtureWorkspace');
const fs = require('fs');
const path = require('path');

// The harness server writes the config it resolves from QA_PROJECT_ROOT; seed that file so the
// tracked core/config/dashboardConfig.json is never touched. Project is not in the Playwright catalog.
const SMOKE = {
  label: 'Smoke Tests', description: '', type: 'single', platform: 'desktop', project: 'Desktop Smoke Tests',
  device: '', viewport: { preset: 'default', width: 1920, height: 1080 }, spec: 'all', specs: 'all', grep: '@smoke', workers: 2,
};

async function getSettings(harness) {
  const res = await fetch(`${harness.url}/api/settings`);
  return res.json();
}

test.describe('Settings / Suites save safety (NB-01, NB-02)', () => {
  let fixture;
  let harness;
  test.beforeAll(async () => {
    fixture = createFixtureWorkspace();
    fs.writeFileSync(path.join(fixture.rootPath, 'dashboardConfig.json'), JSON.stringify({ suites: { smoke: SMOKE } }), 'utf8');
    harness = await startDashboardHarness(fixture.rootPath);
  });
  test.afterAll(async () => { if (harness) await harness.stop(); if (fixture) fixture.cleanup(); });

  test('NB-01: Settings save without visiting Suites keeps stored suites', async ({ page }) => {
    const before = (await getSettings(harness)).suites;
    expect(before.smoke).toMatchObject({ label: 'Smoke Tests', project: 'Desktop Smoke Tests', grep: '@smoke' });
    await page.goto(`${harness.url}/#/settings-view`);
    await page.waitForFunction(() => Boolean(window.__STUDIO_CORE__));
    await page.waitForSelector('#save-settings-button');
    await page.click('#save-settings-button');
    await expect(page.locator('#toast')).toContainText('lưu');
    const after = (await getSettings(harness)).suites;
    expect(after).toEqual(before);
  });

  test('NB-02: a 400 on save shows the server error, not success', async ({ page }) => {
    const message = 'Không thể lưu cấu hình: Default environment must exist in environments.';
    await page.route('**/api/settings', (route) => {
      if (route.request().method() !== 'PUT') return route.continue();
      return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: message }) });
    });
    await page.goto(harness.url);
    await page.waitForFunction(() => Boolean(window.__STUDIO_CORE__));
    await page.evaluate(() => window.__STUDIO_CORE__.featureRegistry.switchView('suites-view'));
    await page.waitForSelector('#suites-save-btn');
    await page.click('#suites-save-btn');
    await expect(page.locator('#toast')).toContainText('Default environment must exist');
    await expect(page.locator('#toast')).not.toContainText('thành công');
  });

  test('NB-02: creating a suite before Settings loaded saves it (no false success, no 400)', async ({ page }) => {
    await page.goto(`${harness.url}/#/suites-view`);
    await page.waitForFunction(() => Boolean(window.__STUDIO_CORE__));
    await page.waitForSelector('#suites-subnav-create');
    await page.click('#suites-subnav-create');
    await page.fill('#suite-field-label', 'Created Before Settings');
    await page.click('#suites-save-btn');
    await expect(page.locator('#toast')).toContainText('thành công');
    const suites = (await getSettings(harness)).suites;
    expect(Object.values(suites).map((s) => s.label)).toContain('Created Before Settings');
    expect(suites.smoke).toMatchObject({ label: 'Smoke Tests', project: 'Desktop Smoke Tests', grep: '@smoke' });
  });

  test('NB-01b: Suites save without edits keeps project outside the Playwright catalog', async ({ page }) => {
    await page.goto(`${harness.url}/#/suites-view`);
    await page.waitForSelector('#suites-save-btn');
    await page.click('#suites-save-btn');
    await expect(page.locator('#toast')).toContainText('thành công');
    expect((await getSettings(harness)).suites.smoke).toMatchObject({ project: 'Desktop Smoke Tests', grep: '@smoke' });
  });
});
