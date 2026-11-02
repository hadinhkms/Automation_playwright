'use strict';

/**
 * Unit test cho findMissingAwaits(), Navigation Assertion Heuristic (S01..S07),
 * loadAutomatedTests() và Verified Helper Imports (Plan 14 Phase 3: TC-14-P3-05, TC-14-P3-05c).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  loadAutomatedTests,
  findMissingAwaits,
  extractTestCallbackBody,
  extractVerifiedHelperImports,
  analyzeTestAssertions,
  PLAYWRIGHT_SAFE_CALL_WHITELIST,
} = require('./sources');
const { withRepo } = require('../__tests__/sourcesFixture');

// ===========================================================================
// findMissingAwaits
// ===========================================================================

test('findMissingAwaits: bắt được expect có locator viết inline (ca từng bị bỏ sót)', () => {
  const hits = findMissingAwaits(["expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();"], 1);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].matcher, 'toBeVisible');
  assert.equal(hits[0].line, 1);
});

test('findMissingAwaits: không báo khi đã có await hoặc return', () => {
  assert.equal(findMissingAwaits(["await expect(page.getByRole('x')).toBeVisible();"], 1).length, 0);
  assert.equal(findMissingAwaits(['return expect(page.locator("#a")).toHaveText("x");'], 1).length, 0);
});

test('findMissingAwaits: bỏ qua matcher đồng bộ, bắt matcher có .not', () => {
  assert.equal(findMissingAwaits(['expect(cookies.length).toBeGreaterThan(0);'], 1).length, 0);
  assert.equal(findMissingAwaits(['await expect.soft(s?.secure).toBe(true);'], 1).length, 0);
  assert.equal(findMissingAwaits(['expect(page.getByTestId("x")).not.toBeVisible();'], 1).length, 1);
});

test('findMissingAwaits: dấu ngoặc nằm trong chuỗi không làm lệch bộ đếm', () => {
  const hits = findMissingAwaits(['expect(page.getByRole("link", { name: "a(b)" })).toBeVisible();'], 1);
  assert.equal(hits.length, 1);
});

test('findMissingAwaits: expect trải nhiều dòng — báo đúng dòng, không báo cái có await', () => {
  const body = [
    'await expect(page.getByRole("heading", {',
    '  name: "Dashboard",',
    '})).toBeVisible();',
    'expect(page.getByRole("alert", {',
    '  name: "Error",',
    '})).toBeVisible();',
  ];
  const hits = findMissingAwaits(body, 10);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].line, 13);
});

test('findMissingAwaits: trả column là vị trí chữ "expect" trong dòng (cho bộ sửa tự động)', () => {
  const hits = findMissingAwaits(
    [
      '  await page.goto("/");',
      '  doWork();expect(a).toBe(1); expect.soft(page.locator("#x")).toBeVisible();',
    ],
    5,
  );
  assert.equal(hits.length, 1);
  assert.equal(hits[0].line, 6);
  assert.equal(hits[0].column, 30);
  assert.equal(hits[0].text.startsWith('doWork();'), true);
});

test('findMissingAwaits: danh sách matcher ghi đè được qua tham số', () => {
  const custom = new Set(['toBeSomethingNew']);
  assert.equal(findMissingAwaits(['expect(x).toBeSomethingNew();'], 1, custom).length, 1);
  assert.equal(findMissingAwaits(['expect(x).toBeVisible();'], 1, custom).length, 0);
});

// ===========================================================================
// Plan 13 Phase 5: Navigation Assertion Heuristic & Callback Scanner (S01–S07)
// ===========================================================================

test('S01: chỉ toHaveURL, chỉ toHaveTitle, hoặc cả hai trên page/alias -> navigation-only', () => {
  assert.ok(PLAYWRIGHT_SAFE_CALL_WHITELIST.has('goto'));
  assert.ok(PLAYWRIGHT_SAFE_CALL_WHITELIST.has('fill'));
  assert.ok(PLAYWRIGHT_SAFE_CALL_WHITELIST.has('click'));

  const urlOnly = analyzeTestAssertions(`
    await page.goto('/login');
    await page.getByLabel('Email').fill('user@example.com');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\\/dashboard/);
  `);
  assert.equal(urlOnly.kind, 'navigation-only');
  assert.deepEqual(urlOnly.matchers, ['toHaveURL']);

  const titleOnly = analyzeTestAssertions(`
    await page.goto('/dashboard');
    await expect(page).toHaveTitle('Dashboard');
  `);
  assert.equal(titleOnly.kind, 'navigation-only');
  assert.deepEqual(titleOnly.matchers, ['toHaveTitle']);

  const bothWithAlias = analyzeTestAssertions(`
    test('TC-001 - AC-001 redirect', async ({ page: userPage }) => {
      const activePage = userPage;
      await activePage.goto('/login');
      await expect(userPage).toHaveURL('/dashboard');
      await expect(activePage).toHaveTitle(/Dashboard/);
    });
  `);
  assert.equal(bothWithAlias.kind, 'navigation-only');
  assert.deepEqual(bothWithAlias.matchers, ['toHaveURL', 'toHaveTitle']);
});

test('S02: URL + UI/data matcher -> mixed; zero assertion với thao tác Playwright chuẩn -> none', () => {
  const mixed = analyzeTestAssertions(`
    await page.goto('/login');
    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible();
  `);
  assert.equal(mixed.kind, 'mixed');
  assert.deepEqual(mixed.matchers, ['toHaveURL', 'toBeVisible']);

  const syncDataMixed = analyzeTestAssertions(`
    await expect(page).toHaveURL('/dashboard');
    const cookies = await page.context().cookies();
    expect(cookies.length).toBeGreaterThan(0);
  `);
  assert.equal(syncDataMixed.kind, 'mixed');
  assert.deepEqual(syncDataMixed.matchers, ['toHaveURL', 'toBeGreaterThan']);

  const none = analyzeTestAssertions(`
    await page.goto('/login');
    await page.getByLabel('Email').fill('user@example.com');
    await page.getByRole('button', { name: 'Sign in' }).click();
  `);
  assert.equal(none.kind, 'none');
  assert.deepEqual(none.matchers, []);
});

test('S03: multiline expect, expect.soft, .not, .resolves, .rejects parse đúng', () => {
  const multilineSoftNot = analyzeTestAssertions(`
    await expect
      .soft(
        page
      )
      .not
      .toHaveURL('/login');
    await expect(
      page
    ).toHaveTitle(
      /Dashboard/
    );
  `);
  assert.equal(multilineSoftNot.kind, 'navigation-only');
  assert.deepEqual(multilineSoftNot.matchers, ['toHaveURL', 'toHaveTitle']);

  const resolvesMixed = analyzeTestAssertions(`
    await expect(page).toHaveURL('/dashboard');
    await expect(page.title()).resolves.toBe('Dashboard');
  `);
  assert.equal(resolvesMixed.kind, 'mixed');
  assert.deepEqual(resolvesMixed.matchers, ['toHaveURL', 'toBe']);

  const rejectsMixed = analyzeTestAssertions(`
    await expect(Promise.reject(new Error('fail'))).rejects.toThrow('fail');
  `);
  assert.equal(rejectsMixed.kind, 'mixed');
  assert.deepEqual(rejectsMixed.matchers, ['toThrow']);
});

test('S04: comment/string/template giả không đếm; syntax mơ hồ hoặc template interpolation gọi hàm -> unknown', () => {
  const fakeInCommentAndString = analyzeTestAssertions(`
    await page.goto(\`\${baseUrl}/login\`);
    // await expect(page.getByRole('heading')).toBeVisible();
    /* await expect(page.locator('#toast')).toHaveText('Saved'); */
    const note = "await expect(page.getByRole('alert')).toBeVisible()";
    const tpl = \`await expect(page.locator('.card')).toHaveCount(3)\`;
    await expect(page).toHaveURL('/dashboard');
  `);
  assert.equal(fakeInCommentAndString.kind, 'navigation-only');
  assert.deepEqual(fakeInCommentAndString.matchers, ['toHaveURL']);

  const ambiguousTemplateCall = analyzeTestAssertions(`
    const msg = \`\${await verifyDashboard(page)}\`;
    await expect(page).toHaveURL('/dashboard');
  `);
  assert.equal(ambiguousTemplateCall.kind, 'unknown');
  assert.match(ambiguousTemplateCall.reason, /ambiguous-template-interpolation/);

  const unclosedBrace = analyzeTestAssertions(`
    if (true) {
      await expect(page).toHaveURL('/dashboard');
  `);
  assert.equal(unclosedBrace.kind, 'unknown');
  assert.match(unclosedBrace.reason, /unclosed-delimiter/);

  const unclosedString = analyzeTestAssertions(`
    const s = "unclosed string
    await expect(page).toHaveURL('/dashboard');
  `);
  assert.equal(unclosedString.kind, 'unknown');
  assert.match(unclosedString.reason, /unclosed-string-literal/);
});

