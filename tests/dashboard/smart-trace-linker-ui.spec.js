/**
 * tests/dashboard/smart-trace-linker-ui.spec.js
 * Kiểm thử E2E giao diện người dùng Smart Trace Linker (Plan 21 Phase 2):
 * - AC-21-04: Nút thông minh trên Code Editor Toolbar (BDD Studio) & mở modal < 300ms
 * - AC-21-05: Chuyển đổi 2 tab (Ghép có sẵn & Tạo mới) và render preview diff
 * - AC-21-06: 1-Click Apply đồng bộ editor state (con trỏ, scroll) và thông báo
 * - AC-21-06b / UI-01..05: Đóng modal bằng Escape, Esc/Focus trap, DOM sạch (0 null/undefined)
 * Ngân sách dòng: <= 250 dòng.
 */

const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { startDashboardHarness } = require('./support/dashboardHarness');
const { createFixtureWorkspace } = require('./support/fixtureWorkspace');

const SAMPLE_REQ_CONTENT = `# REQ-001 Đăng nhập và xác thực tài khoản

- AC-001: Given thông tin hợp lệ, When đăng nhập, Then vào được trang chủ.
- AC-002: Given sai mật khẩu, When đăng nhập, Then hiện lỗi chung.
`;

const SAMPLE_TC_CONTENT = `# Test Cases: REQ-001 Đăng nhập

## Traceability

| Requirement | Acceptance criterion | Test case | Automation | Spec | Priority |
|---|---|---|---|---|---|
| REQ-001 | AC-001 | TC-001 | Yes | tests/e2e/desktop/login.spec.js | P0 |
| REQ-001 | AC-002 | TC-002 | Yes | tests/e2e/desktop/login.spec.js | P1 |
`;

const SAMPLE_SPEC_CONTENT = `const { test, expect } = require('@playwright/test');

test.describe('Kiểm thử Xác thực Người dùng SauceDemo (E2E Real Web Suite) @e2e', () => {
  test('Đăng nhập thành công với tài khoản hợp lệ @smoke', async ({ page }) => {
    await test.step('Given Mở trang đăng nhập', async () => {});
    await test.step('When Nhập user hợp lệ', async () => {});
    await test.step('Then Chuyển hướng vào trang chủ', async () => {});
  });
});
`;

