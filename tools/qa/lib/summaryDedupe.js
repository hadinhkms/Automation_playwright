'use strict';

/**
 * Gộp finding trùng của báo cáo summary: hàm gộp dùng chung nằm ở core/qa/findingDedupe.js
 * (cùng bản mà API dùng). `summary()` thô vẫn giữ nguyên bản lặp.
 */
const { dedupeFindings } = require('../../../core/qa/findingDedupe');

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
