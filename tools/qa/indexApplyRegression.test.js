'use strict';
/**
 * Integration & CLI Subprocess Tests cho tools/qa/index.js — Phần 2 (C05 -> C08).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  hashDirectoryState,
  createCliRepo,
  runCli,
} = require('./__tests__/cliRepoFixture');

// ============================================================================
// C05: Preview/dry-run read-only; output tạo artifact pending, không overwrite
// ============================================================================
test('C05: Preview và --dry-run tuyệt đối read-only; --output chỉ ghi dưới _learning, giữ trạng thái pending và chặn overwrite', (t) => {
  const root = createCliRepo(t);

  fs.writeFileSync(
    path.join(root, 'requirements', 'REQ-099-untracked.md'),
    '---\nid: REQ-099\nstatus: Draft\n---\n### AC-001: Untracked\n',
    'utf8',
  );

  const hashBefore = hashDirectoryState(root);

  const prevTerm = runCli(root, ['learn', '--since=HEAD~1']);
  assert.equal(prevTerm.status, 0);
  assert.match(prevTerm.stdout, /Shared Catalog \(ship\)/);
  assert.match(prevTerm.stdout, /Project Overlay \(own\)/);
  assert.match(prevTerm.stdout, /Effective Knowledge/);
  assert.match(prevTerm.stdout, /Untracked skipped\s*:\s*1/);
  assert.match(prevTerm.stdout, /CHƯA học \/ CHƯA ghi vào kho tri thức/);
  assert.doesNotMatch(prevTerm.stdout, /Đã học thành công/);

  const prevDry = runCli(root, ['learn', '--since=HEAD~1', '--dry-run', '--json']);
  assert.equal(prevDry.status, 0);
  assert.equal(
    fs.existsSync(path.join(root, 'test-cases', '_learning')),
    false,
    'Preview và dry-run không được tạo thư mục _learning',
  );
  assert.equal(hashDirectoryState(root), hashBefore, 'Cây thư mục phải giữ nguyên hash sau preview');

  assert.equal(runCli(root, ['learn', '--output=review.json']).status, 2);
  assert.equal(runCli(root, ['learn', '--output=test-cases/review.json']).status, 2);
  assert.equal(runCli(root, ['learn', '--output=test-cases/_learning/knowledge.json']).status, 2);
  assert.equal(runCli(root, ['learn', '--output=test-cases/_learning/knowledge.lock']).status, 2);
  assert.equal(fs.existsSync(path.join(root, 'test-cases', '_learning')), false);

  const reviewRel = 'test-cases/_learning/review-batch-1.json';
  const outRes = runCli(root, ['learn', '--since=HEAD~1', `--output=${reviewRel}`]);
  assert.equal(outRes.status, 0, outRes.stderr);
  const reviewAbs = path.join(root, reviewRel);
  assert.equal(fs.existsSync(reviewAbs), true);
  const artifact = JSON.parse(fs.readFileSync(reviewAbs, 'utf8'));
  assert.ok(artifact.candidates.length >= 1);
  assert.ok(artifact.candidates.every((c) => c.review && c.review.status === 'pending'));

  fs.writeFileSync(reviewAbs, JSON.stringify({ ...artifact, customNote: 'reviewer-work-in-progress' }), 'utf8');
  const overwriteRes = runCli(root, ['learn', '--since=HEAD~1', `--output=${reviewRel}`]);
  assert.equal(overwriteRes.status, 2);
  assert.equal(
    JSON.parse(fs.readFileSync(reviewAbs, 'utf8')).customNote,
    'reviewer-work-in-progress',
    'Tuyệt đối không được ghi đè làm mất công review cũ',
  );

  const dryApplyRes = runCli(root, ['learn', '--apply', `--review=${reviewRel}`, '--dry-run', '--json']);
  assert.equal(dryApplyRes.status, 0);
  assert.equal(fs.existsSync(path.join(root, 'test-cases', '_learning', 'knowledge.json')), false);
});

// ============================================================================
// C06: Thiếu review/metadata không ghi; approved ghi entry, pending skipped, rejected ghi processed
// ============================================================================
test('C06: Kiểm tra chặt metadata duyệt: thiếu metadata báo lỗi exit 2; approved ghi entry, pending bị skip, rejected chỉ ghi vào processed', (t) => {
  const root = createCliRepo(t);
  const reviewRel = 'test-cases/_learning/review.json';

  const expRes = runCli(root, ['learn', '--since=HEAD~1', `--output=${reviewRel}`]);
  assert.equal(expRes.status, 0, expRes.stderr);

  const reviewAbs = path.join(root, reviewRel);
  const baseArtifact = JSON.parse(fs.readFileSync(reviewAbs, 'utf8'));
  assert.ok(baseArtifact.candidates.length >= 2, 'Cần tối thiểu 2 candidates từ diff + decisions');

  const allPendingRes = runCli(root, ['learn', '--apply', `--review=${reviewRel}`, '--json']);
  assert.equal(allPendingRes.status, 0);
  const allPendingReport = JSON.parse(allPendingRes.stdout);
  assert.equal(allPendingReport.applied.length, 0);
  assert.equal(allPendingReport.skipped.length, baseArtifact.candidates.length);
  assert.equal(fs.existsSync(path.join(root, 'test-cases', '_learning', 'knowledge.json')), false);

  const brokenArtifact = JSON.parse(JSON.stringify(baseArtifact));
  brokenArtifact.candidates[0].review = { status: 'approved', by: '', at: '2026-10-22', rationale: '' };
  fs.writeFileSync(reviewAbs, JSON.stringify(brokenArtifact, null, 2), 'utf8');
  const missingMetaRes = runCli(root, ['learn', '--apply', `--review=${reviewRel}`, '--json']);
  assert.equal(missingMetaRes.status, 2);
  assert.equal(fs.existsSync(path.join(root, 'test-cases', '_learning', 'knowledge.json')), false);

  const mixedArtifact = JSON.parse(JSON.stringify(baseArtifact));
  mixedArtifact.candidates[0].review = {
    status: 'approved',
    by: 'Alice QA',
    at: '2026-10-22T10:00:00Z',
    rationale: 'Heuristic biên có tính tổng quát cao.',
  };
  mixedArtifact.candidates[1].review = {
    status: 'rejected',
    by: 'Alice QA',
    at: '2026-10-22T10:05:00Z',
    rationale: 'Đã có rule tương đương trong checklist nội bộ.',
  };
  fs.writeFileSync(reviewAbs, JSON.stringify(mixedArtifact, null, 2), 'utf8');

  const mixedRes = runCli(root, ['learn', '--apply', `--review=${reviewRel}`, '--json']);
  assert.equal(mixedRes.status, 0, mixedRes.stderr);
  const mixedReport = JSON.parse(mixedRes.stdout);
  assert.equal(mixedReport.applied.length, 1);
  assert.equal(mixedReport.rejected.length, 1);
  assert.equal(mixedReport.skipped.length, mixedArtifact.candidates.length - 2);

  const knowledgePath = path.join(root, 'test-cases', '_learning', 'knowledge.json');
  const knowledge = JSON.parse(fs.readFileSync(knowledgePath, 'utf8'));
  assert.equal(knowledge.entries.length, 1);
  assert.equal(knowledge.entries[0].fingerprint, mixedArtifact.candidates[0].fingerprint);
  assert.equal(knowledge.processed.length, 2);
  const procApproved = knowledge.processed.find((p) => p.fingerprint === mixedArtifact.candidates[0].fingerprint);
  const procRejected = knowledge.processed.find((p) => p.fingerprint === mixedArtifact.candidates[1].fingerprint);
  assert.equal(procApproved.resolution, 'applied');
  assert.equal(procRejected.resolution, 'rejected');
});

// ============================================================================
// C07: Replay no-op; stale/cap/lock/I/O exit 2, không partial write
// ============================================================================
test('C07: Replay trả về no-op giữ nguyên byte-identical; chặn stale snapshot/source, vượt trần cap 25 và lock contention với exit 2', (t) => {
  const root = createCliRepo(t);
  const reviewRel = 'test-cases/_learning/review.json';

  runCli(root, ['learn', '--since=HEAD~1', `--output=${reviewRel}`]);
  const reviewAbs = path.join(root, reviewRel);
  const artifact = JSON.parse(fs.readFileSync(reviewAbs, 'utf8'));
  for (const c of artifact.candidates) {
    c.review = {
      status: 'approved',
      by: 'Bob QA',
      at: '2026-10-22T11:00:00Z',
      rationale: 'Duyệt toàn bộ để test Replay.',
    };
  }
  fs.writeFileSync(reviewAbs, JSON.stringify(artifact, null, 2), 'utf8');

  const firstApply = runCli(root, ['learn', '--apply', `--review=${reviewRel}`, '--json']);
  assert.equal(firstApply.status, 0, firstApply.stderr);
  const knowledgeAbs = path.join(root, 'test-cases', '_learning', 'knowledge.json');
  const bytesAfterFirst = fs.readFileSync(knowledgeAbs, 'utf8');

  const replayApply = runCli(root, ['learn', '--apply', `--review=${reviewRel}`, '--json']);
  assert.equal(replayApply.status, 0, replayApply.stderr);
  const replayReport = JSON.parse(replayApply.stdout);
  assert.equal(replayReport.replayNoOp, true);
  assert.equal(fs.readFileSync(knowledgeAbs, 'utf8'), bytesAfterFirst);

  const reviewStaleRel = 'test-cases/_learning/review-stale.json';
  fs.appendFileSync(
    path.join(root, 'requirements', 'REQ-001-sign-in.md'),
    '| Timeout session | <= 15m | > 15m | đúng 15m và 16m | Hết phiên đăng nhập | TC-001 |\n',
    'utf8',
  );
  const staleOutRes = runCli(root, ['learn', `--output=${reviewStaleRel}`]);
  assert.equal(staleOutRes.status, 0, staleOutRes.stderr);
  const staleAbs = path.join(root, reviewStaleRel);
  const staleArtifact = JSON.parse(fs.readFileSync(staleAbs, 'utf8'));
  for (const c of staleArtifact.candidates) {
    c.review = {
      status: 'approved',
      by: 'Bob QA',
      at: '2026-10-22T11:30:00Z',
      rationale: 'Duyệt trước khi source bị đổi.',
    };
  }
  fs.writeFileSync(staleAbs, JSON.stringify(staleArtifact, null, 2), 'utf8');

  fs.appendFileSync(
    path.join(root, 'requirements', 'REQ-001-sign-in.md'),
    '| OTP retry | <= 3 | >= 4 | 3 và 4 lần | Khoá OTP | TC-002 |\n',
    'utf8',
  );
  const staleRes = runCli(root, ['learn', '--apply', `--review=${reviewStaleRel}`, '--json']);
  assert.equal(staleRes.status, 2);
  assert.match(JSON.parse(staleRes.stdout).error, /Stale/i);
  assert.equal(fs.readFileSync(knowledgeAbs, 'utf8'), bytesAfterFirst, 'Stale apply không được sửa knowledge.json');

  const lockAbs = path.join(root, 'test-cases', '_learning', 'knowledge.lock');
  fs.writeFileSync(lockAbs, 'locked-by-another-pid', 'utf8');
  try {
    const lockRes = runCli(root, ['learn', '--apply', `--review=${reviewStaleRel}`, '--json']);
    assert.equal(lockRes.status, 2);
    assert.match(JSON.parse(lockRes.stdout).error, /knowledge\.lock/i);
    assert.equal(fs.readFileSync(knowledgeAbs, 'utf8'), bytesAfterFirst);
  } finally {
    fs.unlinkSync(lockAbs);
  }

  const reviewCapRel = 'test-cases/_learning/review-cap.json';
  const kData = JSON.parse(bytesAfterFirst);
  kData.entries = [];
  kData.processed = [];
  for (let i = 1; i <= 24; i++) {
    kData.entries.push({
      id: `PDH-${String(i).padStart(3, '0')}`,
      type: 'DH',
      targetCatalog: 'defect',
      title: `Existing heuristic number ${i} for cap test`,
      category: 'Data & BVA',
      trigger: `Trigger condition unique ${i}`,
      failureMode: `Failure mode unique ${i}`,
      actionableCheck: `Actionable check unique ${i}`,
      evidence: `requirements/REQ-001-sign-in.md:${i}`,
      status: 'active',
      appliedAt: '2026-10-22T00:00:00.000Z',
      fingerprint: `fp-cap-${i}`,
      provenance: [
        {
          source: 'git-diff-req-tc',
          file: 'requirements/REQ-001-sign-in.md',
          line: i,
          sourceHash: `sh-${i}`,
          excerpt: `excerpt ${i}`,
        },
      ],
    });
  }
  kData.nextIds.DH = 25;
  kData.nextIds.PA = 1;
  const fullKnowledgeBytes = `${JSON.stringify(kData, null, 2)}\n`;
  fs.writeFileSync(knowledgeAbs, fullKnowledgeBytes, 'utf8');

  const capOutRes = runCli(root, ['learn', `--output=${reviewCapRel}`]);
  assert.equal(capOutRes.status, 0, capOutRes.stderr);
  const capAbs = path.join(root, reviewCapRel);
  const capArt = JSON.parse(fs.readFileSync(capAbs, 'utf8'));
  const dhCandidates = capArt.candidates.filter((c) => c.targetCatalog === 'defect');
  assert.ok(dhCandidates.length >= 2, 'Cần tối thiểu 2 DH candidates để thử vượt trần 24 + 2 > 25');
  for (const c of dhCandidates) {
    c.review = {
      status: 'approved',
      by: 'Bob QA',
      at: '2026-10-22T12:00:00Z',
      rationale: 'Thử vượt trần 24 + 2 > 25.',
    };
  }
  fs.writeFileSync(capAbs, JSON.stringify(capArt, null, 2), 'utf8');

  const capRes = runCli(root, ['learn', '--apply', `--review=${reviewCapRel}`, '--json']);
  assert.equal(capRes.status, 2);
  assert.match(JSON.parse(capRes.stdout).error, /25/);
  assert.equal(fs.readFileSync(knowledgeAbs, 'utf8'), fullKnowledgeBytes, 'Khi vượt cap không được ghi một phần');
});

// ============================================================================
// C08: Regression coverage/gaps/drift/summary/fix và flag cũ không đổi
// ============================================================================
test('C08: Các lệnh truyền thống (coverage, gaps, drift, impact, matrix, summary, fix) và cờ cũ hoạt động không hồi quy', (t) => {
  const root = createCliRepo(t);

  const mockBinDir = path.join(root, '.mock-bin');
  fs.mkdirSync(mockBinDir, { recursive: true });
  const mockPlaywrightJson = JSON.stringify({
    config: { rootDir: path.join(root, 'playwright', 'tests') },
    suites: [
      {
        title: 'auth/sign-in.spec.ts',
        file: 'auth/sign-in.spec.ts',
        suites: [
          {
            title: 'REQ-001 - Sign in',
            specs: [
              {
                title: 'TC-001 - AC-001 valid login',
                tags: ['@REQ-001', '@smoke', '@p0'],
                file: 'auth/sign-in.spec.ts',
                line: 3,
              },
            ],
          },
        ],
      },
    ],
  });
  const mockScriptJs = path.join(mockBinDir, 'pw-list.js');
  fs.writeFileSync(mockScriptJs, `process.stdout.write(${JSON.stringify(mockPlaywrightJson)});\n`, 'utf8');
  if (process.platform === 'win32') {
    fs.writeFileSync(
      path.join(mockBinDir, 'npx.cmd'),
      `@echo off\r\n"${process.execPath}" "${mockScriptJs}"\r\n`,
      'utf8',
    );
  } else {
    const shPath = path.join(mockBinDir, 'npx');
    fs.writeFileSync(shPath, `#!/bin/sh\n"${process.execPath}" "${mockScriptJs}"\n`, 'utf8');
    fs.chmodSync(shPath, 0o755);
  }

  const fastEnv = { PATH: `${mockBinDir}${path.delimiter}${process.env.PATH || ''}` };

  const impRes = runCli(root, ['impact', 'REQ-001', '--json'], { env: fastEnv });
  assert.equal(impRes.status, 0, impRes.stderr);
  assert.equal(JSON.parse(impRes.stdout).requirement.id, 'REQ-001');

  const impMissing = runCli(root, ['impact', '--json'], { env: fastEnv });
  assert.equal(impMissing.status, 2);
  assert.equal(JSON.parse(impMissing.stdout).ok, false);

  const matRes = runCli(root, ['matrix', '--json'], { env: fastEnv });
  assert.equal(matRes.status, 0, matRes.stderr);
  assert.equal(fs.existsSync(path.join(root, 'test-cases', 'traceability.md')), true);

  const fixRes = runCli(root, ['fix', '--dry-run', '--json'], { env: fastEnv });
  assert.equal(fixRes.status, 0, fixRes.stderr);
  assert.equal(JSON.parse(fixRes.stdout).dryRun, true);

  const covRes = runCli(root, ['coverage', '--req=REQ-001', '--json'], { env: fastEnv });
  assert.equal(covRes.status, 0, covRes.stderr);
  assert.equal(JSON.parse(covRes.stdout).requirements, 1);

  const gapsRes = runCli(root, ['gaps', '--no-boundary-rules', '--json'], { env: fastEnv });
  assert.equal(gapsRes.status, 0, gapsRes.stderr);
  assert.ok(Array.isArray(JSON.parse(gapsRes.stdout)));

  const driftRes = runCli(root, ['drift', '--domain=auth', '--json'], { env: fastEnv });
  assert.equal(driftRes.status, 0, driftRes.stderr);
  assert.ok(Array.isArray(JSON.parse(driftRes.stdout)));

  const sumOutRel = 'test-cases/summary-report.json';
  const sumRes = runCli(root, ['summary', `--output=${sumOutRel}`, '--json'], { env: fastEnv });
  assert.equal(sumRes.status, 0, sumRes.stderr);
  assert.equal(fs.existsSync(path.join(root, sumOutRel)), true);
  assert.ok(JSON.parse(sumRes.stdout).metrics);
});

