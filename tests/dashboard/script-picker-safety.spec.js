/**
 * tests/dashboard/script-picker-safety.spec.js
 * Gate 3 fixes: B1 stored XSS (suite label / file name), M1 nothing runs while the picker is loading, failed or
 * empty (Enter in a field + "Mở Playwright UI"), M2 a broken picker file leaves the other screens working,
 * m1 the "/" shortcut, m2 accent colour parsing through the browser.
 */
const { test, expect } = require('@playwright/test');
const { startDashboardHarness } = require('./support/dashboardHarness');
const { createPickerFixture } = require('./support/pickerFixture');

const ALPHA = 'tests/e2e/desktop/alpha.spec.js';
const EVIL_LABEL = '<img src=x onerror="window.__xss=1">';
const EVIL_FILE = 'tests/e2e/desktop/x"><i id=pwn>.spec.js';
const SUITE = { type: 'single', platform: 'desktop', project: 'all', specs: [ALPHA], spec: ALPHA, grep: '', workers: 1, viewport: { preset: 'default', width: 1920, height: 1080 } };
const T = "const { test } = require('@playwright/test');\ntest('t @e2e', async () => {});\n";

test.describe('Script Picker safety', () => {
  let fixture; let harness;
  test.beforeAll(async () => {
    fixture = createPickerFixture({ suites: { evil: { ...SUITE, label: EVIL_LABEL } }, files: { [EVIL_FILE]: T } });
    harness = await startDashboardHarness(fixture.rootPath);
  });
  test.afterAll(async () => { if (harness) await harness.stop(); if (fixture) fixture.cleanup(); });

  const runRequests = (page) => { const list = []; page.on('request', (r) => { if (/\/api\/(run|ui)$/.test(r.url()) && r.method() === 'POST') list.push({ url: r.url(), body: r.postData() }); }); return list; };

  test('B1: a malicious suite label or file name is shown as text and never executes', async ({ page }) => {
    await page.goto(harness.url);
    await page.waitForSelector('.sp-file');
    await page.click('.sp-chip[data-suite="evil"]');
    await expect(page.locator('.sp-banner')).toContainText(EVIL_LABEL);
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();
    expect(await page.locator('#script-picker img, #script-picker #pwn').count()).toBe(0);
    await page.fill('#sp-search', 'pwn');
    await expect(page.locator('.sp-fname')).toContainText('<i id=pwn>');
    expect(await page.locator('#pwn').count()).toBe(0);
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  });

  for (const state of ['loading', 'error', 'empty']) {
    for (const path of ['Enter in the workers field', 'Mở Playwright UI']) {
      test(`M1: ${state} catalog + ${path} sends no run-everything request`, async ({ page }) => {
        const calls = runRequests(page);
        let release;
        const gate = new Promise((r) => { release = r; });
        await page.route('**/api/config', async (route) => {
          if (state === 'loading') { await gate; return route.continue(); }
          if (state === 'error') return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'boom' }) });
          const res = await route.fetch(); const body = await res.json();
          return route.fulfill({ response: res, json: { ...body, specs: [], specTags: {}, specProjects: {}, availableTags: [] } });
        });
        await page.goto(harness.url);
        await expect(page.locator('#script-picker')).toBeVisible();
        if (state === 'error') await expect(page.locator('#script-picker [role="alert"]')).toBeVisible();
        if (state === 'empty') await expect(page.locator('#script-picker')).toContainText('Chưa có script test');
        if (path === 'Mở Playwright UI') await page.click('#ui-button'); else { await page.focus('#workers'); await page.keyboard.press('Enter'); }
        await page.waitForTimeout(500);
        expect(calls, JSON.stringify(calls)).toEqual([]);
        // Enter no longer submits at all (the old default button is disabled while the picker shows); the UI button says why
        if (path === 'Mở Playwright UI') await expect(page.locator('#toast')).toContainText('Danh sách script chưa sẵn sàng');
        release();
      });
    }
  }

  test('M2: a blocked picker file leaves the other screens working and the Runner refuses to run everything', async ({ page }) => {
    const calls = runRequests(page);
    await page.route('**/js/views/runner/picker/pickerTree.js*', (route) => route.abort());
    await page.goto(harness.url);
    await page.waitForFunction(() => Boolean(window.__STUDIO_CORE__));
    await expect(page.locator('#script-picker-error')).toContainText('Không tải được bộ chọn script');
    await page.evaluate(() => window.__STUDIO_CORE__.featureRegistry.switchView('settings-view'));
    await expect(page.locator('#save-settings-button')).toBeVisible();
    await page.evaluate(() => window.__STUDIO_CORE__.featureRegistry.switchView('runner-view'));
    await page.click('.runner-mode-tab[data-mode="manual"]');
    await page.focus('#workers'); await page.keyboard.press('Enter');
    await page.click('#ui-button');
    await page.waitForTimeout(600);
    for (const c of calls) { const b = JSON.parse(c.body); expect(b.spec === 'all' || b.specs === undefined, c.body).toBe(false); expect(b.specs).toEqual([]); }
  });

  test('m1: "/" focuses search only for a plain key outside editable content', async ({ page }) => {
    await page.goto(harness.url);
    await page.waitForSelector('.sp-file');
    const searchFocused = () => page.evaluate(() => document.activeElement && document.activeElement.id === 'sp-search');
    await page.evaluate(() => document.activeElement.blur());
    for (const combo of ['Control+/', 'Meta+/', 'Alt+/']) { await page.keyboard.press(combo); expect(await searchFocused(), combo).toBe(false); }
    await page.evaluate(() => { const d = document.createElement('div'); d.id = 'ce'; d.contentEditable = 'true'; d.tabIndex = 0; d.textContent = 'x'; document.body.appendChild(d); d.focus(); });
    await page.keyboard.press('/');
    expect(await searchFocused()).toBe(false);
    expect(await page.locator('#ce').textContent()).toContain('/');
    await page.focus('#workers');
    await page.keyboard.press('/');
    expect(await searchFocused()).toBe(false);
    await page.evaluate(() => document.activeElement.blur());
    await page.keyboard.press('/');
    expect(await searchFocused()).toBe(true);
  });

  test('m2: the on-accent colour understands names, hsl() and space-separated rgb()', async ({ page }) => {
    await page.goto(harness.url);
    await page.waitForSelector('.sp-file');
    const onAccent = async (accent) => {
      await page.evaluate((a) => document.documentElement.style.setProperty('--accent', a), accent);
      await page.waitForTimeout(80);
      return page.evaluate(() => document.querySelector('#script-picker').style.getPropertyValue('--on-accent').trim().toUpperCase());
    };
    expect(await onAccent('gold')).toBe('#1A0B3B');
    expect(await onAccent('hsl(50 100% 50%)')).toBe('#1A0B3B');
    expect(await onAccent('rgb(10 10 10)')).toBe('#FFFFFF');
    expect(await onAccent('#0A65CC')).toBe('#FFFFFF');
  });
});
