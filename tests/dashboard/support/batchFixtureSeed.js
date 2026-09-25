/**
 * tests/dashboard/support/batchFixtureSeed.js
 * Seed một workspace tạm để scanner QA (tools/qa) sinh đủ các loại finding mà PLAN-18 xử lý.
 * Workspace có playwright.config.js riêng với 2 project để finding bị lặp như repo thật.
 */
const fs = require('fs');
const path = require('path');

const REQ_DOC = `---
id: REQ-001
title: Đăng nhập
status: Ready for Test
version: 1.0
risk: High
owner: Auth squad
test_cases: test-cases/REQ-001.md
---

# REQ-001: Đăng nhập

## Acceptance criteria

### AC-001: Vào được trang chủ

**Given** người dùng hợp lệ **When** đăng nhập **Then** vào được trang chủ

### AC-002: Sai mật khẩu bị từ chối

**Given** sai mật khẩu **When** đăng nhập **Then** hiện lỗi chung

### AC-003: Trang riêng bị chặn khi chưa đăng nhập

**Given** chưa đăng nhập **When** mở trang riêng **Then** bị chặn
`;

const TC_DOC = `# Test Cases: REQ-001

## Traceability

| Requirement | Acceptance criterion | Test case | Automation | Spec | Priority |
|---|---|---|---|---|---|
| REQ-001 | AC-001 | TC-001 | Yes | tests/e2e/login.spec.js | P0 |
| REQ-001 | AC-002 | TC-002 | Yes | tests/e2e/login.spec.js | P1 |
| REQ-001 | AC-003 | TC-003 | Yes | tests/e2e/login.spec.js | P2 |
`;

// Dòng 6 và 7 giống hệt nhau, cùng thiếu await (BATCH-02).
const LOGIN_SPEC = `const { test, expect } = require('@playwright/test');

test.describe('Đăng nhập @REQ-001', () => {
  test('TC-001 - AC-001 vào được trang chủ', async ({ page }) => {
    await page.goto('about:blank');
    expect(page.locator('#home')).toBeVisible();
    expect(page.locator('#home')).toBeVisible();
    expect(1 + 1).toBe(2);
  });

  test.skip('TC-003 - AC-003 chặn trang riêng', async ({ page }) => {
    await expect(page).toHaveURL(/login/);
  });

  test('kiểm tra tiêu đề trang', async ({ page }) => {
    await expect(page).toHaveTitle(/.*/);
  });
});

test.describe('Đăng nhập sai', () => {
  test('TC-002 - AC-002 hiện lỗi chung', async ({ page }) => {
    await page.goto('about:blank');
  });
});
`;

// CRLF + BOM và không có newline cuối file (BATCH-09).
const CRLF_SPEC = '﻿' + [
  "const { test, expect } = require('@playwright/test');",
  '',
  "test.describe('Bản CRLF @REQ-001', () => {",
  "  test('TC-001 - AC-001 bản CRLF', async ({ page }) => {",
  "    expect(page.locator('#crlf')).toBeVisible();",
  '  });',
  '});',
].join('\r\n');

const PLAYWRIGHT_CONFIG = `module.exports = {
  testDir: './tests/e2e',
  projects: [{ name: 'desktop' }, { name: 'mobile' }],
};
`;

const QA_CONFIG = {
  projectDir: '.',
  project: 'all',
  requirementsDir: 'requirements',
  testCasesDir: 'test-cases',
};

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf8');
}

/** Ghi đè toàn bộ tài liệu, spec và cấu hình của fixture về trạng thái gốc. */
function seedBatchFixture(root) {
  write(root, 'requirements/REQ-001.md', REQ_DOC);
  write(root, 'test-cases/REQ-001.md', TC_DOC);
  write(root, 'tests/e2e/login.spec.js', LOGIN_SPEC);
  write(root, 'tests/e2e/crlf.spec.js', CRLF_SPEC);
  write(root, 'playwright.config.js', PLAYWRIGHT_CONFIG);
  write(root, 'qa.config.json', `${JSON.stringify(QA_CONFIG, null, 2)}\n`);
  return root;
}

module.exports = { seedBatchFixture };
