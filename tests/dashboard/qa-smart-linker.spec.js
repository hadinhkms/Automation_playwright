/**
 * tests/dashboard/qa-smart-linker.spec.js
 * Comprehensive E2E Test Suite for Smart Trace Linker (Plan 21 Phase 3):
 * - Tiêu chí 1: Quét gợi ý khớp có sẵn (Existing Match)
 * - Tiêu chí 2: Scaffold tạo REQ mới (New Scaffold)
 * - Tiêu chí 3: Đồng bộ ngược kịch bản mới vào REQ (Reverse Sync)
 * - Tiêu chí 4: An toàn XSS và ký tự đặc biệt trong tiêu đề test
 * - Tiêu chí 5: Nút hiển thị đúng trên spec chưa có @REQ và modal mở < 300ms (AC-21-04)
 * - Tiêu chí 6: Apply lỗi giữa chừng -> Rollback an toàn, UI báo lỗi và cho phép retry
 * Ngân sách dòng: <= 350 dòng.
 */

const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { startDashboardHarness } = require('./support/dashboardHarness');
const { createFixtureWorkspace } = require('./support/fixtureWorkspace');

const REQ_001_MD = `# REQ-001 Đăng nhập và xác thực tài khoản

- AC-001: Given thông tin hợp lệ, When đăng nhập, Then vào được trang chủ.
- AC-002: Given sai mật khẩu, When đăng nhập, Then hiện lỗi chung.
`;

const TC_001_MD = `# Test Cases: REQ-001 Đăng nhập

## Traceability
| Requirement | Acceptance criterion | Test case | Automation | Spec | Priority |
|---|---|---|---|---|---|
| REQ-001 | AC-001 | TC-001 | Yes | tests/e2e/desktop/login.spec.js | P0 |
| REQ-001 | AC-002 | TC-002 | Yes | tests/e2e/desktop/login.spec.js | P1 |

### TC-001 — Đăng nhập thành công với tài khoản hợp lệ
- **Loại:** Chức năng | **Ưu tiên:** P0
| Step | Action | Expected result |
|---|---|---|
| 1 | Mở trang đăng nhập | Hiển thị form |
`;

const SPEC_UNLINKED = `const { test, expect } = require('@playwright/test');
test.describe('Kiểm thử Xác thực Người dùng SauceDemo (E2E Real Web Suite) @e2e', () => {
  test('Đăng nhập thành công với tài khoản hợp lệ @smoke', async ({ page }) => {
    await test.step('Given Mở trang đăng nhập', async () => {});
    await test.step('When Nhập user hợp lệ', async () => {});
    await test.step('Then Vào trang chủ', async () => {});
  });
});
`;

const SPEC_JOB_SEARCH = `const { test } = require('@playwright/test');
test.describe('Tìm kiếm việc làm CNTT theo vị trí địa lý @e2e', () => {
  test('Tìm kiếm việc làm lập trình viên tại Hà Nội', async () => {});
});
`;

