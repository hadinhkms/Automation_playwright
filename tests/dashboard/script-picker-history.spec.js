/**
 * tests/dashboard/script-picker-history.spec.js
 * Script Picker phase 2b: "Fail lần trước" / "Chạy gần đây" chips, per-file status badges, history states
 * (none, error, nothing failed), refresh after the picker's run ends, and the old run button really disabled.
 * History comes from a REAL test-results/web-runs/index.json read by the server (CONTRACT-run-history schema).
 */
const { test, expect } = require('@playwright/test');
const { startDashboardHarness } = require('./support/dashboardHarness');
const { createPickerFixture, historyRun } = require('./support/pickerFixture');

const ALPHA = 'tests/e2e/desktop/alpha.spec.js';
const DANG = 'tests/e2e/desktop/dang-nhap.spec.js';
const GAMMA = 'tests/api/gamma.spec.js';
const BETA = 'tests/e2e/mobile/beta.spec.js';
const GONE = 'tests/e2e/desktop/gone.spec.js';
const file = (f, status) => ({ file: f, status, passed: status === 'passed' ? 1 : 0, failed: status === 'failed' ? 1 : 0, flaky: 0, skipped: 0, durationMs: 10 });
const HISTORY = [
  historyRun({ id: 'r1', minutesAgo: 5, status: 'passed', specs: [GAMMA], projects: ['API Tests'], files: [file(GAMMA, 'passed')] }),
  historyRun({ id: 'r2', minutesAgo: 60, status: 'failed', specs: [ALPHA, DANG, GONE], projects: ['Desktop Smoke Tests'], files: [file(ALPHA, 'failed'), file(DANG, 'failed'), file(GONE, 'failed')] }),
  historyRun({ id: 'r3', minutesAgo: 1500, status: 'passed', specs: [DANG], projects: ['Desktop Regression Tests'], tags: ['@e2e'], files: [file(DANG, 'passed')] }),
];
const row = (page, p) => page.locator(`.sp-file[data-path="${p}"] .sp-row`);
const RUN = { id: 'rx', status: 'running', command: 'npx playwright test', logs: [], startedAt: new Date().toISOString(), options: { environment: 'qc', project: 'all' } };

async function withHarness(extra, fn) {
  const fixture = createPickerFixture(extra);
  const harness = await startDashboardHarness(fixture.rootPath);
  try { await fn(harness); } finally { await harness.stop(); fixture.cleanup(); }
}
const open = async (page, harness) => { await page.goto(harness.url); await page.waitForSelector('.sp-file'); };