test('S05: hai test liên tiếp, nested callback, hook trước/sau, sâu indentation không lẫn body', () => {
  const specSource = [
    "import { test, expect } from '@playwright/test';",
    'test.describe("Outer", () => {',
    '  test.describe("Inner", () => {',
    '    test.beforeEach(async ({ page }) => {',
    '      await expect(page.getByTestId("ready")).toBeVisible();',
    '    });',
    '',
    '    test("TC-001 - AC-001 nav only", { tag: "@smoke" }, async ({ page }) => {',
    '      await page.route("**/api/**", (route) => {',
    '        route.continue();',
    '      });',
    '      await page.goto("/login");',
    '      await expect(page).toHaveURL("/dashboard");',
    '    });',
    '        test("TC-002 - AC-001 deep indent UI assert", async ({ page }) => {',
    '          await expect(page.getByRole("heading")).toBeVisible();',
    '        });',
    '',
    '    test.afterEach(async ({ page }) => {',
    '      await expect(page.getByTestId("footer")).toBeVisible();',
    '    });',
    '  });',
    '});',
  ];

  const tc1Line = specSource.findIndex((l) => l.includes('TC-001 - AC-001')) + 1;
  const tc2Line = specSource.findIndex((l) => l.includes('TC-002 - AC-001')) + 1;

  const ext1 = extractTestCallbackBody(specSource, tc1Line);
  assert.equal(ext1.ok, true);
  assert.ok(!ext1.bodyText.includes('toBeVisible'), 'TC-001 không được hút assertion từ hook hoặc TC-002');
  const prof1 = analyzeTestAssertions(ext1.bodyText, { paramsText: ext1.paramsText });
  assert.equal(prof1.kind, 'navigation-only');
  assert.deepEqual(prof1.matchers, ['toHaveURL']);

  const ext2 = extractTestCallbackBody(specSource, tc2Line);
  assert.equal(ext2.ok, true);
  const prof2 = analyzeTestAssertions(ext2.bodyText, { paramsText: ext2.paramsText });
  assert.equal(prof2.kind, 'mixed');
  assert.deepEqual(prof2.matchers, ['toBeVisible']);
});

