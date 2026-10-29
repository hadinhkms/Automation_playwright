/**
 * tests/dashboard/qa-modals-and-jira-regression.spec.js
 * Deep E2E Regression Suite for QA Studio Modals (Auto-Fix, Scaffold, Infer TCs, Delete REQ, Decisions)
 * and Settings Jira Cloud Integration (Saved Token Test Connection & View Remount Parity).
 * Modularity ceiling <= 250 lines.
 */

const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { startDashboardHarness } = require('./support/dashboardHarness');
const { createFixtureWorkspace } = require('./support/fixtureWorkspace');

const REQ_MD = `---
id: REQ-001
title: Đăng nhập & khóa tài khoản
domain: auth
---
# REQ-001 — Đăng nhập & khóa tài khoản

## Acceptance criteria
### AC-001: Đăng nhập hợp lệ vào trang chủ
- Given tài khoản hợp lệ, When đăng nhập, Then vào dashboard.

### AC-002: Nhập sai quá số lần sẽ khóa tạm
- Given nhập sai liên tiếp, When vượt ngưỡng, Then khóa tài khoản.

## Open questions
- Sai mật khẩu tối đa mấy lần thì khóa tài khoản? — **Đã chốt:** Tối đa 5 lần nhập sai liên tiếp sẽ khóa 15 phút (QA Lead, 2026-10-01).
`;

const TC_MD = `# Test Cases: REQ-001

## Traceability
| Requirement | Acceptance criterion | Test case | Automation | Spec | Priority |
|---|---|---|---|---|---|
| REQ-001 | AC-001 | TC-001 | Candidate | — | P0 |

### TC-001 — Đăng nhập hợp lệ
| Step | Action | Expected result |
|---|---|---|
| 1 | Nhập user/pass đúng | Vào trang chủ |
`;

const DECISIONS_JSON = JSON.stringify({
  version: 1,
  decisions: [{
    id: 'DEC-001',
    title: 'Chiến lược khóa tài khoản <img src=x onerror="window.__DEC_XSS__=1">',
    severity: 'blocking',
    answered: false,
    recommended: 'opt-lock-15m',
    recommendationReason: 'Đảm bảo an toàn brute-force',
    options: [
      { id: 'opt-lock-15m', label: 'Khóa tạm 15 phút', consequence: 'Tự mở sau 15 phút' },
      { id: 'opt-captcha', label: 'Hiện CAPTCHA', consequence: 'Cần tích hợp captcha' },
    ],
    answer: { optionId: null, note: 'Chọn phương án phù hợp', confirmedBy: '', confirmedAt: null },
  }],
}, null, 2);

