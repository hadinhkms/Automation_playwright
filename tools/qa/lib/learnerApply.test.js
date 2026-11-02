'use strict';
/**
 * Unit & Transaction Tests cho Engine Học Chọn Lọc — Phần 2: Batch Apply, Cap, Replay & Lock (L08 .. L12).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  applyReviewedCandidates,
  learn,
  buildReviewArtifact,
} = require('./learner');
const {
  createTempRepo,
  hashDirectoryTree,
} = require('../__tests__/learnerRepoFixture');

// ============================================================================
// L08: Batch ID không trùng; ID retired không tái sử dụng
// ============================================================================
test('L08: Cấp ID đơn điệu trong batch nhiều phần tử và tuyệt đối không tái sử dụng ID đã retired', (t) => {
  const dir = createTempRepo();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const learnDir = path.join(dir, 'test-cases', '_learning');
  fs.mkdirSync(learnDir, { recursive: true });
  const kPath = path.join(learnDir, 'knowledge.json');

  fs.writeFileSync(
    kPath,
    JSON.stringify(
      {
        schemaVersion: '1.0.0',
        nextIds: { DH: 3, PA: 1 },
        entries: [
          {
            id: 'PDH-001',
            targetCatalog: 'defect',
            title: 'Retired 1',
            category: 'Data & BVA',
            trigger: 'T1',
            failureMode: 'F1',
            actionableCheck: 'C1',
            fingerprint: 'fp-ret-1',
            status: 'retired',
            provenance: [{ source: 'direct-verify', file: 'requirements/REQ-001.md', sourceHash: 's1', excerpt: 'e1' }],
            reviewedBy: 'QA',
            reviewedAt: '2026-10-20T10:00:00Z',
          },
          {
            id: 'PDH-002',
            targetCatalog: 'defect',
            title: 'Retired 2',
            category: 'Data & BVA',
            trigger: 'T2',
            failureMode: 'F2',
            actionableCheck: 'C2',
            fingerprint: 'fp-ret-2',
            status: 'retired',
            provenance: [{ source: 'direct-verify', file: 'requirements/REQ-001.md', sourceHash: 's2', excerpt: 'e2' }],
            reviewedBy: 'QA',
            reviewedAt: '2026-10-20T10:00:00Z',
          },
        ],
        processed: [],
        graduations: [],
      },
      null,
      2,
    ),
    'utf8',
  );

  const batchDiff = [
    'diff --git a/test-cases/REQ-001.md b/test-cases/REQ-001.md',
    '--- a/test-cases/REQ-001.md',
    '+++ b/test-cases/REQ-001.md',
    '@@ -1,2 +1,5 @@',
    '+### TC-010 - AC-001 Kiểm tra biên dưới số lượng đặt hàng min - 1',
    '+- Expected: Báo lỗi khi số lượng nhỏ hơn ngưỡng tối thiểu.',
    '@@ -20,2 +23,5 @@',
    '+### TC-011 - AC-002 Kiểm tra bảo toàn dữ liệu khi mạng timeout 504',
    '+- Expected: Giữ nguyên thông tin khách hàng đã nhập khi gặp lỗi 504.',
  ].join('\n');

  const scan = learn(dir, { diffText: batchDiff });
  assert.equal(scan.proposed.length, 2);

  const review = buildReviewArtifact(scan);
  for (const c of review.candidates) {
    c.review = {
      status: 'approved',
      by: 'QA Lead',
      at: '2026-10-22T12:00:00Z',
      rationale: 'Duyệt cả 2 bài học trong cùng batch.',
    };
  }

  const res = applyReviewedCandidates(dir, review, { diffText: batchDiff });
  assert.equal(res.applied.length, 2);
  assert.deepEqual(
    res.applied.map((a) => a.id),
    ['PDH-003', 'PDH-004'],
  );
});

// ============================================================================
// L09: Cap 24+1 pass, 25+1 fail, 24+2 abort; field/provenance limits
// ============================================================================
test('L09: Kiểm soát trần Cap 24+1 pass, 25+1 fail, 24+2 abort toàn batch và giới hạn độ dài trường / số lượng provenance', (t) => {
  const dir = createTempRepo();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const learnDir = path.join(dir, 'test-cases', '_learning');
  fs.mkdirSync(learnDir, { recursive: true });
  const kPath = path.join(learnDir, 'knowledge.json');

  const initialEntries = [];
  for (let i = 1; i <= 24; i++) {
    initialEntries.push({
      id: `PDH-${String(i).padStart(3, '0')}`,
      targetCatalog: 'defect',
      title: `Bài học active số ${i}`,
      category: 'Data & BVA',
      trigger: `Trigger riêng biệt số ${i}`,
      failureMode: `Failure riêng biệt số ${i}`,
      actionableCheck: `Check riêng biệt số ${i}`,
      fingerprint: `fp-old-${i}`,
      status: 'active',
      provenance: [{ source: 'direct-verify', file: 'requirements/REQ-001.md', sourceHash: `s${i}`, excerpt: `ex${i}` }],
      reviewedBy: 'QA Lead',
      reviewedAt: '2026-10-20T10:00:00Z',
    });
  }

  fs.writeFileSync(
    kPath,
    JSON.stringify(
      {
        schemaVersion: '1.0.0',
        nextIds: { DH: 25, PA: 1 },
        entries: initialEntries,
        processed: [],
        graduations: [],
      },
      null,
      2,
    ),
    'utf8',
  );

  const sampleDiff = [
    'diff --git a/test-cases/REQ-001.md b/test-cases/REQ-001.md',
    '--- a/test-cases/REQ-001.md',
    '+++ b/test-cases/REQ-001.md',
    '@@ -1,2 +1,5 @@',
    '+### TC-088 - AC-001 Kiểm tra biên dưới số tiền thanh toán',
    '+- Expected: Từ chối giá trị min - 1 và giữ nguyên dữ liệu form.',
  ].join('\n');

  const scanReport = learn(dir, { diffText: sampleDiff });
  const cand1 = JSON.parse(JSON.stringify(scanReport.proposed[0]));
  cand1.review = {
    status: 'approved',
    by: 'QA Reviewer',
    at: '2026-10-22T12:00:00Z',
    rationale: 'Đạt chuẩn 4 cổng.',
  };

  const tooLongFieldReview = {
    schemaVersion: '1.0.0',
    scope: scanReport.scope,
    snapshotHash: scanReport.snapshotHash,
    sourceHash: scanReport.sourceHash,
    candidates: [{ ...cand1, trigger: 'A'.repeat(501) }],
  };
  assert.throws(
    () => applyReviewedCandidates(dir, tooLongFieldReview, { diffText: sampleDiff }),
    (err) => err.code === 'INVALID_APPROVED_FIELD',
  );

  const tooManyProvReview = {
    schemaVersion: '1.0.0',
    scope: scanReport.scope,
    snapshotHash: scanReport.snapshotHash,
    sourceHash: scanReport.sourceHash,
    candidates: [
      {
        ...cand1,
        provenance: Array.from({ length: 6 }, (_, idx) => ({
          source: 'git-diff:test-case',
          file: 'test-cases/REQ-001.md',
          sourceHash: `h-${idx}`,
          excerpt: 'ok',
        })),
      },
    ],
  };
  assert.throws(
    () => applyReviewedCandidates(dir, tooManyProvReview, { diffText: sampleDiff }),
    (err) => err.code === 'INVALID_APPROVED_PROVENANCE',
  );

  const cand2 = {
    ...cand1,
    candidateId: 'CAND-second-item',
    fingerprint: 'fp-second-overflow',
    title: 'Mục thứ hai gây tràn',
    trigger: 'Trigger khác biệt hoàn toàn',
  };
  assert.throws(
    () =>
      applyReviewedCandidates(
        dir,
        {
          schemaVersion: '1.0.0',
          scope: scanReport.scope,
          snapshotHash: scanReport.snapshotHash,
          sourceHash: scanReport.sourceHash,
          candidates: [cand1, cand2],
        },
        { diffText: sampleDiff },
      ),
    (err) => err.code === 'CAP_OVERFLOW',
  );
  assert.equal(JSON.parse(fs.readFileSync(kPath, 'utf8')).entries.length, 24);

  const res25 = applyReviewedCandidates(
    dir,
    {
      schemaVersion: '1.0.0',
      scope: scanReport.scope,
      snapshotHash: scanReport.snapshotHash,
      sourceHash: scanReport.sourceHash,
      candidates: [cand1],
    },
    { diffText: sampleDiff },
  );
  assert.equal(res25.applied.length, 1);
  assert.equal(res25.applied[0].id, 'PDH-025');

  const scanAfter25 = learn(dir, { diffText: sampleDiff });
  assert.throws(
    () =>
      applyReviewedCandidates(
        dir,
        {
          schemaVersion: '1.0.0',
          scope: scanAfter25.scope,
          snapshotHash: scanAfter25.snapshotHash,
          sourceHash: scanAfter25.sourceHash,
          candidates: [cand2],
        },
        { diffText: sampleDiff },
      ),
    (err) => err.code === 'CAP_OVERFLOW',
  );
});

// ============================================================================
// L10: Preview/dry-run repo hash không đổi, không tạo file/folder/lock
// ============================================================================
test('L10: Chạy preview và apply --dry-run tuyệt đối không thay đổi hash cây thư mục và không tạo _learning hay lock', (t) => {
  const dir = createTempRepo();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const sampleDiff = [
    'diff --git a/test-cases/REQ-001.md b/test-cases/REQ-001.md',
    '--- a/test-cases/REQ-001.md',
    '+++ b/test-cases/REQ-001.md',
    '@@ -1,2 +1,5 @@',
    '+### TC-030 - AC-003 Chống bấm đúp nút Gửi OTP khi mạng chậm',
    '+- Expected: Nút gửi bị disabled (aria-busy) và chỉ gọi API gửi OTP đúng 1 lần.',
  ].join('\n');

  const beforeHash = hashDirectoryTree(dir);
  const previewReport = learn(dir, { diffText: sampleDiff });
  assert.equal(hashDirectoryTree(dir), beforeHash);
  assert.equal(fs.existsSync(path.join(dir, 'test-cases', '_learning')), false);

  const reviewArtifact = buildReviewArtifact(previewReport);
  reviewArtifact.candidates[0].review = {
    status: 'approved',
    by: 'Lead QA',
    at: '2026-10-22T15:00:00Z',
    rationale: 'Duyệt chạy thử dry-run.',
  };

  const dryRes = applyReviewedCandidates(dir, reviewArtifact, { diffText: sampleDiff, dryRun: true });
  assert.equal(dryRes.mode, 'apply-dry-run');
  assert.equal(dryRes.applied.length, 1);
  assert.equal(hashDirectoryTree(dir), beforeHash);
  assert.equal(fs.existsSync(path.join(dir, 'test-cases', '_learning')), false);
});

// ============================================================================
// L11: Apply đúng; replay byte-identical; sửa source/review/catalog stale/conflict
// ============================================================================
test('L11: Apply tạo knowledge.json chuẩn, Replay giữ nguyên byte-identical, và chặn Stale snapshot/source hoặc Replay conflict', (t) => {
  const dir = createTempRepo();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const sampleDiff = [
    'diff --git a/test-cases/REQ-001.md b/test-cases/REQ-001.md',
    '--- a/test-cases/REQ-001.md',
    '+++ b/test-cases/REQ-001.md',
    '@@ -1,2 +1,5 @@',
    '+### TC-030 - AC-003 Chống bấm đúp nút Gửi OTP khi mạng chậm',
    '+- Expected: Nút gửi bị disabled (aria-busy) và chỉ gọi API gửi OTP đúng 1 lần.',
  ].join('\n');

  const previewReport = learn(dir, { diffText: sampleDiff });
  const reviewArtifact = buildReviewArtifact(previewReport);
  reviewArtifact.candidates[0].review = {
    status: 'approved',
    by: 'Lead QA',
    at: '2026-10-22T15:00:00Z',
    rationale: 'Bổ sung kiểm thử idempotency cho OTP.',
  };

  assert.throws(
    () =>
      applyReviewedCandidates(dir, reviewArtifact, {
        diffText: `${sampleDiff}\n+### TC-031 - AC-004 Thêm dòng làm đổi source\n+- Expected: Đổi hash.\n`,
      }),
    (err) => err.code === 'STALE_SOURCE_HASH',
  );

  const staleSnapReview = { ...reviewArtifact, snapshotHash: 'stale-hash-000' };
  assert.throws(
    () => applyReviewedCandidates(dir, staleSnapReview, { diffText: sampleDiff }),
    (err) => err.code === 'STALE_SNAPSHOT_HASH',
  );

  const realApply = applyReviewedCandidates(dir, reviewArtifact, { diffText: sampleDiff });
  assert.equal(realApply.replayNoOp, false);
  assert.equal(realApply.applied.length, 1);
  assert.equal(realApply.applied[0].id, 'PDH-001');

  const kPath = path.join(dir, 'test-cases', '_learning', 'knowledge.json');
  const bytesAfterFirstApply = fs.readFileSync(kPath, 'utf8');

  const replayRes = applyReviewedCandidates(dir, reviewArtifact, { diffText: sampleDiff });
  assert.equal(replayRes.replayNoOp, true);
  assert.equal(replayRes.applied.length, 0);
  assert.equal(fs.readFileSync(kPath, 'utf8'), bytesAfterFirstApply);

  const mutatedReview = JSON.parse(JSON.stringify(reviewArtifact));
  mutatedReview.candidates[0].title = 'Tiêu đề bị sửa sau khi đã apply';
  assert.throws(
    () => applyReviewedCandidates(dir, mutatedReview, { diffText: sampleDiff }),
    (err) => err.code === 'REPLAY_CONFLICT',
  );
});

// ============================================================================
// L12: Lock contention, permission/rename failure, cleanup/crash recovery giữ JSON hợp lệ
// ============================================================================
test('L12: Chặn Lock contention và giữ nguyên knowledge.json gốc nếu rename thất bại (Windows file lock simulation)', (t) => {
  const dir = createTempRepo();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const sampleDiff = [
    'diff --git a/test-cases/REQ-001.md b/test-cases/REQ-001.md',
    '--- a/test-cases/REQ-001.md',
    '+++ b/test-cases/REQ-001.md',
    '@@ -1,2 +1,5 @@',
    '+### TC-040 - AC-004 Kiểm tra bảo toàn dữ liệu khi server trả lỗi 503',
    '+- Expected: Giữ nguyên toàn bộ thông tin đã nhập trên form khi gặp lỗi 503.',
  ].join('\n');

  const report = learn(dir, { diffText: sampleDiff });
  const review = buildReviewArtifact(report);
  review.candidates[0].review = {
    status: 'approved',
    by: 'QA Reviewer',
    at: '2026-10-22T16:00:00Z',
    rationale: 'Hợp lệ.',
  };

  const learnDir = path.join(dir, 'test-cases', '_learning');
  fs.mkdirSync(learnDir, { recursive: true });
  const lockPath = path.join(learnDir, 'knowledge.lock');
  fs.writeFileSync(lockPath, JSON.stringify({ pid: 99999, createdAt: '2026-10-22T00:00:00Z' }), 'utf8');

  assert.throws(
    () => applyReviewedCandidates(dir, review, { diffText: sampleDiff }),
    (err) => err.code === 'LOCK_CONTENTION',
  );
  assert.equal(fs.existsSync(lockPath), true);
  fs.unlinkSync(lockPath);

  applyReviewedCandidates(dir, review, { diffText: sampleDiff });
  const kPath = path.join(learnDir, 'knowledge.json');
  const originalJsonBytes = fs.readFileSync(kPath, 'utf8');

  const secondDiff = [
    'diff --git a/test-cases/REQ-002.md b/test-cases/REQ-002.md',
    '--- a/test-cases/REQ-002.md',
    '+++ b/test-cases/REQ-002.md',
    '@@ -1,2 +1,5 @@',
    '+### TC-041 - AC-005 Kiểm tra Reflected XSS trên ô tìm kiếm công khai',
    '+- Expected: Escape toàn bộ thẻ script trên trang public.',
  ].join('\n');
  const report2 = learn(dir, { diffText: secondDiff });
  const review2 = buildReviewArtifact(report2);
  review2.candidates[0].review = {
    status: 'approved',
    by: 'QA Reviewer',
    at: '2026-10-22T16:05:00Z',
    rationale: 'Hợp lệ lần 2.',
  };

  const failingFsAdapter = {
    ...fs,
    openSync: fs.openSync.bind(fs),
    writeFileSync: fs.writeFileSync.bind(fs),
    closeSync: fs.closeSync.bind(fs),
    fsyncSync: fs.fsyncSync.bind(fs),
    mkdirSync: fs.mkdirSync.bind(fs),
    existsSync: fs.existsSync.bind(fs),
    unlinkSync: fs.unlinkSync.bind(fs),
    renameSync() {
      const err = new Error('EPERM: operation not permitted, rename');
      err.code = 'EPERM';
      throw err;
    },
  };

  assert.throws(
    () => applyReviewedCandidates(dir, review2, { diffText: secondDiff, fsAdapter: failingFsAdapter }),
    /EPERM/,
  );

  assert.equal(fs.readFileSync(kPath, 'utf8'), originalJsonBytes);
  assert.deepEqual(fs.readdirSync(learnDir), ['knowledge.json']);
});

