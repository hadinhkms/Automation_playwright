'use strict';
/**
 * Kiểm tra toàn cục tính toàn vẹn của kho tài liệu requirements/ và test-cases/ trước khi đối chiếu từng REQ.
 */

function checkGlobalDocumentIntegrity(requirements, testCases, options, findings) {
  if (requirements.length === 0) {
    findings.push({
      severity: 'blocker',
      kind: 'khong-doc-duoc-requirement',
      where: `${(options && options.requirementsDir) || 'requirements'}/`,
      message:
        'Không đọc được requirement nào. Thư mục requirements/ không tồn tại, rỗng, hoặc ' +
        'tài liệu để ở chỗ khác. Mọi kiểm tra bên dưới sẽ xanh giả vì không có gì để đối chiếu.',
      action: 'Tạo requirements/REQ-xxx-<slug>.md theo templates/requirement-template.md.',
    });
  }

  const reqsById = new Map();
  for (const r of requirements) {
    if (!r.id) continue;
    if (!reqsById.has(r.id)) reqsById.set(r.id, []);
    reqsById.get(r.id).push(r);
  }
  for (const [id, reqList] of reqsById.entries()) {
    if (reqList.length > 1) {
      findings.push({
        severity: 'blocker',
        kind: 'ma-req-trung',
        where: reqList.map((r) => r.file).join(', '),
        message: `Mã requirement "${id}" bị trùng lặp ở ${reqList.length} file: ${reqList.map((r) => r.file).join(', ')}.`,
        action: 'Đổi mã REQ để mỗi requirement có định danh duy nhất, tránh thổi phồng độ phủ.',
      });
    }
  }

  const rowsByTcId = new Map();
  for (const link of testCases.links) {
    if (!link.tcId) continue;
    if (!rowsByTcId.has(link.tcId)) rowsByTcId.set(link.tcId, new Map());
    const rowKey = link.rowId || `${link.file}:${link.tcId}`;
    if (!rowsByTcId.get(link.tcId).has(rowKey)) {
      rowsByTcId.get(link.tcId).set(rowKey, link);
    }
  }
  for (const [tcId, rowMap] of rowsByTcId.entries()) {
    if (rowMap.size > 1) {
      const occList = Array.from(rowMap.values());
      findings.push({
        severity: 'major',
        kind: 'ma-tc-trung',
        where: occList.map((l) => `${l.file} (${l.reqId}/${l.acId})`).join(', '),
        message: `Mã test case "${tcId}" xuất hiện ${rowMap.size} lần trong bảng traceability.`,
        action: 'Đổi mã TC để mỗi test case có định danh duy nhất (không được tái sử dụng mã TC).',
      });
    }
  }

  for (const nm of testCases.nearMisses || []) {
    findings.push({
      severity: 'major',
      kind: 'dong-traceability-bi-bo-qua',
      where: nm.file,
      message: `Dòng "${nm.raw}" có mã REQ sai quy ước nên bị bỏ qua hoàn toàn.`,
      action: 'Sửa về dạng REQ-001, nếu không TC ở dòng đó vô hình với mọi rule.',
    });
  }

  for (const link of testCases.links) {
    if (link.automation === null) {
      findings.push({
        severity: 'major',
        kind: 'gia-tri-automation-khong-hop-le',
        where: link.file,
        message: `${link.tcId} có cột Automation = "${link.automationRaw}", không hiểu được.`,
        action: 'Dùng Yes / No / Candidate. Giá trị lạ làm mọi rule về automation im lặng.',
      });
    }
  }
}

module.exports = { checkGlobalDocumentIntegrity };
