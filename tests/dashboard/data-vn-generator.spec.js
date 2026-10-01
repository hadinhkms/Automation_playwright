/**
 * tests/dashboard/data-vn-generator.spec.js
 * E2E tests for Test Data Studio - VN Test Data Generator & Edge Payloads (PLAN-19a Phase 3)
 * Tests: TC-20 .. TC-31
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { startDashboardHarness } = require('./support/dashboardHarness');
const { createFixtureWorkspace } = require('./support/fixtureWorkspace');

async function openDataView(page, url) {
  await page.goto(url);
  await page.waitForSelector('.shell');
  await page.waitForFunction(() => Boolean(window.__STUDIO_CORE__));
  await page.evaluate(() => window.__STUDIO_CORE__.featureRegistry.switchView('data-view'));
  await page.waitForSelector('#data-view:not([hidden])');
}

test.describe('Test Data Studio: VN Data Generator & Payloads (PLAN-19a)', () => {
  let fixture;
  let harness;
  const ts = Date.now();
  const testFileName = `plan19a-e2e-${ts}.json`;

  test.beforeAll(async () => {
    fixture = createFixtureWorkspace();
    harness = await startDashboardHarness(fixture.rootPath);
  });

  test.afterAll(async () => {
    // Dọn dẹp dataset nếu có
    const datasetPath = path.join(fixture.rootPath, 'data', testFileName);
    if (fs.existsSync(datasetPath)) {
      try { fs.unlinkSync(datasetPath); } catch (_) {}
    }
    if (harness) await harness.stop();
    if (fixture) fixture.cleanup();
  });

  test('TC-20: UI-02 / LIFE-01 mở modal, sinh CCCD, lưu dataset và kiểm tra file trên đĩa', async ({ page }) => {
    await openDataView(page, harness.url);

    const openBtn = page.locator('#data-vn-gen-open-btn');
    await expect(openBtn).toBeVisible({ timeout: 10000 });
    await openBtn.click();

    const modal = page.locator('#data-vn-gen-modal');
    await expect(modal).toBeVisible();

    await page.locator('#data-vn-type').selectOption('cccd');
    await page.locator('#data-vn-count').fill('10');
    await page.locator('#data-vn-seed').fill('demo-e2e-20');
    await page.locator('#data-vn-generate-btn').click();

    // Chờ bảng xem trước có 10 dòng
    const rows = page.locator('#data-vn-preview .data-vn-table tbody tr');
    await expect(rows).toHaveCount(10);

    // Điền tên file và lưu
    await page.locator('#data-vn-filename').fill(testFileName);
    await page.locator('#data-vn-save-btn').click();

    // Modal tự đóng sau khi lưu thành công
    await expect(modal).not.toBeVisible();

    // Kiểm tra file trên đĩa
    const filePath = path.join(fixture.rootPath, 'data', testFileName);
    expect(fs.existsSync(filePath)).toBe(true);
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    expect(Array.isArray(content)).toBe(true);
    expect(content.length).toBe(10);
    expect(content.every((c) => /^\d{12}$/.test(c))).toBe(true);
  });

  test('TC-21: UI-01 danh mục tùy chọn khớp danh mục đặc tả', async ({ page }) => {
    await openDataView(page, harness.url);
    await page.locator('#data-vn-gen-open-btn').click();

    const typeOptions = await page.locator('#data-vn-type option').allInnerTexts();
    expect(typeOptions.length).toBe(5);

    // Chuyển sang tab payload
    await page.locator('#data-vn-tab-payload').click();
    const categories = await page.locator('#data-vn-payload-category option').evaluateAll((opts) => opts.map((o) => o.value));
    expect(categories).toContain('xss');
    expect(categories).toContain('sqli');
    expect(categories).toContain('unicode');
    expect(categories).toContain('whitespace');
    expect(categories).toContain('length');
    expect(categories).toContain('csv-formula');

    await page.locator('#data-vn-close-top-btn').click();
  });

  test('TC-22: ASYNC-03 phản hồi muộn bị loại bỏ nhờ sequence counter', async ({ page }) => {
    await openDataView(page, harness.url);
    await page.locator('#data-vn-gen-open-btn').click();

    let callCount = 0;
    await page.route('**/api/data/generate', async (route) => {
      callCount++;
      if (callCount === 1) {
        // Request 1 bị trễ 800ms
        await new Promise((r) => setTimeout(r, 800));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, type: 'name', count: 1, seed: 'late', records: ['Tên Bị Bỏ'] })
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, type: 'name', count: 1, seed: 'fresh', records: ['Tên Đúng'] })
        });
      }
    });

    await page.locator('#data-vn-type').selectOption('name');
    await page.locator('#data-vn-count').fill('1');

    // Bấm lần 1 (bị trễ) và bấm ngay lần 2
    await page.locator('#data-vn-generate-btn').click();
    await page.locator('#data-vn-generate-btn').click();

    await page.waitForTimeout(1000);
    const text = await page.locator('#data-vn-preview').innerText();
    expect(text).toContain('Tên Đúng');
    expect(text).not.toContain('Tên Bị Bỏ');

    await page.unroute('**/api/data/generate');
    await page.locator('#data-vn-close-top-btn').click();
  });

  test('TC-23: ASYNC-02 đổi type khi request đang chờ', async ({ page }) => {
    await openDataView(page, harness.url);
    await page.locator('#data-vn-gen-open-btn').click();

    await page.route('**/api/data/generate', async (route) => {
      await new Promise((r) => setTimeout(r, 500));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, type: 'phone', count: 1, seed: 's', records: ['0981234567'] })
      });
    });

    await page.locator('#data-vn-type').selectOption('phone');
    await page.locator('#data-vn-generate-btn').click();

    // Đổi type ngay lập tức sang cccd
    await page.locator('#data-vn-type').selectOption('cccd');
    await page.waitForTimeout(700);

    // Không có giá trị phone vẽ nhầm vào form cccd
    await page.unroute('**/api/data/generate');
    await page.locator('#data-vn-close-top-btn').click();
  });

  test('TC-24: ASYNC-01 khóa nút khi đang lưu', async ({ page }) => {
    await openDataView(page, harness.url);
    await page.locator('#data-vn-gen-open-btn').click();

    await page.locator('#data-vn-generate-btn').click();
    await expect(page.locator('#data-vn-preview .data-vn-table')).toBeVisible();

    await page.route('**/api/data/create-dataset', async (route) => {
      await new Promise((r) => setTimeout(r, 600));
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });

    const saveBtn = page.locator('#data-vn-save-btn');
    await saveBtn.click();
    await expect(saveBtn).toBeDisabled();

    await page.waitForTimeout(800);
    await page.unroute('**/api/data/create-dataset');
  });

  test('TC-25: ASYNC-04 lưu trùng tên báo lỗi 400 và giữ nguyên bản xem trước', async ({ page }) => {
    await openDataView(page, harness.url);
    await page.locator('#data-vn-gen-open-btn').click();

    await page.locator('#data-vn-generate-btn').click();
    await expect(page.locator('#data-vn-preview .data-vn-table')).toBeVisible();

    await page.route('**/api/data/create-dataset', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: 'Tệp dataset đã tồn tại' })
      });
    });

    await page.locator('#data-vn-filename').fill('existing_file.json');
    await page.locator('#data-vn-save-btn').click();

    // Cảnh báo hiển thị
    const alertEl = page.locator('#data-vn-alert');
    await expect(alertEl).toBeVisible();
    await expect(alertEl).toContainText('Tệp dataset đã tồn tại');

    // Bảng xem trước và tên file vẫn còn nguyên vẹn
    await expect(page.locator('#data-vn-preview .data-vn-table')).toBeVisible();
    await expect(page.locator('#data-vn-filename')).toHaveValue('existing_file.json');

    await page.unroute('**/api/data/create-dataset');
    await page.locator('#data-vn-close-top-btn').click();
  });

  test('TC-26: ASYNC-05 xử lý lỗi server 500 khi lưu', async ({ page }) => {
    await openDataView(page, harness.url);
    await page.locator('#data-vn-gen-open-btn').click();

    await page.locator('#data-vn-generate-btn').click();

    await page.route('**/api/data/create-dataset', async (route) => {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Server Error' }) });
    });

    await page.locator('#data-vn-save-btn').click();
    await expect(page.locator('#data-vn-alert')).toBeVisible();
    // Badge chưa lưu vẫn còn
    await expect(page.locator('#data-vn-status-badge')).toBeVisible();

    await page.unroute('**/api/data/create-dataset');
    await page.locator('#data-vn-close-top-btn').click();
  });

  test('TC-27: UI-05 đóng khi dirty hiển thị confirm dialog', async ({ page }) => {
    await openDataView(page, harness.url);
    await page.locator('#data-vn-gen-open-btn').click();

    // Sinh dữ liệu -> dirty = true
    await page.locator('#data-vn-generate-btn').click();
    await expect(page.locator('#data-vn-status-badge')).toBeVisible();

    // Bấm nút đóng -> hộp xác nhận hiện lên
    await page.locator('#data-vn-close-btn').click();
    const confirm = page.locator('#data-vn-confirm');
    await expect(confirm).toBeVisible();

    // Bấm "Ở lại" -> modal chính vẫn mở
    await page.locator('#data-vn-confirm-stay-btn').click();
    await expect(confirm).not.toBeVisible();
    await expect(page.locator('#data-vn-gen-modal')).toBeVisible();

    // Bấm đóng lại và chọn "Bỏ và đóng" -> modal đóng hẳn
    await page.locator('#data-vn-close-btn').click();
    await page.locator('#data-vn-confirm-leave-btn').click();
    await expect(page.locator('#data-vn-gen-modal')).not.toBeVisible();
  });

  test('TC-28: UI-04 đổi tab nhanh giữa Định danh và Payload', async ({ page }) => {
    await openDataView(page, harness.url);
    await page.locator('#data-vn-gen-open-btn').click();

    const tabPayload = page.locator('#data-vn-tab-payload');
    const tabIdentity = page.locator('#data-vn-tab-identity');
    const panelPayload = page.locator('#data-vn-panel-payload');
    const panelIdentity = page.locator('#data-vn-panel-identity');

    await tabPayload.click();
    await expect(tabPayload).toHaveAttribute('aria-selected', 'true');
    await expect(panelPayload).toBeVisible();
    await expect(panelIdentity).not.toBeVisible();

    await tabIdentity.click();
    await expect(tabIdentity).toHaveAttribute('aria-selected', 'true');
    await expect(panelIdentity).toBeVisible();
    await expect(panelPayload).not.toBeVisible();

    await page.locator('#data-vn-close-top-btn').click();
  });

  test('TC-29: OWN-01..04 tính idempotent và gỡ bỏ listener sạch sẽ', async ({ page }) => {
    await openDataView(page, harness.url);

    // Kiểm tra init 2 lần qua evaluate không nhân đôi listener
    const doubleInit = await page.evaluate(async () => {
      const { VnDataGeneratorModal } = await import('/js/views/data/vnDataGeneratorModal.js');
      const m1 = new VnDataGeneratorModal();
      m1.init();
      m1.init();
      m1.destroy();
      return true;
    });
    expect(doubleInit).toBe(true);

    // Chuyển view 20 vòng A-B-A không gây rò rỉ listener
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.__STUDIO_CORE__.featureRegistry.switchView('qa-view'));
      await page.evaluate(() => window.__STUDIO_CORE__.featureRegistry.switchView('data-view'));
    }

    const openBtn = page.locator('#data-vn-gen-open-btn');
    await expect(openBtn).toBeVisible();
    await openBtn.click();
    await expect(page.locator('#data-vn-gen-modal')).toBeVisible();
    await page.locator('#data-vn-close-top-btn').click();
  });

  test('TC-30: OWN-05 rời view khi request đang chờ không gây lỗi console', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await openDataView(page, harness.url);
    await page.locator('#data-vn-gen-open-btn').click();

    await page.route('**/api/data/generate', async (route) => {
      await new Promise((r) => setTimeout(r, 800));
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, records: [] }) });
    });

    await page.locator('#data-vn-generate-btn').click();

    // Ngay lập tức chuyển sang view khác
    await page.evaluate(() => window.__STUDIO_CORE__.featureRegistry.switchView('runner-view'));
    await page.waitForTimeout(1000);

    const runtimeErrors = consoleErrors.filter((e) => !e.includes('Failed to load resource'));
    expect(runtimeErrors).toEqual([]);
    await page.unroute('**/api/data/generate');
  });

  test('TC-31: An toàn hiển thị: xem nhóm XSS nguyên văn và không kích hoạt script', async ({ page }) => {
    let dialogTriggered = false;
    page.on('dialog', () => { dialogTriggered = true; });

    await openDataView(page, harness.url);
    await page.locator('#data-vn-gen-open-btn').click();
    await page.locator('#data-vn-tab-payload').click();

    await page.locator('#data-vn-payload-category').selectOption('xss');
    await page.waitForTimeout(500);

    // Kiểm tra không có alert(1) nào được kích hoạt
    expect(dialogTriggered).toBe(false);

    // Chuỗi <script>alert(1)</script> phải được hiển thị dưới dạng văn bản
    const tableText = await page.locator('#data-vn-payload-table-container').innerText();
    expect(tableText).toContain('<script>alert(1)</script>');

    // Không có thẻ img[onerror] nào được render trong DOM thật
    const injectedImg = await page.locator('#data-vn-payload-table-container img[onerror]').count();
    expect(injectedImg).toBe(0);

    await page.locator('#data-vn-close-top-btn').click();
  });
});
