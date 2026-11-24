/**
 * tests/dashboard/script-picker-gate4.spec.js
 * Gate 4 findings on the Script Picker: NB-PK-2 state kept across screens and Thử lại, NB-PK-3 active chip
 * contrast (any branding accent), NB-PK-4 reduced motion, NB-PK-5 search icon padding, copy with "..",
 * "Đã chạy xong", honest "Chạy N script" label; NB-PK-1 is a BACKEND data bug documented with test.fail().
 */
const { test, expect } = require('@playwright/test');
const { startDashboardHarness } = require('./support/dashboardHarness');
const { createPickerFixture } = require('./support/pickerFixture');

const ALPHA = 'tests/e2e/desktop/alpha.spec.js';
const GAMMA = 'tests/api/gamma.spec.js';
const MIXED = 'tests/e2e/desktop/mixed.spec.js';
const MIXED_SRC = "const { test } = require('@playwright/test');\ntest('smoke part @smoke', async () => {});\ntest('e2e part one @e2e', async () => {});\ntest('e2e part two @e2e', async () => {});\n";
const row = (page, p) => page.locator(`.sp-file[data-path="${p}"] .sp-row`);
const view = (page, id) => page.evaluate((v) => window.__STUDIO_CORE__.featureRegistry.switchView(v), id);

