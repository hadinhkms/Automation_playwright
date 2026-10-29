'use strict';

/**
 * Unit test cho drift(), impact(), matrix(), summary() và quy ước multi-TC trong tools/qa.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { coverage, gaps, impact, drift, matrix, summary } = require('./commands');
const {
  withRepo,
  spec,
  opts,
  only,
  mustReplace,
  REQ,
  DOCS,
  CLEAN_TESTS,
  MANIFEST_OK,
  MULTI_TC_TESTS,
} = require('../__tests__/commandsFixture');

// ===========================================================================
// drift()
// ===========================================================================

test('drift: repo sạch không sinh finding nào', () => {
  withRepo(DOCS, (root) => {
    assert.deepEqual(drift(root, opts(CLEAN_TESTS)), []);
  });
});

test('drift: test không mở đầu bằng TC-xxx -> major test-khong-co-ma-tc', () => {
  withRepo(DOCS, (root) => {
    const tests = [
      ...CLEAN_TESTS,
      spec('đăng nhập rồi làm gì đó', { file: 'playwright/tests/lac.spec.js', line: 4 }),
    ];
    const found = only(drift(root, opts(tests)), 'test-khong-co-ma-tc');
    assert.equal(found.length, 1);
    assert.equal(found[0].severity, 'major');
    assert.equal(found[0].where, 'playwright/tests/lac.spec.js:4', 'where phải mở được từ gốc repo');
    assert.deepEqual(only(drift(root, opts(tests)), 'script-khong-co-trong-test-case'), []);
  });
});

test('drift: test có mã TC nhưng thiếu tag @REQ -> major test-thieu-tag-req', () => {
  withRepo(DOCS, (root) => {
    const tests = [CLEAN_TESTS[0], spec('TC-002 - AC-002 hiện lỗi chung', { reqId: null, line: 15 })];
    const found = only(drift(root, opts(tests)), 'test-thieu-tag-req');
    assert.equal(found.length, 1);
    assert.equal(found[0].severity, 'major');
    assert.ok(found[0].message.includes('TC-002'));
  });
});

test('drift: test gắn REQ đã bị xoá -> blocker test-tro-toi-req-khong-ton-tai', () => {
  withRepo(DOCS, (root) => {
    const tests = [CLEAN_TESTS[0], spec('TC-002 - AC-002 hiện lỗi chung', { reqId: 'REQ-404' })];
    const found = only(drift(root, opts(tests)), 'test-tro-toi-req-khong-ton-tai');
    assert.equal(found.length, 1);
    assert.equal(found[0].severity, 'blocker');
    assert.ok(found[0].message.includes('REQ-404'));
  });
});

test('drift: test trỏ tới AC đã biến mất -> blocker test-tro-toi-ac-khong-ton-tai', () => {
  withRepo(DOCS, (root) => {
    const tests = [CLEAN_TESTS[0], spec('TC-002 - AC-009 hiện lỗi chung')];
    const found = only(drift(root, opts(tests)), 'test-tro-toi-ac-khong-ton-tai');
    assert.equal(found.length, 1);
    assert.equal(found[0].severity, 'blocker');
    assert.ok(found[0].message.includes('AC-009'));
  });
});

test('drift: script có mã TC lạ so với bảng traceability -> major script-khong-co-trong-test-case', () => {
  withRepo(DOCS, (root) => {
    const tests = [...CLEAN_TESTS, spec('TC-777 - AC-001 case ai đó thêm tay', { line: 30 })];
    const found = only(drift(root, opts(tests)), 'script-khong-co-trong-test-case');
    assert.equal(found.length, 1);
    assert.equal(found[0].severity, 'major');
    assert.ok(found[0].message.includes('TC-777'));
  });
});

test('drift: front-matter test_cases trỏ sai file -> blocker test-case-file-khong-ton-tai', () => {
  withRepo(
    {
      ...DOCS,
      'requirements/REQ-001.md': mustReplace(
        REQ,
        'test_cases: test-cases/REQ-001.md',
        'test_cases: test-cases/da-doi-ten.md',
      ),
    },
    (root) => {
      const found = only(drift(root, opts(CLEAN_TESTS)), 'test-case-file-khong-ton-tai');
      assert.equal(found.length, 1);
      assert.equal(found[0].severity, 'blocker');
      assert.equal(found[0].where, 'requirements/REQ-001.md');
      assert.ok(found[0].message.includes('test-cases/da-doi-ten.md'));
    },
  );

  withRepo(DOCS, (root) => {
    assert.deepEqual(only(drift(root, opts(CLEAN_TESTS)), 'test-case-file-khong-ton-tai'), []);
  });
});

test('drift: requirement còn Draft mà đã có script -> major requirement-draft-nhung-da-co-script', () => {
  withRepo(
    { ...DOCS, 'requirements/REQ-001.md': mustReplace(REQ, 'status: Ready for Test', 'status: Draft') },
    (root) => {
      const found = only(drift(root, opts(CLEAN_TESTS)), 'requirement-draft-nhung-da-co-script');
      assert.equal(found.length, 1);
      assert.equal(found[0].severity, 'major');
      assert.equal(found[0].where, 'requirements/REQ-001.md');
    },
  );

  withRepo(DOCS, (root) => {
    assert.deepEqual(
      only(drift(root, opts(CLEAN_TESTS)), 'requirement-draft-nhung-da-co-script'),
      [],
      'status Ready for Test thì có script là đúng, không phải drift',
    );
  });
});

test('drift: requirement Draft có script nhưng toàn bộ mang tag @wip -> requirement-moi-scaffold-chua-hoan-thien mức minor', () => {
  const draftReq = REQ.replace('status: Ready for Test', 'status: Draft');
  const wipTests = [
    { ...spec('TC-001 - AC-001 valid'), tags: ['@REQ-001', '@wip'] },
    { ...spec('TC-002 - AC-002 invalid'), tags: ['@REQ-001', '@wip'] },
  ];
  const repo = { ...DOCS, 'requirements/REQ-001.md': draftReq };
  withRepo(repo, (root) => {
    const findings = drift(root, opts(wipTests));
    const f = findings.find((x) => x.kind === 'requirement-moi-scaffold-chua-hoan-thien');
    assert.ok(f, 'phải có finding requirement-moi-scaffold-chua-hoan-thien');
    assert.equal(f.severity, 'minor');
    const major = findings.find((x) => x.kind === 'requirement-draft-nhung-da-co-script');
    assert.equal(major, undefined, 'không được báo major khi script toàn @wip');
  });
});

test('drift: file *.setup.* được bỏ qua hoàn toàn, không đòi mã TC hay tag REQ', () => {
  withRepo(DOCS, (root) => {
    const tests = [
      ...CLEAN_TESTS,
      spec('đăng nhập lấy storageState', {
        file: 'playwright/tests/auth.setup.ts',
        reqId: null,
        isSetup: true,
      }),
    ];
    assert.deepEqual(drift(root, opts(tests)), []);
  });
});

test('drift: cũng phải hét lên khi đọc được 0 spec mà repo đã có test case', () => {
  withRepo(DOCS, (root) => {
    const found = only(
      drift(root, opts([], { emptyResult: true, emptyMessage: 'Đọc được 0 test' })),
      'doc-duoc-0-spec',
    );
    assert.equal(found.length, 1, 'drift im lặng khi không đọc được spec chính là xanh giả');
    assert.equal(found[0].severity, 'blocker');
  });
});

// ===========================================================================
// impact()
// ===========================================================================

test('impact: trả về cây AC -> TC -> spec và danh sách file cần mở', () => {
  withRepo(DOCS, (root) => {
    const r = impact(root, 'REQ-001', opts(CLEAN_TESTS));
    assert.equal(r.error, undefined);
    assert.equal(r.requirement.id, 'REQ-001');
    assert.equal(r.requirement.status, 'Ready for Test');
    assert.equal(r.requirement.version, '1.0');
    assert.equal(r.requirement.file, 'requirements/REQ-001.md');

    assert.deepEqual(r.acs.map((ac) => ac.acId), ['AC-001', 'AC-002']);
    const ac1 = r.acs[0];
    assert.deepEqual(ac1.testCases.map((tc) => tc.tcId), ['TC-001']);
    assert.equal(ac1.testCases[0].automation, 'Yes');
    assert.equal(ac1.testCases[0].priority, 'P0');
    assert.deepEqual(ac1.testCases[0].specs, ['playwright/tests/login.spec.js:7']);

    assert.ok(r.filesToReview.includes('requirements/REQ-001.md'));
    assert.ok(r.filesToReview.includes('test-cases/REQ-001.md'));
    assert.ok(r.filesToReview.includes('playwright/tests/login.spec.js:7'));
  });
});

test('impact: AC chưa có script thì specs rỗng chứ không phải thiếu nhánh', () => {
  withRepo(DOCS, (root) => {
    const r = impact(root, 'REQ-001', opts([CLEAN_TESTS[0]]));
    const ac2 = r.acs.find((ac) => ac.acId === 'AC-002');
    assert.equal(ac2.testCases.length, 1);
    assert.deepEqual(ac2.testCases[0].specs, [], 'index.js dựa vào đây để in "khai Yes nhưng không có script"');
  });
});

test('impact: REQ không tồn tại -> trả error, không ném exception', () => {
  withRepo(DOCS, (root) => {
    const r = impact(root, 'REQ-404', opts(CLEAN_TESTS));
    assert.ok(r.error, 'phải trả lỗi để index.js đặt exit code 2');
    assert.ok(r.error.includes('REQ-404'));
    assert.equal(r.acs, undefined);
  });
});

// ===========================================================================
// matrix()
// ===========================================================================

test('matrix: sinh file traceability.md với đầy đủ cột và đúng số dòng', () => {
  withRepo(DOCS, (root) => {
    const res = matrix(root, opts(CLEAN_TESTS));
    assert.equal(res.ok, true);
    assert.equal(res.rowsCount, 2);
    const traceFile = path.join(root, 'test-cases/traceability.md');
    assert.ok(fs.existsSync(traceFile));
    const content = fs.readFileSync(traceFile, 'utf8');
    assert.match(content, /# Ma Trận Truy Vết Kiểm Thử/);
    assert.match(content, /TC-001.*Yes \(Automated\)/);
    assert.match(content, /TC-002.*Yes \(Automated\)/);
  });
});

test('matrix: hoàn toàn tất định (không có timestamp, 2 lần sinh cho kết quả byte khớp 100%)', () => {
  withRepo(DOCS, (root) => {
    matrix(root, opts(CLEAN_TESTS));
    const traceFile = path.join(root, 'test-cases/traceability.md');
    const content1 = fs.readFileSync(traceFile, 'utf8');
    assert.equal(content1.includes('Sinh tự động lúc:'), false, 'không được chứa timestamp ISO');

    matrix(root, opts(CLEAN_TESTS));
    const content2 = fs.readFileSync(traceFile, 'utf8');
    assert.equal(content1, content2, 'hai lần sinh phải cho byte giống hệt nhau');
  });
});

test('matrix: ghi cảnh báo vào file khi không liệt kê được test Playwright', () => {
  withRepo(DOCS, (root) => {
    matrix(root, opts([], { error: 'npx không chạy được' }));
    const content = fs.readFileSync(path.join(root, 'test-cases/traceability.md'), 'utf8');
    assert.match(content, /Không liệt kê được test Playwright .*npx không chạy được/);

    matrix(root, opts(CLEAN_TESTS));
    const clean = fs.readFileSync(path.join(root, 'test-cases/traceability.md'), 'utf8');
    assert.equal(clean.includes('Không liệt kê được'), false);
  });
});

// ===========================================================================
// summary()
// ===========================================================================

test('summary: trả về đúng cấu trúc schema và các metrics cơ bản', () => {
  withRepo(DOCS, (root) => {
    const res = summary(root, opts(CLEAN_TESTS));
    assert.equal(res.schemaVersion, '1.0.0');
    assert.ok(res.timestamp);
    assert.equal(typeof res.metrics.coveragePercent, 'number');
    assert.equal(res.metrics.requirements, 1);
    assert.equal(res.metrics.acceptanceCriteria, 2);
    assert.ok(res.health);
    assert.ok(res.boundary);
    assert.ok(res.decisions);
    assert.ok(Array.isArray(res.findings));
  });
});

test('summary: phân loại HEALTHY khi không có blocker/major và decisions sạch', () => {
  const cleanManifest = JSON.stringify({
    ship: [],
    seed: [],
    own: [
      { path: 'requirements', reason: 'x' },
      { path: 'test-cases', reason: 'x' },
      { path: 'decisions.json', reason: 'x' },
    ],
  });
  const repo = {
    ...DOCS,
    'sync-manifest.json': cleanManifest,
    'decisions.json': JSON.stringify({
      decisions: [{ id: 'D-1', severity: 'soon', answer: { optionId: 'opt-1' } }],
    }),
  };
  withRepo(repo, (root) => {
    const res = summary(root, opts(CLEAN_TESTS));
    assert.equal(res.health.status, 'HEALTHY');
    assert.equal(res.systemHealth, 'HEALTHY');
  });
});

test('summary: phân loại WARNING khi có major finding hoặc blocking decision chờ duyệt', () => {
  const repo = {
    ...DOCS,
    'sync-manifest.json': JSON.stringify({
      ship: [],
      seed: [],
      own: [
        { path: 'requirements', reason: 'x' },
        { path: 'test-cases', reason: 'x' },
        { path: 'decisions.json', reason: 'x' },
      ],
    }),
    'decisions.json': JSON.stringify({ decisions: [{ id: 'D-1', severity: 'blocking', answer: null }] }),
  };
  withRepo(repo, (root) => {
    const res = summary(root, opts(CLEAN_TESTS));
    assert.equal(res.health.status, 'WARNING');
    assert.equal(res.systemHealth, 'WARNING');
    assert.equal(res.decisions.blocking, 1);
  });
});

test('summary: manifest khớp thực tế -> boundary ALIGNED, không có problem', () => {
  withRepo(
    {
      'sync-manifest.json': MANIFEST_OK,
      'templates/a.md': 'x',
      'qa.config.json': '{}',
      'requirements/REQ-001-x.md': '---\nid: REQ-001\n---\n\n## AC-001: a\n',
      'test-cases/REQ-001-x.md':
        '# t\n\n## Traceability\n\n| R | A | T | Au | S | P |\n|---|---|---|---|---|---|\n| REQ-001 | AC-001 | TC-001 | Yes | `x` | P0 |\n',
    },
    (root) => {
      const res = summary(
        root,
        opts([
          {
            tcId: 'TC-001',
            acId: 'AC-001',
            reqId: 'REQ-001',
            tags: ['@REQ-001'],
            path: 'x.spec.ts',
            line: 1,
            assertionCount: 1,
          },
        ]),
      );
      assert.equal(res.boundary.status, 'ALIGNED');
      assert.deepEqual(res.boundary.problems, []);
      assert.equal(res.boundary.ownCount, 2);
    },
  );
});

test('summary: có thư mục business nằm trong vùng sync -> DRIFTED kèm lý do', () => {
  withRepo(
    {
      'sync-manifest.json': MANIFEST_OK,
      'templates/requirements/leak.md': 'x',
      'qa.config.json': '{}',
      'requirements/REQ-001-x.md': '---\nid: REQ-001\n---\n\n## AC-001: a\n',
      'test-cases/REQ-001-x.md':
        '# t\n\n## Traceability\n\n| R | A | T | Au | S | P |\n|---|---|---|---|---|---|\n| REQ-001 | AC-001 | TC-001 | Yes | `x` | P0 |\n',
    },
    (root) => {
      const res = summary(
        root,
        opts([
          {
            tcId: 'TC-001',
            acId: 'AC-001',
            reqId: 'REQ-001',
            tags: ['@REQ-001'],
            path: 'x.spec.ts',
            line: 1,
            assertionCount: 1,
          },
        ]),
      );
      assert.equal(res.boundary.status, 'DRIFTED');
      assert.ok(res.boundary.problems.some((p) => p.kind === 'business-nam-trong-vung-sync'));
      assert.equal(res.health.status, 'CRITICAL');
    },
  );
});

test('summary: thiếu sync-manifest.json -> MISSING, không phải ALIGNED', () => {
  withRepo(
    {
      'requirements/REQ-001-x.md': '---\nid: REQ-001\n---\n\n## AC-001: a\n',
      'test-cases/REQ-001-x.md':
        '# t\n\n## Traceability\n\n| R | A | T | Au | S | P |\n|---|---|---|---|---|---|\n| REQ-001 | AC-001 | TC-001 | Yes | `x` | P0 |\n',
    },
    (root) => {
      const res = summary(
        root,
        opts([
          {
            tcId: 'TC-001',
            acId: 'AC-001',
            reqId: 'REQ-001',
            tags: ['@REQ-001'],
            path: 'x.spec.ts',
            line: 1,
            assertionCount: 1,
          },
        ]),
      );
      assert.equal(res.boundary.status, 'MISSING');
    },
  );
});

// ===========================================================================
// Một test phủ nhiều TC: `TC-001 - AC-001 ... [TC-001 TC-002]`
// ===========================================================================

test('multi-TC: coverage tính TC phụ trong title là đã automation', () => {
  withRepo(DOCS, (root) => {
    const r = coverage(root, opts(MULTI_TC_TESTS));
    const ac2 = r.rows.find((row) => row.acId === 'AC-002');
    assert.deepEqual(ac2.automated, ['TC-002']);
    assert.equal(r.automatedTests, 1, 'vẫn là 1 test, chỉ phủ 2 TC');
  });
});

test('multi-TC: gaps không báo TC phụ là "khai Yes nhưng không có script"', () => {
  withRepo(DOCS, (root) => {
    const findings = gaps(root, opts(MULTI_TC_TESTS));
    assert.deepEqual(only(findings, 'khai-automation-nhung-khong-co-script'), []);
    assert.deepEqual(only(findings, 'ac-chua-co-script'), []);
  });
});

test('multi-TC: không có ngoặc vuông thì TC-002 vẫn bị báo thiếu script (hành vi cũ)', () => {
  withRepo(DOCS, (root) => {
    const findings = gaps(root, opts([spec('TC-001 - AC-001 vào được dashboard', { line: 7 })]));
    const missing = only(findings, 'khai-automation-nhung-khong-co-script');
    assert.deepEqual(missing.map((f) => f.message.slice(0, 6)), ['TC-002']);
  });
});

test('multi-TC: test mang @wip thì mọi TC nó phủ đều tính là wip', () => {
  withRepo(DOCS, (root) => {
    const tests = [{ ...MULTI_TC_TESTS[0], tags: ['@REQ-001', '@wip'] }];
    const r = coverage(root, opts(tests));
    assert.deepEqual(r.rows.map((row) => row.wip), [['TC-001'], ['TC-002']]);
    assert.deepEqual(r.rows.map((row) => row.automated), [[], []]);
  });
});

test('multi-TC: matrix và impact gắn spec cho cả TC phụ', () => {
  withRepo(DOCS, (root) => {
    matrix(root, opts(MULTI_TC_TESTS));
    const content = fs.readFileSync(path.join(root, 'test-cases/traceability.md'), 'utf8');
    assert.match(content, /\| TC-002 \| Yes \(Automated\) \| `playwright\/tests\/login\.spec\.js:7` \|/);

    const r = impact(root, 'REQ-001', opts(MULTI_TC_TESTS));
    const ac2 = r.acs.find((ac) => ac.acId === 'AC-002');
    assert.deepEqual(ac2.testCases[0].specs, ['playwright/tests/login.spec.js:7']);
  });
});

test('multi-TC: bộ lọc filterTag giữ dòng traceability của TC phụ', () => {
  withRepo(DOCS, (root) => {
    const tests = [{ ...MULTI_TC_TESTS[0], tags: ['@REQ-001', '@smoke'] }];
    const r = coverage(root, { ...opts(tests), filterTag: 'smoke' });
    assert.equal(r.testCases, 2);
  });
});

