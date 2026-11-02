'use strict';
/**
 * Integration & CLI Subprocess Tests cho tools/qa/index.js — Phần 1 (C01 -> C04).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  WORKSPACE_ROOT,
  ANSI_REGEX,
  createCliRepo,
  runCli,
} = require('./__tests__/cliRepoFixture');

// ============================================================================
// C01: Import không chạy; root injection dùng repo tạm; default root không đổi
// ============================================================================
test('C01: Import tools/qa/index.js không tự thực thi; hỗ trợ root injection qua main({root, argv}) và giữ nguyên default ROOT', (t) => {
  const prevExitCode = process.exitCode;
  t.after(() => {
    process.exitCode = prevExitCode;
  });

  const cliModule = require('./index');
  assert.equal(typeof cliModule.main, 'function');
  assert.equal(typeof cliModule.parseArgs, 'function');
  assert.equal(typeof cliModule.renderLearnReport, 'function');
  assert.equal(cliModule.ROOT, WORKSPACE_ROOT, 'Default ROOT phải giữ nguyên path.resolve(__dirname, "..", "..")');

  const tmpRepo = createCliRepo(t);
  const logs = [];
  const origLog = console.log;
  console.log = (...a) => logs.push(a.join(' '));
  let exitCode;
  try {
    exitCode = cliModule.main({
      root: tmpRepo,
      argv: ['learn', '--since=HEAD~1', '--json'],
    });
  } finally {
    console.log = origLog;
    process.exitCode = 0;
  }

  assert.equal(exitCode, 0);
  assert.equal(logs.length, 1);
  const report = JSON.parse(logs[0]);
  assert.equal(report.mode, 'preview');
  assert.equal(report.scope.since, 'HEAD~1');
  assert.ok(report.proposed.length >= 1, 'Phải có tối thiểu 1 proposed candidate');
  assert.ok(report.needsReview.length >= 1, 'Phải có tối thiểu 1 needsReview candidate');
});

// ============================================================================
// C02: Hai cú pháp since; unknown/empty/missing value/tổ hợp sai exit 2
// ============================================================================
test('C02: Hỗ trợ --since=REF và --since REF; từ chối cờ lạ, giá trị thiếu/rỗng và tổ hợp cờ sai với exit 2', (t) => {
  const root = createCliRepo(t);

  const eqRun = runCli(root, ['learn', '--since=HEAD~1', '--json']);
  const spaceRun = runCli(root, ['learn', '--since', 'HEAD~1', '--json']);
  assert.equal(eqRun.status, 0);
  assert.equal(spaceRun.status, 0);
  const eqReport = JSON.parse(eqRun.stdout);
  const spaceReport = JSON.parse(spaceRun.stdout);
  assert.equal(eqReport.sourceHash, spaceReport.sourceHash);
  assert.equal(eqReport.proposed.length, spaceReport.proposed.length);

  const invalidFlagCases = [
    ['learn', '--unknown-flag'],
    ['learn', '--since'],
    ['learn', '--since='],
    ['learn', '--since', '   '],
    ['learn', '--since', '--json'],
    ['learn', '--review'],
    ['learn', '--review='],
    ['learn', '--review', '   '],
    ['learn', '--output'],
    ['learn', '--output='],
    ['learn', 'unexpected-arg'],
    ['learn', '--apply'],
    ['learn', '--review=test-cases/_learning/review.json'],
    ['learn', '--apply', '--review=test-cases/_learning/review.json', '--since=HEAD~1'],
    ['learn', '--apply', '--review=test-cases/_learning/review.json', '--output=test-cases/_learning/out.json'],
    ['learn', '--dry-run', '--output=test-cases/_learning/out.json'],
    ['learn', '--req=REQ-001'],
    ['learn', '--domain=auth'],
    ['learn', '--tag=@smoke'],
    ['learn', '--strict'],
    ['learn', '--boundary-rules'],
    ['learn', '--no-boundary-rules'],
    ['gaps', '--apply'],
    ['coverage', '--since=HEAD~1'],
  ];

  for (const args of invalidFlagCases) {
    const res = runCli(root, args);
    assert.equal(
      res.status,
      2,
      `Kỳ vọng exit 2 cho bộ tham số [${args.join(' ')}], nhưng nhận được status=${res.status}`,
    );
  }
});

// ============================================================================
// C03: JSON success/error parse được, không ANSI/banner/stack trace
// ============================================================================
test('C03: Chế độ --json luôn xuất đúng 1 JSON object cho cả success lẫn error, không lẫn ANSI, banner hay stack trace', (t) => {
  const root = createCliRepo(t);

  const okRes = runCli(root, ['learn', '--since=HEAD~1', '--json'], { forceColor: true });
  assert.equal(okRes.status, 0);
  assert.equal(ANSI_REGEX.test(okRes.stdout), false, 'stdout JSON không được chứa mã màu ANSI');
  assert.equal(okRes.stdout.includes('ignoreSpecs đang bật'), false, 'stdout JSON không được lẫn banner');
  const parsedOk = JSON.parse(okRes.stdout);
  assert.equal(parsedOk.schemaVersion, '1.0.0');
  assert.equal(parsedOk.mode, 'preview');

  const flagErrRes = runCli(root, ['learn', '--unknown-xyz', '--json'], { forceColor: true });
  assert.equal(flagErrRes.status, 2);
  assert.equal(ANSI_REGEX.test(flagErrRes.stdout), false);
  assert.doesNotMatch(flagErrRes.stdout, /\n\s*at\s+/, 'stdout JSON không được chứa stack trace');
  assert.doesNotMatch(flagErrRes.stderr, /\n\s*at\s+/, 'stderr không được chứa stack trace');
  const parsedFlagErr = JSON.parse(flagErrRes.stdout);
  assert.equal(parsedFlagErr.ok, false);
  assert.match(parsedFlagErr.error, /Cờ không hợp lệ/);

  const gitErrRes = runCli(root, ['learn', '--since=non-existent-ref-999', '--json'], { forceColor: true });
  assert.equal(gitErrRes.status, 2);
  const parsedGitErr = JSON.parse(gitErrRes.stdout);
  assert.equal(parsedGitErr.ok, false);
  assert.ok(parsedGitErr.error.length > 0);
  assert.doesNotMatch(gitErrRes.stderr, /\n\s*at\s+/);

  fs.writeFileSync(path.join(root, 'qa.config.json'), '{ broken json ', 'utf8');
  const cfgErrRes = runCli(root, ['learn', '--json'], { forceColor: true });
  assert.equal(cfgErrRes.status, 2);
  const parsedCfgErr = JSON.parse(cfgErrRes.stdout);
  assert.equal(parsedCfgErr.ok, false);
  assert.match(parsedCfgErr.error, /qa\.config\.json/);
});

// ============================================================================
// C04: Terminal/JSON apply cùng knowledge bytes/IDs
// ============================================================================
test('C04: Chạy --apply ở chế độ Terminal và --json tạo ra knowledge.json có cùng IDs và cấu trúc dữ liệu chuẩn', (t) => {
  const rootTerminal = createCliRepo(t);
  const rootJson = createCliRepo(t);
  const reviewRel = 'test-cases/_learning/review.json';

  for (const repo of [rootTerminal, rootJson]) {
    const exp = runCli(repo, ['learn', '--since', 'HEAD~1', `--output=${reviewRel}`]);
    assert.equal(exp.status, 0, exp.stderr);
    const reviewAbs = path.join(repo, reviewRel);
    const reviewData = JSON.parse(fs.readFileSync(reviewAbs, 'utf8'));
    assert.ok(reviewData.candidates.length >= 1);
    for (const c of reviewData.candidates) {
      c.review = {
        status: 'approved',
        by: 'QA Reviewer',
        at: '2026-10-22T16:00:00.000Z',
        rationale: 'Phê duyệt đồng bộ cho C04.',
      };
    }
    fs.writeFileSync(reviewAbs, JSON.stringify(reviewData, null, 2), 'utf8');
  }

  const termApply = runCli(rootTerminal, ['learn', '--apply', '--review', reviewRel]);
  const jsonApply = runCli(rootJson, ['learn', '--apply', `--review=${reviewRel}`, '--json']);

  assert.equal(termApply.status, 0, termApply.stderr);
  assert.equal(jsonApply.status, 0, jsonApply.stderr);

  const kTerm = JSON.parse(
    fs.readFileSync(path.join(rootTerminal, 'test-cases', '_learning', 'knowledge.json'), 'utf8'),
  );
  const kJson = JSON.parse(
    fs.readFileSync(path.join(rootJson, 'test-cases', '_learning', 'knowledge.json'), 'utf8'),
  );

  assert.deepEqual(kTerm.nextIds, kJson.nextIds);
  assert.deepEqual(
    kTerm.entries.map((e) => ({
      id: e.id,
      type: e.type,
      targetCatalog: e.targetCatalog,
      title: e.title,
      category: e.category,
      fingerprint: e.fingerprint,
    })),
    kJson.entries.map((e) => ({
      id: e.id,
      type: e.type,
      targetCatalog: e.targetCatalog,
      title: e.title,
      category: e.category,
      fingerprint: e.fingerprint,
    })),
  );

  for (const e of kTerm.entries) e.appliedAt = 'FIXED_TIME';
  for (const e of kJson.entries) e.appliedAt = 'FIXED_TIME';
  for (const p of kTerm.processed) p.reviewedAt = 'FIXED_TIME';
  for (const p of kJson.processed) p.reviewedAt = 'FIXED_TIME';
  assert.equal(JSON.stringify(kTerm, null, 2), JSON.stringify(kJson, null, 2));
});