test.describe('QA Studio Modals & Jira Settings Deep Regression Suite', () => {
  let fixture;
  let harness;
  let mockJira;
  let mockJiraUrl;

  test.beforeAll(async () => {
    fixture = createFixtureWorkspace();
    fs.mkdirSync(path.join(fixture.rootPath, 'requirements'), { recursive: true });
    fs.mkdirSync(path.join(fixture.rootPath, 'test-cases'), { recursive: true });
    fs.mkdirSync(path.join(fixture.rootPath, 'tests', 'e2e', 'desktop'), { recursive: true });
    fs.writeFileSync(path.join(fixture.rootPath, 'requirements', 'REQ-001-auth.md'), REQ_MD, 'utf8');
    fs.writeFileSync(path.join(fixture.rootPath, 'test-cases', 'REQ-001-auth.md'), TC_MD, 'utf8');
    fs.writeFileSync(path.join(fixture.rootPath, 'decisions.json'), DECISIONS_JSON, 'utf8');

    mockJira = http.createServer((req, res) => {
      res.setHeader('Content-Type', 'application/json');
      if (req.url === '/rest/api/3/myself') {
        res.end(JSON.stringify({ displayName: 'Senior QA', emailAddress: 'qa@company.vn', timeZone: 'Asia/Ho_Chi_Minh', active: true }));
        return;
      }
      if (req.url.startsWith('/rest/api/3/issue/JS-101')) {
        res.end(JSON.stringify({
          fields: {
            summary: 'Tối ưu luồng đăng nhập SSO',
            issuetype: { name: 'Story' },
            status: { name: 'In Progress' },
            priority: { name: 'High' },
            description: {
              type: 'doc',
              content: [
                { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Acceptance Criteria' }] },
                { type: 'orderedList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'SSO redirect < 2s' }] }] }] },
              ],
            },
          },
        }));
        return;
      }
      res.statusCode = 404;
      res.end(JSON.stringify({ errorMessages: ['Not Found'] }));
    });
    await new Promise((resolve) => mockJira.listen(0, '127.0.0.1', resolve));
    mockJiraUrl = `http://127.0.0.1:${mockJira.address().port}`;

    harness = await startDashboardHarness(fixture.rootPath);
  });

  test.afterAll(async () => {
    if (mockJira) await new Promise((resolve) => mockJira.close(resolve));
    if (harness) await harness.stop();
    if (fixture) fixture.cleanup();
  });

  test('QA Studio: Decisions interactive save, Infer TCs modal & append, Auto-Fix, Scaffold Wizard, and Delete REQ', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto(harness.url);
    await page.waitForFunction(() => Boolean(window.__STUDIO_CORE__));
    await page.evaluate(() => window.__STUDIO_CORE__.featureRegistry.switchView('qa-view'));
    await expect(page.locator('#qa-view .qa-hero')).toBeVisible();

    // 1. Interactive Decisions tab (XSS-safe + PUT /api/qa/decision)
    await page.click('[data-qa-tab="decisions"]');
    await expect(page.locator('#qa-panel-decisions')).toBeVisible();
    const decCard = page.locator('#qa-decisions-list .qa-decision').first();
    await expect(decCard).toBeVisible();
    expect(await page.evaluate(() => Boolean(window.__DEC_XSS__))).toBe(false);
    await decCard.locator('input[type="radio"][value="opt-lock-15m"]').check();
    await decCard.locator('textarea.qa-textarea').fill('Chốt theo chuẩn bảo mật');
    await decCard.locator('input[type="text"]').fill('QA Lead');
    await decCard.locator('button', { hasText: 'Lưu quyết định' }).click();
    await expect(page.locator('#qa-decisions-list .qa-decision.is-answered')).toBeVisible();

    // 2. Infer Test Cases modal from decided Open Question & append to test-cases
    await page.click('[data-qa-tab="docs"]');
    await page.locator('.qa-doc-item', { hasText: 'REQ-001-auth.md' }).first().click();
    const inferBtn = page.locator('#qa-reader-infer');
    await expect(inferBtn).toBeVisible();
    await inferBtn.click();
    const inferModal = page.locator('#qa-infer-modal');
    await expect(inferModal).toBeVisible();
    await expect(inferModal.locator('.qa-inferred-card').first()).toBeVisible();
    await inferModal.locator('#qa-infer-deselect-all').click();
    await expect(inferModal.locator('#qa-infer-submit-btn')).toBeDisabled();
    await inferModal.locator('#qa-infer-select-all').click();
    await expect(inferModal.locator('#qa-infer-submit-btn')).toBeEnabled();
    await inferModal.locator('#qa-infer-submit-btn').click();
    await expect(inferModal).not.toBeVisible();

    // 3. Auto-Fix dry-run modal renders summary & list cleanly
    await page.click('#qa-btn-autofix');
    const fixModal = page.locator('#qa-fix-modal');
    await expect(fixModal).toBeVisible();
    await expect(fixModal.locator('#qa-fix-changes-list li').first()).toBeVisible();
    await fixModal.locator('#qa-fix-cancel-btn').click();
    await expect(fixModal).not.toBeVisible();

    // 4. Scaffold Wizard extract & create REQ-002, then safe Delete REQ-002
    await page.click('#qa-btn-scaffold');
    const scModal = page.locator('#qa-scaffold-modal');
    await expect(scModal).toBeVisible();
    await scModal.locator('#qa-scaffold-raw-content').fill('# Tìm kiếm việc làm\n- AC-001: Given từ khóa Tester, When bấm Tìm, Then hiện danh sách việc làm.');
    await scModal.locator('#qa-btn-extract-raw').click();
    await expect(scModal.locator('#qa-scaffold-raw-preview')).toBeVisible();
    await expect(scModal.locator('#qa-scaffold-preview-req-id')).toHaveText('REQ-002');
    await scModal.locator('#qa-btn-submit-scaffold').click();
    await expect(scModal).not.toBeVisible();

    // Reader opens REQ-002 automatically -> test Delete Requirement modal
    await expect(page.locator('#qa-reader-delete')).toBeVisible();
    await page.click('#qa-reader-delete');
    const delModal = page.locator('#qa-delete-req-modal');
    await expect(delModal).toBeVisible();
    await expect(delModal.locator('#qa-delete-target-id')).toHaveText('REQ-002');
    await expect(delModal.locator('#qa-delete-submit-btn')).toBeDisabled();
    await delModal.locator('#qa-delete-confirm-input').fill('REQ-002');
    await expect(delModal.locator('#qa-delete-submit-btn')).toBeEnabled();
    await delModal.locator('#qa-delete-submit-btn').click();
    await expect(delModal).not.toBeVisible();

    expect(errors).toEqual([]);
  });

  test('Settings Jira Cloud: Save config, test connection with saved token, fetch issue, and survive view remount', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto(harness.url);
    await page.waitForFunction(() => Boolean(window.__STUDIO_CORE__));
    await page.evaluate(() => window.__STUDIO_CORE__.featureRegistry.switchView('settings-view'));
    await page.click('.settings-subtab[data-subtab="jira"]');
    await expect(page.locator('section.settings-jira')).toBeVisible();

    await page.fill('#settings-jira-base-url', mockJiraUrl);
    await page.fill('#settings-jira-email', 'qa@company.vn');
    await page.fill('#settings-jira-token', 'ATATT3xSecretJiraToken9999');
    await page.click('#btn-save-jira');

    await expect(page.locator('#settings-jira-status-badge')).toContainText('Đã kết nối (ATATT3...9999)');
    await expect(page.locator('#settings-jira-token')).toHaveValue('');

    // Switch away and back (remount parity) then test connection WITHOUT re-entering token
    await page.evaluate(() => window.__STUDIO_CORE__.featureRegistry.switchView('runner-view'));
    await page.evaluate(() => window.__STUDIO_CORE__.featureRegistry.switchView('settings-view'));
    await page.click('.settings-subtab[data-subtab="jira"]');
    await expect(page.locator('section.settings-jira')).toBeVisible();

    await page.click('#btn-test-jira');
    await expect(page.locator('#settings-jira-alert-title')).toHaveText('Kết nối Jira thành công!');
    await expect(page.locator('#settings-jira-alert-msg')).toContainText('Senior QA');

    await page.fill('#jira-fetch-key-input', 'JS-101');
    await page.click('#btn-fetch-jira-test');
    await expect(page.locator('#jira-fetch-result')).toContainText('JS-101');
    await expect(page.locator('#jira-fetch-result')).toContainText('SSO redirect < 2s');

    expect(errors).toEqual([]);
  });
});

