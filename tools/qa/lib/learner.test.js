'use strict';
/**
 * Unit Tests cho Engine Học Chọn Lọc — Phần 1: Catalog, Signals & 4-Gate Gatekeeper (L01 .. L07).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  STATIC_RULE_MAPPING,
  computeLexicalJaccard,
  parseCatalogMarkdown,
  loadCatalog,
  extractSignalsFromDiff,
  extractSignalsFromDecisions,
  evaluateGatekeeper,
} = require('./learner');
const { gaps, drift } = require('./commands');
const {
  REAL_DEFECT_MD,
  REAL_PA_MD,
  createTempRepo,
} = require('../__tests__/learnerRepoFixture');

// ============================================================================
// L01: BOM/CRLF/fence, đúng field/enums; malformed/duplicate ID/cap lỗi
// ============================================================================
test('L01: parseCatalogMarkdown hỗ trợ BOM, CRLF, fenced code, comment metadata và bắt chặt mọi lỗi malformed/cap', (t) => {
  const dir = createTempRepo();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const parsedDh = parseCatalogMarkdown(REAL_DEFECT_MD, 'DH', 'defect-heuristics-catalog.md');
  const parsedPa = parseCatalogMarkdown(REAL_PA_MD, 'PA', 'playwright-antipatterns-catalog.md');
  assert.equal(parsedDh.length, 6);
  assert.equal(parsedPa.length, 4);
  assert.equal(parsedPa[0].id, 'PA-01');
  assert.equal(parsedPa[0].metadata.staticRule, 'spec-chi-assert-url');
  assert.equal(parsedPa[0].metadata.coverage, 'partial');
  assert.equal(parsedPa[3].category, 'Negative Side Effects');

  const withBomCrlfFence =
    '\uFEFF# Catalog\r\n\r\n```markdown\r\n### [INVALID-99] Ví dụ trong fence không được parse\r\n```\r\n\r\n' +
    '### [DH-01] Tiêu đề hợp lệ\r\n' +
    '<!-- staticRule: none | coverage: semantic -->\r\n' +
    '- **Category**: Data & BVA\r\n' +
    '- **Trigger**: Khi nhập số lượng.\r\n' +
    '- **Failure Mode**: Lọt số âm.\r\n' +
    '- **Actionable Check**: Kiểm tra biên min - 1.\r\n';
  const entries = parseCatalogMarkdown(withBomCrlfFence, 'DH');
  assert.equal(entries.length, 1);
  assert.equal(entries[0].id, 'DH-01');

  assert.throws(
    () => parseCatalogMarkdown('### DH-01 Thiếu ngoặc vuông\n- **Category**: Data & BVA\n', 'DH'),
    /Heading entry sai quy ước/,
  );
  assert.throws(
    () =>
      parseCatalogMarkdown(
        '### [PA-01] Sai tiền tố\n- **Category**: Data & BVA\n- **Trigger**: A\n- **Failure Mode**: B\n- **Actionable Check**: C\n',
        'DH',
      ),
    /sai tiền tố/,
  );

  const dupMd =
    '### [DH-01] Mục 1\n- **Category**: Data & BVA\n- **Trigger**: A\n- **Failure Mode**: B\n- **Actionable Check**: C\n\n' +
    '### [DH-01] Mục 2\n- **Category**: Data & BVA\n- **Trigger**: D\n- **Failure Mode**: E\n- **Actionable Check**: F\n';
  assert.throws(() => parseCatalogMarkdown(dupMd, 'DH'), /Trùng mã ID "DH-01"/);

  assert.throws(
    () =>
      parseCatalogMarkdown(
        '### [DH-01] Thiếu Actionable Check\n- **Category**: Data & BVA\n- **Trigger**: A\n- **Failure Mode**: B\n',
        'DH',
      ),
    /thiếu trường bắt buộc "Actionable Check"/,
  );
  assert.throws(
    () =>
      parseCatalogMarkdown(
        '### [DH-01] Lặp trường Trigger\n- **Category**: Data & BVA\n- **Trigger**: A\n- **Trigger**: A2\n- **Failure Mode**: B\n- **Actionable Check**: C\n',
        'DH',
      ),
    /bị lặp lại/,
  );
  assert.throws(
    () =>
      parseCatalogMarkdown(
        '### [DH-01] Sai Category\n- **Category**: Unknown Category\n- **Trigger**: A\n- **Failure Mode**: B\n- **Actionable Check**: C\n',
        'DH',
      ),
    /Category "Unknown Category" không hợp lệ/,
  );

  let overCapMd = '# Over Cap\n\n';
  for (let i = 1; i <= 26; i++) {
    const id = `DH-${String(i).padStart(2, '0')}`;
    overCapMd += `### [${id}] Mục số ${i}\n- **Category**: Data & BVA\n- **Trigger**: T${i}\n- **Failure Mode**: F${i}\n- **Actionable Check**: C${i}\n\n`;
  }
  assert.throws(() => parseCatalogMarkdown(overCapMd, 'DH'), /vượt quá trần cho phép \(25\)/);
});

// ============================================================================
// L02: Overlay absent rỗng; JSON/read error không fallback
// ============================================================================
test('L02: loadCatalog trả overlay rỗng hợp lệ khi chưa có file, nhưng báo lỗi ngay khi JSON/schema hỏng', (t) => {
  const dir = createTempRepo();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const cat = loadCatalog(dir);
  assert.equal(cat.overlayPresent, false);
  assert.equal(cat.stats.shared.DH, 6);
  assert.equal(cat.stats.shared.PA, 4);
  assert.equal(cat.stats.project.active, 0);
  assert.equal(fs.existsSync(path.join(dir, 'test-cases', '_learning')), false);

  const learnDir = path.join(dir, 'test-cases', '_learning');
  fs.mkdirSync(learnDir, { recursive: true });
  const kPath = path.join(learnDir, 'knowledge.json');
  fs.writeFileSync(kPath, '{ invalid json ', 'utf8');
  assert.throws(() => loadCatalog(dir), /không phải JSON hợp lệ/);

  fs.writeFileSync(
    kPath,
    JSON.stringify({ schemaVersion: '9.9.9', nextIds: { DH: 1, PA: 1 }, entries: [], processed: [], graduations: [] }),
    'utf8',
  );
  assert.throws(() => loadCatalog(dir), /schemaVersion/);
});

// ============================================================================
// L03: Heading/table/context biến thể; generated/_learning không mining
// ============================================================================
test('L03: extractSignalsFromDiff nhận diện biến thể heading/table và bỏ qua traceability.md + _learning/', (t) => {
  const dir = createTempRepo();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const sampleDiff = [
    'diff --git a/test-cases/traceability.md b/test-cases/traceability.md',
    '--- a/test-cases/traceability.md',
    '+++ b/test-cases/traceability.md',
    '@@ -1,2 +1,3 @@',
    '+| REQ-001 | AC-001 | TC-001 | Yes | `playwright/tests/auth/login.spec.ts` | P0 |',
    'diff --git a/test-cases/_learning/knowledge.json b/test-cases/_learning/knowledge.json',
    '--- a/test-cases/_learning/knowledge.json',
    '+++ b/test-cases/_learning/knowledge.json',
    '@@ -1,2 +1,3 @@',
    '+"title": "Không được quét lại chính thư mục _learning"',
    'diff --git a/requirements/REQ-001-login.md b/requirements/REQ-001-login.md',
    '--- a/requirements/REQ-001-login.md',
    '+++ b/requirements/REQ-001-login.md',
    '@@ -15,3 +15,6 @@',
    ' ## Rules and validation',
    ' | Field/rule | Valid | Invalid | Boundary | Expected | Test cases |',
    ' |---|---|---|---|---|---|',
    '+| OTP code | 6 digits | chữ cái, số âm | min - 1 (5 ký tự), max + 1 (7 ký tự) | Báo lỗi mã OTP không hợp lệ và giữ nguyên màn hình | TC-020 |',
    'diff --git a/test-cases/REQ-001-login.md b/test-cases/REQ-001-login.md',
    '--- a/test-cases/REQ-001-login.md',
    '+++ b/test-cases/REQ-001-login.md',
    '@@ -30,2 +30,6 @@',
    '+#### TC-020 — AC-002 Kiểm tra biên độ dài mã OTP khi dán chuỗi hỗn hợp',
    '+- Preconditions: Người dùng đang ở màn hình nhập OTP.',
    '+- Steps: Dán chuỗi "12ab34" hoặc 5 ký tự (min - 1).',
    '+- Expected: Hiển thị lỗi validation và không gửi request xác thực.',
  ].join('\n');

  const res = extractSignalsFromDiff(sampleDiff, { root: dir });
  assert.equal(res.signals.length, 2);
  assert.ok(res.skipped.some((s) => s.reason === 'generated-traceability'));
  assert.ok(res.skipped.some((s) => s.reason === 'learning-overlay-artifact'));
  assert.equal(res.signals[0].file, 'requirements/REQ-001-login.md');
  assert.equal(res.signals[1].file, 'test-cases/REQ-001-login.md');
  assert.equal(res.signals[1].hasExpectedInContext, true);
});

// ============================================================================
// L04: Noise comment/format/config/happy path bị lọc; heading/keyword đơn lẻ needsReview
// ============================================================================
test('L04: evaluateGatekeeper chặn comment/format/config/happy-path và chuyển heading/keyword đơn lẻ sang needsReview', (t) => {
  const dir = createTempRepo();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const catalog = loadCatalog(dir);

  const diffNoiseAndPartial = [
    'diff --git a/playwright/tests/auth/login.spec.ts b/playwright/tests/auth/login.spec.ts',
    '--- a/playwright/tests/auth/login.spec.ts',
    '+++ b/playwright/tests/auth/login.spec.ts',
    '@@ -1,2 +1,3 @@',
    '+// Chỉ thêm dòng chú thích typo',
    'diff --git a/playwright/tests/auth/format.spec.ts b/playwright/tests/auth/format.spec.ts',
    '--- a/playwright/tests/auth/format.spec.ts',
    '+++ b/playwright/tests/auth/format.spec.ts',
    '@@ -1,2 +1,2 @@',
    '-const a = 1;',
    '+  const a = 1;  ',
    'diff --git a/playwright/tests/auth/env.spec.ts b/playwright/tests/auth/env.spec.ts',
    '--- a/playwright/tests/auth/env.spec.ts',
    '+++ b/playwright/tests/auth/env.spec.ts',
    '@@ -5,2 +5,2 @@',
    '-const url = process.env.OLD_BASE_URL;',
    '+const url = requireEnv("NEW_BASE_URL");',
    'diff --git a/test-cases/REQ-002-profile.md b/test-cases/REQ-002-profile.md',
    '--- a/test-cases/REQ-002-profile.md',
    '+++ b/test-cases/REQ-002-profile.md',
    '@@ -10,2 +10,5 @@',
    '+### TC-001 - AC-001 Admin mở trang hồ sơ thành công',
    '+- Steps: Admin bấm vào menu hồ sơ để determine thông tin.',
    '+- Expected: Hiển thị tên Admin trên màn hình.',
    'diff --git a/test-cases/REQ-003-sec.md b/test-cases/REQ-003-sec.md',
    '--- a/test-cases/REQ-003-sec.md',
    '+++ b/test-cases/REQ-003-sec.md',
    '@@ -10,1 +10,2 @@',
    '+### TC-099: Kiểm tra Security cho màn hình thanh toán',
  ].join('\n');

  const { signals } = extractSignalsFromDiff(diffNoiseAndPartial, { root: dir });
  const evaluated = evaluateGatekeeper(signals, catalog);

  assert.equal(evaluated.proposed.length, 0);
  assert.equal(evaluated.rejected.length, 4);
  assert.equal(evaluated.needsReview.length, 1);

  const reasons = evaluated.rejected.map((r) => r.reasonCode);
  assert.ok(reasons.includes('comment-or-whitespace-only'));
  assert.ok(reasons.includes('formatting-only'));
  assert.ok(reasons.includes('config-or-env-only'));
  assert.ok(reasons.includes('happy-path-routine'));
  assert.equal(evaluated.needsReview[0].provenance[0].file, 'test-cases/REQ-003-sec.md');
});

// ============================================================================
// L05: Assertion fix old/new; assertion mới không tự approved
// ============================================================================
test('L05: Spec diff phân biệt bản sửa assertion cũ/mới với spec mới chỉ thêm expect đơn thuần', (t) => {
  const dir = createTempRepo();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const catalog = loadCatalog(dir);

  const specDiff = [
    'diff --git a/playwright/tests/auth/checkout.spec.ts b/playwright/tests/auth/checkout.spec.ts',
    '--- a/playwright/tests/auth/checkout.spec.ts',
    '+++ b/playwright/tests/auth/checkout.spec.ts',
    '@@ -20,3 +20,5 @@',
    '-  await expect(submitBtn).toBeVisible();',
    '+  await expect(submitBtn).toBeDisabled();',
    '+  await expect(page.getByRole("status")).toHaveText("Đang xử lý giao dịch duy nhất");',
    'diff --git a/playwright/tests/auth/new-feature.spec.ts b/playwright/tests/auth/new-feature.spec.ts',
    'new file mode 100644',
    '--- /dev/null',
    '+++ b/playwright/tests/auth/new-feature.spec.ts',
    '@@ -0,0 +1,4 @@',
    '+test("TC-001 - AC-001 Mở trang mới", async ({ page }) => {',
    '+  await expect(page.getByRole("heading")).toBeVisible();',
    '+});',
  ].join('\n');

  const { signals } = extractSignalsFromDiff(specDiff, { root: dir });
  const evaluated = evaluateGatekeeper(signals, catalog);

  assert.equal(evaluated.proposed.length, 1);
  assert.equal(evaluated.proposed[0].provenance[0].file, 'playwright/tests/auth/checkout.spec.ts');
  assert.equal(evaluated.proposed[0].review.status, 'pending');

  assert.equal(evaluated.needsReview.length, 1);
  assert.equal(evaluated.needsReview[0].provenance[0].file, 'playwright/tests/auth/new-feature.spec.ts');
  assert.equal(evaluated.needsReview[0].gates.impact.reasonCode, 'new-assertion-not-automatically-fix');
});

// ============================================================================
// L06: Confirmed/pending/placeholder/wrong option/BOM/malformed decisions
// ============================================================================
test('L06: extractSignalsFromDecisions chỉ nhận status=confirmed có optionId hợp lệ, xử lý BOM và báo lỗi khi hỏng', (t) => {
  const dir = createTempRepo();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const absent = extractSignalsFromDecisions(dir);
  assert.equal(absent.present, false);
  assert.equal(absent.signals.length, 0);

  const validDecisions = {
    version: 1,
    decisions: [
      {
        id: 'D-01',
        title: 'Quyết định đang chờ',
        severity: 'blocking',
        options: [{ id: 'opt-1', label: 'Phương án 1' }],
        status: 'pending',
        answer: { optionId: null, note: 'Placeholder note không được sinh candidate', confirmedBy: '', confirmedAt: '' },
      },
      {
        id: 'D-02',
        title: 'Chốt cơ chế khoá phiên khi hết hạn token',
        severity: 'blocking',
        options: [
          {
            id: 'strict-session-lock',
            label: 'Khóa phiên ngay lập tức và chặn nút Back sau khi session expired',
            consequence: 'Mọi test luồng nhạy cảm phải kiểm tra session expiration và idempotency.',
          },
        ],
        status: 'confirmed',
        answer: {
          optionId: 'strict-session-lock',
          note: 'Áp dụng kiểm tra bắt buộc cho toàn bộ form thanh toán.',
          confirmedBy: 'PO',
          confirmedAt: '2026-10-22T10:00:00Z',
        },
      },
    ],
  };
  fs.writeFileSync(path.join(dir, 'decisions.json'), `\uFEFF${JSON.stringify(validDecisions, null, 2)}`, 'utf8');

  const extracted = extractSignalsFromDecisions(dir);
  assert.equal(extracted.present, true);
  assert.equal(extracted.signals.length, 1);
  assert.equal(extracted.skipped.length, 1);
  assert.equal(extracted.signals[0].decisionId, 'D-02');
  assert.ok(!extracted.signals[0].addedText.includes('[object Object]'));

  validDecisions.decisions[1].answer.optionId = 'non-existent-option';
  fs.writeFileSync(path.join(dir, 'decisions.json'), JSON.stringify(validDecisions, null, 2), 'utf8');
  assert.throws(() => extractSignalsFromDecisions(dir), /không tồn tại trong danh sách options/);

  fs.writeFileSync(path.join(dir, 'decisions.json'), '{ broken ', 'utf8');
  assert.throws(() => extractSignalsFromDecisions(dir), /không phải JSON hợp lệ/);
});

// ============================================================================
// L07: Exact/lexical/multilingual unknown; shared/project/batch dedup; static partial
// ============================================================================
test('L07: Gate 2 Novelty xử lý exact duplicate, lexical Jaccard >= 0.65, multilingual/low-context, dedup batch và static partial', (t) => {
  const dir = createTempRepo();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const validFindingKinds = new Set([
    'assertion-thieu-await',
    'spec-thieu-assertion',
    'spec-chi-assert-url',
    'weak-existence-assertion',
    'missing-idempotency-guard',
  ]);
  for (const m of STATIC_RULE_MAPPING) {
    assert.ok(validFindingKinds.has(m.findingKind));
  }
  assert.equal(typeof gaps, 'function');
  assert.equal(typeof drift, 'function');

  const learnDir = path.join(dir, 'test-cases', '_learning');
  fs.mkdirSync(learnDir, { recursive: true });
  const dh01 = parseCatalogMarkdown(REAL_DEFECT_MD, 'DH')[0];
  fs.writeFileSync(
    path.join(learnDir, 'knowledge.json'),
    JSON.stringify(
      {
        schemaVersion: '1.0.0',
        nextIds: { DH: 2, PA: 1 },
        entries: [
          {
            id: 'PDH-001',
            targetCatalog: 'defect',
            title: dh01.title,
            category: dh01.category,
            trigger: dh01.trigger,
            failureMode: dh01.failureMode,
            actionableCheck: dh01.actionableCheck,
            fingerprint: 'fp-shadowed-1',
            status: 'active',
            provenance: [{ source: 'direct-verify', file: 'test-cases/REQ-001.md', sourceHash: 'sh1', excerpt: 'ex' }],
            reviewedBy: 'QA',
            reviewedAt: '2026-10-20T10:00:00Z',
          },
        ],
        processed: [],
        graduations: [],
      },
      null,
      2,
    ),
    'utf8',
  );

  const catalog = loadCatalog(dir);
  assert.equal(catalog.stats.effective.shadowed, 1);
  assert.equal(catalog.effective.shadowed[0].projectEntryId, 'PDH-001');
  assert.equal(catalog.effective.shadowed[0].shadowedBySharedId, 'DH-01');

  const emptyJac = computeLexicalJaccard('the and hoặc', 'và của trong');
  assert.equal(emptyJac.empty, true);
  assert.equal(emptyJac.score, 0);

  const signals = [
    {
      source: 'git-diff:playwright-spec',
      file: 'playwright/tests/auth/a.spec.ts',
      line: 10,
      targetCatalog: 'antipattern',
      isNoise: false,
      isAssertionFix: true,
      isPureMissingAwaitFix: true,
      suggestedCategory: 'Async & Timing',
      oldCode: 'expect(btn).toBeVisible();',
      addedText: 'await expect(btn).toBeVisible();',
      rawExcerpt: 'await expect(btn).toBeVisible();',
      sourceHash: 'h1',
    },
    {
      source: 'git-diff:test-case',
      file: 'test-cases/REQ-001.md',
      line: 20,
      targetCatalog: 'defect',
      isNoise: false,
      headingSummary: 'Idempotency và chống gửi trùng khi bấm đúp liên tiếp (Rapid Double-Submit)',
      hasExpectedInContext: true,
      riskTags: ['state-concurrency'],
      suggestedCategory: 'State & Concurrency',
      addedText:
        'Form hoặc nút thực hiện hành động ghi dữ liệu, tạo bản ghi, thanh toán, gửi OTP/Email, hoặc kích hoạt tiến trình bất đồng bộ. Requirement và Test Case chỉ kiểm tra bấm 1 lần khi mạng nhanh; bỏ sót trường hợp bấm đúp liên tiếp khi mạng trễ làm gọi API nhiều lần hoặc tạo bản ghi trùng lặp. Đối chiếu AC/Rules và Test Case xem đã quy định khóa nút (disabled / aria-busy) trong lúc chờ phản hồi và kiểm tra số lần ghi dữ liệu khi gửi lặp.',
      rawExcerpt:
        'Form hoặc nút thực hiện hành động ghi dữ liệu, tạo bản ghi, thanh toán, gửi OTP/Email, hoặc kích hoạt tiến trình bất đồng bộ. Requirement và Test Case chỉ kiểm tra bấm 1 lần khi mạng nhanh; bỏ sót trường hợp bấm đúp liên tiếp khi mạng trễ làm gọi API nhiều lần hoặc tạo bản ghi trùng lặp.',
      sourceHash: 'h2',
    },
    {
      source: 'git-diff:requirement',
      file: 'requirements/REQ-005.md',
      line: 12,
      targetCatalog: 'defect',
      isNoise: false,
      headingSummary: 'TC-050: Kiểm tra tràn bộ đệm khi tải file CSV 100MB có ký tự đặc biệt',
      hasExpectedInContext: true,
      riskTags: ['data-bva'],
      suggestedCategory: 'Data & BVA',
      addedText: 'Kiểm tra boundary max + 1 dung lượng file CSV và dòng dữ liệu chứa ký tự điều khiển Expected: từ chối an toàn',
      rawExcerpt: 'Kiểm tra boundary max + 1 dung lượng file CSV và dòng dữ liệu chứa ký tự điều khiển Expected: từ chối an toàn',
      sourceHash: 'h3',
    },
    {
      source: 'git-diff:test-case',
      file: 'test-cases/REQ-005.md',
      line: 45,
      targetCatalog: 'defect',
      isNoise: false,
      headingSummary: 'TC-050: Kiểm tra tràn bộ đệm khi tải file CSV 100MB có ký tự đặc biệt',
      hasExpectedInContext: true,
      riskTags: ['data-bva'],
      suggestedCategory: 'Data & BVA',
      addedText: 'Kiểm tra boundary max + 1 dung lượng file CSV và dòng dữ liệu chứa ký tự điều khiển Expected: từ chối an toàn',
      rawExcerpt: 'Kiểm tra boundary max + 1 dung lượng file CSV và dòng dữ liệu chứa ký tự điều khiển Expected: từ chối an toàn',
      sourceHash: 'h4',
    },
    {
      source: 'git-diff:playwright-spec',
      file: 'playwright/tests/auth/url-fix.spec.ts',
      line: 30,
      targetCatalog: 'antipattern',
      isNoise: false,
      isAssertionFix: true,
      isPureMissingAwaitFix: false,
      suggestedCategory: 'Superficial Assertion',
      oldCode: 'await expect(page).toHaveURL("/profile");',
      addedText: 'await expect(page).toHaveURL("/profile");\nawait expect(page.getByText("Đã lưu hồ sơ")).toBeVisible();',
      rawExcerpt: 'await expect(page).toHaveURL("/profile"); await expect(page.getByText("Đã lưu hồ sơ")).toBeVisible();',
      sourceHash: 'h5',
    },
  ];

  const evaluated = evaluateGatekeeper(signals, catalog);
  assert.ok(evaluated.rejected.some((r) => r.reasonCode === 'covered-by-static-rule:assertion-thieu-await'));
  assert.ok(evaluated.rejected.some((r) => r.reasonCode === 'merged-in-batch'));
  assert.equal(evaluated.proposed.length, 1);
  assert.equal(evaluated.proposed[0].provenance.length, 2);
  assert.ok(evaluated.needsReview.some((n) => n.gates.novelty.reasonCode === 'possible-duplicate-lexical'));
  assert.ok(
    evaluated.needsReview.some((n) => n.gates.novelty.reasonCode === 'partial-static-coverage:spec-chi-assert-url'),
  );
});

