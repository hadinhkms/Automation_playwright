/**
 * tests/dashboard/script-picker-lifecycle.spec.js
 * Script Picker across mounts: no leaked listeners/nodes (L1, measured with CDP), stale remembered state is
 * dropped with a message (L2), a run in progress is shown after coming back (L3), run-end messages only for a
 * run this picker started (L4), and the honest "estimate" note for specProjectsSource (backend flag).
 */
const { test, expect } = require('@playwright/test');
const { startDashboardHarness } = require('./support/dashboardHarness');
const { createPickerFixture } = require('./support/pickerFixture');

const ALPHA = 'tests/e2e/desktop/alpha.spec.js';
const DANG = 'tests/e2e/desktop/dang-nhap.spec.js';
const GAMMA = 'tests/api/gamma.spec.js';
const RUN = { id: 'r', status: 'running', command: 'npx playwright test', logs: [], startedAt: new Date().toISOString(), options: { environment: 'qc', project: 'all' } };
const row = (page, p) => page.locator(`.sp-file[data-path="${p}"] .sp-row`);
const view = (page, id) => page.evaluate((v) => window.__STUDIO_CORE__.featureRegistry.switchView(v), id);
const roundTrip = async (page) => { await view(page, 'settings-view'); await expect(page.locator('#save-settings-button')).toBeVisible(); await view(page, 'runner-view'); await page.locator('.sp-file').first().waitFor(); }; // locator, not waitForSelector: an ElementHandle would itself keep the old DOM alive

