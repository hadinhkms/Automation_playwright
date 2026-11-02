'use strict';
/**
 * Kiểm tra Replay No-op / Conflict và đối chiếu tính toàn vẹn của snapshotHash & sourceHash khi Apply.
 */

const fs = require('node:fs');
const { LearnerError } = require('./learnerConstants');
const {
  sha256,
  stripBomAndNormalizeLf,
  computeResolutionContentHash,
  computeScopeSourceHash,
} = require('./learnerText');
const { resolveAndValidateRepoPath } = require('./learnerPaths');
const { collectDiff } = require('./learnerGitDiff');
const { extractSignalsFromDiff } = require('./learnerDiffSignals');
const { extractSignalsFromDecisions } = require('./learnerDecisionSignals');

function checkReplayStatus(actionable, processedMap) {
  if (actionable.length === 0) return { allAlreadyProcessed: false };

  let allAlreadyProcessed = true;
  for (const c of actionable) {
    const desiredRes =
      c.review.status === 'rejected'
        ? 'rejected'
        : c.review.resolution === 'merged'
        ? 'merged'
        : 'applied';
    const expectedHash = computeResolutionContentHash(c, desiredRes);
    const existingProc = processedMap.get(c.fingerprint);

    if (!existingProc) {
      allAlreadyProcessed = false;
    } else if (
      existingProc.resolution !== desiredRes ||
      (existingProc.resolutionHash && existingProc.resolutionHash !== expectedHash)
    ) {
      throw new LearnerError(
        `Xung đột Replay: Candidate "${c.candidateId || c.fingerprint}" đã được xử lý trước đó với nội dung hoặc trạng thái khác ("${existingProc.resolution}").`,
        'REPLAY_CONFLICT',
      );
    }
  }

  return { allAlreadyProcessed };
}

function verifyApplyHashes(root, reviewObj, actionable, currentCatalog, cfg, options = {}) {
  if (reviewObj.snapshotHash !== currentCatalog.snapshotHash) {
    throw new LearnerError(
      'Review Artifact đã cũ (Stale snapshotHash): Catalog chung hoặc knowledge.json đã thay đổi kể từ lúc xuất file review.',
      'STALE_SNAPSHOT_HASH',
    );
  }

  const sinceScope = reviewObj.scope && reviewObj.scope.since ? reviewObj.scope.since : null;
  const currentSignals = [];
  if (options.diffText !== undefined) {
    const diffExtracted = extractSignalsFromDiff(options.diffText, { ...cfg, root });
    currentSignals.push(...diffExtracted.signals);
  } else if (!reviewObj.scope || reviewObj.scope.mode !== 'direct-verify-only') {
    const diffCollected = collectDiff(root, { ...cfg, since: sinceScope });
    const diffExtracted = extractSignalsFromDiff(diffCollected, { ...cfg, root });
    currentSignals.push(...diffExtracted.signals);
  }
  const decExtracted = extractSignalsFromDecisions(root);
  currentSignals.push(...decExtracted.signals);

  for (const c of actionable) {
    for (const p of c.provenance || []) {
      if (p.source === 'direct-verify') {
        if (!p.file || !p.sourceHash) {
          throw new LearnerError(
            `Candidate "${c.candidateId}" từ direct-verify thiếu file hoặc sourceHash bằng chứng.`,
            'INVALID_DIRECT_VERIFY_EVIDENCE',
          );
        }
        const verifyTarget = resolveAndValidateRepoPath(root, p.file);
        if (!fs.existsSync(verifyTarget.absPath)) {
          throw new LearnerError(
            `File bằng chứng "${p.file}" của candidate "${c.candidateId}" không tồn tại.`,
            'MISSING_DIRECT_VERIFY_FILE',
          );
        }
        const fileBytesHash = sha256(stripBomAndNormalizeLf(fs.readFileSync(verifyTarget.absPath, 'utf8')));
        if (p.fileHash && p.fileHash !== fileBytesHash) {
          throw new LearnerError(
            `File bằng chứng "${p.file}" đã thay đổi so với lúc review.`,
            'STALE_DIRECT_VERIFY_FILE',
          );
        }
        currentSignals.push({ source: 'direct-verify', file: p.file, sourceHash: p.sourceHash });
      }
    }
  }

  const currentSourceHash = computeScopeSourceHash(currentSignals);
  if (reviewObj.sourceHash !== currentSourceHash) {
    throw new LearnerError(
      'Review Artifact đã cũ (Stale sourceHash): Mã nguồn diff hoặc decisions.json đã thay đổi kể từ lúc xuất file review.',
      'STALE_SOURCE_HASH',
    );
  }
}

module.exports = {
  checkReplayStatus,
  verifyApplyHashes,
};