test.describe('Script Picker: Gate 4 fixes', () => {
  let fixture; let harness;
  test.beforeAll(async () => { fixture = createPickerFixture({ files: { [MIXED]: MIXED_SRC } }); harness = await startDashboardHarness(fixture.rootPath); });
  test.afterAll(async () => { if (harness) await harness.stop(); if (fixture) fixture.cleanup(); });

  const open = async (page) => { await page.goto(harness.url); await page.waitForSelector('.sp-file'); };
  const mockRun = (page, status = 202, body = { id: 'r', status: 'running', command: 'npx playwright test', logs: [], startedAt: new Date().toISOString(), options: { environment: 'qc', project: 'all' } }) => page.route('**/api/run', (route) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }));

  test('NB-PK-2: selection, search and filters survive leaving the screen and "Thử lại"', async ({ page }) => {
    await open(page);
    await row(page, ALPHA).click(); await row(page, GAMMA).click();
    await page.fill('#sp-search', 'a');
    await page.click('.sp-chip[data-tag="@e2e"]');
    await view(page, 'settings-view');
    await expect(page.locator('#save-settings-button')).toBeVisible();
    await view(page, 'runner-view');
    await page.waitForSelector('#script-picker');
    await expect(page.locator('#sp-search')).toHaveValue('a');
    await expect(page.locator('.sp-chip[data-tag="@e2e"]')).toHaveAttribute('aria-pressed', 'true');
    await page.click('#sp-results [data-act="clear-filters"]');
    await expect(page.locator('#sp-run')).toHaveText(/Chạy 2 script/);
    await expect(page.locator(`.sp-file[data-path="${ALPHA}"]`)).toHaveAttribute('aria-checked', 'true');

    let failing = true;
    await page.route('**/api/config', (route) => (failing ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'boom' }) }) : route.continue()));
    await view(page, 'settings-view'); await view(page, 'runner-view');
    await expect(page.locator('#script-picker [role="alert"]')).toContainText('boom');
    failing = false;
    await page.click('#script-picker [data-act="retry"]');
    await expect(page.locator('#sp-run')).toHaveText(/Chạy 2 script/);
  });

  test('the run button never says "Chạy tất cả": selecting everything is "N script (tất cả file)"', async ({ page }) => {
    await open(page);
    await page.click('[data-act="select-found"]');
    await expect(page.locator('#sp-run')).toHaveText(/Chạy 6 script/);
    await expect(page.locator('#sp-run')).not.toContainText('tất cả');
    await expect(page.locator('.sp-summary')).toContainText('6 script (tất cả file)');
  });

  for (const theme of ['light', 'dark']) {
    test(`NB-PK-3: the active chip is >= 4.5:1 in ${theme} with any branding accent`, async ({ page }) => {
      await open(page);
      await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
      await page.click('.sp-chip[data-tag="@e2e"]');
      for (const accent of ['#0A65CC', '#FFD400', '#7C3AED', '#E11D48', '#A78BFA', 'gold']) {
        await page.evaluate((a) => document.documentElement.style.setProperty('--accent', a), accent);
        await page.waitForTimeout(350); // the chip fades colours over 150ms
        const r = await page.locator('.sp-chip.is-on').first().evaluate((el) => {
          const rgb = (c) => c.match(/[\d.]+/g).slice(0, 3).map(Number);
          const lum = ([a, b, c]) => { const f = (v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(a) + 0.7152 * f(b) + 0.0722 * f(c); };
          const cs = getComputedStyle(el); const [hi, lo] = [lum(rgb(cs.color)), lum(rgb(cs.backgroundColor))].sort((x, y) => y - x);
          return (hi + 0.05) / (lo + 0.05);
        });
        expect(r, `${theme} accent ${accent}`).toBeGreaterThanOrEqual(4.5);
      }
    });
  }

  test('NB-PK-4: prefers-reduced-motion switches every picker transition and animation off', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page);
    const moving = await page.evaluate(() => Array.from(document.querySelectorAll('#script-picker *')).filter((el) => {
      const cs = getComputedStyle(el);
      return cs.transitionDuration.split(',').some((d) => parseFloat(d) > 0) || (cs.animationName !== 'none' && cs.animationDuration.split(',').some((d) => parseFloat(d) > 0));
    }).map((el) => `${el.tagName}.${el.className}`).slice(0, 5));
    expect(moving).toEqual([]);
  });

  test('NB-PK-5: the search icon does not overlap the text', async ({ page }) => {
    await open(page);
    const g = await page.evaluate(() => { const i = document.querySelector('#sp-search'); const cs = getComputedStyle(i); const ic = document.querySelector('.sp-searchbox > i').getBoundingClientRect(); return { textStart: i.getBoundingClientRect().left + parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth), iconRight: ic.right }; });
    expect(g.textStart).toBeGreaterThanOrEqual(g.iconRight + 4);
  });

  test('server error copy has no double full stop', async ({ page }) => {
    await mockRun(page, 400, { error: 'Tối đa 200 spec mỗi lần chạy.' });
    await open(page);
    await row(page, ALPHA).click();
    await page.click('#sp-run');
    const text = await page.locator('#sp-foot [role="alert"]').textContent();
    expect(text).toContain('Chưa chạy được: Tối đa 200 spec mỗi lần chạy. Lựa chọn của bạn vẫn còn');
    expect(text).not.toContain('..');
  });

  test('"Đã chạy xong." appears when the run that started ends', async ({ page }) => {
    await mockRun(page);
    await open(page);
    await row(page, ALPHA).click();
    await page.click('#sp-run');
    await expect(page.locator('#stop-button')).toBeEnabled(); // run is active (legacy renderRun)
    await expect(page.locator('#sp-run')).toHaveText('Đang chạy…');
    await page.evaluate(() => { document.querySelector('#stop-button').disabled = true; });
    await expect(page.locator('.sp-banner')).toHaveText('Đã chạy xong.');
  });

  test('NB-PK-1 (BACKEND data): a file with @smoke AND @e2e tests must list both device projects', async ({ page }) => {
    // Root cause: specService.projectsForSpec tests project.grep/grepInvert against the WHOLE file text, so one
    // "@smoke" anywhere removes Desktop Regression Tests (grepInvert @smoke) although Playwright (per test title)
    // runs the 2 @e2e tests there. Fixture check: `playwright --list --project="Desktop Regression Tests"` = 2 tests.
    // Not a front-end fix: remove test.fail() when backend-dev fixes specProjects.
    test.fail(true, 'BACKEND: specProjects omits Desktop Regression Tests for files that mention @smoke');
    const cfg = await (await fetch(`${harness.url}/api/config`)).json();
    expect(cfg.specProjects[MIXED]).toEqual(expect.arrayContaining(['Desktop Smoke Tests', 'Desktop Regression Tests']));
  });
});
