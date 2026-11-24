/**
 * tests/dashboard/script-picker-resources.spec.js
 * Gate 3 (2b/3) V1, V2, V4: one real event stream per page (many tabs keep working, the picker opens none),
 * suites with too many tags cannot be saved, the Playwright-UI button is locked while the picker shows.
 */
const { test, expect } = require('@playwright/test');
const { startDashboardHarness } = require('./support/dashboardHarness');
const { createPickerFixture } = require('./support/pickerFixture');

const T = (tag) => `const { test } = require('@playwright/test');\ntest('t ${tag}', async () => {});\n`;
const LONG_TAGS = Array.from({ length: 14 }, (_, i) => `@verylongtagname_${String(i).padStart(2, '0')}`);
const MANY = Object.fromEntries(LONG_TAGS.map((t, i) => [`tests/e2e/desktop/long-${String(i).padStart(2, '0')}.spec.js`, T(t)]));

test.describe('Script Picker: connections, long tag lists, locked buttons', () => {
  let fixture; let harness;
  test.beforeAll(async () => { fixture = createPickerFixture({ files: MANY }); harness = await startDashboardHarness(fixture.rootPath); });
  test.afterAll(async () => { if (harness) await harness.stop(); if (fixture) fixture.cleanup(); });

  const countStreams = () => { // runs before every page script: counts the REAL EventSource objects of the page
    const Native = window.EventSource;
    window.__es = { opened: 0, live: 0 };
    window.EventSource = function EventSourceCounter(...args) { const e = new Native(...args); window.__es.opened += 1; window.__es.live += 1; const close = e.close.bind(e); e.close = () => { window.__es.live -= 1; close(); }; return e; };
    window.EventSource.prototype = Native.prototype;
  };

  test('V1: five tabs on the Runner screen each hold ONE event stream and the fifth still reaches the API fast', async ({ browser }) => {
    const context = await browser.newContext();
    await context.addInitScript(countStreams);
    const pages = [];
    for (let i = 1; i <= 5; i += 1) {
      const page = await context.newPage();
      await page.goto(harness.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.locator('.sp-file').first().waitFor({ timeout: 20000 });
      pages.push(page);
    }
    const last = pages[4];
    const ms = await last.evaluate(async () => { const t = performance.now(); await fetch('/api/health'); return performance.now() - t; });
    expect(ms, `/api/health in the 5th tab took ${Math.round(ms)}ms`).toBeLessThan(2000);
    for (const [i, page] of pages.entries()) {
      const es = await page.evaluate(() => window.__es);
      expect(es.live, `tab ${i + 1}: ${JSON.stringify(es)}`).toBe(1); // before: 2 per tab (app.js + Runner slice), 3 with the picker's own
    }
    await context.close();
  });

  test('further EventSource users share the page stream (no new connection) and the last close ends it; other URLs are untouched', async ({ page }) => {
    await page.addInitScript(countStreams);
    await page.goto(harness.url);
    await page.waitForSelector('.sp-file');
    const r = await page.evaluate(() => {
      const before = { ...window.__es };
      const a = new EventSource('/api/events'); const b = new EventSource('/api/events'); const other = new EventSource('/api/health');
      a.onmessage = () => {}; b.addEventListener('message', () => {});
      const during = { opened: window.__es.opened - before.opened, live: window.__es.live - before.live };
      const isInstance = a instanceof EventSource;
      a.close(); b.close(); other.close();
      return { during, isInstance, closed: a.readyState, liveAfter: window.__es.live - before.live };
    });
    expect(r.during).toEqual({ opened: 1, live: 1 }); // only the foreign URL opened a real stream
    expect(r.isInstance).toBe(true);
    expect(r.closed).toBe(2);
    expect(r.liveAfter).toBe(0); // the page's own stream (app.js) is still there: closing proxies never closed it
  });

  test('V2: a tag list whose regex exceeds 200 characters cannot be saved (reason as text); a short one can', async ({ page }) => {
    await page.goto(harness.url);
    await page.waitForSelector('.sp-file');
    for (const tag of LONG_TAGS) await page.click(`.sp-chip[data-tag="${tag}"]`);
    await page.check('#sp-tagonly');
    await page.click('[data-act="select-found"]');
    await expect(page.locator('#sp-save')).toBeDisabled();
    await expect(page.locator('#sp-foot')).toContainText('Quá nhiều tag để lưu thành suite (tối đa 200 ký tự).');
    for (const tag of LONG_TAGS.slice(3)) await page.click(`.sp-chip[data-tag="${tag}"]`); // down to 3 tags
    await expect(page.locator('#sp-save')).toBeEnabled();
  });

  test('V4: the Playwright-UI button is locked while the picker shows and given back in suite mode', async ({ page }) => {
    const calls = [];
    page.on('request', (r) => { if (/\/api\/ui$/.test(r.url())) calls.push(r.method()); });
    await page.goto(harness.url);
    await page.waitForSelector('.sp-file');
    const ui = page.locator('#ui-button');
    await expect(ui).toBeDisabled();
    await expect(ui).toHaveAttribute('aria-hidden', 'true');
    await page.evaluate(() => { const b = document.getElementById('ui-button'); b.click(); b.disabled = false; b.click(); });
    await page.waitForTimeout(300);
    expect(calls).toEqual([]);
    await page.click('.runner-mode-tab[data-mode="suite"]');
    await expect(ui).toBeEnabled();
    await page.click('.runner-mode-tab[data-mode="manual"]');
    await expect(ui).toBeDisabled();
  });

  test('every chip-like button carries aria-pressed that follows the selection (quick chips too)', async ({ page }) => {
    await page.goto(harness.url);
    await page.waitForSelector('.sp-file');
    const missing = await page.evaluate(() => Array.from(document.querySelectorAll('#script-picker .sp-chip')).filter((c) => !c.hasAttribute('aria-pressed')).map((c) => c.textContent.trim()));
    expect(missing).toEqual([]);
    await page.click('.sp-chip[data-tag="@verylongtagname_00"]');
    await expect(page.locator('.sp-chip[data-tag="@verylongtagname_00"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.sp-chip[data-tag="@verylongtagname_01"]')).toHaveAttribute('aria-pressed', 'false');
  });

  test('B-3: switching screens 20 times does not request /api/events again (one stream per page)', async ({ page }) => {
    let requests = 0;
    page.on('request', (r) => { if (r.url().endsWith('/api/events')) requests += 1; });
    await page.goto(harness.url);
    await page.waitForSelector('.sp-file');
    await page.waitForTimeout(400);
    const atLoad = requests;
    const view = (id) => page.evaluate((v) => window.__STUDIO_CORE__.featureRegistry.switchView(v), id);
    for (let i = 0; i < 20; i += 1) { await view('settings-view'); await page.waitForTimeout(60); await view('runner-view'); await page.locator('.sp-file').first().waitFor(); }
    expect(requests, `at load ${atLoad}, after 20 switches ${requests}`).toBe(atLoad);
    expect(atLoad).toBe(1);
  });
});
