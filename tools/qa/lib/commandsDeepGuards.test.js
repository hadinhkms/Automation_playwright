'use strict';

/**
 * Unit test cho Static Guardrail Graduation (Plan 13 Phase 5: S08..S10)
 * và Deep Coverage Gates & Learner Sync (Plan 14 Phase 3: TC-14-P3-06).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { gaps, SEVERITY_RANK } = require('./commands');
const { loadAutomatedTests } = require('./sources');
const { STATIC_RULE_MAPPING } = require('./learner');
const { loadConfig } = require('./config');
const { withRepo, spec, opts, DOCS } = require('../__tests__/commandsFixture');

// ===========================================================================
// Plan 13 Phase 5: Static Guardrail Graduation (S08–S10, spec -> inventory -> gaps)
// ===========================================================================

test('S08: E2E spec -> loadAutomatedTests -> gaps phát đúng spec-chi-assert-url (minor), không gắn nhầm mixed/none/unknown', () => {
  const specFileContent = [
    "import { test, expect } from '@playwright/test';",
    'test.describe("Auth", { tag: "@REQ-001" }, () => {',
    '  test("TC-001 - AC-001 nav only", async ({ page }) => {',
    '    await page.goto("/login");',
    '    await expect(page).toHaveURL("/dashboard");',
    '    await expect(page).toHaveTitle("Dashboard");',
    '  });',
    '  test("TC-002 - AC-002 mixed assert", async ({ page }) => {',
    '    await page.goto("/login");',
    '    await expect(page).toHaveURL("/login");',
    '    await expect(page.getByRole("alert")).toBeVisible();',
    '  });',
    '  test("TC-004 - AC-002 unknown helper assert", async ({ page }) => {',
    '    await page.goto("/login");',
    '    await verifyInvalidLoginHelper(page);',
    '  });',
    '  test("TC-005 - AC-002 zero assert", async ({ page }) => {',
    '    await page.goto("/login");',
    '    await page.getByRole("button").click();',
    '  });',
    '});',
  ].join('\n');

  const tcMd = `# Test cases: REQ-001

## Traceability

| Requirement | Acceptance criterion | Test case | Automation | Spec | Priority |
|---|---|---|---|---|---|
| REQ-001 | AC-001 | TC-001 | Yes | \`playwright/tests/login.spec.ts\` | P0 |
| REQ-001 | AC-002 | TC-002 | Yes | \`playwright/tests/login.spec.ts\` | P0 |
| REQ-001 | AC-002 | TC-004 | Yes | \`playwright/tests/login.spec.ts\` | P1 |
| REQ-001 | AC-002 | TC-005 | Yes | \`playwright/tests/login.spec.ts\` | P1 |
`;

  withRepo(
    {
      ...DOCS,
      'test-cases/REQ-001.md': tcMd,
      'playwright/tests/login.spec.ts': specFileContent,
    },
    (root) => {
      const listJson = {
        config: { rootDir: path.join(root, 'playwright/tests') },
        suites: [
          {
            specs: [
              { title: 'TC-001 - AC-001 nav only', file: 'login.spec.ts', line: 3, tags: ['@REQ-001'] },
              { title: 'TC-002 - AC-002 mixed assert', file: 'login.spec.ts', line: 8, tags: ['@REQ-001'] },
              { title: 'TC-004 - AC-002 unknown helper assert', file: 'login.spec.ts', line: 13, tags: ['@REQ-001'] },
              { title: 'TC-005 - AC-002 zero assert', file: 'login.spec.ts', line: 17, tags: ['@REQ-001'] },
            ],
          },
        ],
      };

      const findings = gaps(root, { listJson, loadAutomated: loadAutomatedTests });

      const navFindings = findings.filter((f) => f.kind === 'spec-chi-assert-url');
      assert.equal(navFindings.length, 1, 'chỉ TC-001 là navigation-only');
      assert.equal(navFindings[0].severity, 'minor');
      assert.equal(navFindings[0].where, 'playwright/tests/login.spec.ts:3');
      assert.match(navFindings[0].message, /TC-001/);
      assert.match(navFindings[0].message, /toHaveURL, toHaveTitle/);
      assert.match(navFindings[0].action, /Expected Result/);

      const zeroFindings = findings.filter((f) => f.kind === 'spec-thieu-assertion');
      assert.equal(
        zeroFindings.length,
        1,
        'chỉ TC-005 (none) bị báo spec-thieu-assertion; TC-004 (unknown) không bị gắn nhầm',
      );
      assert.match(zeroFindings[0].message, /TC-005/);
    },
  );
});

test('S09: spec-chi-assert-url tôn trọng @wip, test.skip/fixme, ignoreSpecs và filterReq/filterDomain/filterTag', () => {
  const specFileContent = [
    "import { test, expect } from '@playwright/test';",
    'test.describe("Auth", () => {',
    '  test("TC-001 - AC-001 active nav only", async ({ page }) => {',
    '    await expect(page).toHaveURL("/dashboard");',
    '  });',
    '  test("TC-002 - AC-002 wip nav only", async ({ page }) => {',
    '    await expect(page).toHaveURL("/login");',
    '  });',
    '  test.skip("TC-004 - AC-002 skipped nav only", async ({ page }) => {',
    '    await expect(page).toHaveURL("/login");',
    '  });',
    '});',
  ].join('\n');

  const billingSpecContent = [
    "import { test, expect } from '@playwright/test';",
    'test("TC-010 - AC-001 billing nav only", async ({ page }) => {',
    '  await expect(page).toHaveURL("/billing");',
    '});',
  ].join('\n');

  withRepo(
    {
      ...DOCS,
      'requirements/REQ-002.md':
        '---\nid: REQ-002\ntitle: Billing\nstatus: Ready for Test\n---\n\n### AC-001: Billing page\n',
      'test-cases/REQ-002.md':
        '# TC 2\n\n## Traceability\n| Req | AC | TC | Status | Spec | Priority |\n|---|---|---|---|---|---|\n| REQ-002 | AC-001 | TC-010 | Yes | `playwright/tests/billing/bill.spec.ts` | P1 |\n',
      'playwright/tests/auth/login.spec.ts': specFileContent,
      'playwright/tests/billing/bill.spec.ts': billingSpecContent,
    },
    (root) => {
      const listJson = {
        config: { rootDir: path.join(root, 'playwright/tests') },
        suites: [
          {
            specs: [
              { title: 'TC-001 - AC-001 active nav only', file: 'auth/login.spec.ts', line: 3, tags: ['@REQ-001', '@smoke'] },
              { title: 'TC-002 - AC-002 wip nav only', file: 'auth/login.spec.ts', line: 6, tags: ['@REQ-001', '@wip'] },
              { title: 'TC-004 - AC-002 skipped nav only', file: 'auth/login.spec.ts', line: 9, tags: ['@REQ-001'] },
              { title: 'TC-010 - AC-001 billing nav only', file: 'billing/bill.spec.ts', line: 2, tags: ['@REQ-002', '@regression'] },
            ],
          },
        ],
      };

      const allNav = gaps(root, { listJson, loadAutomated: loadAutomatedTests }).filter(
        (f) => f.kind === 'spec-chi-assert-url',
      );
      assert.deepEqual(allNav.map((f) => f.where), [
        'playwright/tests/auth/login.spec.ts:3',
        'playwright/tests/billing/bill.spec.ts:2',
      ]);

      const ignoredBilling = gaps(root, {
        listJson,
        loadAutomated: loadAutomatedTests,
        ignoreSpecs: ['playwright/tests/billing'],
      }).filter((f) => f.kind === 'spec-chi-assert-url');
      assert.deepEqual(ignoredBilling.map((f) => f.where), ['playwright/tests/auth/login.spec.ts:3']);

      const byReq = gaps(root, {
        listJson,
        loadAutomated: loadAutomatedTests,
        filterReq: 'REQ-002',
      }).filter((f) => f.kind === 'spec-chi-assert-url');
      assert.deepEqual(byReq.map((f) => f.where), ['playwright/tests/billing/bill.spec.ts:2']);

      const byDomain = gaps(root, {
        listJson,
        loadAutomated: loadAutomatedTests,
        filterDomain: 'auth',
      }).filter((f) => f.kind === 'spec-chi-assert-url');
      assert.deepEqual(byDomain.map((f) => f.where), ['playwright/tests/auth/login.spec.ts:3']);

      const byTag = gaps(root, {
        listJson,
        loadAutomated: loadAutomatedTests,
        filterTag: '@smoke',
      }).filter((f) => f.kind === 'spec-chi-assert-url');
      assert.deepEqual(byTag.map((f) => f.where), ['playwright/tests/auth/login.spec.ts:3']);
    },
  );
});

test('S10: --strict với minor spec-chi-assert-url vẫn exit 0; major (spec-thieu-assertion / assertion-thieu-await) vẫn exit 1', () => {
  const navOnlyTests = [
    spec('TC-001 - AC-001 nav only', {
      assertionCount: 1,
      onlyNavigationAssert: true,
      assertionProfile: {
        kind: 'navigation-only',
        matchers: ['toHaveURL'],
        reason: 'only-page-navigation-matchers',
      },
    }),
    spec('TC-002 - AC-002 mixed', {
      assertionCount: 2,
      onlyNavigationAssert: false,
      assertionProfile: {
        kind: 'mixed',
        matchers: ['toHaveURL', 'toBeVisible'],
        reason: 'has-non-navigation-matchers',
      },
    }),
  ];

  withRepo(DOCS, (root) => {
    const minorFindings = gaps(root, opts(navOnlyTests));
    assert.equal(minorFindings.length, 1);
    assert.equal(minorFindings[0].kind, 'spec-chi-assert-url');
    assert.equal(minorFindings[0].severity, 'minor');
    const blockingMinor = minorFindings.filter(
      (f) => (SEVERITY_RANK[f.severity] || 0) >= SEVERITY_RANK.major,
    );
    assert.equal(blockingMinor.length, 0, 'minor spec-chi-assert-url không được chặn gate --strict');

    const withMajor = [
      ...navOnlyTests,
      spec('TC-004 - AC-001 missing await', {
        assertionCount: 1,
        missingAwaits: [{ line: 12, text: 'expect(page).toHaveURL("/dashboard");' }],
      }),
    ];
    const majorFindings = gaps(root, opts(withMajor));
    const blockingMajor = majorFindings.filter(
      (f) => (SEVERITY_RANK[f.severity] || 0) >= SEVERITY_RANK.major,
    );
    assert.ok(blockingMajor.length >= 1, 'major finding vẫn phải chặn gate --strict');
  });
});

// ===========================================================================
// Plan 14 Phase 3: Deep Coverage Gates & Learner Sync (TC-14-P3-06 / AC-14-P3-05)
// ===========================================================================

test('TC-14-P3-06: gaps phát hiện weak-existence-assertion, missing-idempotency-guard, missing-ui-coverage, missing-xss-coverage và đồng bộ với config.js + learner.js (AC-14-P3-05)', () => {
  const deepReq = `---
id: REQ-001
title: Đăng nhập
status: Ready for Test
version: 1.0
risk: High
owner: Auth squad
test_cases: test-cases/REQ-001.md
---
# REQ-001: Đăng nhập
- **Page exposure**: Public
- **UI coverage**: Required
- **XSS applicability**: Applicable

## Acceptance criteria
### AC-001: Đăng nhập thành công
### AC-002: Sai mật khẩu
`;

  const deepTc = `# Test cases: REQ-001
## Traceability
| Requirement | Acceptance criterion | Test case | Automation | Spec | Priority |
|---|---|---|---|---|---|
| REQ-001 | AC-001 | TC-001 | Yes | \`playwright/tests/login.spec.ts\` | P0 |
| REQ-001 | AC-002 | TC-002 | Yes | \`playwright/tests/login.spec.ts\` | P1 |

## Test cases
### TC-001: Đăng nhập thành công
- **Capabilities**: idempotency

### TC-002: Sai mật khẩu
`;

  const specWithWeakAndMissingGuards = [
    "import { test, expect } from '@playwright/test';",
    'test.describe("Auth", { tag: "@REQ-001" }, () => {',
    '  test("TC-001 - AC-001 weak existence only", async ({ page }) => {',
    '    const user = { id: 1 };',
    '    expect(user).toBeDefined();',
    '  });',
    '  test("TC-002 - AC-002 normal assert", async ({ page }) => {',
    '    await expect(page.getByRole("alert")).toBeVisible();',
    '  });',
    '});',
  ].join('\n');

  withRepo(
    {
      'requirements/REQ-001.md': deepReq,
      'test-cases/REQ-001.md': deepTc,
      'playwright/tests/login.spec.ts': specWithWeakAndMissingGuards,
    },
    (root) => {
      const cfg = loadConfig(root);
      assert.equal(cfg.checkDeepCoverage, false, 'checkDeepCoverage mặc định phải là false');

      const listJson = {
        config: { rootDir: path.join(root, 'playwright/tests') },
        suites: [
          {
            specs: [
              { title: 'TC-001 - AC-001 weak existence only', file: 'login.spec.ts', line: 3, tags: ['@REQ-001'] },
              { title: 'TC-002 - AC-002 normal assert', file: 'login.spec.ts', line: 7, tags: ['@REQ-001'] },
            ],
          },
        ],
      };

      const defaultFindings = gaps(root, { listJson, loadAutomated: loadAutomatedTests });
      const weakFinding = defaultFindings.find((f) => f.kind === 'weak-existence-assertion');
      const idemFinding = defaultFindings.find((f) => f.kind === 'missing-idempotency-guard');
      const uiFinding = defaultFindings.find((f) => f.kind === 'missing-ui-coverage');
      const xssFinding = defaultFindings.find((f) => f.kind === 'missing-xss-coverage');

      assert.ok(weakFinding, 'phải bắt lỗi weak-existence-assertion khi chỉ dùng toBeDefined()');
      assert.equal(weakFinding.severity, 'minor', 'khi checkDeepCoverage=false thì ở mức minor (WARN)');
      assert.ok(idemFinding, 'phải bắt lỗi missing-idempotency-guard');
      assert.ok(uiFinding, 'phải bắt lỗi missing-ui-coverage');
      assert.ok(xssFinding, 'phải bắt lỗi missing-xss-coverage');

      const strictFindings = gaps(root, {
        listJson,
        loadAutomated: loadAutomatedTests,
        checkDeepCoverage: true,
      });
      assert.equal(
        strictFindings.find((f) => f.kind === 'weak-existence-assertion').severity,
        'major',
        'khi checkDeepCoverage=true thì nâng lên mức major (ERROR)',
      );

      const learnerRuleSet = new Set(STATIC_RULE_MAPPING.map((m) => m.findingKind));
      assert.ok(learnerRuleSet.has('weak-existence-assertion'));
      assert.ok(learnerRuleSet.has('missing-idempotency-guard'));
    },
  );
});