test('S06: helper call, custom expect, custom matcher, expect.poll, expect.configure, dynamic call -> unknown', () => {
  const withHelper = analyzeTestAssertions(`
    await page.goto('/login');
    await expect(page).toHaveURL('/dashboard');
    await verifyDashboardWidgets(page);
  `);
  assert.equal(withHelper.kind, 'unknown');
  assert.match(withHelper.reason, /unresolved-helper-call:verifyDashboardWidgets/);

  const customExpect = analyzeTestAssertions(`
    await customExpect(page.getByRole('heading')).toBeVisible();
  `);
  assert.equal(customExpect.kind, 'unknown');
  assert.match(customExpect.reason, /unresolved-helper-call:customExpect/);

  const customMatcher = analyzeTestAssertions(`
    await expect(page).toHaveValidSessionCookie();
  `);
  assert.equal(customMatcher.kind, 'unknown');
  assert.match(customMatcher.reason, /custom-or-unknown-matcher:toHaveValidSessionCookie/);

  const expectPoll = analyzeTestAssertions(`
    await expect.poll(async () => page.url()).toContain('/dashboard');
  `);
  assert.equal(expectPoll.kind, 'unknown');
  assert.match(expectPoll.reason, /unsupported-expect-variant:expect\.poll/);

  const expectConfigure = analyzeTestAssertions(`
    const softExpect = expect.configure({ soft: true });
    await softExpect(page).toHaveURL('/dashboard');
  `);
  assert.equal(expectConfigure.kind, 'unknown');
  assert.match(expectConfigure.reason, /unsupported-expect-variant:expect\.configure/);

  const dynamicMatcher = analyzeTestAssertions(`
    await expect(page)[matcherName]('/dashboard');
  `);
  assert.equal(dynamicMatcher.kind, 'unknown');
  assert.match(dynamicMatcher.reason, /dynamic-or-incomplete-expect-chain/);
});