test.describe('Script Picker lifecycle', () => {
  let fixture; let harness;
  test.beforeAll(async () => { fixture = createPickerFixture(); harness = await startDashboardHarness(fixture.rootPath); });
  test.afterAll(async () => { if (harness) await harness.stop(); if (fixture) fixture.cleanup(); });
  const open = async (page) => { await page.goto(harness.url); await page.waitForSelector('.sp-file'); };
  const mockRun = (page) => page.route('**/api/run', (route) => route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify(RUN) }));

  test('L1: 20 more visits to the Runner screen leave no extra listeners or nodes (CDP counters after GC)', async ({ page }) => {
    await open(page);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Memory.getDOMCounters').catch(() => null);
    const counters = async () => { await cdp.send('HeapProfiler.collectGarbage'); await cdp.send('HeapProfiler.collectGarbage'); return cdp.send('Memory.getDOMCounters'); };
    for (let i = 0; i < 3; i += 1) await roundTrip(page); // warm-up: lazy templates, caches
    const before = await counters();
    for (let i = 0; i < 20; i += 1) await roundTrip(page);
    const after = await counters();
    const d = { listeners: after.jsEventListeners - before.jsEventListeners, nodes: after.nodes - before.nodes };
    test.info().annotations.push({ type: 'leak', description: JSON.stringify(d) });
    expect(d.listeners, JSON.stringify(d)).toBeLessThanOrEqual(5);
    expect(d.nodes, JSON.stringify(d)).toBeLessThanOrEqual(150);
  });

  test('L2: remembered files, tags, platforms and projects that no longer exist are dropped and announced', async ({ page }) => {
    let loads = 0;
    await page.route('**/api/config', async (route) => {
      const res = await route.fetch(); const body = await res.json(); loads += 1;
      if (loads <= 2) return route.fulfill({ response: res, json: body }); // legacy init + first picker load
      const specs = body.specs.filter((p) => p !== GAMMA);
      const specTags = Object.fromEntries(Object.entries(body.specTags).map(([k, v]) => [k, v.filter((t) => t !== '@auth')]));
      const specProjects = Object.fromEntries(Object.entries(body.specProjects).map(([k, v]) => [k, v.filter((p) => p !== 'Desktop Regression Tests')]));
      return route.fulfill({ response: res, json: { ...body, specs, specTags, specProjects, availableTags: body.availableTags.filter((t) => t !== '@auth'), projects: body.projects.filter((p) => p !== 'Desktop Regression Tests') } });
    });
    await open(page);
    await row(page, GAMMA).click(); await row(page, DANG).click();
    await page.click('#sp-foot [data-act="open-projects"]');
    await page.click('.sp-projlist [data-project="Desktop Regression Tests"]');
    await page.click('.sp-chip[data-tag="@auth"]');
    await page.click('.sp-chip[data-platform="API"]');
    await page.click('.sp-chip[data-platform="Desktop"]');
    await roundTrip(page);
    await expect(page.locator('.sp-banner')).toHaveText('Đã bỏ 1 file, 1 tag, 1 nền tảng, 1 project không còn tồn tại.');
    await expect(page.locator('.sp-chip.is-on')).toHaveCount(1); // only "Desktop" is left: no invisible filter
    await expect(page.locator('.sp-chip[data-platform="Desktop"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#sp-run')).toHaveText(/Chạy 1 script/);
    await expect(page.locator('#sp-foot')).not.toContainText('Desktop Regression Tests');
  });

  test('L3: coming back to the screen while a run is active shows "Đang chạy…" and a disabled button', async ({ page }) => {
    await mockRun(page);
    await open(page);
    await row(page, ALPHA).click();
    await page.click('#sp-run');
    await expect(page.locator('#sp-run')).toHaveText('Đang chạy…');
    await roundTrip(page);
    await expect(page.locator('#sp-run')).toHaveText('Đang chạy…');
    await expect(page.locator('#sp-run')).toBeDisabled();
    await expect(page.locator('#stop-button')).toBeEnabled();
  });

  test('L4: "Run đã kết thúc." only for a run this picker started; Dừng gives "Đã dừng run."', async ({ page }) => {
    await mockRun(page);
    await page.route('**/api/stop', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await open(page);
    const finish = () => page.evaluate(() => { document.querySelector('#stop-button').disabled = true; });
    const startForeign = () => page.evaluate(() => { document.querySelector('#stop-button').disabled = false; }); // a run started elsewhere (Suite mode)
    await startForeign(); await finish();
    await expect(page.locator('#sp-foot .sp-banner')).toHaveCount(0);
    await row(page, ALPHA).click();
    await page.click('#sp-run');
    await expect(page.locator('#stop-button')).toBeEnabled();
    await finish();
    await expect(page.locator('#sp-foot .sp-banner')).toHaveText('Run đã kết thúc.');
    await row(page, GAMMA).click(); // selection change clears the message
    await page.click('#sp-run');
    await expect(page.locator('#stop-button')).toBeEnabled();
    await page.click('#stop-button');
    await finish();
    await expect(page.locator('#sp-foot .sp-banner')).toHaveText('Đã dừng run.');
  });

  test('M-1: a picker run that ended while away shows "Run đã kết thúc." once; a later Suite-mode run ending shows nothing', async ({ page }) => {
    await mockRun(page);
    await open(page);
    await row(page, ALPHA).click();
    await page.click('#sp-run');
    await expect(page.locator('#stop-button')).toBeEnabled();
    await view(page, 'settings-view');
    await expect(page.locator('#save-settings-button')).toBeVisible();
    await page.evaluate(() => { document.querySelector('#stop-button').disabled = true; }); // our run ends while we are away
    await view(page, 'runner-view');
    await page.locator('.sp-file').first().waitFor();
    await expect(page.locator('#sp-foot .sp-banner')).toHaveText('Run đã kết thúc.');
    await row(page, GAMMA).click(); // any change clears the message
    await expect(page.locator('#sp-foot .sp-banner')).toHaveCount(0);
    await roundTrip(page); // coming back again: the flag is spent, no second banner
    await expect(page.locator('#sp-foot .sp-banner')).toHaveCount(0);
    await page.evaluate(() => { document.querySelector('#stop-button').disabled = false; }); // a run from another mode starts...
    await page.evaluate(() => { document.querySelector('#stop-button').disabled = true; }); // ...and ends
    await page.waitForTimeout(150);
    await expect(page.locator('#sp-foot .sp-banner')).toHaveCount(0);
  });

  for (const [source, shown] of [['estimate', true], ['playwright', false], ['none', false]]) {
    test(`specProjectsSource "${source}" ${shown ? 'shows' : 'hides'} the estimate note`, async ({ page }) => {
      await page.route('**/api/config', async (route) => { const res = await route.fetch(); const body = await res.json(); return route.fulfill({ response: res, json: { ...body, specProjectsSource: source } }); });
      await open(page);
      await row(page, ALPHA).click();
      const note = page.locator('#sp-foot [role="note"]');
      if (shown) await expect(note).toHaveText('Danh sách project đang là ước lượng; số lượt chạy có thể chưa chính xác.'); else await expect(note).toHaveCount(0);
    });
  }
});