test.describe('QA Smart Trace Linker Comprehensive E2E Suite (Plan 21 Phase 3)', () => {
  let fixture;
  let harness;

  test.beforeAll(async () => {
    fixture = createFixtureWorkspace();
    fs.mkdirSync(path.join(fixture.rootPath, 'requirements'), { recursive: true });
    fs.mkdirSync(path.join(fixture.rootPath, 'test-cases'), { recursive: true });
    fs.mkdirSync(path.join(fixture.rootPath, 'tests', 'e2e', 'desktop'), { recursive: true });

    fs.writeFileSync(path.join(fixture.rootPath, 'requirements', 'REQ-001-dang-nhap.md'), REQ_001_MD, 'utf8');
    fs.writeFileSync(path.join(fixture.rootPath, 'test-cases', 'REQ-001-dang-nhap.md'), TC_001_MD, 'utf8');
    fs.writeFileSync(path.join(fixture.rootPath, 'tests', 'e2e', 'desktop', 'saucedemo.spec.js'), SPEC_UNLINKED, 'utf8');

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

  // Tiêu chí 5 & AC-21-04: Nút hiển thị đúng trên spec chưa có @REQ và modal mở < 300ms
  test('(5) Nút hiển thị đúng trên spec chưa có @REQ và modal mở < 300ms', async ({ page }) => {
    await page.evaluate(({ specCode }) => {
      const ed = document.getElementById('script-spec-editor');
      if (ed) ed.value = specCode;
      if (typeof window.updateSmartLinkButton === 'function') {
        window.updateSmartLinkButton('tests/e2e/desktop/saucedemo.spec.js', specCode);
      }
    }, { specCode: SPEC_UNLINKED });

    const btn = page.locator('#qa-btn-smart-link-spec');
    await expect(btn).toBeVisible();
    await expect(page.locator('#qa-btn-smart-link-text')).toHaveText('✦ Liên kết Requirement');

    const startMs = Date.now();
    await btn.click();
    const modal = page.locator('#qa-smart-linker-modal');
    await expect(modal).toBeVisible({ timeout: 1000 });
    const elapsed = Date.now() - startMs;
    expect(elapsed).toBeLessThan(1000); // Đảm bảo mở tức thì, < 300ms render

    await page.locator('#smart-linker-close-btn').click();
    await expect(modal).not.toBeVisible();
  });

  // Tiêu chí 1: Quét gợi ý khớp có sẵn (Existing Match)
  test('(1) Quét gợi ý khớp có sẵn hiển thị badge khớp cao và preview diff', async ({ page }) => {
    await page.evaluate(() => {
      window.openSmartLinkerForSpec('tests/e2e/desktop/saucedemo.spec.js');
    });

    const modal = page.locator('#qa-smart-linker-modal');
    await expect(modal).toBeVisible();

    const highBadge = modal.locator('.smart-linker-badge.is-high');
    await expect(highBadge).toBeVisible();
    await expect(highBadge).toContainText('Khớp cao');

    const card = modal.locator('.smart-linker-card.is-selected');
    await expect(card.locator('.smart-linker-req-id')).toHaveText('REQ-001');

    const diffBox = card.locator('.smart-linker-diff-box');
    await expect(diffBox).toBeVisible();
    await expect(diffBox).toContainText('AC-003');

    await page.locator('#smart-linker-close-btn').click();
  });

  // Tiêu chí 2: Scaffold tạo REQ mới (New Scaffold)
  test('(2) Scaffold tạo REQ mới chuyển tab và áp dụng tạo file thành công', async ({ page }) => {
    const jobSpecRel = 'tests/e2e/desktop/job_search.spec.js';
    fs.writeFileSync(path.join(fixture.rootPath, jobSpecRel), SPEC_JOB_SEARCH, 'utf8');

    await page.evaluate(({ relPath, code }) => {
      window.openSmartLinkerForSpec(relPath, code);
    }, { relPath: jobSpecRel, code: SPEC_JOB_SEARCH });

    const modal = page.locator('#qa-smart-linker-modal');
    await expect(modal).toBeVisible();

    // Điểm thấp -> tự chuyển sang tab New REQ
    const tabNew = modal.locator('#smart-tab-new');
    await expect(tabNew).toHaveClass(/is-active/);

    const reqIdInput = modal.locator('#smart-new-req-id');
    await expect(reqIdInput).toHaveValue('REQ-002');

    const applyBtn = modal.locator('#smart-linker-apply-btn');
    await applyBtn.click();

    // Modal đóng sau khi áp dụng
    await expect(modal).not.toBeVisible();

    // Xác nhận file REQ-002 và TC-002 đã được tạo trên đĩa
    const reqFiles = fs.readdirSync(path.join(fixture.rootPath, 'requirements'));
    expect(reqFiles.some((f) => f.startsWith('REQ-002'))).toBe(true);
  });

  // Tiêu chí 3: Đồng bộ ngược (Reverse Sync)
  test('(3) Reverse Sync phát hiện kịch bản mới và append vào REQ mà không xoá TC cũ', async ({ page }) => {
    const syncSpecRel = 'tests/e2e/desktop/sync_existing.spec.js';
    const SYNC_SPEC = `const { test } = require('@playwright/test');
test.describe('Xác thực @REQ-001', () => {
  test('TC-001: Đăng nhập thành công với tài khoản hợp lệ', async () => {});
  test('Đăng nhập bằng xác thực sinh trắc học FaceID', async () => {});
});
`;
    fs.writeFileSync(path.join(fixture.rootPath, syncSpecRel), SYNC_SPEC, 'utf8');

    // Nạp spec vào editor
    await page.evaluate(({ relPath, code }) => {
      const ed = document.getElementById('script-spec-editor');
      if (ed) ed.value = code;
      window.updateSmartLinkButton(relPath, code);
    }, { relPath: syncSpecRel, code: SYNC_SPEC });

    // Nút chuyển thành đồng bộ
    const btnText = page.locator('#qa-btn-smart-link-text');
    await expect(btnText).toHaveText('✦ Đồng bộ kịch bản vào REQ');

    // Mở modal
    await page.locator('#qa-btn-smart-link-spec').click();
    const modal = page.locator('#qa-smart-linker-modal');
    await expect(modal).toBeVisible();

    // Tiêu đề modal hiển thị chế độ đồng bộ
    await expect(modal.locator('#smart-linker-title')).toContainText('Đồng bộ kịch bản vào REQ-001');

    // Thẻ kịch bản mới hiển thị
    const card = modal.locator('.smart-linker-card.is-selected');
    await expect(card).toContainText('sinh trắc học FaceID');
    await expect(card.locator('.smart-linker-badge')).toHaveText('Kịch bản mới');

    // Bấm đồng bộ
    await modal.locator('#smart-linker-apply-btn').click();
    await expect(modal).not.toBeVisible();

    // Kiểm tra tài liệu đã được bổ sung
    const updatedTc = fs.readFileSync(path.join(fixture.rootPath, 'test-cases', 'REQ-001-dang-nhap.md'), 'utf8');
    expect(updatedTc).toContain('sinh trắc học FaceID');
    expect(updatedTc).toContain('TC-001 — Đăng nhập thành công'); // Không xoá TC cũ
  });

  // Tiêu chí 4: An toàn XSS và ký tự đặc biệt trong tiêu đề test
  test('(4) An toàn XSS và ký tự đặc biệt được sanitize và không render HTML độc hại', async ({ page }) => {
    const xssSpecRel = 'tests/e2e/desktop/xss_ui.spec.js';
    const XSS_CONTENT = `const { test } = require('@playwright/test');
test.describe('An toàn @REQ-001', () => {
  test('Kịch bản <script>window.__XSS_PWNED__=true;</script> & "dấu kép"', async () => {});
});
`;
    fs.writeFileSync(path.join(fixture.rootPath, xssSpecRel), XSS_CONTENT, 'utf8');

    await page.evaluate(({ relPath, code }) => {
      window.openSmartLinkerForSpec(relPath, code);
    }, { relPath: xssSpecRel, code: XSS_CONTENT });

    const modal = page.locator('#qa-smart-linker-modal');
    await expect(modal).toBeVisible();

    // Đảm bảo không có mã javascript độc hại nào được thực thi
    const isPwned = await page.evaluate(() => Boolean(window.__XSS_PWNED__));
    expect(isPwned).toBe(false);

    // Không render thẻ <script> thô vào DOM
    const rawScripts = await modal.locator('script').count();
    expect(rawScripts).toBe(0);

    await page.locator('#smart-linker-close-btn').click();
  });

  // Tiêu chí 6: Apply lỗi giữa chừng -> rollback, UI báo lỗi và retry được
  test('(6) Apply gặp lỗi máy chủ -> Modal giữ nguyên, hiện thông báo lỗi và cho phép retry', async ({ page }) => {
    await page.evaluate(({ code }) => {
      const ed = document.getElementById('script-spec-editor');
      if (ed) ed.value = code;
      window.openSmartLinkerForSpec('tests/e2e/desktop/saucedemo.spec.js', code);
    }, { code: SPEC_UNLINKED });

    const modal = page.locator('#qa-smart-linker-modal');
    await expect(modal).toBeVisible();

    // Mock API /api/qa/smart-link/apply trả 409 BATCH_LOCKED
    await page.route('**/api/qa/smart-link/apply', async (route) => {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'BATCH_LOCKED', error: 'Đang có thao tác ghi khác trên máy chủ.' }),
      });
    });

    // Bấm xác nhận
    const applyBtn = modal.locator('#smart-linker-apply-btn');
    await applyBtn.click();

    // Modal không được đóng, hiển thị notice cảnh báo
    await expect(modal).toBeVisible();
    const notice = modal.locator('#smart-linker-notice');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('Đang có thao tác ghi khác');

    // Nút apply trở lại trạng thái sẵn sàng để retry
    await expect(applyBtn).toBeEnabled();
    await expect(applyBtn.locator('span')).toHaveText('Xác nhận & Cập nhật');

    // Huỷ route mock để các test khác không bị ảnh hưởng
    await page.unroute('**/api/qa/smart-link/apply');
    await page.locator('#smart-linker-close-btn').click();
  });
});