test('S07: toHaveTitle/toHaveURL trên locator hoặc custom receiver không rõ -> unknown (không coi là page navigation)', () => {
  const locatorTitle = analyzeTestAssertions(`
    await page.goto('/dashboard');
    await expect(page.locator('.card-header')).toHaveTitle('Account Overview');
  `);
  assert.equal(locatorTitle.kind, 'unknown');
  assert.match(locatorTitle.reason, /non-page-navigation-receiver/);

  const customReceiverTitle = analyzeTestAssertions(`
    await expect(customPopupPage).toHaveTitle('Popup');
  `);
  assert.equal(customReceiverTitle.kind, 'unknown');
  assert.match(customReceiverTitle.reason, /non-page-navigation-receiver:customPopupPage/);

  const customReceiverUrl = analyzeTestAssertions(`
    test('TC-001 - AC-001 no page fixture', async ({ browser }) => {
      const popup = await browser.newPage();
      await expect(popup).toHaveURL('/popup');
    });
  `);
  assert.equal(customReceiverUrl.kind, 'unknown');
  assert.match(customReceiverUrl.reason, /non-page-navigation-receiver:popup/);
});

test('loadAutomatedTests: gắn đúng assertionProfile và onlyNavigationAssert từ file spec thật trên đĩa', () => {
  const specContent = [
    "import { test, expect } from '@playwright/test';",
    'test.describe("Auth", { tag: "@REQ-001" }, () => {',
    '  test("TC-001 - AC-001 chỉ assert URL", async ({ page }) => {',
    '    await page.goto("/login");',
    '    await expect(page).toHaveURL("/dashboard");',
    '  });',
    '  test("TC-002 - AC-001 assert URL + UI", async ({ page }) => {',
    '    await page.goto("/login");',
    '    await expect(page).toHaveURL("/dashboard");',
    '    await expect(page.getByRole("heading")).toBeVisible();',
    '  });',
    '});',
  ].join('\n');

  withRepo({ 'playwright/tests/auth.spec.ts': specContent }, (root) => {
    const listJson = {
      config: { rootDir: path.join(root, 'playwright/tests') },
      suites: [
        {
          specs: [
            { title: 'TC-001 - AC-001 chỉ assert URL', file: 'auth.spec.ts', line: 3, tags: ['@REQ-001'] },
            { title: 'TC-002 - AC-001 assert URL + UI', file: 'auth.spec.ts', line: 7, tags: ['@REQ-001'] },
          ],
        },
      ],
    };

    const res = loadAutomatedTests(root, { listJson });
    assert.equal(res.error, null);
    assert.equal(res.tests.length, 2);

    const tc1 = res.tests.find((t) => t.tcId === 'TC-001');
    assert.equal(tc1.onlyNavigationAssert, true);
    assert.equal(tc1.assertionProfile.kind, 'navigation-only');
    assert.deepEqual(tc1.assertionProfile.matchers, ['toHaveURL']);
    assert.equal(tc1.assertionCount, 1);

    const tc2 = res.tests.find((t) => t.tcId === 'TC-002');
    assert.equal(tc2.onlyNavigationAssert, false);
    assert.equal(tc2.assertionProfile.kind, 'mixed');
    assert.deepEqual(tc2.assertionProfile.matchers, ['toHaveURL', 'toBeVisible']);
    assert.equal(tc2.assertionCount, 2);
  });
});

// ===========================================================================
// Plan 14 Phase 3: Verified Helper Imports & Missing Awaits (TC-14-P3-05, TC-14-P3-05c)
// ===========================================================================

