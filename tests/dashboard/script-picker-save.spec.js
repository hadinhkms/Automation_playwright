/**
 * tests/dashboard/script-picker-save.spec.js
 * Script Picker phase 3: "Lưu thành suite…" - success, validation, duplicate key (also created meanwhile),
 * revision/409 retry, user labels escaped, the one-project rule, and the dialog at phone width.
 */
const { test, expect } = require('@playwright/test');
const { startDashboardHarness } = require('./support/dashboardHarness');
const { createPickerFixture } = require('./support/pickerFixture');

const ALPHA = 'tests/e2e/desktop/alpha.spec.js';
const DANG = 'tests/e2e/desktop/dang-nhap.spec.js';
const row = (page, p) => page.locator(`.sp-file[data-path="${p}"] .sp-row`);
const settings = async (h) => (await fetch(`${h.url}/api/settings`)).json();
const EXISTING = { label: 'Smoke', description: '', type: 'single', platform: 'desktop', project: 'Desktop Smoke Tests', device: '', viewport: { preset: 'default', width: 1920, height: 1080 }, specs: [ALPHA], spec: ALPHA, grep: '', workers: 2 };

test.describe('Script Picker: save as suite', () => {
  let fixture; let harness;
  test.beforeEach(async () => { fixture = createPickerFixture({ suites: { smoke: EXISTING } }); harness = await startDashboardHarness(fixture.rootPath); });
  test.afterEach(async () => { await harness.stop(); fixture.cleanup(); });

  const open = async (page) => { await page.goto(harness.url); await page.waitForSelector('.sp-file'); };
  const openDialog = async (page) => { await page.click('#sp-save'); await expect(page.locator('#sp-save-dialog')).toBeVisible(); };

  test('saves the selection (files, project, tags as regex) and the new suite becomes a chip that reloads it', async ({ page }) => {
    await open(page);
    await row(page, ALPHA).click();
    await page.click('.sp-chip[data-tag="@smoke"]');
    await page.check('#sp-tagonly');
    await openDialog(page);
    await expect(page.locator('#sp-save-dialog')).toContainText('Gồm 1 script · Desktop Smoke Tests · @smoke');
    await expect(page.locator('#sp-save-dialog')).toContainText('Lưu vào cấu hình của máy này; chưa đẩy lên Git.');
    await page.fill('#sp-suite-name', 'Smoke nhanh');
    await expect(page.locator('#sp-suite-key')).toHaveValue('smoke-nhanh');
    await page.fill('#sp-suite-desc', 'Tạo từ bộ chọn');
    await page.click('#sp-save-submit');
    await expect(page.locator('#sp-save-dialog')).toHaveCount(0);
    await expect(page.locator('#sp-foot .sp-banner')).toContainText('Đã lưu suite “Smoke nhanh”. Suite này mới nằm trong cấu hình máy này — dùng Đồng bộ Git nếu muốn chia sẻ.');
    await expect(page.locator('#sp-run')).toBeFocused();
    await expect(page.locator('.sp-chip[data-suite="smoke-nhanh"]')).toContainText('Suite: Smoke nhanh (1)');
    const saved = (await settings(harness)).suites['smoke-nhanh'];
    expect(saved).toMatchObject({ label: 'Smoke nhanh', description: 'Tạo từ bộ chọn', type: 'single', platform: 'desktop', project: 'Desktop Smoke Tests', specs: [ALPHA], spec: ALPHA, grep: '(?:@smoke)(?![\\w-])' });
    expect((await settings(harness)).suites.smoke.label).toBe('Smoke'); // the existing suite is untouched
    await row(page, ALPHA).click(); // deselect, then the chip reloads files + tag switch
    await page.click('.sp-chip[data-suite="smoke-nhanh"]');
    await expect(page.locator(`.sp-file[data-path="${ALPHA}"]`)).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('#sp-tagonly')).toBeChecked();
  });

  test('validation: empty name, bad key, taken key (kept inline, nothing saved)', async ({ page }) => {
    await open(page);
    await row(page, ALPHA).click();
    await openDialog(page);
    await page.click('#sp-save-submit');
    await expect(page.locator('#sp-name-error')).toHaveText('Nhập tên suite (tối đa 50 ký tự).');
    await page.fill('#sp-suite-name', 'Một tên');
    await page.fill('#sp-suite-key', 'Bad Key!');
    await page.click('#sp-save-submit');
    await expect(page.locator('#sp-key-error')).toHaveText('Mã chỉ gồm chữ thường, số và dấu gạch ngang.');
    await page.fill('#sp-suite-name', 'Smoke'); // key stays touched; set it to an existing one
    await page.fill('#sp-suite-key', 'smoke');
    await page.click('#sp-save-submit');
    await expect(page.locator('#sp-key-error')).toHaveText('Mã “smoke” đã dùng. Đổi mã hoặc chọn tên khác.');
    await expect(page.locator('#sp-save-dialog')).toBeVisible();
    await expect(page.locator('#sp-suite-name')).toHaveValue('Smoke');
    expect(Object.keys((await settings(harness)).suites)).toEqual(['smoke']);
  });

  test('a key taken by someone else after the dialog opened is refused; their other change is not lost', async ({ page }) => {
    await open(page);
    await row(page, ALPHA).click();
    await openDialog(page);
    await page.fill('#sp-suite-name', 'Race');
    const cur = await settings(harness);
    const put = await fetch(`${harness.url}/api/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ suites: { ...cur.suites, race: { ...EXISTING, label: 'Other tab' }, extra: { ...EXISTING, label: 'Extra' } }, baseRevision: cur.revision }) });
    expect(put.status).toBe(200);
    await page.click('#sp-save-submit');
    await expect(page.locator('#sp-key-error')).toContainText('Mã “race” đã dùng');
    await page.fill('#sp-suite-key', 'race-2');
    await page.click('#sp-save-submit');
    await expect(page.locator('#sp-save-dialog')).toHaveCount(0);
    const suites = (await settings(harness)).suites;
    expect(Object.keys(suites).sort()).toEqual(['extra', 'race', 'race-2', 'smoke']);
    expect(suites.race.label).toBe('Other tab');
  });

  test('409: one automatic retry after a fresh read succeeds without the global conflict banner', async ({ page }) => {
    let puts = 0;
    await page.route('**/api/settings', (route) => {
      if (route.request().method() !== 'PUT') return route.continue();
      puts += 1;
      return puts === 1 ? route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ ok: false, code: 'CONFIG_CONFLICT', error: 'Cấu hình đã được thay đổi ở nơi khác.', revision: 'x' }) }) : route.continue();
    });
    await open(page);
    await row(page, ALPHA).click();
    await openDialog(page);
    await page.fill('#sp-suite-name', 'Retry ok');
    await page.click('#sp-save-submit');
    await expect(page.locator('#sp-save-dialog')).toHaveCount(0);
    expect(puts).toBe(2);
    expect((await settings(harness)).suites['retry-ok']).toBeDefined();
    await expect(page.locator('#settings-conflict-banner')).toBeHidden();
  });

  test('409 twice: a clear message, the typed data and the selection are kept, nothing saved', async ({ page }) => {
    await page.route('**/api/settings', (route) => (route.request().method() === 'PUT' ? route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ ok: false, code: 'CONFIG_CONFLICT', error: 'x', revision: 'x' }) }) : route.continue()));
    await open(page);
    await row(page, ALPHA).click();
    await openDialog(page);
    await page.fill('#sp-suite-name', 'Never saved');
    await page.fill('#sp-suite-desc', 'keep me');
    await page.click('#sp-save-submit');
    await expect(page.locator('#sp-save-error')).toHaveText('Cấu hình đã đổi ở nơi khác nên chưa lưu. Dữ liệu bạn nhập vẫn còn — thử lại.');
    await expect(page.locator('#sp-suite-name')).toHaveValue('Never saved');
    await expect(page.locator('#sp-suite-desc')).toHaveValue('keep me');
    await expect(page.locator('#sp-save-submit')).toBeEnabled();
    await page.click('#sp-save-cancel');
    await expect(page.locator(`.sp-file[data-path="${ALPHA}"]`)).toHaveAttribute('aria-checked', 'true');
    expect(Object.keys((await settings(harness)).suites)).toEqual(['smoke']);
  });

  test('a malicious label is stored and shown as text everywhere (chip, notice, dialog)', async ({ page }) => {
    const evil = '<img src=x onerror="window.__xss=1">';
    await open(page);
    await row(page, ALPHA).click();
    await openDialog(page);
    await page.fill('#sp-suite-name', evil);
    await page.click('#sp-save-submit');
    await expect(page.locator('#sp-foot .sp-banner')).toContainText(evil);
    await expect(page.locator('.sp-chip[data-suite]').last()).toContainText(evil);
    expect(await page.locator('#script-picker img').count()).toBe(0);
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();
    expect(Object.values((await settings(harness)).suites).map((s) => s.label)).toContain(evil);
  });

  test('two projects cannot be saved (one-project schema): button disabled with the reason; picking one enables it; "everything" saves specs:"all"', async ({ page }) => {
    await open(page);
    await row(page, ALPHA).click(); await row(page, DANG).click(); // Smoke + Regression
    await expect(page.locator('#sp-save')).toBeDisabled();
    await expect(page.locator('#sp-foot')).toContainText('Chọn đúng 1 nền tảng (project) để lưu thành suite.');
    await page.click('#sp-foot [data-act="open-projects"]');
    await page.click('.sp-projlist [data-project="Desktop Smoke Tests"]');
    await expect(page.locator('#sp-save')).toBeEnabled();
    await page.click('[data-act="select-found"]'); // everything, still one project
    await openDialog(page);
    await page.fill('#sp-suite-name', 'Tất cả');
    await page.click('#sp-save-submit');
    await expect(page.locator('#sp-save-dialog')).toHaveCount(0);
    expect((await settings(harness)).suites['tat-ca']).toMatchObject({ specs: 'all', spec: 'all', project: 'Desktop Smoke Tests' });
  });

  test('the dialog fits a phone: no overflow, buttons reachable, Esc returns focus to the opener', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 700 });
    await open(page);
    await row(page, ALPHA).click();
    await openDialog(page);
    const o = await page.evaluate(() => { const r = document.querySelector('#sp-save-dialog').getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, doc: document.documentElement.scrollWidth - innerWidth }; });
    expect(o.left).toBeGreaterThanOrEqual(0);
    expect(o.right).toBeLessThanOrEqual(390);
    expect(o.doc).toBeLessThanOrEqual(0);
    await expect(page.locator('#sp-save-submit')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#sp-save-dialog')).toHaveCount(0);
    await expect(page.locator('#sp-save')).toBeFocused();
  });
});
