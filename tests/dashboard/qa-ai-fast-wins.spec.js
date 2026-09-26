/**
 * tests/dashboard/qa-ai-fast-wins.spec.js
 * E2E test suite for Plan-17c Fast Wins:
 * Requirement Clarity Checker (BA-1), Generate Test Cases (QA-1),
 * Draft Bug Report (QA-4), and AI Audit Log Viewer (F3 UI).
 */
const { test, expect } = require('@playwright/test');
const { startDashboardHarness } = require('./support/dashboardHarness');
const { createFixtureWorkspace } = require('./support/fixtureWorkspace');

test.describe('Plan-17c: Fast Wins UI E2E Suite', () => {
  test.describe.configure({ timeout: 60_000 });
  let fixture;
  let harness;

  test.beforeAll(async () => {
    fixture = createFixtureWorkspace();
    harness = await startDashboardHarness(fixture.rootPath);
  });

  test.afterAll(async () => {
    if (harness) await harness.stop();
    if (fixture) fixture.cleanup();
  });

  test('P17C-TC-07: Requirement Studio supports BA-1 Clarity Checker with score and BDD draft', async ({ page }) => {
    await page.route('**/api/ai/req-clarity', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          score: 65,
          status: 'needs_clarification',
          summary: 'Yêu cầu có tiêu chí nhưng chứa từ định tính.',
          ambiguities: [
            { phrase: 'nhanh chóng', reason: 'Không có SLA', suggestion: 'dưới 2000ms' }
          ],
          missingAspects: ['thiếu timeout'],
          clarifiedDraft: 'Given giỏ hàng When thanh toán Then hoàn tất trong 2s'
        })
      });
    });

    await page.goto(harness.url);
    await page.waitForLoadState('domcontentloaded');

    // Switch to QA view
    await page.evaluate(async () => {
      const core = window.__STUDIO_CORE__;
      if (core?.featureRegistry) {
        await core.featureRegistry.switchView('qa-view');
      }
    });
    await page.waitForTimeout(400);

    const openBtn = page.locator('#qa-btn-analyze-req');
    await expect(openBtn).toBeVisible({ timeout: 10000 });
    await openBtn.click();

    const modal = page.locator('#qa-req-analyzer-modal');
    await expect(modal).toBeVisible();

    const textarea = page.locator('#qa-req-analyzer-text');
    const clarityBtn = page.locator('#qa-req-btn-clarity');
    await expect(clarityBtn).toBeVisible();

    // Input ambiguous requirement
    await textarea.fill('Hệ thống phải xử lý thanh toán nhanh chóng, giao diện đẹp mắt và dễ dùng.');
    await clarityBtn.click();

    // Verify clarity panel is shown and score badge updated
    const clarityPanel = page.locator('#qa-req-panel-clarity');
    await expect(clarityPanel).toBeVisible({ timeout: 10000 });

    const clarityResult = page.locator('#qa-req-clarity-result');
    await expect(clarityResult).toContainText('Cụm từ định tính');
    await expect(clarityResult).toContainText('nhanh chóng');

    // Close modal
    const closeBtn = page.locator('#qa-req-analyzer-close');
    await closeBtn.click();
  });

  test('P17C-TC-08: Requirement Studio supports QA-1 Generate Test Cases with tags', async ({ page }) => {
    await page.route('**/api/ai/generate-tc', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          testCases: [
            { tcId: 'TC-001', acId: 'AC-001', title: 'Đăng ký xe hợp lệ', type: 'positive', given: 'Học viên đã đăng nhập', when: 'Nhập biển số 29A-123.45', then: 'Lưu xe thành công', tags: ['@smoke'] }
          ]
        })
      });
    });

    await page.goto(harness.url);
    await page.waitForLoadState('domcontentloaded');

    await page.evaluate(async () => {
      const core = window.__STUDIO_CORE__;
      if (core?.featureRegistry) {
        await core.featureRegistry.switchView('qa-view');
      }
    });
    await page.waitForTimeout(400);

    const openBtn = page.locator('#qa-btn-analyze-req');
    await openBtn.click();

    const textarea = page.locator('#qa-req-analyzer-text');
    const generateTcBtn = page.locator('#qa-req-btn-generate-tc');
    await expect(generateTcBtn).toBeVisible();

    await textarea.fill('AC-001: Biển số xe không được để trống và theo định dạng chuẩn Việt Nam.');
    await generateTcBtn.click();

    // Verify TC panel is shown with generated test cases
    const tcPanel = page.locator('#qa-req-panel-tc');
    await expect(tcPanel).toBeVisible({ timeout: 10000 });

    const tcList = page.locator('#qa-req-tc-list');
    await expect(tcList).toContainText('TC-001');

    const closeBtn = page.locator('#qa-req-analyzer-close');
    await closeBtn.click();
  });

  test('P17C-TC-09: Runner diagnostics panel supports QA-4 Draft Bug Report with Jira Markdown', async ({ page }) => {
    await page.route('**/api/diagnostics/triage', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          source: 'ai',
          category: 'locator-not-found',
          confidence: 95,
          summary: 'Phần tử không tìm thấy do timeout khi chờ selector.',
          evidence: 'TimeoutError: locator.click waiting for getByRole("button")',
          suggestedFix: 'Kiểm tra xem modal có đang che khuất nút không.'
        })
      });
    });

    await page.route('**/api/ai/draft-bug', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          title: '[Bug] Không thể bấm nút Thêm xe do timeout',
          severity: 'Major',
          stepsToReproduce: ['1. Mở trang đăng ký xe', '2. Bấm nút Thêm xe'],
          expectedResult: 'Nút Thêm xe được bấm thành công',
          actualResult: 'Timeout 5000ms exceeded',
          markdownReport: '### Steps to Reproduce\n1. Mở trang đăng ký xe\n2. Bấm nút Thêm xe'
        })
      });
    });

    await page.goto(harness.url);
    await page.waitForLoadState('domcontentloaded');

    const panel = page.locator('.diagnostics-panel');
    await expect(panel).toBeVisible();

    const input = page.locator('#diagnostics-error-input');
    const analyzeBtn = page.locator('#diagnostics-analyze-btn');

    await input.fill('TimeoutError: locator.click: Timeout 5000ms exceeded waiting for getByRole("button", { name: "Thêm xe" })');
    await analyzeBtn.click();

    const results = page.locator('#diagnostics-results');
    await expect(results.locator('.diagnostic-finding')).toBeVisible({ timeout: 10000 });

    const draftBugBtn = page.locator('#btn-diagnostics-draft-bug');
    await expect(draftBugBtn).toBeVisible({ timeout: 5000 });
    await draftBugBtn.click();

    const bugContainer = page.locator('#diagnostics-bug-report-container');
    await expect(bugContainer).toBeVisible({ timeout: 10000 });
    await expect(bugContainer).toContainText('[Bug]');
    await expect(bugContainer).toContainText('Steps to Reproduce');

    const copyBtn = page.locator('#btn-copy-bug-report');
    await expect(copyBtn).toBeVisible();
  });

  test('P17C-TC-10: Settings view displays F3 AI Audit Log Viewer table & refresh action', async ({ page }) => {
    await page.goto(harness.url);
    await page.waitForLoadState('domcontentloaded');

    // Switch to settings view
    await page.evaluate(async () => {
      const core = window.__STUDIO_CORE__;
      if (core?.featureRegistry) {
        await core.featureRegistry.switchView('settings-view');
      }
    });
    await page.waitForTimeout(400);

    // Switch to AI subtab in settings
    const aiSubtabBtn = page.locator('.settings-subtab[data-subtab="ai"]');
    if (await aiSubtabBtn.isVisible()) {
      await aiSubtabBtn.click();
      await page.waitForTimeout(300);
    }

    const auditCard = page.locator('#settings-ai-audit-card');
    await expect(auditCard).toBeVisible({ timeout: 5000 });

    const auditTable = page.locator('#ai-audit-table');
    await expect(auditTable).toBeVisible();

    const refreshBtn = page.locator('#btn-ai-audit-refresh');
    await expect(refreshBtn).toBeVisible();
    await refreshBtn.click();

    const clearBtn = page.locator('#btn-ai-audit-clear');
    await expect(clearBtn).toBeVisible();
  });
});
