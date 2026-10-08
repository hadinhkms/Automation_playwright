'use strict';

/**
 * tests/dashboard-api/smartTraceLinker.test.js
 * Test suite kiểm thử toàn diện Smart Trace Linker API (Plan 21 Phase 1):
 * - AC-21-01: Phân tích intent, Heuristic response < 500ms, candidate sorting
 * - AC-21-02: So khớp song ngữ Việt/Anh >= 75% với fixture saucedemo, < 40% với spec khác
 * - AC-21-03: 1-Click Apply ghi đĩa nguyên tử (Existing, New Scaffold, Reverse Sync)
 * - AC-21-03b: Fault injection, rollback, path traversal (403), invalid REQ ID (400),
 *              specHash stale (409), lock conflict (409 BATCH_LOCKED), .spec.ts
 * - AC-21-03c: Phân luồng mode ('link' | 'reverse_sync' | 'conflict')
 *
 * Chạy: npm run test:dashboard:api
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { startDashboardHarness } = require('../dashboard/support/dashboardHarness');
const { createFixtureWorkspace } = require('../dashboard/support/fixtureWorkspace');
const { withWriteLock } = require('../../dashboard/services/qaBatchSessionStore');

const REQ_001_CONTENT = `# REQ-001 Đăng nhập và xác thực tài khoản

- AC-001: Given thông tin hợp lệ, When đăng nhập, Then vào được trang chủ.
- AC-002: Given sai mật khẩu, When đăng nhập, Then hiện lỗi chung.
- AC-003: Given tài khoản bị khóa, When đăng nhập, Then thông báo liên hệ admin.
`;

const TC_001_CONTENT = `# Test Cases: REQ-001 Đăng nhập

## Traceability

| Requirement | Acceptance criterion | Test case | Automation | Spec | Priority |
|---|---|---|---|---|---|
| REQ-001 | AC-001 | TC-001 | Yes | tests/e2e/desktop/login.spec.js | P0 |
| REQ-001 | AC-002 | TC-002 | Yes | tests/e2e/desktop/login.spec.js | P1 |
| REQ-001 | AC-003 | TC-003 | Yes | tests/e2e/desktop/login.spec.js | P1 |

## Test cases

### TC-001 — Đăng nhập thành công với tài khoản hợp lệ
- **Loại:** Chức năng | **Ưu tiên:** P0
| Step | Action | Expected result |
|---|---|---|
| 1 | Mở trang đăng nhập | Trang hiển thị form |
| 2 | Nhập tài khoản hợp lệ | Đăng nhập thành công |
`;

const SAUCEDEMO_VN_SPEC = `const { test, expect } = require('@playwright/test');
test.describe('Kiểm thử Xác thực Người dùng SauceDemo (E2E Real Web Suite) @e2e @saucedemo', () => {
  test('Đăng nhập thành công với tài khoản hợp lệ (Standard User) @smoke', async ({ page }) => {
    await test.step('Given Tiền điều kiện: Mở trang đăng nhập SauceDemo', async () => {});
    await test.step('When Người dùng đăng nhập với username và password', async () => {});
    await test.step('Then Hệ thống chuyển hướng thành công đến trang sản phẩm (Inventory)', async () => {});
  });
  test('Đăng nhập thất bại với tài khoản bị khóa (Locked Out User) @e2e', async ({ page }) => {
    await test.step('Given Mở trang đăng nhập SauceDemo', async () => {});
    await test.step('When Nhập user bị khóa', async () => {});
    await test.step('Then Hiển thị thông báo lỗi', async () => {});
  });
});
`;

const SAUCEDEMO_EN_SPEC = `import { test, expect } from '@playwright/test';
test.describe('SauceDemo User Authentication and Login Web Suite @e2e', () => {
  test('User logs in successfully with valid credentials @smoke', async ({ page }) => {
    await test.step('Given Open login page', async () => {});
    await test.step('When Enter username and password', async () => {});
    await test.step('Then User redirected to inventory page', async () => {});
  });
});
`;

const JOB_SEARCH_SPEC = `const { test, expect } = require('@playwright/test');
test.describe('Tìm kiếm việc làm theo ngành nghề và địa điểm @e2e', () => {
  test('Tìm kiếm việc làm lập trình viên tại Hà Nội', async ({ page }) => {
    await test.step('Given Mở trang tìm kiếm', async () => {});
    await test.step('When Chọn ngành nghề CNTT và tỉnh Hà Nội', async () => {});
    await test.step('Then Danh sách việc làm hiển thị tương ứng', async () => {});
  });
});
`;

describe('API Contract: Smart Trace Linker Engine (Plan 21 Phase 1)', () => {
  let fixture;
  let harness;

  before(async () => {
    fixture = createFixtureWorkspace();
    fs.mkdirSync(path.join(fixture.rootPath, 'requirements'), { recursive: true });
    fs.mkdirSync(path.join(fixture.rootPath, 'test-cases'), { recursive: true });
    fs.mkdirSync(path.join(fixture.rootPath, 'tests', 'e2e', 'desktop'), { recursive: true });

    fs.writeFileSync(path.join(fixture.rootPath, 'requirements', 'REQ-001-dang-nhap.md'), REQ_001_CONTENT, 'utf8');
    fs.writeFileSync(path.join(fixture.rootPath, 'test-cases', 'REQ-001-dang-nhap.md'), TC_001_CONTENT, 'utf8');

    harness = await startDashboardHarness(fixture.rootPath);
  });

  after(async () => {
    if (harness) await harness.stop();
    if (fixture) fixture.cleanup();
  });

  test('AC-21-01 / AC-21-02: POST /api/qa/smart-link so khớp Heuristic song ngữ >= 75% trong < 500ms', async () => {
    const start = performance.now();
    const res = await fetch(`${harness.url}/api/qa/smart-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        specContent: SAUCEDEMO_VN_SPEC,
        specPath: 'tests/e2e/desktop/saucedemo_login.spec.js',
      }),
    });
    const duration = performance.now() - start;

    assert.equal(res.status, 200);
    assert.ok(duration < 500, `Heuristic response time phải < 500ms, thực tế: ${duration}ms`);

    const data = await res.json();
    assert.equal(data.mode, 'link');
    assert.equal(data.hasExistingReq, false);
    assert.ok(data.specHash);
    assert.ok(data.candidates.length > 0);

    const topCandidate = data.candidates[0];
    assert.equal(topCandidate.reqId, 'REQ-001');
    assert.ok(topCandidate.score >= 0.75, `Điểm so khớp tiếng Việt phải >= 0.75, thực tế: ${topCandidate.score}`);
    assert.equal(topCandidate.matchLevel, 'high');
    assert.equal(topCandidate.suggestedAcId, 'AC-004');
    assert.equal(topCandidate.suggestedTcId, 'TC-004');

    // Kiểm tra bản tiếng Anh (saucedemo login / user authentication)
    const resEn = await fetch(`${harness.url}/api/qa/smart-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ specContent: SAUCEDEMO_EN_SPEC }),
    });
    assert.equal(resEn.status, 200);
    const dataEn = await resEn.json();
    assert.ok(dataEn.candidates.length > 0);
    assert.equal(dataEn.candidates[0].reqId, 'REQ-001');
    assert.ok(dataEn.candidates[0].score >= 0.75, `Điểm so khớp tiếng Anh phải >= 0.75, thực tế: ${dataEn.candidates[0].score}`);
  });

  test('AC-21-02: Spec nghiệp vụ khác (tìm kiếm việc làm) trả điểm < 40% và cung cấp newScaffold', async () => {
    const res = await fetch(`${harness.url}/api/qa/smart-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ specContent: JOB_SEARCH_SPEC }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();

    const topScore = data.candidates.length > 0 ? data.candidates[0].score : 0;
    assert.ok(topScore < 0.4, `Spec khác chủ đề phải có điểm < 0.4, thực tế: ${topScore}`);
    assert.ok(data.newScaffold, 'Phải có bản thảo newScaffold');
    assert.equal(data.newScaffold.nextReqId, 'REQ-002');
    assert.ok(data.newScaffold.reqContent.includes('# REQ-002'));
    assert.ok(data.newScaffold.tcContent.includes('# Test Cases: REQ-002'));
  });

  test('AC-21-03c: Phân luồng Reverse Sync khi spec đã có tag REQ và phân luồng Conflict khi có nhiều tag', async () => {
    // 1. Reverse Sync: Spec đã có @REQ-001 nhưng có test mới
    const taggedSpec = `const { test } = require('@playwright/test');
test.describe('Đăng nhập hệ thống @REQ-001', () => {
  test('TC-001 — Đăng nhập thành công với tài khoản hợp lệ', async () => {});
  test('Quên mật khẩu và khôi phục qua email', async () => {});
  test('Đăng nhập nhanh bằng mã OTP điện thoại', async () => {});
});
`;
    const resSync = await fetch(`${harness.url}/api/qa/smart-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ specContent: taggedSpec, specPath: 'tests/e2e/desktop/login.spec.js' }),
    });
    assert.equal(resSync.status, 200);
    const dataSync = await resSync.json();
    assert.equal(dataSync.mode, 'reverse_sync');
    assert.equal(dataSync.hasExistingReq, true);
    assert.equal(dataSync.candidates.length, 0);
    assert.ok(dataSync.delta);
    assert.equal(dataSync.delta.reqId, 'REQ-001');
    assert.equal(dataSync.delta.knownCount, 1);
    assert.equal(dataSync.delta.newTests.length, 2);
    assert.equal(dataSync.delta.newTests[0].title, 'Quên mật khẩu và khôi phục qua email');
    assert.equal(dataSync.delta.newTests[0].suggestedTcId, 'TC-004');
    assert.equal(dataSync.delta.newTests[1].suggestedTcId, 'TC-005');

    // 2. Conflict: Spec có 2 tag REQ khác nhau
    const conflictSpec = `test.describe('Hệ thống @REQ-001 @REQ-002', () => {});`;
    const resConflict = await fetch(`${harness.url}/api/qa/smart-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ specContent: conflictSpec }),
    });
    assert.equal(resConflict.status, 200);
    const dataConflict = await resConflict.json();
    assert.equal(dataConflict.mode, 'conflict');
    assert.deepEqual(dataConflict.existingReqTags, ['REQ-001', 'REQ-002']);
  });

  test('AC-21-03: POST /api/qa/smart-link/apply cập nhật an toàn nguyên tử (link_existing)', async () => {
    const relSpec = 'tests/e2e/desktop/saucedemo_login.spec.js';
    const absSpec = path.join(fixture.rootPath, relSpec);
    fs.writeFileSync(absSpec, SAUCEDEMO_VN_SPEC, 'utf8');

    // Bước 1: Gọi smart-link để lấy hash hiện tại
    const scanRes = await fetch(`${harness.url}/api/qa/smart-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ specPath: relSpec }),
    });
    const scanData = await scanRes.json();

    // Bước 2: Apply link_existing vào REQ-001
    const applyRes = await fetch(`${harness.url}/api/qa/smart-link/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        specPath: relSpec,
        specHash: scanData.specHash,
        diskHash: scanData.diskHash,
        mode: 'link_existing',
        targetReqId: 'REQ-001',
      }),
    });

    assert.equal(applyRes.status, 200);
    const applyData = await applyRes.json();
    assert.equal(applyData.success, true);
    assert.equal(applyData.assignedReqId, 'REQ-001');

    // Xác minh file spec trên đĩa đã được chèn @REQ-001
    const updatedSpec = fs.readFileSync(absSpec, 'utf8');
    assert.ok(updatedSpec.includes('@REQ-001'), 'Spec trên đĩa phải được chèn @REQ-001');
    assert.ok(updatedSpec.includes('@saucedemo'), 'Phải giữ nguyên các tag cũ');

    // Xác minh requirement đã được chèn AC mới
    const updatedReq = fs.readFileSync(path.join(fixture.rootPath, 'requirements', 'REQ-001-dang-nhap.md'), 'utf8');
    assert.ok(updatedReq.includes('AC-004'), 'Requirement phải có AC-004 mới');

    // Xác minh test case đã được chèn TC mới
    const updatedTc = fs.readFileSync(path.join(fixture.rootPath, 'test-cases', 'REQ-001-dang-nhap.md'), 'utf8');
    assert.ok(updatedTc.includes('TC-004'), 'Test Case phải có TC-004 mới');
  });

  test('AC-21-03: POST /api/qa/smart-link/apply tạo Requirement mới hoàn chỉnh (create_new)', async () => {
    const relSpec = 'tests/e2e/desktop/job_search.spec.js';
    const absSpec = path.join(fixture.rootPath, relSpec);
    fs.writeFileSync(absSpec, JOB_SEARCH_SPEC, 'utf8');

    const scanRes = await fetch(`${harness.url}/api/qa/smart-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ specPath: relSpec }),
    });
    const scanData = await scanRes.json();

    const applyRes = await fetch(`${harness.url}/api/qa/smart-link/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        specPath: relSpec,
        specHash: scanData.specHash,
        diskHash: scanData.diskHash,
        mode: 'create_new',
        newReqData: { title: 'Tìm kiếm việc làm theo ngành nghề' },
      }),
    });

    assert.equal(applyRes.status, 200);
    const applyData = await applyRes.json();
    assert.equal(applyData.success, true);
    assert.equal(applyData.assignedReqId, 'REQ-002');

    // Kiểm tra tạo file REQ và TC mới
    const reqFiles = fs.readdirSync(path.join(fixture.rootPath, 'requirements'));
    const tcFiles = fs.readdirSync(path.join(fixture.rootPath, 'test-cases'));
    assert.ok(reqFiles.some((f) => f.startsWith('REQ-002')));
    assert.ok(tcFiles.some((f) => f.startsWith('REQ-002')));

    // Kiểm tra spec được patch @REQ-002
    const updatedSpec = fs.readFileSync(absSpec, 'utf8');
    assert.ok(updatedSpec.includes('@REQ-002'));
  });

  test('AC-21-03b: Kiểm soát an toàn - Path Traversal (403), Invalid ID (400), Stale Hash (409)', async () => {
    // 1. Path traversal bị từ chối 403
    const resPath = await fetch(`${harness.url}/api/qa/smart-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ specPath: '../../package.json' }),
    });
    assert.equal(resPath.status, 403);

    // 2. ID sai định dạng (REQ-1, REQ-0001) bị từ chối 400
    const resBadId = await fetch(`${harness.url}/api/qa/smart-link/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        specPath: 'tests/e2e/desktop/login.spec.js',
        mode: 'link_existing',
        targetReqId: 'REQ-1',
      }),
    });
    assert.equal(resBadId.status, 400);

    // 3. Stale hash trả về 409 SPEC_CHANGED
    const resStale = await fetch(`${harness.url}/api/qa/smart-link/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        specPath: 'tests/e2e/desktop/saucedemo_login.spec.js',
        specHash: 'stale_hash_123',
        diskHash: 'stale_disk_hash_123',
        mode: 'link_existing',
        targetReqId: 'REQ-001',
      }),
    });
    assert.equal(resStale.status, 409);
    const staleData = await resStale.json();
    assert.equal(staleData.code, 'SPEC_CHANGED');
  });

  test('AC-21-03b: Concurrency Lock trả về 409 BATCH_LOCKED khi đang có luồng ghi khác', async () => {
    const { applySmartLink } = require('../../dashboard/services/smartTraceLinkerService');
    const specRel = 'tests/e2e/desktop/saucedemo_login.spec.js';
    const specAbs = path.join(fixture.rootPath, specRel);
    const contentBefore = fs.existsSync(specAbs) ? fs.readFileSync(specAbs, 'utf8') : '';

    // Khi luồng khác đang giữ withWriteLock, applySmartLink phải ném 409 BATCH_LOCKED ngay lập tức
    await withWriteLock(fixture.rootPath, async () => {
      await assert.rejects(
        async () => {
          await applySmartLink(fixture.rootPath, {
            specPath: specRel,
            mode: 'link_existing',
            targetReqId: 'REQ-001',
          });
        },
        (err) => {
          assert.equal(err.status, 409);
          assert.equal(err.code, 'BATCH_LOCKED');
          return true;
        }
      );
    });

    // Xác nhận 0 file nào bị thay đổi khi gặp BATCH_LOCKED
    const contentAfter = fs.existsSync(specAbs) ? fs.readFileSync(specAbs, 'utf8') : '';
    assert.equal(contentAfter, contentBefore);
  });

  test('AC-21-03b: Hỗ trợ phân tích và chèn tag cho kịch bản TypeScript (.spec.ts)', async () => {
    const relTsSpec = 'tests/e2e/desktop/cart.spec.ts';
    const absTsSpec = path.join(fixture.rootPath, relTsSpec);
    fs.writeFileSync(absTsSpec, SAUCEDEMO_EN_SPEC, 'utf8');

    const scanRes = await fetch(`${harness.url}/api/qa/smart-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ specPath: relTsSpec }),
    });
    assert.equal(scanRes.status, 200);
    const scanData = await scanRes.json();
    assert.equal(scanData.candidates[0].reqId, 'REQ-001');

    const applyRes = await fetch(`${harness.url}/api/qa/smart-link/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        specPath: relTsSpec,
        specHash: scanData.specHash,
        diskHash: scanData.diskHash,
        mode: 'link_existing',
        targetReqId: 'REQ-001',
      }),
    });
    assert.equal(applyRes.status, 200);

    const patchedTs = fs.readFileSync(absTsSpec, 'utf8');
    assert.ok(patchedTs.includes('@REQ-001'), '.spec.ts phải được gắn tag @REQ-001');
  });

  test('AC-21-07: Reverse Sync phát hiện kịch bản mới, multi-describe và suy luận steps từ assertion', async () => {
    const relSpec = 'tests/e2e/desktop/multi_describe_sync.spec.js';
    const absSpec = path.join(fixture.rootPath, relSpec);

    // Kịch bản có @REQ-001, 2 khối describe, và 1 test không có test.step()
    const MULTI_DESC_SPEC = `const { test, expect } = require('@playwright/test');
test.describe('Nhóm Đăng nhập Cơ bản @REQ-001', () => {
  test('TC-001: Đăng nhập thành công với tài khoản hợp lệ', async ({ page }) => {
    await test.step('Mở trang', async () => {});
  });
});

test.describe('Nhóm Đăng nhập Nâng cao @REQ-001', () => {
  test('Đăng nhập với tính năng ghi nhớ mật khẩu Remember Me', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('#remember')).toBeVisible();
  });
});
`;
    fs.writeFileSync(absSpec, MULTI_DESC_SPEC, 'utf8');

    const scanRes = await fetch(`${harness.url}/api/qa/smart-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ specPath: relSpec }),
    });
    assert.equal(scanRes.status, 200);
    const scanData = await scanRes.json();

    assert.equal(scanData.mode, 'reverse_sync');
    assert.ok(scanData.delta);
    assert.equal(scanData.delta.reqId, 'REQ-001');
    assert.equal(scanData.delta.knownCount, 1, 'Kịch bản TC-001 phải được nhận diện đã có');
    assert.equal(scanData.delta.newTests.length, 1, 'Chỉ 1 kịch bản mới cần đồng bộ');
    const newTest = scanData.delta.newTests[0];
    assert.ok(newTest.title.includes('Remember Me'));
    assert.ok(newTest.steps.length >= 2, 'Phải suy luận được các bước từ assertion');
    assert.ok(newTest.steps.some((s) => s.includes('assertion') || s.includes('toBeVisible')));
  });

  test('AC-21-07b: Đổi tên test tạo cảnh báo (renamedWarnings) và không xoá TC cũ (C-3)', async () => {
    const relSpec = 'tests/e2e/desktop/renamed_test.spec.js';
    const absSpec = path.join(fixture.rootPath, relSpec);

    // Test mang tag TC-001 nhưng tiêu đề đã bị đổi hoàn toàn
    const RENAMED_SPEC = `const { test } = require('@playwright/test');
test.describe('Xác thực @REQ-001', () => {
  test('TC-001: Đổi mật khẩu định kỳ 90 ngày', async ({ page }) => {
    await page.goto('/change-password');
  });
});
`;
    fs.writeFileSync(absSpec, RENAMED_SPEC, 'utf8');

    const scanRes = await fetch(`${harness.url}/api/qa/smart-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ specPath: relSpec }),
    });
    assert.equal(scanRes.status, 200);
    const scanData = await scanRes.json();

    assert.equal(scanData.mode, 'reverse_sync');
    assert.ok(scanData.delta.renamedWarnings.length > 0, 'Phải có cảnh báo đổi tên test');
    assert.equal(scanData.delta.renamedWarnings[0].tcId, 'TC-001');
    assert.equal(scanData.delta.newTests.length, 1, 'Kịch bản đổi tên được coi là kịch bản mới');
  });

  test('AC-21-08: An toàn XSS và ký tự đặc biệt trong tiêu đề test', async () => {
    const relSpec = 'tests/e2e/desktop/xss_spec.spec.js';
    const absSpec = path.join(fixture.rootPath, relSpec);

    const XSS_SPEC = `const { test } = require('@playwright/test');
test.describe('Bảo mật @REQ-001', () => {
  test('Thử nghiệm payload <script>alert("XSS")</script> & | pipe break | \\"quotes\\"', async ({ page }) => {
    await page.goto('/');
  });
});
`;
    fs.writeFileSync(absSpec, XSS_SPEC, 'utf8');

    const scanRes = await fetch(`${harness.url}/api/qa/smart-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ specPath: relSpec }),
    });
    assert.equal(scanRes.status, 200);
    const scanData = await scanRes.json();

    assert.equal(scanData.mode, 'reverse_sync');
    const newTest = scanData.delta.newTests[0];
    assert.ok(!newTest.title.includes('<script>'), 'Thẻ script phải bị loại bỏ để chống XSS');
    assert.ok(!newTest.title.includes('alert('), 'Payload script phải bị lọc sạch');
    assert.ok(!newTest.title.includes('|'), 'Ký tự pipe phải được thay thế để không làm vỡ bảng markdown');
  });

  test('AC-21-07c: POST /api/qa/smart-link/apply hoàn tất Reverse Sync vào tài liệu', async () => {
    const relSpec = 'tests/e2e/desktop/reverse_sync_apply.spec.js';
    const absSpec = path.join(fixture.rootPath, relSpec);

    const SYNC_SPEC = `const { test } = require('@playwright/test');
test.describe('Đăng nhập mở rộng @REQ-001', () => {
  test('TC-001: Đăng nhập thành công với tài khoản hợp lệ', async () => {});
  test('Đăng nhập bằng mã OTP qua tin nhắn SMS', async () => {});
});
`;
    fs.writeFileSync(absSpec, SYNC_SPEC, 'utf8');

    const scanRes = await fetch(`${harness.url}/api/qa/smart-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ specPath: relSpec }),
    });
    const scanData = await scanRes.json();

    const applyRes = await fetch(`${harness.url}/api/qa/smart-link/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        specPath: relSpec,
        specHash: scanData.specHash,
        diskHash: scanData.diskHash,
        mode: 'reverse_sync',
        targetReqId: 'REQ-001',
      }),
    });
    assert.equal(applyRes.status, 200);
    const applyData = await applyRes.json();
    assert.equal(applyData.success, true);

    // Kiểm tra tài liệu REQ và TC đã được bổ sung
    const updatedReq = fs.readFileSync(path.join(fixture.rootPath, 'requirements', 'REQ-001-dang-nhap.md'), 'utf8');
    const updatedTc = fs.readFileSync(path.join(fixture.rootPath, 'test-cases', 'REQ-001-dang-nhap.md'), 'utf8');

    assert.ok(updatedReq.includes('Đăng nhập bằng mã OTP qua tin nhắn SMS'));
    assert.ok(updatedTc.includes('Đăng nhập bằng mã OTP qua tin nhắn SMS'));
    assert.ok(updatedTc.includes('TC-001 — Đăng nhập thành công'), 'Không được xoá TC-001 cũ');
  });
});

