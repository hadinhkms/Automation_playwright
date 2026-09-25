/**
 * tests/dashboard/qa-batch-fixer.spec.js
 * Sửa static finding (PLAN-18) chạy thật qua UI + server + scanner + file trên đĩa (LIFE-01):
 * route và selection, xem trước / áp dụng / hoàn tác, file đổi giữa chừng, hoàn tác khi đang
 * quét lại, sửa một dòng không gọi AI, modal chi tiết.
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { startDashboardHarness } = require('./support/dashboardHarness');
const { createFixtureWorkspace } = require('./support/fixtureWorkspace');
const { LOGIN, prepareFixture, openFindings, waitScanDone, rowAt, read, watchErrors } = require('./support/batchE2e');

test.describe('QA: sửa static finding hàng loạt (PLAN-18)', () => {
  test.describe.configure({ timeout: 90_000 });
  let fixture;
  let harness;
  let errors;
  let original;

  test.beforeAll(async () => {
    fixture = createFixtureWorkspace();
    harness = await startDashboardHarness(fixture.rootPath);
  });

  test.afterAll(async () => {
    if (harness) await harness.stop();
    if (fixture) fixture.cleanup();
  });

  test.beforeEach(async ({ page }) => {
    await prepareFixture(fixture.rootPath, harness.url);
    original = read(fixture.rootPath, LOGIN);
    // 409 của batch là phản hồi hợp đồng mà test "file đổi giữa chừng" cố ý gây ra.
    errors = watchErrors(page, (res) => res.status() === 409 && res.url().includes('/api/qa/finding/'));
  });

  test.afterEach(async () => {
    expect(errors(), errors().join('\n')).toEqual([]);
  });

  const check = (page, where) => rowAt(page, where).locator('.qa-finding-checkbox');

  test('dòng theo route, checkbox tổng tri-state, mục ẩn, chip A-B-A, selection qua làm mới (BATCH-29, 30, 31)', async ({ page }) => {
    await openFindings(page, harness.url);
    await expect(page.locator('.qa-static-gap-row')).toHaveCount(7);
    await expect(page.locator('.qa-finding-checkbox')).toHaveCount(6);
    await expect(rowAt(page, `${LOGIN}:15`).locator('.qa-finding-checkbox')).toHaveCount(1);
    await expect(page.locator('[data-batch-filter="guided"] [data-count]')).toHaveText('1');
    const manual = rowAt(page, `${LOGIN}:21`, 'spec-thieu-assertion');
    await expect(manual.locator('.qa-finding-checkbox')).toHaveCount(0);
    await expect(manual.getByRole('button', { name: 'Xem hướng dẫn' })).toBeVisible();
    await expect(rowAt(page, `${LOGIN}:6`).getByRole('button', { name: 'Sửa lỗi' })).toBeVisible();
    await expect(rowAt(page, `${LOGIN}:6`).locator('.qa-gap-dup')).toHaveText('×2 project');

    const master = page.locator('#qa-batch-master');
    const count = page.locator('#qa-batch-count');
    await master.check();
    await expect(count).toHaveText('6 đã chọn');
    await check(page, `${LOGIN}:7`).uncheck();
    expect(await master.evaluate((el) => el.indeterminate)).toBe(true);
    await master.click();
    await expect(count).toHaveText('6 đã chọn');
    await master.click();
    await expect(count).toHaveText('0 đã chọn');

    await check(page, `${LOGIN}:6`).check();
    await check(page, `${LOGIN}:11`).check();
    await page.locator('[data-batch-filter="manual"]').click();
    await expect(page.locator('.qa-static-gap-row')).toHaveCount(1);
    await expect(master).toBeDisabled();
    await expect(page.locator('#qa-batch-hidden')).toHaveText('2 đang ẩn');
    await expect(page.locator('#qa-batch-preview span')).toHaveText('Xem trước & sửa (2)');

    for (const filter of ['quick', 'manual', 'quick']) await page.locator(`[data-batch-filter="${filter}"]`).click();
    await expect(page.locator('[data-batch-filter="quick"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.qa-static-gap-row')).toHaveCount(5);

    await page.evaluate(async () => (await import('/js/views/qa/qaSlice.js')).qaSlice.reload(true));
    await waitScanDone(page);
    await expect(check(page, `${LOGIN}:6`)).toBeChecked();
    await expect(count).toHaveText('2 đã chọn');
  });

  test('xem trước → bỏ tick → kích hoạt lại → Esc hỏi xác nhận → áp dụng đúng 1 request → quét lại → hoàn tác (BATCH-32, 33, 35)', async ({ page }) => {
    await openFindings(page, harness.url);
    for (const line of [6, 7, 11]) await check(page, `${LOGIN}:${line}`).check();
    await page.locator('#qa-batch-preview').click();
    const modal = page.locator('#qa-batch-modal');
    const apply = page.locator('#qa-batch-modal-apply');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.qa-batch-card')).toHaveCount(1);
    await expect(modal.locator('.qa-batch-patch')).toHaveCount(3);
    await expect(apply).toHaveText('Áp dụng 3 bản vá (1 file)');

    await modal.locator('.qa-batch-patch', { hasText: 'dòng 7' }).locator('input[type=checkbox]').uncheck();
    await modal.getByRole('radio', { name: 'Kích hoạt lại' }).check();
    await expect(modal.locator('.qa-badge', { hasText: 'Đổi hành vi' })).toBeVisible();
    await expect(apply).toHaveText('Áp dụng 2 bản vá (1 file)');

    await page.keyboard.press('Escape');
    const confirm = page.locator('#qa-batch-confirm');
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: 'Ở lại' }).click();
    await expect(modal).toBeVisible();

    const applyRequests = [];
    page.on('request', (r) => { if (r.url().endsWith('/api/qa/finding/batch-apply')) applyRequests.push(r.url()); });
    await apply.dblclick();
    await expect(modal).toBeHidden();
    expect(applyRequests).toHaveLength(1);

    const bar = page.locator('#qa-batch-result-bar');
    await expect(bar).toContainText('Đã áp dụng 2 bản vá trên 1 file.');
    await expect(bar).toContainText('Quét lại: đã xử lý 2 · còn 0 · phát sinh mới 0', { timeout: 20_000 });
    const lines = read(fixture.rootPath, LOGIN).split('\n');
    expect(lines[5]).toBe("    await expect(page.locator('#home')).toBeVisible();");
    expect(lines[6]).toBe("    expect(page.locator('#home')).toBeVisible();");
    expect(lines[10]).toBe("  test('TC-003 - AC-003 chặn trang riêng', async ({ page }) => {");
    await waitScanDone(page);
    await expect(rowAt(page, `${LOGIN}:6`)).toHaveCount(0);
    await expect(check(page, `${LOGIN}:7`)).toBeChecked();

    await page.locator('#qa-batch-result-close').click();
    await page.locator('#qa-batch-undo-last').click();
    await expect(bar).toContainText('Đã hoàn tác batch');
    expect(read(fixture.rootPath, LOGIN)).toBe(original);
    await waitScanDone(page);
    await expect(check(page, `${LOGIN}:6`)).toBeChecked();
  });

  test('đổi cách xử lý khi batch-input đang chờ: modal khoá, bản vá đã bỏ tick vẫn giữ, đóng thì hỏi và không ghi file (BATCH-33)', async ({ page }) => {
    await openFindings(page, harness.url);
    for (const line of [6, 7, 11]) await check(page, `${LOGIN}:${line}`).check();
    await page.locator('#qa-batch-preview').click();
    const modal = page.locator('#qa-batch-modal');
    const apply = page.locator('#qa-batch-modal-apply');
    const line7 = modal.locator('.qa-batch-patch', { hasText: 'dòng 7' }).locator('input[type=checkbox]');
    await line7.uncheck();

    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    await page.route('**/api/qa/finding/batch-input', async (route) => {
      await gate;
      await route.continue();
    });
    await modal.getByRole('radio', { name: 'Kích hoạt lại' }).check();
    await expect(apply).toBeDisabled();
    await expect(line7).toBeDisabled();
    const response = page.waitForResponse('**/api/qa/finding/batch-input');
    release();
    expect((await response).status()).toBe(200);

    await expect(modal.locator('.qa-badge', { hasText: 'Đổi hành vi' })).toBeVisible();
    await expect(line7).toBeEnabled();
    await expect(line7).not.toBeChecked();
    await expect(apply).toHaveText('Áp dụng 2 bản vá (1 file)');

    await page.keyboard.press('Escape');
    const confirm = page.locator('#qa-batch-confirm');
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: 'Bỏ và đóng' }).click();
    await expect(modal).toBeHidden();
    expect(read(fixture.rootPath, LOGIN)).toBe(original);
  });

  test('file đổi sau khi xem trước: báo lỗi kèm file, lập lại kế hoạch rồi áp dụng được (BATCH-34)', async ({ page }) => {
    await openFindings(page, harness.url);
    await rowAt(page, `${LOGIN}:6`).getByRole('button', { name: 'Sửa lỗi' }).click();
    const modal = page.locator('#qa-batch-modal');
    await expect(modal.locator('.qa-batch-patch')).toHaveCount(1);
    fs.writeFileSync(path.join(fixture.rootPath, LOGIN), `${original}// sửa tay\n`, 'utf8');
    await page.locator('#qa-batch-modal-apply').click();
    const error = page.locator('#qa-batch-modal-error');
    await expect(error).toContainText('File đã thay đổi');
    await expect(error).toContainText(LOGIN);
    await error.getByRole('button', { name: 'Lập lại kế hoạch' }).click();
    await expect(error).toBeHidden();
    await page.locator('#qa-batch-modal-apply').click();
    await expect(modal).toBeHidden();
    const content = read(fixture.rootPath, LOGIN);
    expect(content).toContain("    await expect(page.locator('#home')).toBeVisible();");
    expect(content).toContain('// sửa tay');
    await waitScanDone(page);
  });

  test('áp dụng rồi hoàn tác ngay khi đang quét lại: file và danh sách về đúng trạng thái cuối (BATCH-36)', async ({ page }) => {
    await openFindings(page, harness.url);
    await rowAt(page, `${LOGIN}:6`).getByRole('button', { name: 'Sửa lỗi' }).click();
    await page.locator('#qa-batch-modal-apply').click();
    const bar = page.locator('#qa-batch-result-bar');
    await expect(bar).toContainText('Đã áp dụng 1 bản vá');
    await page.locator('#qa-batch-result-undo').click();
    await expect(bar).toContainText('Đã hoàn tác batch', { timeout: 20_000 });
    expect(read(fixture.rootPath, LOGIN)).toBe(original);
    await waitScanDone(page);
    await expect(page.locator('.qa-static-gap-row')).toHaveCount(7);
    await expect(rowAt(page, `${LOGIN}:6`)).toHaveCount(1);
  });

  test('"Sửa lỗi" trên một dòng: đúng một bản vá, không gọi AI, hoàn tác về nguyên trạng (BATCH-44)', async ({ page }) => {
    await openFindings(page, harness.url);
    const aiCalls = [];
    page.on('request', (r) => {
      if (/ai-analyze-fix|apply-fix/.test(r.url()) || (r.method() === 'POST' && /\/api\/ai\//.test(r.url()))) aiCalls.push(r.url());
    });
    await rowAt(page, `${LOGIN}:11`).getByRole('button', { name: 'Sửa lỗi' }).click();
    const modal = page.locator('#qa-batch-modal');
    await expect(modal.locator('.qa-batch-card')).toHaveCount(1);
    await expect(modal.locator('.qa-batch-patch')).toHaveCount(1);
    await expect(modal.locator('.qa-diff-row.is-add')).toContainText("test.skip('TC-003 - AC-003 chặn trang riêng @wip'");
    await page.locator('#qa-batch-modal-apply').click();
    await expect(modal).toBeHidden();
    const before = original.split('\n');
    const changed = read(fixture.rootPath, LOGIN).split('\n').filter((line, i) => line !== before[i]);
    expect(changed).toEqual(["  test.skip('TC-003 - AC-003 chặn trang riêng @wip', async ({ page }) => {"]);
    await page.locator('#qa-batch-result-undo').click();
    await expect(page.locator('#qa-batch-result-bar')).toContainText('Đã hoàn tác batch', { timeout: 20_000 });
    expect(read(fixture.rootPath, LOGIN)).toBe(original);
    expect(aiCalls).toEqual([]);
    await waitScanDone(page);
  });

  test('"Xem hướng dẫn" hiện đoạn mã chỉ đọc; "Chi tiết" của mục sửa được chuyển sang xem trước', async ({ page }) => {
    await openFindings(page, harness.url);
    await rowAt(page, `${LOGIN}:21`, 'spec-thieu-assertion').getByRole('button', { name: 'Xem hướng dẫn' }).click();
    const detail = page.locator('#qa-finding-detail-modal');
    await expect(detail).toBeVisible();
    await expect(detail.locator('.qa-diff-row.is-focus')).toContainText("test('TC-002 - AC-002 hiện lỗi chung'");
    await expect(detail.locator('#qa-finding-detail-fix')).toBeHidden();
    await detail.locator('#qa-finding-detail-close').click();
    await expect(detail).toBeHidden();

    await rowAt(page, `${LOGIN}:6`).getByRole('button', { name: 'Chi tiết' }).click();
    await expect(detail.locator('#qa-finding-detail-fix')).toBeVisible();
    await detail.locator('#qa-finding-detail-fix').click();
    await expect(page.locator('#qa-batch-modal .qa-batch-patch')).toHaveCount(1);
  });

  test('gán mã TC: chọn AC trong modal → áp dụng → spec + bảng traceability đổi, quét lại không phát sinh lỗi (BATCH-40)', async ({ page }) => {
    await openFindings(page, harness.url);
    await page.locator('[data-batch-filter="guided"]').click();
    await expect(page.locator('.qa-static-gap-row')).toHaveCount(1);
    await rowAt(page, `${LOGIN}:15`).getByRole('button', { name: 'Sửa lỗi' }).click();
    const modal = page.locator('#qa-batch-modal');
    const acChoice = modal.locator('.qa-batch-ac');
    await expect(acChoice).toContainText('· REQ-001 · AC:');
    const tc = (await acChoice.innerText()).match(/TC-\d{3}/)[0];
    await expect(page.locator('#qa-batch-modal-apply')).toBeDisabled();
    await expect(modal.locator('.qa-batch-patch input[type=checkbox]')).toBeDisabled();
    await modal.getByRole('combobox', { name: `Chọn AC cho ${tc}` }).selectOption('AC-002');
    await expect(modal.locator('.qa-batch-card')).toHaveCount(2);
    await expect(modal.locator('.qa-badge', { hasText: 'Truy vết' }).first()).toBeVisible();
    await expect(page.locator('#qa-batch-modal-apply')).toHaveText('Áp dụng 1 bản vá (2 file)');
    await page.locator('#qa-batch-modal-apply').click();
    await expect(modal).toBeHidden();
    await expect(page.locator('#qa-batch-result-bar')).toContainText('Quét lại: đã xử lý 1 · còn 0 · phát sinh mới 0', { timeout: 20_000 });
    expect(read(fixture.rootPath, LOGIN).split('\n')[14]).toBe(`  test('${tc} - AC-002 kiểm tra tiêu đề trang', async ({ page }) => {`);
    expect(read(fixture.rootPath, 'test-cases/REQ-001.md')).toContain(`| REQ-001 | AC-002 | ${tc} | Yes | tests/e2e/login.spec.js | P2 |`);
    await waitScanDone(page);
  });
});
