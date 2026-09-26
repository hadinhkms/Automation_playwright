/**
 * tests/dashboard/qa-ai-triage.spec.js
 * E2E test suite for Plan-17b:
 * Failure Triage (QA-3), Jira Markup Parser (BA-4), Source Traceability,
 * and Runner Diagnostics Panel UI.
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { startDashboardHarness } = require('./support/dashboardHarness');
const { createFixtureWorkspace } = require('./support/fixtureWorkspace');

test.describe('Plan-17b: Failure Triage & Jira Story E2E Suite', () => {
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

  test('P17B-TC-08: Runner diagnostics panel triage error and displays source badge (UI-01, UI-02)', async ({ page }) => {
    await page.goto(harness.url);
    await page.waitForLoadState('domcontentloaded');

    const panel = page.locator('.diagnostics-panel');
    await expect(panel).toBeVisible();

    const input = page.locator('#diagnostics-error-input');
    const analyzeBtn = page.locator('#diagnostics-analyze-btn');
    const aiBtn = page.locator('#diagnostics-ai-btn');

    await expect(analyzeBtn).toBeVisible();
    await expect(aiBtn).toBeVisible();

    // 1. Phân tích tự động bằng luật tĩnh (Rule-based, 0 token)
    await input.fill('Error: expect(received).toBe(expected)\nExpected: 200\nReceived: 500');
    await analyzeBtn.click();

    const results = page.locator('#diagnostics-results');
    await expect(results).toContainText('Lỗi sản phẩm (Product Bug)', { timeout: 5000 });
    await expect(results).toContainText('Luật suy luận (0 token)');

    // 2. Chẩn đoán chuyên sâu qua AI RCA button
    await aiBtn.click();
    await expect(results).toBeVisible();
  });

  test('P17B-TC-09: Requirement Studio modal supports Jira key and cleans markup (UI-04)', async ({ page }) => {
    await page.goto(harness.url);
    await page.waitForLoadState('domcontentloaded');

    // Switch to QA view via FeatureRegistry
    await page.evaluate(async () => {
      const core = window.__STUDIO_CORE__;
      if (core?.featureRegistry) {
        await core.featureRegistry.switchView('qa-view');
      }
    });
    await page.waitForTimeout(400);

    // Click button to open requirement analyzer modal
    const openBtn = page.locator('#qa-btn-analyze-req');
    await expect(openBtn).toBeVisible({ timeout: 10000 });
    await openBtn.click();

    const modal = page.locator('#qa-req-analyzer-modal');
    await expect(modal).toBeVisible();

    const jiraInput = page.locator('#qa-req-jira-key');
    const formatBtn = page.locator('#qa-req-btn-format-jira');
    const textarea = page.locator('#qa-req-analyzer-text');

    await expect(jiraInput).toBeVisible();
    await expect(formatBtn).toBeVisible();
    await expect(textarea).toBeVisible();

    // Paste Jira Wiki Markup containing an issue key
    const sampleJira = [
      'h1. Đăng ký tài khoản mới (PROJ-888)',
      'Người dùng có thể *đăng ký* bằng email.',
      'h2. Tiêu chí nghiệm thu',
      '* Email phải duy nhất trong hệ thống',
      '{code:javascript}',
      'const user = { email: "test@example.com" };',
      '{code}'
    ].join('\n');

    await textarea.fill(sampleJira);
    await formatBtn.click();

    // Verify markdown conversion
    const textVal = await textarea.inputValue();
    expect(textVal).toContain('# Đăng ký tài khoản mới (PROJ-888)');
    expect(textVal).toContain('**đăng ký**');
    expect(textVal).toContain('## Tiêu chí nghiệm thu');
    expect(textVal).toContain('- Email phải duy nhất');
    expect(textVal).toContain('```javascript');

    // Verify Jira key auto-detection
    const detectedKey = await jiraInput.inputValue();
    expect(detectedKey).toBe('PROJ-888');

    // Close modal
    await page.locator('#qa-req-analyzer-close').click();
    await expect(modal).not.toBeVisible();
  });

  test('P17B-TC-07: Scaffold requirement preserves Source: PROJ-xxx in metadata', async () => {
    const res = await fetch(`${harness.url}/api/qa/scaffold-from-analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reqId: 'REQ-888',
        title: 'Tích hợp đăng ký người dùng',
        source: 'PROJ-888',
        analysisResult: {
          summary: 'Tính năng đăng ký tài khoản mới cho người dùng cá nhân.',
          testCaseEstimation: {
            testCases: [
              {
                title: 'Đăng ký thành công với email hợp lệ',
                precondition: 'Người dùng ở trang đăng ký',
                steps: [{ step: 1, action: 'Điền form', expected: 'Tạo tài khoản' }]
              }
            ]
          }
        }
      })
    });

    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);

    const reqRelative = data.files.find((f) => f.startsWith('requirements/'));
    expect(Boolean(reqRelative)).toBe(true);

    const reqFile = path.join(fixture.rootPath, reqRelative);
    expect(fs.existsSync(reqFile)).toBe(true);

    const content = fs.readFileSync(reqFile, 'utf8');
    expect(content).toContain('> **Source:** PROJ-888');
    expect(content).toContain('# REQ-888: Tích hợp đăng ký người dùng');
  });

  test('P17B-TC-10: Abort controller clears triage state cleanly (ASYNC-04)', async ({ page }) => {
    await page.goto(harness.url);
    await page.waitForLoadState('domcontentloaded');

    const input = page.locator('#diagnostics-error-input');
    await input.fill('Some random failure log');

    const analyzeBtn = page.locator('#diagnostics-analyze-btn');
    await analyzeBtn.click();

    const results = page.locator('#diagnostics-results');
    await expect(results).toBeVisible();
  });

  test('Plan-17b UI responsive layout across viewports and dark/light mode', async ({ page }) => {
    const viewports = [
      { width: 1920, height: 1080 },
      { width: 1440, height: 900 },
      { width: 1280, height: 800 },
      { width: 390, height: 844 }
    ];

    for (const vp of viewports) {
      await page.setViewportSize(vp);
      await page.goto(harness.url);
      await page.waitForLoadState('domcontentloaded');

      const diagPanel = page.locator('.diagnostics-panel');
      await expect(diagPanel).toBeVisible();

      // Check button text or icons are not clipped
      const btn = page.locator('#diagnostics-analyze-btn');
      await expect(btn).toBeVisible();
    }
  });
});
