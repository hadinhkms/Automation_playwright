/**
 * tests/dashboard/script-picker-states.spec.js
 * Script Picker status panels (empty, catalog error + retry, many files) and server errors shown verbatim
 * (409, real 400s from /api/run). Isolated fixture workspaces.
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { startDashboardHarness } = require('./support/dashboardHarness');
const { createPickerFixture } = require('./support/pickerFixture');

const ALPHA = 'tests/e2e/desktop/alpha.spec.js';
const MANY = Object.fromEntries(Array.from({ length: 22 }, (_, i) => [`tests/e2e/desktop/many-${String(i).padStart(2, '0')}.spec.js`, "const { test } = require('@playwright/test');\ntest('many @e2e', async () => {});\n"]));
const row = (page, p) => page.locator(`.sp-file[data-path="${p}"] .sp-row`);

test.describe('Script Picker: panels and server errors', () => {
  let fixture; let harness;
  test.beforeAll(async () => { fixture = createPickerFixture({ files: { ...MANY, 'tests/e2e/desktop/delete-me.spec.js': "const { test } = require('@playwright/test');\ntest('del @e2e', async () => {});\n" } }); harness = await startDashboardHarness(fixture.rootPath); });
  test.afterAll(async () => { if (harness) await harness.stop(); if (fixture) fixture.cleanup(); });

  test('S2: an empty catalog explains what to do and offers the BDD view', async ({ page }) => {
    await page.route('**/api/config', async (route) => {
      const res = await route.fetch(); const body = await res.json();
      await route.fulfill({ response: res, json: { ...body, specs: [], specTags: {}, specProjects: {}, availableTags: [] } });
    });
    await page.goto(harness.url);
    await expect(page.locator('#script-picker')).toContainText('Chưa có script test nào trong dự án này');
    await expect(page.locator('#script-picker')).toContainText('Tạo script đầu tiên trong Kịch bản BDD');
    await page.click('#script-picker [data-view-go="builder-view"]');
    await expect(page.locator('#builder-view')).toBeVisible();
  });

  test('S3: a catalog error shows the reason, keeps the other tab usable and Thử lại works', async ({ page }) => {
    let failing = true;
    await page.route('**/api/config', (route) => (failing ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'boom' }) }) : route.continue()));
    await page.goto(harness.url);
    await expect(page.locator('#script-picker [role="alert"]')).toContainText('Không đọc được danh sách script (boom)');
    await expect(page.locator('#script-picker [role="alert"]')).toContainText('Lựa chọn của bạn chưa bị mất');
    await page.click('.runner-mode-tab[data-mode="suite"]');
    await expect(page.locator('#runner-suite-mode')).toBeVisible();
    await page.click('.runner-mode-tab[data-mode="manual"]');
    failing = false;
    await page.click('#script-picker [data-act="retry"]');
    await expect(page.locator('.sp-file').first()).toBeVisible();
  });

  test('S6: from 20 files on a notice appears (no confirmation, no block); fewer shows none', async ({ page }) => {
    await page.route('**/api/run', (route) => route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ id: 'r', status: 'running', command: [], logs: [] }) }));
    await page.goto(harness.url);
    await page.waitForSelector('.sp-file');
    await page.fill('#sp-search', 'many');
    await expect(page.locator('.sp-file')).toHaveCount(22);
    await page.click('[data-act="select-found"]');
    await expect(page.locator('.sp-banner')).toContainText('Bạn đã chọn 22 script — chạy có thể mất lâu.');
    await expect(page.locator('#sp-run')).toBeEnabled();
    await page.click('#sp-body .sp-group [data-act="group"]'); // clear all again (mixed/true -> none)
    await expect(page.locator('.sp-banner')).toHaveCount(0);
  });

  test('S8: 409 shows the busy message inline and keeps the selection', async ({ page }) => {
    await page.route('**/api/run', (route) => route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'Đang có test run' }) }));
    await page.goto(harness.url);
    await page.waitForSelector('.sp-file');
    await row(page, ALPHA).click();
    await page.click('#sp-run');
    await expect(page.locator('#sp-foot [role="alert"]')).toHaveText('Đang có một test run khác. Chờ chạy xong hoặc bấm Dừng.');
    await expect(page.locator(`.sp-file[data-path="${ALPHA}"]`)).toHaveAttribute('aria-checked', 'true');
  });

  test('S10: a real 400 for a file deleted after the page loaded shows the server message and keeps the selection', async ({ page }) => {
    await page.goto(harness.url);
    await page.waitForSelector('.sp-file');
    const gone = 'tests/e2e/desktop/delete-me.spec.js';
    await row(page, gone).click();
    await row(page, ALPHA).click();
    fs.unlinkSync(path.join(fixture.rootPath, gone));
    await page.click('#sp-run');
    await expect(page.locator('#sp-foot [role="alert"]')).toContainText(`Chưa chạy được: Spec không hợp lệ: ${gone}`);
    await expect(page.locator('#sp-foot [role="alert"]')).toContainText('Lựa chọn của bạn vẫn còn');
    await expect(page.locator(`.sp-file[data-path="${ALPHA}"]`)).toHaveAttribute('aria-checked', 'true');
    await row(page, ALPHA).click(); // changing the selection clears the stale error
    await expect(page.locator('#sp-foot [role="alert"]')).toHaveCount(0);
  });
});