test('TC-14-P3-05: extractVerifiedHelperImports, analyzeTestAssertions và findMissingAwaits nhận diện alias/multiline import và bắt thiếu await (AC-14-P3-04)', () => {
  const specLines = [
    'import {',
    '  expectNoTextOverflow as checkOverflow,',
    '  expectResponsiveIntegrity,',
    "} from '../../src/support/ui-checks';",
    "import { expectIdempotentSubmit } from '../support/deep-guards';",
    "import { expectNoTextOverflow as fakeLocal } from './local-helper';",
    'test("TC-001 - AC-001 check UI and idempotency", async ({ page }) => {',
    '  checkOverflow(page);',
    '  await expectIdempotentSubmit(page, page.locator("#btn"), "/api/login");',
    '  await Promise.all([expectResponsiveIntegrity(page)]);',
    '});',
  ];

  const verifiedMap = extractVerifiedHelperImports(specLines);
  assert.equal(verifiedMap.get('checkOverflow'), 'expectNoTextOverflow');
  assert.equal(verifiedMap.get('expectResponsiveIntegrity'), 'expectResponsiveIntegrity');
  assert.equal(verifiedMap.get('expectIdempotentSubmit'), 'expectIdempotentSubmit');
  assert.equal(
    verifiedMap.has('fakeLocal'),
    false,
    'không được nhận diện import từ module không phải support/ui-checks hoặc support/deep-guards',
  );

  const profile = analyzeTestAssertions(specLines);
  assert.equal(profile.kind, 'mixed');
  assert.equal(profile.weakExistenceOnly, false);
  assert.deepEqual(profile.matchers, [
    'helper:expectNoTextOverflow',
    'helper:expectIdempotentSubmit',
    'helper:expectResponsiveIntegrity',
  ]);

  const missing = findMissingAwaits(specLines, 1, undefined, verifiedMap);
  assert.equal(missing.length, 1, 'chỉ checkOverflow(page) thiếu await; Promise.all và await không bị báo');
  assert.equal(missing[0].line, 8);
  assert.equal(missing[0].matcher, 'helper:expectNoTextOverflow');

  const unverifiedLocal = analyzeTestAssertions(`
    await page.goto('/login');
    await expectNoTextOverflow(page);
  `);
  assert.equal(unverifiedLocal.kind, 'unknown');
  assert.match(unverifiedLocal.reason, /unresolved-helper-call:expectNoTextOverflow/);

  const weakOnly = analyzeTestAssertions(`
    const res = { ok: true };
    expect(res).toBeDefined();
    expect(res.ok).toBeTruthy();
  `);
  assert.equal(weakOnly.kind, 'mixed');
  assert.equal(weakOnly.weakExistenceOnly, true);
});

test('TC-14-P3-05c: extractVerifiedHelperImports nhận diện expectNetworkFaultRecovery, expectMultiTabConcurrency và CommonJS require từ core/deep-testing', () => {
  const cjsSpec = [
    "const { expectNoTextOverflow, expectNetworkFaultRecovery: checkFault, expectMultiTabConcurrency } = require('../../core/deep-testing');",
    "test('TC-001 - AC-001 resilience check', async ({ page }) => {",
    '  await expectNoTextOverflow(page);',
    "  await checkFault(page, async () => {}, { urlPattern: '**/api', errorLocator: page.locator('#err') });",
    '  await expectMultiTabConcurrency(page, { setupBothTabs: async () => {}, tabAAction: async () => {}, tabBConflictingAction: async () => {}, verifyConflictOrIsolation: async () => {} });',
    '});',
  ];
  const map = extractVerifiedHelperImports(cjsSpec);
  assert.equal(map.get('expectNoTextOverflow'), 'expectNoTextOverflow');
  assert.equal(map.get('checkFault'), 'expectNetworkFaultRecovery');
  assert.equal(map.get('expectMultiTabConcurrency'), 'expectMultiTabConcurrency');

  const profile = analyzeTestAssertions(cjsSpec);
  assert.equal(profile.kind, 'mixed');
  assert.deepEqual(profile.matchers, [
    'helper:expectNoTextOverflow',
    'helper:expectNetworkFaultRecovery',
    'helper:expectMultiTabConcurrency',
  ]);
});

test('TC-14-P3-05d: extractVerifiedHelperImports nhận diện các sub-module sau khi tách core/deep-testing (ui-layout-checks, ui-responsive-checks, security-guards)', () => {
  const splitSpec = [
    "const { expectNoTextOverflow } = require('../../core/deep-testing/ui-layout-checks');",
    "const { expectResponsiveIntegrity } = require('../../core/deep-testing/ui-responsive-checks');",
    "const { expectSafeXssRender } = require('../../core/deep-testing/security-guards');",
    "test('TC-001 - AC-001 sub-module imports', async ({ page }) => {",
    '  expectNoTextOverflow(page);',
    '  await expectResponsiveIntegrity(page);',
    "  await expectSafeXssRender(page, async () => {}, { sinkLocator: page.locator('#out') });",
    '});',
  ];
  const map = extractVerifiedHelperImports(splitSpec);
  assert.equal(map.get('expectNoTextOverflow'), 'expectNoTextOverflow');
  assert.equal(map.get('expectResponsiveIntegrity'), 'expectResponsiveIntegrity');
  assert.equal(map.get('expectSafeXssRender'), 'expectSafeXssRender');

  const missing = findMissingAwaits(splitSpec, 1, undefined, map);
  assert.equal(missing.length, 1);
  assert.equal(missing[0].line, 5);
  assert.equal(missing[0].matcher, 'helper:expectNoTextOverflow');
});


