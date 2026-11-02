'use strict';
/**
 * Đọc và kiểm định cấu trúc Review Artifact cùng danh sách candidates trước khi thực thi Batch Apply.
 */

const fs = require('node:fs');
const path = require('node:path');
const {
  SCHEMA_VERSION,
  MAX_TITLE_LENGTH,
  MAX_FIELD_LENGTH,
  MAX_PROVENANCE_PER_ENTRY,
  MAX_EXCERPT_LENGTH,
  VALID_CATEGORIES,
  LearnerError,
  normalizeCatalogType,
} = require('./learnerConstants');
const {
  unicodeLength,
  stripBomAndNormalizeLf,
  containsUnredactedSensitive,
  isIso8601Timestamp,
} = require('./learnerText');

function validateApprovedCandidate(c) {
  const label = c.candidateId || c.fingerprint;
  const { prefix, targetCatalog } = normalizeCatalogType(c.targetCatalog || c.type);
  if (!VALID_CATEGORIES[prefix].has(c.category)) {
    throw new LearnerError(
      `Candidate "${label}" có category "${c.category}" không thuộc enum hợp lệ của ${prefix}.`,
      'INVALID_APPROVED_CATEGORY',
    );
  }
  if (!c.title || unicodeLength(c.title) > MAX_TITLE_LENGTH) {
    throw new LearnerError(
      `Candidate "${label}" có title trống hoặc vượt ${MAX_TITLE_LENGTH} ký tự.`,
      'INVALID_APPROVED_TITLE',
    );
  }
  for (const f of ['trigger', 'failureMode', 'actionableCheck']) {
    if (!c[f] || typeof c[f] !== 'string' || unicodeLength(c[f]) > MAX_FIELD_LENGTH) {
      throw new LearnerError(
        `Candidate "${label}" có trường "${f}" trống hoặc vượt ${MAX_FIELD_LENGTH} ký tự.`,
        'INVALID_APPROVED_FIELD',
      );
    }
    if (containsUnredactedSensitive(c[f]) || containsUnredactedSensitive(c.title)) {
      throw new LearnerError(
        `Candidate "${label}" chứa dữ liệu nhạy cảm (PII/secret/email) chưa được redact.`,
        'UNREDACTED_APPROVED_CONTENT',
      );
    }
  }
  if (!Array.isArray(c.provenance) || c.provenance.length === 0 || c.provenance.length > MAX_PROVENANCE_PER_ENTRY) {
    throw new LearnerError(
      `Candidate "${label}" phải có từ 1..${MAX_PROVENANCE_PER_ENTRY} provenance.`,
      'INVALID_APPROVED_PROVENANCE',
    );
  }
  for (const p of c.provenance) {
    if (!p || typeof p !== 'object' || !p.source || !p.sourceHash) {
      throw new LearnerError(`Provenance của "${label}" thiếu source hoặc sourceHash.`, 'INVALID_PROVENANCE_SCHEMA');
    }
    if (p.excerpt && (unicodeLength(p.excerpt) > MAX_EXCERPT_LENGTH || containsUnredactedSensitive(p.excerpt))) {
      throw new LearnerError(
        `Provenance excerpt của "${label}" vượt ${MAX_EXCERPT_LENGTH} ký tự hoặc chứa PII/secret.`,
        'INVALID_PROVENANCE_EXCERPT',
      );
    }
  }
  if (c.gates && typeof c.gates === 'object') {
    for (const gName of ['generality', 'novelty', 'impact', 'distillability']) {
      const g = c.gates[gName];
      if (!g || (g.status !== 'pass' && g.status !== 'unknown')) {
        throw new LearnerError(
          `Candidate "${label}" không thể approved khi cổng "${gName}" đang có trạng thái "${g && g.status}".`,
          'UNCONFIRMED_GATE_ON_APPROVAL',
        );
      }
    }
  }
  c.targetCatalog = targetCatalog;
  c.type = prefix;
}

