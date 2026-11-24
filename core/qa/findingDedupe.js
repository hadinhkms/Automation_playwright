'use strict';

/**
 * core/qa/findingDedupe.js
 * MỘT hàm gộp finding trùng cho CLI (`node tools/qa summary`) và API (/api/qa/summary).
 * Nằm trong core/ vì đây là thư mục được đóng gói cùng dashboard (tools/ thì không).
 * Cùng một spec nằm trong nhiều Playwright project nên scanner báo lặp y hệt; khoá gộp là
 * kind|where(id)|message(detail), `\` coi như `/`. `occurrences` giữ số lần lặp.
 */
function findingDedupeKey(f) {
  return `${f.kind || ''}|${String(f.where || f.id || '').replace(/\\/g, '/')}|${f.message || f.detail || ''}`;
}

function dedupeFindings(findings) {
  const byKey = new Map();
  for (const f of Array.isArray(findings) ? findings : []) {
    if (!f || typeof f !== 'object') continue;
    const key = findingDedupeKey(f);
    const seen = byKey.get(key);
    // `|| 1`: finding đã gộp trước đó mang sẵn occurrences; finding thô thì tính là 1 lần.
    if (seen) seen.occurrences += f.occurrences || 1;
    else byKey.set(key, { ...f, occurrences: f.occurrences || 1 });
  }
  return [...byKey.values()];
}

module.exports = { findingDedupeKey, dedupeFindings };