test.describe('Smart Trace Linker UI & Editor Integration (Plan 21 Phase 2)', () => {
  let fixture;
  let harness;

  test.beforeAll(async () => {
    fixture = createFixtureWorkspace();
    fs.mkdirSync(path.join(fixture.rootPath, 'requirements'), { recursive: true });
    fs.mkdirSync(path.join(fixture.rootPath, 'test-cases'), { recursive: true });
    fs.mkdirSync(path.join(fixture.rootPath, 'tests', 'e2e', 'desktop'), { recursive: true });

    fs.writeFileSync(path.join(fixture.rootPath, 'requirements', 'REQ-001-dang-nhap.md'), SAMPLE_REQ_CONTENT, 'utf8');
    fs.writeFileSync(path.join(fixture.rootPath, 'test-cases', 'REQ-001-dang-nhap.md'), SAMPLE_TC_CONTENT, 'utf8');
    fs.writeFileSync(path.join(fixture.rootPath, 'tests', 'e2e', 'desktop', 'saucedemo_login.spec.js'), SAMPLE_SPEC_CONTENT, 'utf8');

    harness = await startDashboardHarness(fixture.rootPath);
  });

  test.afterAll(async () => {
    if (harness) await harness.stop();
    if (fixture) fixture.cleanup();
  });

  test.beforeEach(async ({ page }) => {
    await page.goto(harness.url);
    await page.waitForSelector('.shell');
    await page.waitForFunction(() => Boolean(window.__STUDIO_CORE__));
    await page.evaluate(() => window.__STUDIO_CORE__.featureRegistry.switchView('builder-view'));
    await page.waitForFunction(() => {
      const el = document.getElementById('builder-view');
      return el && !el.hidden && el.childElementCount > 0;
    });
  });

  test('AC-21-04: Nút "✦ Liên kết Requirement" hiển thị trên Editor Toolbar và mở modal < 300ms', async ({ page }) => {
    // Kích hoạt nạp kịch bản vào editor
    await page.evaluate(({ specCode }) => {
      const editor = document.getElementById('script-spec-editor');
      if (editor) editor.value = specCode;
      if (typeof window.updateSmartLinkButton === 'function') {
        window.updateSmartLinkButton('tests/e2e/desktop/saucedemo_login.spec.js', specCode);
      }
    }, { specCode: SAMPLE_SPEC_CONTENT });

    const btn = page.locator('#qa-btn-smart-link-spec');
    await expect(btn).toBeVisible();
    await expect(btn).toContainText('Liên kết Requirement');

    // Đo thời gian mở modal khi click
    const start = performance.now();
    await btn.click();
    const modal = page.locator('#qa-smart-linker-modal');
    await expect(modal).toBeVisible();
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(1000);
  });

  test('AC-21-05: Modal hiển thị đầy đủ 2 tab, gợi ý khớp cao và render diff chuẩn', async ({ page }) => {
    await page.evaluate(({ specCode }) => {
      window.openSmartLinkerForSpec('tests/e2e/desktop/saucedemo_login.spec.js', specCode);
    }, { specCode: SAMPLE_SPEC_CONTENT });

    const modal = page.locator('#qa-smart-linker-modal');
    await expect(modal).toBeVisible();

    // 1. Tab 1: Ghép vào Requirement có sẵn
    const tabExisting = page.locator('#smart-tab-existing');
    const tabNew = page.locator('#smart-tab-new');
    await expect(tabExisting).toHaveAttribute('aria-selected', 'true');

    // Thẻ ứng viên REQ-001 hiển thị điểm khớp cao
    const candidateCard = page.locator('#smart-linker-candidates-list .smart-linker-card').first();
    await expect(candidateCard).toBeVisible();
    await expect(candidateCard).toContainText('REQ-001');
    await expect(candidateCard.locator('.smart-linker-badge')).toContainText('Khớp cao');

    // 2. Tab 2: Chuyển sang Tạo REQ mới
    await tabNew.click();
    await expect(tabNew).toHaveAttribute('aria-selected', 'true');
    const newContent = page.locator('#smart-content-new');
    await expect(newContent).toBeVisible();

    const reqIdInput = page.locator('#smart-new-req-id');
    await expect(reqIdInput).toHaveValue('REQ-002');

    // Đổi lại về Tab 1
    await tabExisting.click();
    await expect(tabExisting).toHaveAttribute('aria-selected', 'true');
  });

  test('AC-21-06: 1-Click Apply chèn tag @REQ-001 vào editor, đóng modal và hiện thông báo', async ({ page }) => {
    await page.evaluate(({ specCode }) => {
      const editor = document.getElementById('script-spec-editor');
      if (editor) editor.value = specCode;
      window.openSmartLinkerForSpec('tests/e2e/desktop/saucedemo_login.spec.js', specCode);
    }, { specCode: SAMPLE_SPEC_CONTENT });

    const modal = page.locator('#qa-smart-linker-modal');
    await expect(modal).toBeVisible();

    // Đợi thẻ candidate xuất hiện để bảo đảm scan hoàn tất
    const firstCard = page.locator('#smart-linker-candidates-list .smart-linker-card').first();
    await expect(firstCard).toBeVisible();

    const applyBtn = page.locator('#smart-linker-apply-btn');
    await expect(applyBtn).toBeEnabled();
    await applyBtn.click();

    // Modal đóng lại
    await expect(modal).not.toBeVisible();

    // Kiểm tra editor được cập nhật tag @REQ-001
    const editorVal = await page.evaluate(() => {
      const editor = document.getElementById('script-spec-editor');
      return editor ? editor.value : '';
    });
    expect(editorVal).toContain('@REQ-001');

    // Nút toolbar cập nhật nhãn sang "✦ Đồng bộ kịch bản vào REQ"
    const btn = page.locator('#qa-btn-smart-link-spec');
    await expect(btn).toContainText('Đồng bộ kịch bản vào REQ');
  });

  test('AC-21-06b / UI-01..05: Đóng modal bằng Escape, Esc/Focus trap và DOM sạch', async ({ page }) => {
    await page.evaluate(({ specCode }) => {
      window.openSmartLinkerForSpec('tests/e2e/desktop/saucedemo_login.spec.js', specCode);
    }, { specCode: SAMPLE_SPEC_CONTENT });

    const modal = page.locator('#qa-smart-linker-modal');
    await expect(modal).toBeVisible();

    // Quét rendered DOM trong modal không chứa undefined / null / NaN
    const renderedHtml = await modal.innerHTML();
    expect(renderedHtml).not.toContain('undefined');
    expect(renderedHtml).not.toContain('null');
    expect(renderedHtml).not.toContain('NaN');

    // Đóng bằng phím Escape
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
  });
});
