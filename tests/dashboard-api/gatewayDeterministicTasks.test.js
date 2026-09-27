/**
 * tests/dashboard-api/gatewayDeterministicTasks.test.js
 * Verifies deterministic 0-token code replacements for low-value AI tasks.
 * Strict ceiling <= 150 lines.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  heuristicCheckClarity,
  heuristicBugReport,
  heuristicTriage,
  heuristicArbitrateConflict
} = require('../../core/ai/tasks/index');

test('Deterministic Rule-First Tasks Suite (0-token, Instant, 100% Deterministic)', async (t) => {
  await t.test('D-TC-01: heuristicCheckClarity scores ambiguities and generates BDD draft (0 token)', () => {
    const text = 'Hệ thống cần xử lý thanh toán nhanh chóng, giao diện đẹp mắt và dễ dàng nếu cần.';
    const res = heuristicCheckClarity({ requirementText: text, title: 'Thanh toán' });

    assert.equal(res.ok, true);
    assert.equal(res.source, 'rule');
    assert.equal(typeof res.score, 'number');
    assert.equal(res.status, 'ambiguous');
    assert.equal(res.ambiguities.length >= 3, true);
    assert.match(res.ambiguities[0].reason, /SLA|đo lường/i);
    assert.equal(res.missingAspects.length >= 1, true);
    assert.match(res.clarifiedDraft, /Given.*When.*Then/s);
  });

  await t.test('D-TC-02: heuristicCheckClarity awards high score for clear BDD specs', () => {
    const text = 'Given giỏ hàng có 2 sản phẩm When bấm thanh toán trong 1500ms Then hiển thị mã đơn hàng thành công, báo lỗi nếu tài khoản không đủ số dư.';
    const res = heuristicCheckClarity({ requirementText: text, title: 'Thanh toán rõ ràng' });

    assert.equal(res.ok, true);
    assert.equal(res.score >= 85, true);
    assert.equal(res.status, 'clear');
    assert.equal(res.ambiguities.length, 0);
  });

  await t.test('D-TC-03: heuristicBugReport extracts steps, severity, and markdown from Playwright snippet', () => {
    const snippet = [
      "await page.goto('/checkout');",
      "await page.getByRole('button', { name: 'Thanh toán' }).click();",
      "await page.locator('input#voucher').fill('SALE50');",
      "await expect(page.locator('.toast')).toHaveText('Áp dụng mã thành công');"
    ].join('\n');

    const res = heuristicBugReport({
      testTitle: 'Áp dụng mã giảm giá thanh toán',
      errorText: 'Error: expect(received).toHaveText(expected)\nExpected: Áp dụng mã thành công\nReceived: 500 Internal Server Error',
      locator: 'input#voucher',
      snippet,
      url: 'https://staging.carthings.vn/checkout',
      triageCategory: 'product_bug',
      triageSummary: 'Backend trả về mã lỗi 500'
    });

    assert.equal(res.ok, true);
    assert.equal(res.source, 'rule');
    assert.equal(res.severity, 'Critical');
    assert.match(res.title, /\[Bug\]/);
    assert.equal(res.stepsToReproduce.length >= 3, true);
    assert.match(res.stepsToReproduce[0], /checkout/);
    assert.match(res.stepsToReproduce[1], /Click/);
    assert.match(res.actualResult, /500/);
    assert.match(res.markdownReport, /### Steps to Reproduce:/);
    assert.match(res.markdownReport, /### Suggested Fix:/);
  });

  await t.test('D-TC-04: heuristicTriage classifies failure instantly via analyzeDiagnostics', () => {
    const errorText = 'Error: expect(received).toBe(expected)\nExpected: 200\nReceived: 400';
    const res = heuristicTriage({
      errorText,
      testTitle: 'API Status check',
      locator: 'api'
    });

    assert.equal(res.ok, true);
    assert.equal(res.source, 'rule');
    assert.equal(res.category, 'product_bug');
    assert.equal(res.confidence >= 80, true);
    assert.equal(typeof res.summary, 'string');
    assert.equal(typeof res.suggestedFix, 'string');
  });

  await t.test('D-TC-05: heuristicArbitrateConflict recommends sync based on spec assertions', () => {
    const ctx = {
      specAcs: ['AC-001'],
      docAcs: ['AC-002'],
      blocks: [{ line: 10, snippet: 'await expect(page.locator(".tax-rate")).toHaveText("10%");' }],
      acDefinitions: {
        'AC-001': { text: 'Thuế suất VAT mặc định là 10% tính trên tổng đơn hàng' },
        'AC-002': { text: 'Miễn thuế VAT đối với tài khoản VIP doanh nghiệp' }
      }
    };

    const res = heuristicArbitrateConflict(ctx);
    assert.equal(res.ok, true);
    assert.equal(res.source, 'rule');
    assert.equal(res.recommendation, 'sync_doc_to_spec');
    assert.equal(res.confidence >= 70, true);
    assert.match(res.reason, /Spec|kiểm thử/i);
  });
});
