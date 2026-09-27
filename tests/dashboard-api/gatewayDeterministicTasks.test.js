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
  detectHeuristicAmbiguities,
  buildRuleTestCases
} = require('../../core/ai/tasks/index');
const { translateStep } = require('../../core/ai/tasks/generatePlaywrightSpec');

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

  await t.test('D-TC-05: clarity rules match Vietnamese words with diacritics and whole words only', () => {
    // JS `\b` is ASCII-only: "không hợp lệ", "thì", "giờ" used to be missed and "breakfast" matched "fast".
    const vi = heuristicCheckClarity({ requirementText: 'Khi nhập sai thì hiển thị thông báo không hợp lệ trong 1 giờ' });
    assert.deepEqual(vi.missingAspects, []);
    assert.equal(vi.status, 'clear');
    assert.deepEqual(detectHeuristicAmbiguities('Show a breakfast menu'), []);
    assert.deepEqual(detectHeuristicAmbiguities('Nhập một số điện thoại hợp lệ'), []);
    assert.deepEqual(detectHeuristicAmbiguities('Phản hồi nhanh hơn và nhanh chóng'), ['nhanh hơn', 'nhanh chóng']);
  });

  await t.test('D-TC-06: buildRuleTestCases splits AC blocks and keeps each case on its AC', () => {
    const res = buildRuleTestCases({
      criteriaText: '## AC-001: Đăng nhập\n**Given** ở trang "/login"\n**When** bấm nút "Đăng nhập"\n**Then** hiển thị "Xin chào"\n- AC-2: Mật khẩu từ 8 đến 20 ký tự',
      startTcNumber: 5
    });
    assert.equal(res.source, 'rule');
    assert.equal(res.testCases[0].tcId, 'TC-005');
    assert.deepEqual(
      { acId: res.testCases[0].acId, given: res.testCases[0].given, when: res.testCases[0].when, then: res.testCases[0].then },
      { acId: 'AC-001', given: 'ở trang "/login"', when: 'bấm nút "Đăng nhập"', then: 'hiển thị "Xin chào"' }
    );
    const ac2 = res.testCases.filter((tc) => tc.acId === 'AC-002');
    assert.deepEqual(ac2.map((tc) => tc.type), ['positive', 'positive', 'boundary', 'boundary']);
  });

  await t.test('D-TC-07: translateStep only generates code for quoted UI targets, never page locators', () => {
    assert.deepEqual(translateStep('nhập "a@b.vn" vào "Email" và bấm nút "Lưu và đóng"').lines, [
      "await basePage.fillInput('role=textbox[name=\"Email\"]', 'a@b.vn');",
      "await basePage.clickElement('role=button[name=\"Lưu và đóng\"]');"
    ]);
    assert.equal(translateStep('không hiển thị "Lỗi"').asserts, 1);
    assert.match(translateStep('không hiển thị "Lỗi"').lines[0], /toBeHidden/);
    assert.equal(translateStep('Người dùng ở màn hình nhập liệu'), null);
    // Every clause must be translated; a clause with an unused quoted target makes the step unmapped.
    assert.equal(translateStep('hiển thị "A"; không hiển thị "B"').lines.length, 2);
    assert.equal(translateStep('hiển thị "A", "B"'), null);
    assert.match(translateStep('bấm nút "It\'s ok"').lines[0], /name="It\\'s ok"/);
  });
});
