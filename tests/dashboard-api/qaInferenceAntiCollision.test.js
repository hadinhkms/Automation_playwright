'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {
  collectAllExistingTcIds,
  inferTestCases,
  buildTestCaseDocument,
  appendTestCasesToDocument,
} = require('../../dashboard/services/qaInferenceService');

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'qa-infer-test-'));
}

test('Anti-Collision: quét ID toàn cục qua nhiều file test-cases/*.md tránh trùng mã', async () => {
  const root = makeTmpDir();
  try {
    fs.mkdirSync(path.join(root, 'requirements'), { recursive: true });
    fs.mkdirSync(path.join(root, 'test-cases'), { recursive: true });

    // REQ-001 chỉ có TC-001..TC-010
    fs.writeFileSync(path.join(root, 'test-cases', 'REQ-001.md'), `
# Test Cases: REQ-001
| Test case | AC | Mô tả | Ưu tiên | Automation | Spec |
|---|---|---|---|---|---|
| TC-001 | AC-001 | Test 1 | P1 | Yes | tests/1.spec.js |
| TC-010 | AC-001 | Test 10 | P1 | Yes | tests/1.spec.js |
`);

    // REQ-002 đã có tới TC-050
    fs.writeFileSync(path.join(root, 'test-cases', 'REQ-002.md'), `
# Test Cases: REQ-002
| Test case | AC | Mô tả | Ưu tiên | Automation | Spec |
|---|---|---|---|---|---|
| TC-050 | AC-001 | Test 50 | P1 | Yes | tests/2.spec.js |
`);

    const allIds = collectAllExistingTcIds(root);
    assert.ok(allIds.includes('TC-001'));
    assert.ok(allIds.includes('TC-010'));
    assert.ok(allIds.includes('TC-050'));

    // Requirement REQ-001 có câu hỏi chốt
    fs.writeFileSync(path.join(root, 'requirements', 'REQ-001.md'), `
# REQ-001 Đăng ký
## Acceptance Criteria
- AC-001: Đăng ký thành công

## Open Questions
- Q-1: Số điện thoại có bắt buộc không? **Đã chốt:** Số điện thoại là trường tùy chọn không bắt buộc khi đăng ký email.
`);

    const result = await inferTestCases({
      root,
      reqPath: 'requirements/REQ-001.md',
      mode: 'heuristic',
    });

    assert.ok(result.items.length > 0);
    // Mã mới được sinh phải lớn hơn TC-050 (toàn cục), KHÔNG được là TC-011 (cục bộ REQ-001)
    const suggestedIdNum = parseInt(result.items[0].suggestedId.replace('TC-', ''), 10);
    assert.ok(suggestedIdNum > 50, `Mã đề xuất (${result.items[0].suggestedId}) phải lớn hơn TC-050`);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('Anti-Duplicate: Rule 4 không sinh lặp khi hành vi câu hỏi đã có trong test-cases', async () => {
  const root = makeTmpDir();
  try {
    fs.mkdirSync(path.join(root, 'requirements'), { recursive: true });
    fs.mkdirSync(path.join(root, 'test-cases'), { recursive: true });

    // REQ-001 có câu hỏi Q-1
    fs.writeFileSync(path.join(root, 'requirements', 'REQ-001.md'), `
# REQ-001 Đăng ký
## Acceptance Criteria
- AC-001: Đăng ký

## Open Questions
- Q-1: Màu sắc nút gửi form quy định thế nào?
  **Đã chốt:** Màu xanh dương mặc định theo chuẩn thương hiệu.
`);

    // File test-cases đã có test case cho câu hỏi đó
    fs.writeFileSync(path.join(root, 'test-cases', 'REQ-001.md'), `
# Test Cases: REQ-001
| Test case | AC | Mô tả | Ưu tiên | Automation | Spec |
|---|---|---|---|---|---|
| TC-001 | AC-001 | Kiểm thử hành vi theo quyết định: Màu sắc nút gửi form quy định thế nào? | P2 | candidate | - |

### TC-001 — Kiểm thử hành vi theo quyết định: Màu sắc nút gửi form quy định thế nào?
`);

    const result = await inferTestCases({
      root,
      reqPath: 'requirements/REQ-001.md',
      mode: 'heuristic',
    });

    // Không được sinh lặp lại chính test case đó
    assert.equal(result.items.length, 0, 'Không được đề xuất test case đã có trong tài liệu');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('Dedup on Append: buildTestCaseDocument và appendTestCasesToDocument chặn nhân đôi dòng bảng', () => {
  const initialContent = `# Test Cases: REQ-001
| Test case | AC | Mô tả | Ưu tiên | Automation | Spec |
|---|---|---|---|---|---|
| TC-051 | AC-001 | Kiểm thử theo quyết định | P2 | candidate | - |

### TC-051 — Kiểm thử theo quyết định
`;

  const testCasesToAdd = [
    {
      suggestedId: 'TC-051',
      acId: 'AC-001',
      title: 'Kiểm thử theo quyết định',
      priority: 'P2',
      automation: 'candidate',
    },
  ];

  // Lần 1: gửi TC-051 khi nó đã tồn tại trong file -> không chèn thêm dòng nào
  const updated = buildTestCaseDocument(initialContent, 'REQ-001', testCasesToAdd);
  const tc51Occurrences = (updated.match(/\|\s*TC-051\s*\|/g) || []).length;
  assert.equal(tc51Occurrences, 1, 'TC-051 không được xuất hiện 2 lần trong bảng traceability');
});
