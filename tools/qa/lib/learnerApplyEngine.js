'use strict';
/**
 * Thực thi giao dịch Batch Apply (khóa wx độc quyền, xác minh hash/replay, ghi nguyên tử knowledge.json).
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { loadConfig } = require('./config');
const { SCHEMA_VERSION, LearnerError } = require('./learnerConstants');
const { resolveAndValidateRepoPath } = require('./learnerPaths');
const { loadCatalog } = require('./learnerCatalogLoader');
const { parseAndValidateReviewInput } = require('./learnerReviewValidator');
const { checkReplayStatus, verifyApplyHashes } = require('./learnerApplyVerification');
const { applyCandidatesToKnowledge } = require('./learnerApplyMutator');

function applyReviewedCandidates(root, reviewInput, options = {}) {
  const cfg = { ...loadConfig(root), ...options };
  const dryRun = Boolean(options.dryRun);

  const { reviewObj, actionable, skipped } = parseAndValidateReviewInput(root, reviewInput, cfg);

  const learningRelDir = `${cfg.testCasesDir || 'test-cases'}/_learning`;
  const { absPath: learningAbsDir } = resolveAndValidateRepoPath(root, learningRelDir, { requireOwn: true });
  const knowledgeAbsPath = path.join(learningAbsDir, 'knowledge.json');
  const lockAbsPath = path.join(learningAbsDir, 'knowledge.lock');

  let lockFd = null;
  let tempAbsPath = null;
  const fsOps = options.fsAdapter || fs;

  try {
    if (!dryRun && actionable.length > 0) {
      fsOps.mkdirSync(learningAbsDir, { recursive: true });
      try {
        lockFd = fsOps.openSync(lockAbsPath, 'wx');
        const lockPayload = JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() });
        fsOps.writeFileSync(lockFd, lockPayload, 'utf8');
      } catch (err) {
        if (err && err.code === 'EEXIST') {
          throw new LearnerError(
            `Không thể lấy khoá ghi "${path.relative(root, lockAbsPath).replace(/\\/g, '/')}" (đang có tiến trình khác chạy hoặc lock cũ bị sót sau sự cố).`,
            'LOCK_CONTENTION',
          );
        }
        throw new LearnerError(`Lỗi khi tạo file lock: ${err.message}`, 'LOCK_ERROR');
      }
    }

    const currentCatalog = loadCatalog(root, { ...cfg, requireOwnOverlay: true });
    const knowledge = JSON.parse(JSON.stringify(currentCatalog.project));
    const processedMap = new Map(knowledge.processed.map((p) => [p.fingerprint, p]));

    const { allAlreadyProcessed } = checkReplayStatus(actionable, processedMap);
    if (allAlreadyProcessed) {
      return {
        schemaVersion: SCHEMA_VERSION,
        mode: dryRun ? 'apply-dry-run' : 'apply',
        replayNoOp: true,
        scope: reviewObj.scope || null,
        snapshotHash: currentCatalog.snapshotHash,
        sourceHash: reviewObj.sourceHash,
        catalogStats: currentCatalog.stats,
        proposed: [],
        needsReview: [],
        rejected: [],
        applied: [],
        skipped,
        errors: [],
      };
    }

    verifyApplyHashes(root, reviewObj, actionable, currentCatalog, cfg, options);

    const { appliedItems, rejectedItems } = applyCandidatesToKnowledge(
      actionable,
      currentCatalog,
      knowledge,
      processedMap,
    );

    if (!dryRun && (appliedItems.length > 0 || rejectedItems.length > 0)) {
      const serialized = `${JSON.stringify(knowledge, null, 2)}\n`;
      const rand = crypto.randomBytes(6).toString('hex');
      tempAbsPath = path.join(learningAbsDir, `knowledge.json.tmp.${process.pid}.${rand}`);

      const tmpFd = fsOps.openSync(tempAbsPath, 'wx');
      try {
        fsOps.writeFileSync(tmpFd, serialized, 'utf8');
        if (typeof fsOps.fsyncSync === 'function') fsOps.fsyncSync(tmpFd);
      } finally {
        fsOps.closeSync(tmpFd);
      }

      fsOps.renameSync(tempAbsPath, knowledgeAbsPath);
      tempAbsPath = null;
    }

    const updatedCatalog = dryRun ? currentCatalog : loadCatalog(root, { ...cfg, requireOwnOverlay: true });

    return {
      schemaVersion: SCHEMA_VERSION,
      mode: dryRun ? 'apply-dry-run' : 'apply',
      replayNoOp: false,
      scope: reviewObj.scope || null,
      snapshotHash: updatedCatalog.snapshotHash,
      sourceHash: reviewObj.sourceHash,
      catalogStats: updatedCatalog.stats,
      proposed: [],
      needsReview: [],
      rejected: rejectedItems,
      applied: appliedItems,
      skipped,
      errors: [],
    };
  } finally {
    if (tempAbsPath && fsOps.existsSync(tempAbsPath)) {
      try {
        fsOps.unlinkSync(tempAbsPath);
      } catch {
        // Bỏ qua lỗi dọn file tạm
      }
    }
    if (lockFd !== null) {
      try {
        fsOps.closeSync(lockFd);
      } catch {
        // Bỏ qua lỗi đóng fd
      }
      try {
        if (fsOps.existsSync(lockAbsPath)) fsOps.unlinkSync(lockAbsPath);
      } catch {
        // Bỏ qua lỗi xoá lock
      }
    }
  }
}

module.exports = { applyReviewedCandidates };

