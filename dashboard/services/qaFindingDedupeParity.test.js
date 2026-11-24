'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { enrichFindings } = require('./qaFindingCatalog');
const { dedupeFindings } = require('../../core/qa/findingDedupe');
const { dedupeSummary } = require('../../tools/qa/lib/summaryDedupe');

// Gate 3 N2: API (enrichFindings) and CLI (dedupeSummary) must count the same on awkward input.
const INPUT = [
  { kind: 'a', where: 'tests\\e2e\\x.spec.js:3', message: 'm1', severity: 'major' },
  { kind: 'a', where: 'tests/e2e/x.spec.js:3', message: 'm1', severity: 'major' },
  { kind: 'b', id: 'REQ-1', detail: 'd1', severity: 'blocker' },
  { kind: 'b', where: 'REQ-1', message: 'd1', severity: 'blocker' },
  { kind: 'c', where: 'p.js:1', message: 'm', severity: 'minor', occurrences: 3 },
  { kind: 'c', where: 'p.js:1', message: 'm', severity: 'minor' },
  { kind: 'd', where: 'other', message: 'm', severity: 'minor' },
];

test('enrichFindings, dedupeFindings and dedupeSummary agree on count and occurrences', () => {
  const shared = dedupeFindings(INPUT);
  const api = enrichFindings(INPUT);
  const cli = dedupeSummary({ health: {}, findings: INPUT });

  assert.equal(shared.length, 4);
  assert.equal(api.length, shared.length);
  assert.equal(cli.findings.length, shared.length);
  assert.deepEqual(api.map((f) => f.occurrences), shared.map((f) => f.occurrences));
  assert.deepEqual(cli.findings.map((f) => f.occurrences), shared.map((f) => f.occurrences));
  assert.deepEqual(shared.map((f) => f.occurrences), [2, 2, 4, 1]);
  assert.equal(cli.health.totalFindings, api.length);
  assert.deepEqual([cli.health.blockers, cli.health.majors, cli.health.minors], [1, 1, 2]);
});
