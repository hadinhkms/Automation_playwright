/**
 * tests/dashboard/settings-save-guards.spec.js
 * Client guards after Gate 3: revision/409 (two tabs), stuck Suites flag (F1), double "Tạo suite" (F3),
 * draft suites never saved by Settings (F5), Settings fields still saved (F4).
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { startDashboardHarness } = require('./support/dashboardHarness');
const { createFixtureWorkspace } = require('./support/fixtureWorkspace');

const SMOKE = {
  label: 'Smoke Tests', description: '', type: 'single', platform: 'desktop', project: 'chromium',
  device: '', viewport: { preset: 'default', width: 1920, height: 1080 }, spec: 'all', specs: 'all', grep: '', workers: 2,
};
const getSettings = async (h) => (await fetch(`${h.url}/api/settings`)).json();
const labels = (s) => Object.values(s.suites).map((x) => x.label);

async function boot(suites) {
  const fixture = createFixtureWorkspace();
  fs.writeFileSync(path.join(fixture.rootPath, 'dashboardConfig.json'), JSON.stringify({ suites }), 'utf8');
  return { fixture, harness: await startDashboardHarness(fixture.rootPath) };
}
async function openView(page, harness, view, ready) {
  await page.goto(`${harness.url}/#/${view}`);
  await page.waitForSelector(ready);
  await page.waitForTimeout(700); // SSE keeps the network busy; let the startup settings GET finish
}
const clickSettingsSave = (page) => page.locator('#save-settings-button').dispatchEvent('click');

test.describe('Revision / 409 across two tabs', () => {
  let env;
  test.describe.configure({ mode: 'serial' });
  test.beforeAll(async () => { env = await boot({ smoke: SMOKE }); });
  test.afterAll(async () => { await env.harness.stop(); env.fixture.cleanup(); });

  async function createAndSaveOnA(browser, label) {
    const a = await (await browser.newContext()).newPage();
    await openView(a, env.harness, 'suites-view', '#suites-subnav-create');
    await a.click('#suites-subnav-create');
    await a.fill('#suite-field-label', label);
    await a.click('#suites-save-btn');
    await expect(a.locator('#toast')).toContainText('thành công');
  }

  test('stale Settings tab: 409 shown, form kept, A\'s suite intact, reload offered', async ({ browser }) => {
    const b = await (await browser.newContext()).newPage();
    await openView(b, env.harness, 'settings-view', '.env-card');
    await createAndSaveOnA(browser, 'From A');
    const workersBefore = (await getSettings(env.harness)).runtime.workers;
    await b.fill('#settings-workers', '3');
    await clickSettingsSave(b);
    await expect(b.locator('#toast')).toContainText('Cấu hình đã được thay đổi ở nơi khác');
    await expect(b.locator('#toast')).not.toContainText('thành công');
    await expect(b.locator('#settings-conflict-banner')).toBeVisible();
    await expect(b.locator('#settings-workers')).toHaveValue('3');
    const after = await getSettings(env.harness);
    expect(labels(after)).toContain('From A');
    expect(after.runtime.workers).toBe(workersBefore);
    await b.click('#settings-conflict-reload');
    await expect(b.locator('#settings-workers')).toHaveValue(String(workersBefore));
    await expect(b.locator('#settings-conflict-banner')).toBeHidden();
  });

  test('stale Suites tab: 409 shown instead of success, A\'s suite intact', async ({ browser }) => {
    const b = await (await browser.newContext()).newPage();
    await openView(b, env.harness, 'suites-view', '#suites-subnav-create');
    await createAndSaveOnA(browser, 'Second From A');
    await b.click('#suites-subnav-create');
    await b.fill('#suite-field-label', 'From B');
    await b.click('#suites-save-btn');
    await expect(b.locator('#toast')).toContainText('Cấu hình đã được thay đổi ở nơi khác');
    await expect(b.locator('#toast')).not.toContainText('thành công');
    await expect(b.locator('#suite-field-label')).toHaveValue('From B');
    const l = labels(await getSettings(env.harness));
    expect(l).toContain('Second From A');
    expect(l).not.toContain('From B');
  });

  test('after a successful save the next save from the same tab is not a conflict', async ({ page }) => {
    await openView(page, env.harness, 'settings-view', '.env-card');
    await page.fill('#settings-workers', '4');
    await clickSettingsSave(page);
    await expect(page.locator('#toast')).toContainText('lưu');
    await page.fill('#settings-workers', '5');
    await clickSettingsSave(page);
    await expect(page.locator('#toast')).not.toContainText('nơi khác');
    await expect.poll(async () => (await getSettings(env.harness)).runtime.workers).toBe(5);
  });
});

test.describe('Suites / Settings save guards (F1, F3, F4)', () => {
  let env;
  test.describe.configure({ mode: 'serial' });
  test.beforeAll(async () => { env = await boot({ smoke: SMOKE }); });
  test.afterAll(async () => { await env.harness.stop(); env.fixture.cleanup(); });

  test('F1: a Suites save that throws before saving does not turn the next Settings save into a Suites save', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    await openView(page, env.harness, 'settings-view', '.env-card');
    await page.evaluate(() => window.__STUDIO_CORE__.featureRegistry.switchView('suites-view'));
    await page.waitForSelector('#suite-field-label');
    await page.fill('#suite-field-label', 'Draft Label');
    await page.evaluate(() => {
      window.__origSync = window.syncCurrentSuiteFromInputs;
      window.syncCurrentSuiteFromInputs = () => { throw new Error('boom'); };
    });
    await page.click('#suites-save-btn');
    await expect(page.locator('#toast')).toContainText('boom');
    await page.evaluate(() => { window.syncCurrentSuiteFromInputs = window.__origSync; });
    await clickSettingsSave(page);
    await expect(page.locator('#toast')).toContainText('Đã lưu cấu hình');
    expect(labels(await getSettings(env.harness))).not.toContain('Draft Label');
    expect(pageErrors).toEqual([]);
  });

  test('F3: one click on "Tạo suite" creates exactly one suite', async ({ page }) => {
    await openView(page, env.harness, 'suites-view', '#suites-subnav-create');
    const items = page.locator('#suites-sidebar-list .suite-nav-item');
    const before = await items.count();
    await page.click('#suites-subnav-create');
    await expect(items).toHaveCount(before + 1);
    await page.waitForTimeout(300);
    await expect(items).toHaveCount(before + 1);
  });

  test('F4: editing Settings fields (runtime and environment) is saved, not silently dropped', async ({ page }) => {
    await openView(page, env.harness, 'settings-view', '.env-card');
    const envLabel = page.locator('.env-card [data-setting="env-label"]').first();
    await envLabel.fill('Edited Env Label');
    await page.fill('#settings-workers', '3');
    await clickSettingsSave(page);
    await expect(page.locator('#toast')).toContainText('lưu');
    const s = await getSettings(env.harness);
    expect(s.runtime.workers).toBe(3);
    expect(Object.values(s.environments).map((e) => e.label)).toContain('Edited Env Label');
    expect(s.suites.smoke.label).toBe('Smoke Tests');
  });
});

test.describe('F5: server with zero suites', () => {
  let env;
  test.beforeAll(async () => { env = await boot({}); });
  test.afterAll(async () => { await env.harness.stop(); env.fixture.cleanup(); });

  test('a draft suite is never saved by a Settings save', async ({ page }) => {
    expect(Object.keys((await getSettings(env.harness)).suites)).toHaveLength(0);
    await openView(page, env.harness, 'settings-view', '.env-card');
    await page.evaluate(() => window.__STUDIO_CORE__.featureRegistry.switchView('suites-view'));
    await page.waitForSelector('#suites-subnav-create');
    await page.click('#suites-subnav-create');
    await expect(page.locator('#suites-sidebar-list .suite-nav-item').first()).toBeVisible();
    await clickSettingsSave(page);
    await expect(page.locator('#toast')).toContainText('lưu');
    expect(Object.keys((await getSettings(env.harness)).suites)).toHaveLength(0);
  });
});
