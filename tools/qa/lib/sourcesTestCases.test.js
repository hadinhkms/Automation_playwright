'use strict';

/**
 * Unit test cho loadTestCases() và Canonical Metadata (Plan 14 Phase 3: TC-14-P3-05b).
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { loadRequirements, loadTestCases } = require('./sources');
const {
  withRepo,
  lineOf,
  asWindowsFile,
  TC_FULL,
  traceabilityFile,
} = require('../__tests__/sourcesFixture');

// ===========================================================================
// loadTestCases
// ===========================================================================

test('loadTestCases: bảng Traceability rút đúng reqId/acId/tcId/automation/spec/priority', () => {
  withRepo({ 'test-cases/REQ-001.md': TC_FULL }, (root) => {
    const { links } = loadTestCases(root);
    assert.equal(links.length, 3, 'header và dòng phân cách không được thành link');
    const first = links[0];
    assert.equal(first.reqId, 'REQ-001');
    assert.equal(first.acId, 'AC-001');
    assert.equal(first.tcId, 'TC-001');
    assert.equal(first.automation, 'Yes');
    assert.equal(first.spec, 'tests/auth/login.spec.ts');
    assert.equal(first.priority, 'P0');
    assert.equal(first.file, 'test-cases/REQ-001.md', 'link phải nhớ file nguồn để finding chỉ được chỗ sửa');
  });
});

test('loadTestCases: priority có khoảng trắng thừa vẫn được cắt sạch', () => {
  withRepo({ 'test-cases/REQ-001.md': TC_FULL }, (root) => {
    const { links } = loadTestCases(root);
    assert.equal(links[2].priority, 'P2');
  });
});

test('loadTestCases: mọi cách viết "có automation" đều chuẩn hoá về "Yes"', () => {
  for (const raw of ['Yes', 'yes', 'YES', '**Yes**', '`Yes`', 'Yes ✅', 'Có', 'có', 'CÓ', 'Co', 'Done']) {
    withRepo({ 'test-cases/a.md': traceabilityFile(raw) }, (root) => {
      const { links } = loadTestCases(root);
      assert.equal(links[0].automation, 'Yes', `"${raw}" phải được hiểu là Yes`);
      assert.equal(links[0].automationRaw, raw, 'bản gốc phải giữ nguyên để in lại cho người sửa');
    });
  }
});

test('loadTestCases: mọi cách viết "không automation" đều chuẩn hoá về "No"', () => {
  for (const raw of ['No', 'no', 'NO', '**No**', 'Không', 'khong', 'Manual', 'thủ công', 'N/A']) {
    withRepo({ 'test-cases/a.md': traceabilityFile(raw) }, (root) => {
      const { links } = loadTestCases(root);
      assert.equal(links[0].automation, 'No', `"${raw}" phải được hiểu là No`);
      assert.equal(links[0].automationRaw, raw);
    });
  }
});

test('loadTestCases: mọi cách viết "ứng viên" đều chuẩn hoá về "Candidate"', () => {
  for (const raw of ['Candidate', 'candidate', '**Candidate**', 'Ứng viên', 'ung vien', 'Planned', 'TODO']) {
    withRepo({ 'test-cases/a.md': traceabilityFile(raw) }, (root) => {
      const { links } = loadTestCases(root);
      assert.equal(links[0].automation, 'Candidate', `"${raw}" phải được hiểu là Candidate`);
      assert.equal(links[0].automationRaw, raw);
    });
  }
});

test('loadTestCases: giá trị lạ -> automation null nhưng giữ nguyên bản gốc trong automationRaw', () => {
  for (const raw of ['maybe', 'Có thể', 'WIP', 'partial', 'chưa rõ']) {
    withRepo({ 'test-cases/a.md': traceabilityFile(raw) }, (root) => {
      const { links } = loadTestCases(root);
      assert.equal(links[0].automation, null, `"${raw}" không nằm trong từ điển nên phải là null`);
      assert.equal(links[0].automationRaw, raw, 'thông báo lỗi cần in đúng thứ người dùng đã gõ');
    });
  }
});

test('loadTestCases: ô Automation trống -> chuỗi rỗng, phân biệt với "không hiểu được"', () => {
  for (const raw of ['', '  ', '**  **']) {
    withRepo({ 'test-cases/a.md': traceabilityFile(raw) }, (root) => {
      const { links } = loadTestCases(root);
      assert.equal(links[0].automation, '', `ô "${raw}" là bỏ trống, không phải giá trị sai`);
      assert.notEqual(links[0].automation, null, 'bỏ trống và sai chính tả là hai finding khác nhau');
    });
  }
});

test('loadTestCases: traceability.md bị bỏ qua vì là file sinh ra, không phải nguồn', () => {
  withRepo(
    {
      'test-cases/REQ-001.md': TC_FULL,
      'test-cases/traceability.md': traceabilityFile('Yes').replace('TC-001', 'TC-900'),
    },
    (root) => {
      const { links } = loadTestCases(root);
      assert.equal(links.length, 3);
      assert.ok(!links.some((l) => l.tcId === 'TC-900'), 'không được nạp lại file tổng hợp');
    },
  );
});

test('loadTestCases: README.md trong test-cases cũng bị bỏ qua', () => {
  withRepo(
    {
      'test-cases/README.md': traceabilityFile('Yes').replace('TC-001', 'TC-901'),
      'test-cases/REQ-001.md': TC_FULL,
    },
    (root) => {
      const { links } = loadTestCases(root);
      assert.ok(!links.some((l) => l.tcId === 'TC-901'));
    },
  );
});

test('loadTestCases: mục "Case không automation" chỉ nhận dòng có lý do', () => {
  withRepo({ 'test-cases/REQ-001.md': TC_FULL }, (root) => {
    const { noAutomationReasons } = loadTestCases(root);
    assert.ok(noAutomationReasons instanceof Set, 'commands.js gọi .has() nên phải là Set');
    assert.equal(noAutomationReasons.has('TC-002'), true);
    assert.equal(noAutomationReasons.has('TC-003'), false, 'cột Lý do bỏ trống thì không tính là đã giải trình');
    assert.equal(noAutomationReasons.size, 1, 'hàng header "Test case | Lý do" không được lọt vào');
  });
});

test('loadTestCases: details rút được cả ba biến thể heading TC kèm số dòng thật', () => {
  withRepo({ 'test-cases/REQ-001.md': TC_FULL }, (root) => {
    const { details } = loadTestCases(root);
    assert.deepEqual(details.map((d) => d.tcId), ['TC-001', 'TC-002', 'TC-003']);
    assert.equal(details[0].title, 'Đăng nhập thành công');
    assert.equal(details[1].title, 'Sai mật khẩu', 'dấu ngăn "-" không được dính vào tiêu đề');
    assert.equal(details[2].title, 'Khoá tài khoản');
    assert.equal(details[0].line, lineOf(TC_FULL, '### TC-001:'));
    assert.equal(details[0].file, 'test-cases/REQ-001.md');
  });
});

test('loadTestCases: testCasesDir khai trong options được tôn trọng', () => {
  withRepo({ 'docs/test-cases/REQ-001.md': TC_FULL }, (root) => {
    assert.equal(loadTestCases(root).links.length, 0, 'không khai thì vẫn chỉ nhìn test-cases/');
    const r = loadTestCases(root, { testCasesDir: 'docs/test-cases' });
    assert.equal(r.links.length, 3);
    assert.equal(r.links[0].file, 'docs/test-cases/REQ-001.md');
  });
});

test('loadTestCases: thư mục không tồn tại -> links/details rỗng và Set rỗng, không ném', () => {
  withRepo({ 'README.md': '# repo trống' }, (root) => {
    const r = loadTestCases(root);
    assert.deepEqual(r.links, []);
    assert.deepEqual(r.details, []);
    assert.equal(r.noAutomationReasons.size, 0);
  });
});

test('loadTestCases: nhiều file test case gộp chung links, mỗi link nhớ đúng file nguồn', () => {
  withRepo(
    {
      'test-cases/REQ-001.md': TC_FULL,
      'test-cases/REQ-002.md': traceabilityFile('Yes')
        .replace('REQ-001', 'REQ-002')
        .replace('TC-001', 'TC-050'),
    },
    (root) => {
      const { links } = loadTestCases(root);
      assert.equal(links.length, 4);
      const tc50 = links.find((l) => l.tcId === 'TC-050');
      assert.equal(tc50.reqId, 'REQ-002');
      assert.equal(tc50.file, 'test-cases/REQ-002.md');
    },
  );
});

test('loadTestCases: hàng traceability thiếu cột -> spec/priority rỗng, không ném', () => {
  withRepo(
    {
      'test-cases/a.md': `## Traceability

| Requirement | Acceptance criterion | Test case | Automation |
|---|---|---|---|
| REQ-001 | AC-001 | TC-001 | Yes |
`,
    },
    (root) => {
      const { links } = loadTestCases(root);
      assert.equal(links.length, 1);
      assert.equal(links[0].spec, '');
      assert.equal(links[0].priority, '');
      assert.equal(links[0].automation, 'Yes');
    },
  );
});

test('loadTestCases: bảng ngoài mục Traceability không bị hút vào links', () => {
  withRepo(
    {
      'test-cases/a.md': `## Test data

| Requirement | Acceptance criterion | Test case | Automation | Spec | Priority |
|---|---|---|---|---|---|
| REQ-001 | AC-001 | TC-099 | Yes | - | P0 |

## Traceability

| Requirement | Acceptance criterion | Test case | Automation | Spec | Priority |
|---|---|---|---|---|---|
| REQ-001 | AC-001 | TC-001 | Yes | - | P0 |
`,
    },
    (root) => {
      const { links } = loadTestCases(root);
      assert.deepEqual(
        links.map((l) => l.tcId),
        ['TC-001'],
        'chỉ bảng dưới ## Traceability mới là nguồn link',
      );
    },
  );
});

test('loadTestCases: file lưu kèm BOM + CRLF vẫn rút đủ links, details và lý do', () => {
  withRepo({ 'test-cases/REQ-001.md': asWindowsFile(TC_FULL) }, (root) => {
    const r = loadTestCases(root);
    assert.equal(r.links.length, 3);
    assert.equal(r.links[0].automation, 'Yes', 'ký tự \\r sót lại sẽ làm ô Automation không khớp từ điển');
    assert.equal(r.links[0].spec, 'tests/auth/login.spec.ts');
    assert.equal(r.details.length, 3);
    assert.equal(r.noAutomationReasons.has('TC-002'), true);
  });
});

test('TC-14-P3-05b: loadRequirements và loadTestCases đọc đúng Canonical Metadata (Page exposure, UI coverage, XSS applicability, Coverage notes, Capabilities)', () => {
  const reqMd = `---
id: REQ-101
title: Deep Sign In
status: Ready for Test
test_cases: test-cases/REQ-101.md
---
# REQ-101
- **Page exposure**: Public
- **UI coverage**: Required
- **XSS applicability**: Applicable

## Coverage notes
| Aspect | Status | Notes |
|---|---|---|
| Idempotency | Required | Chống double-submit |

## Acceptance criteria
### AC-001: Sign in
`;
  const tcMd = `# TC REQ-101
## Traceability
| Requirement | Acceptance criterion | Test case | Automation | Spec | Priority |
|---|---|---|---|---|---|
| REQ-101 | AC-001 | TC-001 | Yes | \`tests/login.spec.ts\` | P0 |

## Test cases
### TC-001: Sign in
- **Capabilities**: ui-geometry, xss, idempotency
`;

  withRepo({ 'requirements/REQ-101.md': reqMd, 'test-cases/REQ-101.md': tcMd }, (root) => {
    const [req] = loadRequirements(root);
    assert.equal(req.pageExposure, 'Public');
    assert.deepEqual(req.uiCoverage, { status: 'Required', reason: null });
    assert.deepEqual(req.xssApplicability, { status: 'Applicable', reason: null });
    assert.equal(req.coverageNotes.length, 1);
    assert.equal(req.coverageNotes[0].aspect, 'Idempotency');

    const tcs = loadTestCases(root);
    assert.equal(tcs.details.length, 1);
    assert.deepEqual(tcs.details[0].capabilities, ['ui-geometry', 'xss', 'idempotency']);
  });
});

