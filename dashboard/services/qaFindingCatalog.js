'use strict';

/**
 * dashboard/services/qaFindingCatalog.js
 * Nguồn sự thật duy nhất (PLAN-18) cho tuyến xử lý của từng loại static finding và định danh
 * ổn định của finding. Server gắn sẵn `findingKey`, `matchKey`, `fixRoute` vào mỗi finding;
 * UI chỉ đọc, không tự suy luận route và không tự băm (trình duyệt truy cập qua HTTP trong LAN
 * không có `crypto.subtle`).
 */

const crypto = require('node:crypto');

/**
 * quick: sửa tự động bằng quy tắc xác định; guided: cần người dùng chọn (Phase 4);
 * scaffold / autofix: mở công cụ sẵn có; manual: chỉ hướng dẫn. Kind không có ở đây là manual.
 */
const FIX_ROUTES = Object.freeze({
  'assertion-thieu-await': 'quick',
  'test-bi-skip-am-tham': 'quick',
  'test-thieu-tag-req': 'quick',
  'test-khong-co-ma-tc': 'manual',
  'spec-thieu-assertion': 'manual',
  'khong-doc-duoc-requirement': 'scaffold',
  'script-khong-co-trong-test-case': 'autofix',
  'ma-tc-trung': 'manual',
});

function routeFor(kind) {
  return FIX_ROUTES[kind] || 'manual';
}

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/');
}

function shortHash(value) {
  return crypto.createHash('sha1').update(value).digest('hex').slice(0, 16);
}

function whereOf(finding) {
  return normalizePath(finding.where || finding.id || '');
}

function messageOf(finding) {
  return String(finding.message || finding.detail || '');
}

/** Định danh một vị trí cụ thể: cùng kind, cùng `path:line`, cùng message là một finding. */
function createFindingKey(finding) {
  return shortHash(`${finding.kind || ''}|${whereOf(finding)}|${messageOf(finding)}`);
}

/**
 * Bỏ số dòng khỏi vị trí: dùng để so trước/sau khi quét lại mà không bị lệch khi một bản vá
 * làm dịch dòng của các finding khác trong cùng file.
 */
function createMatchKey(finding) {
  return shortHash(`${finding.kind || ''}|${whereOf(finding).replace(/:\d+$/, '')}|${messageOf(finding)}`);
}

/**
 * Gắn định danh + route và gộp finding trùng. Cùng một spec nằm trong nhiều Playwright project
 * nên scanner báo lặp lại y hệt; `occurrences` giữ số lần lặp để UI hiện badge.
 */
function enrichFindings(findings) {
  const byKey = new Map();
  for (const finding of Array.isArray(findings) ? findings : []) {
    if (!finding || typeof finding !== 'object') continue;
    const findingKey = createFindingKey(finding);
    const existing = byKey.get(findingKey);
    if (existing) {
      existing.occurrences += 1;
      continue;
    }
    byKey.set(findingKey, {
      ...finding,
      findingKey,
      matchKey: createMatchKey(finding),
      fixRoute: routeFor(finding.kind),
      occurrences: 1,
    });
  }
  return [...byKey.values()];
}

module.exports = {
  FIX_ROUTES,
  routeFor,
  createFindingKey,
  createMatchKey,
  enrichFindings,
};
