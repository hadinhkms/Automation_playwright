/**
 * tests/dashboard/support/batchTestUtils.js
 * Tiện ích cho test service của batch fixer (PLAN-18): workspace tạm có tài liệu truy vết và
 * chỉ mục finding dựng tay (không cần chạy scanner cho từng ca biên).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { enrichFindings } = require('../../../dashboard/services/qaFindingCatalog');
const { REQ_DOC, TC_DOC } = require('./batchFixtureSeed');

const MESSAGES = {
  'assertion-thieu-await': 'gọi matcher bất đồng bộ của Playwright mà thiếu "await"',
  'test-bi-skip-am-tham': 'đang bị test.skip hoặc test.fixme mà không gắn tag @wip',
  'test-thieu-tag-req': 'thiếu tag @REQ-xxx ở describe',
  'test-khong-co-ma-tc': 'không mở đầu bằng TC-xxx',
  'spec-thieu-assertion': 'không chứa bất kỳ lệnh assert/expect nào',
  'khong-doc-duoc-requirement': 'Không đọc được requirement nào',
  'script-khong-co-trong-test-case': 'có script nhưng không có trong bảng traceability',
};

function makeWorkspace(files = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-batch-'));
  const write = (rel, content) => {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf8');
  };
  write('requirements/REQ-001.md', REQ_DOC);
  write('test-cases/REQ-001.md', TC_DOC);
  Object.entries(files).forEach(([rel, content]) => write(rel, content));
  return {
    root,
    write,
    read: (rel) => fs.readFileSync(path.join(root, rel), 'utf8'),
    exists: (rel) => fs.existsSync(path.join(root, rel)),
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
  };
}

function finding(kind, where, extra = {}) {
  return { kind, severity: 'major', where, message: `${MESSAGES[kind] || kind} @ ${where}`, ...extra };
}

/** Chỉ mục giống getFindingsIndex() dựng từ danh sách finding thô. */
function indexOf(findings) {
  const enriched = enrichFindings(findings);
  return { scanId: 1, byKey: new Map(enriched.map((f) => [f.findingKey, f])), list: enriched };
}

function keyOf(index, kind, where) {
  const found = index.list.find((f) => f.kind === kind && f.where === where);
  if (!found) throw new Error(`Không có finding ${kind} tại ${where}`);
  return found.findingKey;
}

module.exports = { makeWorkspace, finding, indexOf, keyOf };
