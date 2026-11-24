'use strict';

/**
 * Gộp finding trùng của báo cáo summary. Cùng một spec nằm trong nhiều Playwright project nên
 * scanner báo lặp y hệt; số đếm hiển thị (CLI, API, UI) phải tính trên danh sách đã gộp để cả ba
 * cùng ra một số. `occurrences` giữ số lần lặp. `summary()` thô vẫn giữ nguyên bản lặp.
 */
function dedupeFindings(findings) {
  const byKey = new Map();
  for (const f of Array.isArray(findings) ? findings : []) {
    if (!f || typeof f !== 'object') continue;
    const key = `${f.kind || ''}|${String(f.where || f.id || '').replace(/\\/g, '/')}|${f.message || f.detail || ''}`;
    const seen = byKey.get(key);
    if (seen) seen.occurrences += f.occurrences || 1;
    else byKey.set(key, { ...f, occurrences: f.occurrences || 1 });
  }
  return [...byKey.values()];
}

const count = (list, severity) => list.filter((f) => f.severity === severity).length;

function dedupeSummary(res) {
  if (!res || !Array.isArray(res.findings)) return res;
  const findings = dedupeFindings(res.findings);
  return {
    ...res,
    findings,
    health: {
      ...res.health,
      blockers: count(findings, 'blocker'),
      majors: count(findings, 'major'),
      minors: count(findings, 'minor'),
      totalFindings: findings.length,
    },
  };
}

module.exports = { dedupeFindings, dedupeSummary };
