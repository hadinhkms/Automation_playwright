'use strict';
/**
 * Xây dựng, kiểm tra đường dẫn và xuất Review Artifact JSON an toàn vào thư mục <testCasesDir>/_learning.
 */

const fs = require('node:fs');
const path = require('node:path');
const { SCHEMA_VERSION, LearnerError } = require('./learnerConstants');
const { resolveAndValidateRepoPath } = require('./learnerPaths');

function buildReviewArtifact(learnReport) {
  const clonedCandidates = JSON.parse(
    JSON.stringify([...(learnReport.proposed || []), ...(learnReport.needsReview || [])]),
  );
  return {
    schemaVersion: SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    scope: learnReport.scope ? JSON.parse(JSON.stringify(learnReport.scope)) : null,
    snapshotHash: learnReport.snapshotHash,
    sourceHash: learnReport.sourceHash,
    candidates: clonedCandidates,
  };
}

function resolveAndValidateReviewOutputPath(root, outputFlag, options = {}) {
  if (!outputFlag || typeof outputFlag !== 'string' || !outputFlag.trim()) {
    throw new LearnerError('Cờ --output thiếu đường dẫn file đích.', 'INVALID_OUTPUT_PATH');
  }
  const testCasesDir = String(options.testCasesDir || 'test-cases')
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '');
  const learningRelDir = `${testCasesDir}/_learning`;

  const validatedLearning = resolveAndValidateRepoPath(root, learningRelDir, { requireOwn: true });
  const validatedOut = resolveAndValidateRepoPath(root, outputFlag.trim(), { requireOwn: true });

  const relToLearning = path.relative(validatedLearning.absPath, validatedOut.absPath).replace(/\\/g, '/');
  if (!relToLearning || relToLearning.startsWith('..') || path.isAbsolute(relToLearning)) {
    throw new LearnerError(
      `Đường dẫn --output phải nằm bên trong "${learningRelDir}": ${outputFlag}`,
      'OUTPUT_OUTSIDE_LEARNING_DIR',
    );
  }

  const baseLower = path.basename(validatedOut.absPath).toLowerCase();
  if (
    baseLower === 'knowledge.json' ||
    baseLower === 'knowledge.lock' ||
    baseLower === 'knowledge' ||
    baseLower === 'lock' ||
    baseLower.endsWith('.lock') ||
    baseLower.startsWith('knowledge.json.')
  ) {
    throw new LearnerError(
      `Đường dẫn --output không được trùng với file hệ thống (knowledge.json / knowledge.lock): ${outputFlag}`,
      'OUTPUT_RESERVED_FILENAME',
    );
  }

  if (fs.existsSync(validatedOut.absPath)) {
    throw new LearnerError(
      `File review artifact đã tồn tại: ${outputFlag}. Vui lòng dùng tên file khác để giữ công review cũ.`,
      'OUTPUT_ALREADY_EXISTS',
    );
  }

  return validatedOut;
}

function exportReviewArtifact(root, outputFlag, learnReport, options = {}) {
  const validatedOut = resolveAndValidateReviewOutputPath(root, outputFlag, options);
  const artifact = buildReviewArtifact(learnReport);
  const parentDir = path.dirname(validatedOut.absPath);
  fs.mkdirSync(parentDir, { recursive: true });
  resolveAndValidateRepoPath(root, path.relative(fs.realpathSync(root), parentDir), { requireOwn: true });
  try {
    fs.writeFileSync(validatedOut.absPath, `${JSON.stringify(artifact, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
    });
  } catch (err) {
    if (err && err.code === 'EEXIST') {
      throw new LearnerError(
        `File review artifact đã tồn tại: ${outputFlag}. Vui lòng dùng tên file khác để giữ công review cũ.`,
        'OUTPUT_ALREADY_EXISTS',
      );
    }
    throw new LearnerError(`Không thể ghi review artifact "${outputFlag}": ${err.message}`, 'OUTPUT_IO_ERROR');
  }
  return { outputPath: validatedOut.relPath, artifact };
}

module.exports = {
  buildReviewArtifact,
  resolveAndValidateReviewOutputPath,
  exportReviewArtifact,
};

