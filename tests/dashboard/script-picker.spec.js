/**
 * tests/dashboard/script-picker.spec.js
 * Script Picker (Runner > Chọn script): the 4 scenarios, tri-state, accent-insensitive search, payload of
 * POST /api/run (specs[], projects[], tags[]), status panels and server errors. Isolated fixture workspace.
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { startDashboardHarness } = require('./support/dashboardHarness');
const { createPickerFixture } = require('./support/pickerFixture');

const ALPHA = 'tests/e2e/desktop/alpha.spec.js';
const DANG = 'tests/e2e/desktop/dang-nhap.spec.js';
const SPACE = 'tests/e2e/desktop/with space.spec.js';
const BETA = 'tests/e2e/mobile/beta.spec.js';
const GAMMA = 'tests/api/gamma.spec.js';
const row = (page, p) => page.locator(`.sp-file[data-path="${p}"] .sp-row`);
const item = (page, p) => page.locator(`.sp-file[data-path="${p}"]`);

test.describe('Script Picker', () => {
  let fixture; let harness;
  test.beforeAll(async () => { fixture = createPickerFixture(); harness = await startDashboardHarness(fixture.rootPath); });
  test.afterAll(async () => { if (harness) await harness.stop(); if (fixture) fixture.cleanup(); });

  async function open(page, { captureRun = true } = {}) {
    const run = { body: null, calls: 0 };
    if (captureRun) {
      await page.route('**/api/run', (route) => { run.calls += 1; run.body = route.request().postDataJSON(); return route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ id: 'r1', status: 'running', command: [], logs: [] }) }); });
    }
    await page.goto(harness.url);
    await page.waitForSelector('.sp-file');
    return run;
  }

  test('is the default mode, groups by folder and leaves out tests/dashboard', async ({ page }) => {
    await open(page);
    await expect(page.locator('.runner-mode-tab[data-mode="manual"]')).toHaveClass(/active/);
    await expect(page.locator('.runner-mode-tab[data-mode="manual"]')).toContainText('Chọn script');
    await expect(page.locator('.sp-group')).toHaveCount(3);
    await expect(page.locator('.sp-file')).toHaveCount(5);
    await expect(page.locator('#script-picker')).not.toContainText('internal.spec.js');
    await expect(page.locator('.sp-tree')).toHaveAttribute('role', 'tree');
    await expect(page.locator('#sp-run')).toBeDisabled();
    await expect(page.locator('.sp-reason')).toHaveText('Chọn ít nhất 1 script để chạy');
  });

  test('(a) one script: select it and run -> specs[] + its default project', async ({ page }) => {
    const run = await open(page);
    await row(page, ALPHA).click(); // 1 click
    await expect(page.locator('#sp-run')).toHaveText(/Chạy 1 script/);
    await expect(page.locator('.sp-summary')).toContainText('1 script');
    await page.click('#sp-run'); // 2 clicks
    await expect.poll(() => run.body).not.toBeNull();
    expect(run.body.specs).toEqual([ALPHA]);
    expect(run.body.spec).toBeUndefined();
    expect(run.body.projects).toEqual(['Desktop Smoke Tests']);
    expect(run.body.tags).toBeUndefined();
    expect(run.body.grep).toBeUndefined();
    test.info().annotations.push({ type: 'operations', description: '(a) 1 script = 2 clicks (select, run)' });
  });

  test('(b) a folder: the group checkbox selects its files; projects are the union of their defaults', async ({ page }) => {
    const run = await open(page);
    await page.locator('.sp-group[data-group="tests/e2e/desktop"] [data-act="group"]').click(); // 1
    await expect(page.locator('.sp-group[data-group="tests/e2e/desktop"]')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('.sp-summary')).toContainText('3 script');
    await expect(page.locator('.sp-summary')).toContainText('3 lượt chạy');
    await page.click('#sp-run'); // 2
    await expect.poll(() => run.body).not.toBeNull();
    expect(run.body.specs.sort()).toEqual([ALPHA, DANG, SPACE].sort());
    expect(run.body.projects.sort()).toEqual(['Desktop Regression Tests', 'Desktop Smoke Tests']);
    test.info().annotations.push({ type: 'operations', description: '(b) one folder = 2 clicks (group checkbox, run)' });
  });

  test('(c) by tag: chip -> "Chọn tất cả" -> run; the switch adds tags[] and never a grep string', async ({ page }) => {
    const run = await open(page);
    await page.click('.sp-chip[data-tag="@smoke"]'); // 1
    await expect(page.locator('.sp-file')).toHaveCount(2);
    await page.click('[data-act="select-found"]'); // 2
    await page.click('#sp-run'); // 3
    await expect.poll(() => run.body).not.toBeNull();
    expect(run.body.specs.sort()).toEqual([ALPHA, BETA].sort());
    expect(run.body.projects.sort()).toEqual(['Desktop Smoke Tests', 'Mobile Chrome Smoke Tests']); // Chrome only, not Safari
    expect(run.body.tags).toBeUndefined();
    test.info().annotations.push({ type: 'operations', description: '(c) by tag = 3 clicks (chip, select all, run)' });

    run.body = null;
    await expect(page.locator('#sp-tagonly')).not.toBeChecked();
    await expect(page.locator('#sp-top')).toContainText('Sẽ chạy toàn bộ test trong mỗi file');
    await page.check('#sp-tagonly');
    await expect(page.locator('.sp-summary')).toContainText('Chỉ test mang @smoke');
    await page.click('#sp-run');
    await expect.poll(() => run.body).not.toBeNull();
    expect(run.body.tags).toEqual(['@smoke']);
    expect(run.body.grep).toBeUndefined();
  });

  test('(d) states: nothing selected, no match, filters AND/OR, clear', async ({ page }) => {
    await open(page);
    await page.fill('#sp-search', 'zzzz');
    await expect(page.locator('#sp-count')).toHaveText('Không có script nào khớp');
    await expect(page.locator('#sp-body')).toContainText('Không có script nào khớp “zzzz”');
    await page.click('#sp-body [data-act="clear-filters"]');
    await expect(page.locator('.sp-file')).toHaveCount(5);
    await page.click('.sp-chip[data-platform="Desktop"]');
    await page.click('.sp-chip[data-platform="API"]'); // same group = OR
    await expect(page.locator('.sp-file')).toHaveCount(4);
    await page.click('.sp-chip[data-tag="@smoke"]'); // other group = AND
    await expect(page.locator('.sp-file')).toHaveCount(1);
    await expect(page.locator('#sp-body')).toContainText('alpha.spec.js');
    await page.click('#sp-results [data-act="clear-filters"]');
    await expect(page.locator('.sp-file')).toHaveCount(5);
  });

  test('tri-state group checkbox acts on visible children only', async ({ page }) => {
    await open(page);
    const group = page.locator('.sp-group[data-group="tests/e2e/desktop"]');
    await row(page, ALPHA).click();
    await expect(group).toHaveAttribute('aria-checked', 'mixed');
    await expect(group.locator('.sp-count')).toHaveText('1 / 3 đã chọn');
    await group.locator('[data-act="group"]').click(); // mixed -> all
    await expect(group).toHaveAttribute('aria-checked', 'true');
    await group.locator('[data-act="group"]').click(); // all -> none
    await expect(group).toHaveAttribute('aria-checked', 'false');
    await row(page, ALPHA).click();
    await page.fill('#sp-search', 'dang');
    await expect(page.locator('.sp-file')).toHaveCount(1);
    await expect(group.locator('.sp-count')).toHaveText('0 / 1 đang hiện');
    await group.locator('[data-act="group"]').click(); // only the visible child
    await expect(page.locator('.sp-summary')).toContainText('2 script (1 đang ẩn bởi bộ lọc)');
    await page.fill('#sp-search', '');
    await expect(group.locator('.sp-count')).toHaveText('2 / 3 đã chọn');
  });

  test('search ignores case and accents and matches name, path and tags', async ({ page }) => {
    await open(page);
    for (const [q, n] of [['đăng nhập', 1], ['DANG', 1], ['dang-nhap', 1], ['auth', 1], ['@auth', 1], ['e2e smoke', 2], ['mobile', 1], ['REQ-001', 0]]) {
      await page.fill('#sp-search', q);
      await expect(page.locator('.sp-file'), `query "${q}"`).toHaveCount(n);
    }
    await page.fill('#sp-search', 'dang');
    await expect(page.locator('.sp-fname mark')).toHaveText('dang');
    await page.keyboard.press('Escape');
    await expect(page.locator('#sp-search')).toHaveValue('');
    await expect(page.locator('.sp-file')).toHaveCount(5);
  });

  test('select everything sends spec:"all"', async ({ page }) => {
    const run = await open(page);
    await page.click('[data-act="select-found"]');
    await expect(page.locator('#sp-run')).toHaveText(/Chạy 5 script/);
    await page.click('#sp-run');
    await expect.poll(() => run.body).not.toBeNull();
    expect(run.body.spec).toBe('all');
    expect(run.body.specs).toBeUndefined();
    expect(run.body.projects).toBeDefined();
  });

  test('a file with two device families says which one is chosen and lets you change it', async ({ page }) => {
    const run = await open(page);
    await row(page, BETA).click();
    await expect(page.locator('#sp-foot')).toContainText('beta.spec.js chạy được trên 2 thiết bị; đang chọn Mobile Chrome.');
    await page.click('#sp-foot [data-act="open-projects"]');
    await page.click('.sp-projlist [data-project="Mobile Safari Smoke Tests"]');
    await page.click('#sp-run');
    await expect.poll(() => run.body).not.toBeNull();
    expect(run.body.projects).toEqual(['Mobile Safari Smoke Tests']);
  });

  test('the right-hand plan follows the selection and "Xem lệnh" shows the command', async ({ page }) => {
    await open(page);
    await row(page, ALPHA).click();
    await row(page, GAMMA).click();
    await expect(page.locator('#execution-plan-count')).toHaveText('2 script');
    await expect(page.locator('#execution-plan-list')).toContainText('alpha.spec.js');
    await page.click('.sp-cmd summary');
    await expect(page.locator('.sp-cmd pre')).toContainText(`npx playwright test ${GAMMA} ${ALPHA}`);
    await expect(page.locator('.sp-cmd pre')).toContainText('--project="Desktop Smoke Tests"');
  });

  test('keyboard: roving tabindex, arrows, space/enter, ctrl+A, esc to search, "/" to focus search', async ({ page }) => {
    await open(page);
    expect(await page.locator('#sp-body [tabindex="0"]').count()).toBe(1);
    await page.locator('#sp-body [tabindex="0"]').focus();
    await expect(page.locator('.sp-group').first()).toBeFocused();
    await page.keyboard.press('ArrowDown'); // group 2 (api has 1 file, open) -> first file of group 1
    await expect(item(page, GAMMA)).toBeFocused();
    await page.keyboard.press('ArrowLeft'); // file -> parent group
    await expect(page.locator('.sp-group').first()).toBeFocused();
    await page.keyboard.press('ArrowLeft'); // open group -> close
    await expect(page.locator('.sp-group').first()).toHaveAttribute('aria-expanded', 'false');
    await page.keyboard.press('ArrowRight'); // closed -> open
    await expect(page.locator('.sp-group').first()).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('ArrowRight'); // open -> first child
    await expect(item(page, GAMMA)).toBeFocused();
    await page.keyboard.press(' ');
    await expect(item(page, GAMMA)).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('Enter'); // Enter on a file toggles, never runs
    await expect(item(page, GAMMA)).toHaveAttribute('aria-checked', 'false');
    await page.keyboard.press('End');
    await expect(item(page, BETA)).toBeFocused();
    await page.keyboard.press('Home');
    await expect(page.locator('.sp-group').first()).toBeFocused();
    await page.keyboard.press('Control+a');
    await expect(page.locator('.sp-summary')).toContainText('5 script (tất cả file)');
    expect(await page.locator('#sp-body [tabindex="0"]').count()).toBe(1);
    await page.keyboard.press('Escape');
    await expect(page.locator('#sp-search')).toBeFocused();
    await page.locator('#sp-body [tabindex="0"]').focus();
    await page.evaluate(() => document.activeElement.blur());
    await page.keyboard.press('/');
    await expect(page.locator('#sp-search')).toBeFocused();
  });

  test('Ctrl+Enter runs when enabled', async ({ page }) => {
    const run = await open(page);
    await row(page, ALPHA).click();
    await page.locator(`.sp-file[data-path="${ALPHA}"]`).focus();
    await page.keyboard.press('Control+Enter');
    await expect.poll(() => run.body).not.toBeNull();
    expect(run.body.specs).toEqual([ALPHA]);
  });
});