function parseAndValidateReviewInput(root, reviewInput, cfg) {
  let reviewObj = reviewInput;
  if (typeof reviewInput === 'string') {
    const reviewAbs = path.resolve(root, reviewInput);
    if (!fs.existsSync(reviewAbs)) {
      throw new LearnerError(`Không tìm thấy file Review Artifact: "${reviewInput}"`, 'MISSING_REVIEW_FILE');
    }
    try {
      reviewObj = JSON.parse(stripBomAndNormalizeLf(fs.readFileSync(reviewAbs, 'utf8')));
    } catch (err) {
      throw new LearnerError(`File review "${reviewInput}" không phải JSON hợp lệ: ${err.message}`, 'INVALID_REVIEW_JSON');
    }
  }

  if (!reviewObj || typeof reviewObj !== 'object' || Array.isArray(reviewObj)) {
    throw new LearnerError('Review Artifact phải là một JSON object.', 'INVALID_REVIEW_ARTIFACT');
  }
  if (reviewObj.schemaVersion !== SCHEMA_VERSION) {
    throw new LearnerError(
      `Review Artifact có schemaVersion "${reviewObj.schemaVersion}" không khớp "${SCHEMA_VERSION}".`,
      'UNSUPPORTED_REVIEW_SCHEMA',
    );
  }
  if (!reviewObj.snapshotHash || !reviewObj.sourceHash || !Array.isArray(reviewObj.candidates)) {
    throw new LearnerError(
      'Review Artifact thiếu snapshotHash, sourceHash hoặc mảng candidates.',
      'INCOMPLETE_REVIEW_ARTIFACT',
    );
  }

  if (reviewObj.scope && reviewObj.scope.layout) {
    const rl = reviewObj.scope.layout;
    if (
      (rl.testCasesDir && rl.testCasesDir !== cfg.testCasesDir) ||
      (rl.requirementsDir && rl.requirementsDir !== cfg.requirementsDir) ||
      (rl.projectDir && rl.projectDir !== cfg.projectDir)
    ) {
      throw new LearnerError('Layout trong Review Artifact không khớp với cấu hình repo hiện tại.', 'LAYOUT_MISMATCH');
    }
  }

  const actionable = [];
  const skipped = [];
  const seenBatchFps = new Set();

  for (let i = 0; i < reviewObj.candidates.length; i++) {
    const c = reviewObj.candidates[i];
    if (!c || typeof c !== 'object' || !c.fingerprint || !c.review || typeof c.review !== 'object') {
      throw new LearnerError(`candidates[${i}] thiếu fingerprint hoặc object review.`, 'INVALID_CANDIDATE_SCHEMA');
    }
    if (seenBatchFps.has(c.fingerprint)) {
      throw new LearnerError(
        `Trùng fingerprint "${c.fingerprint}" ngay trong cùng một Review Artifact.`,
        'DUPLICATE_BATCH_FINGERPRINT',
      );
    }
    seenBatchFps.add(c.fingerprint);

    const rStatus = c.review.status;
    if (rStatus === 'pending') {
      skipped.push({
        candidateId: c.candidateId || `CAND-${c.fingerprint.slice(0, 12)}`,
        fingerprint: c.fingerprint,
        reason: 'review-pending',
      });
      continue;
    }
    if (rStatus !== 'approved' && rStatus !== 'rejected') {
      throw new LearnerError(
        `Candidate "${c.candidateId || c.fingerprint}" có review.status="${rStatus}" không hợp lệ (chỉ nhận pending | approved | rejected).`,
        'INVALID_REVIEW_STATUS',
      );
    }

    const by = String(c.review.by || '').trim();
    const at = String(c.review.at || '').trim();
    const rationale = String(c.review.rationale || '').trim();
    if (!by || !isIso8601Timestamp(at) || !rationale) {
      throw new LearnerError(
        `Candidate "${c.candidateId || c.fingerprint}" (${rStatus}) bắt buộc phải có review.by, review.at (ISO 8601) và review.rationale không rỗng.`,
        'MISSING_REVIEW_METADATA',
      );
    }

    if (rStatus === 'approved') validateApprovedCandidate(c);
    actionable.push(c);
  }

  return { reviewObj, actionable, skipped };
}

module.exports = { parseAndValidateReviewInput };