test.describe('Script Picker: run history', () => {
  test('"Fail lần trước (N)" replaces the selection with the failed files, reports deleted ones, undo restores; 2 clicks to re-run', async ({ page }) => {
    await withHarness({ history: HISTORY }, async (harness) => {
      let body = null;
      await page.route('**/api/run', (route) => { body = route.request().postDataJSON(); return route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify(RUN) }); });
      await open(page, harness);
      await row(page, BETA).click(); // something selected first: the chip must REPLACE it
      const chip = page.locator('[data-history="fail"]');
      await expect(chip).toContainText('Fail lần trước (2)');
      await chip.click(); // click 1
      await expect(page.locator('.sp-file[aria-checked="true"]')).toHaveCount(2);
      await expect(page.locator(`.sp-file[data-path="${ALPHA}"]`)).toHaveAttribute('aria-checked', 'true');
      await expect(page.locator(`.sp-file[data-path="${BETA}"]`)).toHaveAttribute('aria-checked', 'false');
      await expect(page.locator('#sp-top .sp-banner')).toHaveText(/Đã chọn 2 script từ “Fail lần trước”\. 1 file đã bị xoá khỏi dự án\. Hoàn tác/);
      await page.click('#sp-run'); // click 2
      await expect.poll(() => body).not.toBeNull();
      expect(body.specs.sort()).toEqual([ALPHA, DANG].sort());
      expect(body.projects).toEqual(['Desktop Smoke Tests']);
      test.info().annotations.push({ type: 'operations', description: '(d) re-run what failed = 2 clicks (Fail lần trước, Chạy)' });
      await page.click('[data-act="undo"]');
      await expect(page.locator(`.sp-file[data-path="${BETA}"]`)).toHaveAttribute('aria-checked', 'true');
      await expect(page.locator('.sp-file[aria-checked="true"]')).toHaveCount(1);
    });
  });

  test('"Chạy gần đây" lists distinct recent runs and reloads one (files, projects, tags)', async ({ page }) => {
    await withHarness({ history: HISTORY }, async (harness) => {
      await open(page, harness);
      await page.click('.sp-recent summary');
      const items = page.locator('.sp-recent-item');
      await expect(items).toHaveCount(3);
      await expect(items.nth(0)).toContainText('5 phút trước · 1 script · 0 fail');
      await expect(items.nth(1)).toContainText('1 giờ trước · 3 script · 3 fail');
      await items.nth(2).click(); // r3: DANG with tag @e2e
      await expect(page.locator('.sp-file[aria-checked="true"]')).toHaveCount(1);
      await expect(page.locator(`.sp-file[data-path="${DANG}"]`)).toHaveAttribute('aria-checked', 'true');
      await expect(page.locator('.sp-chip[data-tag="@e2e"]')).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('#sp-tagonly')).toBeChecked();
    });
  });

  test('file rows show status with icon AND words (Fail / Pass / Chưa chạy) and the same text in the accessible name', async ({ page }) => {
    await withHarness({ history: HISTORY }, async (harness) => {
      await open(page, harness);
      const fail = page.locator(`.sp-file[data-path="${ALPHA}"] .sp-hist`);
      await expect(fail).toHaveClass(/sp-hist-fail/);
      await expect(fail).toContainText('Fail 1 giờ trước');
      await expect(fail.locator('i.ph-x')).toHaveCount(1);
      await expect(page.locator(`.sp-file[data-path="${GAMMA}"] .sp-hist`)).toContainText('Pass 5 phút trước');
      await expect(page.locator(`.sp-file[data-path="${BETA}"] .sp-hist`)).toHaveText('Chưa chạy');
      await expect(page.locator(`.sp-file[data-path="${ALPHA}"]`)).toHaveAttribute('aria-label', /Fail 1 giờ trước/);
    });
  });

  test('S5: no history -> both chips disabled with the reason as text', async ({ page }) => {
    await withHarness({}, async (harness) => {
      await open(page, harness);
      await expect(page.locator('[data-history="fail"]')).toBeDisabled();
      await expect(page.locator('[data-history="fail"]')).toHaveAttribute('aria-disabled', 'true');
      await expect(page.locator('[data-history="recent"]')).toBeDisabled();
      await expect(page.locator('#sp-top')).toContainText('Chưa có lịch sử chạy. Chạy một lần để thấy “Fail lần trước” và “Gần đây”.');
    });
  });

  test('S5c: history without failures -> "Fail lần trước (0)" disabled with the reason', async ({ page }) => {
    await withHarness({ history: [HISTORY[0], HISTORY[2]] }, async (harness) => {
      await open(page, harness);
      await expect(page.locator('[data-history="fail"]')).toContainText('Fail lần trước (0)');
      await expect(page.locator('[data-history="fail"]')).toBeDisabled();
      await expect(page.locator('#sp-top')).toContainText('Lần chạy trước không có script nào fail.');
      await expect(page.locator('.sp-recent summary')).toBeVisible();
    });
  });

  test('S5b: a history error does not block the tree; Thử lại reloads it', async ({ page }) => {
    await withHarness({ history: HISTORY }, async (harness) => {
      let failing = true;
      await page.route('**/api/run-history/latest-failed', (route) => (failing ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'boom' }) }) : route.continue()));
      await open(page, harness);
      await expect(page.locator('#sp-top .sp-warn')).toContainText('Không tải được lịch sử chạy.');
      await expect(page.locator('[data-history="fail"]')).toBeDisabled();
      await row(page, ALPHA).click(); // the tree still works
      await expect(page.locator('#sp-run')).toHaveText(/Chạy 1 script/);
      failing = false;
      await page.click('[data-act="history-retry"]');
      await expect(page.locator('[data-history="fail"]')).toContainText('Fail lần trước (2)');
      await expect(page.locator('[data-history="fail"]')).toBeEnabled();
    });
  });

  test('history refreshes after the picker\'s run ends', async ({ page }) => {
    await withHarness({ history: HISTORY }, async (harness) => {
      await page.route('**/api/run', (route) => route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify(RUN) }));
      let after = false;
      await page.route('**/api/run-history/latest-failed', (route) => (after ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ run: { id: 'r9', startedAt: new Date().toISOString(), environment: 'qc', projects: [] }, specs: [GAMMA], missing: [] }) }) : route.continue()));
      await open(page, harness);
      await expect(page.locator('[data-history="fail"]')).toContainText('(2)');
      await row(page, ALPHA).click();
      await page.click('#sp-run');
      await expect(page.locator('#stop-button')).toBeEnabled();
      after = true;
      await page.evaluate(() => { document.querySelector('#stop-button').disabled = true; });
      await expect(page.locator('[data-history="fail"]')).toContainText('Fail lần trước (1)');
    });
  });

  test('the old run button is really out of service while the picker shows (0 run-everything requests), and back in suite mode', async ({ page }) => {
    await withHarness({ history: HISTORY }, async (harness) => {
      const calls = [];
      page.on('request', (r) => { if (/\/api\/(run|ui)$/.test(r.url()) && r.method() === 'POST') calls.push(r.postData()); });
      await page.route('**/api/run', (route) => route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify(RUN) }));
      await open(page, harness);
      const old = page.locator('#run-button');
      await expect(old).toBeDisabled();
      await expect(old).toHaveAttribute('aria-hidden', 'true');
      await expect(old).toHaveAttribute('tabindex', '-1');
      await page.evaluate(() => { const b = document.getElementById('run-button'); b.click(); b.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); b.disabled = false; b.click(); }); // even if re-enabled by a script
      await page.focus('#workers'); await page.keyboard.press('Enter'); // empty selection
      await page.click('#ui-button');
      await page.waitForTimeout(400);
      expect(calls).toEqual([]);
      await expect(page.locator('#toast')).toContainText('Chọn ít nhất 1 script để chạy');
      await page.click('.runner-mode-tab[data-mode="suite"]');
      await expect(old).toBeEnabled();
      await expect(old).not.toHaveAttribute('aria-hidden', 'true');
      await page.click('.runner-mode-tab[data-mode="manual"]');
      await expect(old).toBeDisabled();
    });
  });
});
