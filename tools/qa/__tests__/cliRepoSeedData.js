'use strict';
/**
 * Dữ liệu seed mẫu (sync-manifest, qa.config, REQ/TC/spec, decisions.json) cho cliRepoFixture.js.
 */

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_MANIFEST = {
  ship: [
    { path: 'tools/qa', reason: 'analyzer' },
    { path: 'tools/boundary', reason: 'boundary' },
    { path: '.agents', reason: 'shared skills' },
  ],
  seed: [
    { path: 'qa.config.json', reason: 'config' },
    { path: 'playwright', reason: 'playwright' },
  ],
  own: [
    { path: 'requirements', reason: 'business', hubModule: 'requirements' },
    { path: 'test-cases', reason: 'business', hubModule: 'test-cases' },
    { path: 'decisions.json', reason: 'decisions' },
  ],
};

const DEFAULT_DECISIONS = {
  version: 1,
  createdAt: '2026-10-20',
  source: 'cli-test',
  decisions: [
    {
      id: 'D-01',
      title: 'Chính sách khoá đồng thời khi nhiều thiết bị đăng nhập sai',
      severity: 'blocking',
      blocks: 'REQ-001',
      context: 'Khi gửi song song request đăng nhập sai ở biên tối đa, bộ đếm có nguy cơ bị race condition.',
      status: 'confirmed',
      options: [
        {
          id: 'atomic-lock',
          label: 'Khoá nguyên tử ở tầng DB và trả mã 429 ngay lập tức',
          consequence: 'Chặn đứng vượt ngưỡng thử mật khẩu khi gửi request song song',
        },
        { id: 'eventual', label: 'Đếm bất đồng bộ qua hàng đợi', consequence: 'Có độ trễ' },
      ],
      recommended: 'atomic-lock',
      recommendationReason: 'An toàn bảo mật',
      evidence: [{ claim: 'Kiểm thử race condition', source: 'requirements/REQ-001-sign-in.md' }],
      answer: {
        optionId: 'atomic-lock',
        note: 'Bắt buộc kiểm tra trạng thái khoá ở DB và thông báo lỗi 429 khi gửi 2 request đồng thời.',
        confirmedBy: 'QA Lead',
        confirmedAt: '2026-10-22',
      },
    },
    {
      id: 'D-02',
      title: 'Quyết định đang chờ chưa duyệt',
      severity: 'soon',
      blocks: 'none',
      context: 'Chưa chốt',
      status: 'pending',
      options: [{ id: 'opt1', label: 'Phương án 1', consequence: 'Hệ quả 1' }],
      recommended: 'opt1',
      recommendationReason: 'N/A',
      evidence: [],
      answer: { optionId: 'opt1', note: 'Ghi chú nháp', confirmedBy: '', confirmedAt: '' },
    },
  ],
};

function buildReqMd(version, extraRuleLine = '') {
  return `---
id: REQ-001
title: Đăng nhập hệ thống
status: Approved
version: ${version}
test_cases: test-cases/REQ-001-sign-in.md
---

## Acceptance Criteria
### AC-001: Đăng nhập hợp lệ chuyển vào trang chủ
### AC-002: Khoá tài khoản khi nhập sai mật khẩu quá giới hạn

## Rules and validation
| Rule | Valid | Invalid | Boundary | Error message | Test cases |
|---|---|---|---|---|---|
| Email format | validdomain | plain | 254 chars | Email không hợp lệ | TC-001 |
${extraRuleLine}`;
}

function buildSpecTs(assertLine) {
  return `import { test, expect } from '@playwright/test';
test.describe('REQ-001 - Sign in', { tag: '@REQ-001' }, () => {
  test('TC-001 - AC-001 valid login', { tag: ['@smoke', '@p0'] }, async ({ page }) => {
    await page.goto('/login');
    ${assertLine}
  });
});
`;
}

function seedInitialRepoFiles(root, options = {}) {
  const manifest = options.manifest || DEFAULT_MANIFEST;
  fs.writeFileSync(path.join(root, 'sync-manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

  const qaConfig = options.qaConfig || {
    projectDir: 'playwright',
    project: 'chromium',
    requirementsDir: 'requirements',
    testCasesDir: 'test-cases',
    ignoreSpecs: ['playwright/tests/scratch'],
  };
  fs.writeFileSync(path.join(root, 'qa.config.json'), JSON.stringify(qaConfig, null, 2), 'utf8');

  const reqDir = path.join(root, qaConfig.requirementsDir || 'requirements');
  const tcDir = path.join(root, qaConfig.testCasesDir || 'test-cases');
  const specDir = path.join(root, qaConfig.projectDir || 'playwright', 'tests', 'auth');
  fs.mkdirSync(reqDir, { recursive: true });
  fs.mkdirSync(tcDir, { recursive: true });
  fs.mkdirSync(specDir, { recursive: true });

  fs.writeFileSync(path.join(reqDir, 'REQ-001-sign-in.md'), buildReqMd('1.0'), 'utf8');
  fs.writeFileSync(
    path.join(tcDir, 'REQ-001-sign-in.md'),
    `# Test Cases: REQ-001

## Traceability
| REQ | AC | TC | Automation | Spec | Priority |
|---|---|---|---|---|---|
| REQ-001 | AC-001 | TC-001 | Yes | \`playwright/tests/auth/sign-in.spec.ts\` | P0 |
| REQ-001 | AC-002 | TC-002 | Yes | \`playwright/tests/auth/sign-in.spec.ts\` | P1 |

### TC-001: Đăng nhập thành công
- **Steps:** Nhập thông tin hợp lệ.
- **Expected:** Hiển thị dashboard.
`,
    'utf8',
  );
  fs.writeFileSync(
    path.join(specDir, 'sign-in.spec.ts'),
    buildSpecTs("await expect(page.locator('#banner')).toBeTruthy();"),
    'utf8',
  );
  fs.writeFileSync(path.join(root, 'decisions.json'), JSON.stringify(DEFAULT_DECISIONS, null, 2), 'utf8');

  return { reqDir, tcDir, specDir };
}

function applySecondCommitChanges(reqDir, specDir) {
  fs.writeFileSync(
    path.join(reqDir, 'REQ-001-sign-in.md'),
    buildReqMd(
      '1.1',
      '| Rate limit login | <= 5 lần | >= 6 lần liên tiếp | đúng 5 và 6 lần trong 60 giây | Tài khoản tạm khoá 15 phút | TC-002 |\n',
    ),
    'utf8',
  );
  fs.writeFileSync(
    path.join(specDir, 'sign-in.spec.ts'),
    buildSpecTs("await expect(page.locator('#banner')).toHaveText('Welcome Dashboard');"),
    'utf8',
  );
}

module.exports = { seedInitialRepoFiles, applySecondCommitChanges };
