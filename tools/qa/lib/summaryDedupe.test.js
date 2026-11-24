'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { dedupeSummary } = require('./summaryDedupe');

test('dedupeSummary gộp finding lặp theo project và tính lại số đếm', () => {
  const dup = { severity: 'blocker', kind: 'khong-doc-duoc-playwright', where: '.', message: 'x' };
  const res = dedupeSummary({
    health: { status: 'CRITICAL', blockers: 3, majors: 1, minors: 0, totalFindings: 4 },
    findings: [dup, { ...dup }, { severity: 'major', kind: 'a', where: 'a.spec.js:1', message: 'm' }, { severity: 'blocker', kind: 'k', where: 'r\\x.md', message: 'm' }],
  });
  assert.equal(res.findings.length, 3);
  assert.deepEqual(res.health, { status: 'CRITICAL', blockers: 2, majors: 1, minors: 0, totalFindings: 3 });
  assert.equal(res.findings[0].occurrences, 2);
});

test('dedupeSummary giữ nguyên khi không có finding', () => {
  assert.deepEqual(dedupeSummary({ findings: [] }).findings, []);
  assert.equal(dedupeSummary(null), null);
});
