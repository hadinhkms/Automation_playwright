'use strict';
/**
 * Bóc tách tín hiệu học tập từ unified diff (Hunk-aware, lọc nhiễu comment/format/config).
 */

const { loadConfig } = require('./config');
const { MAX_EXCERPT_LENGTH, MAX_SIGNALS, LearnerError } = require('./learnerConstants');
const { sha256, redactSensitiveText } = require('./learnerText');
const { classifyRepoFile } = require('./learnerPaths');
const {
  isCommentOrBlankLine,
  isConfigOrEnvOnlyLine,
  parseUnifiedDiffHunks,
} = require('./learnerDiffParser');
const { buildDocHunkSignal, buildSpecHunkSignal } = require('./learnerHunkSignals');

function buildNoiseSignal(filePath, fileKind, newStart, noiseReason, rawText) {
  return {
    source: `git-diff:${fileKind}`,
    file: filePath,
    line: newStart,
    targetCatalog: fileKind === 'playwright-spec' ? 'antipattern' : 'defect',
    isNoise: true,
    noiseReason,
    rawExcerpt: redactSensitiveText(rawText.slice(0, MAX_EXCERPT_LENGTH)),
    sourceHash: sha256(`${filePath}:${newStart}:${rawText}`),
  };
}

function extractSignalsFromDiff(diffInput, options = {}) {
  const cfg = { ...loadConfig(options.root || process.cwd()), ...options };
  const diffText = typeof diffInput === 'string' ? diffInput : (diffInput && diffInput.diffText) || '';
  const skipped = Array.isArray(diffInput && diffInput.skipped) ? [...diffInput.skipped] : [];
  const parsedFiles = parseUnifiedDiffHunks(diffText);
  const signals = [];

  for (const f of parsedFiles) {
    const filePath = (f.newPath || f.oldPath || '').replace(/\\/g, '/');
    if (!filePath) continue;

    if (f.isDeletedFile && !f.newPath) {
      skipped.push({ file: filePath, reason: 'deleted-file' });
      continue;
    }

    const cls = classifyRepoFile(filePath, cfg);
    if (!cls.eligible) {
      if (cls.skipReason) skipped.push({ file: filePath, reason: cls.skipReason });
      continue;
    }

    for (const hunk of f.hunks) {
      if (hunk.added.length === 0 && hunk.removed.length === 0) continue;

      const changedLines = [...hunk.added, ...hunk.removed];
      if (changedLines.every((l) => isCommentOrBlankLine(l, cls.kind))) {
        signals.push(
          buildNoiseSignal(filePath, cls.kind, hunk.newStart, 'comment-or-whitespace-only', hunk.added.join('\n')),
        );
        continue;
      }

      const normAdded = hunk.added.map((l) => l.trim()).filter(Boolean).join(' ');
      const normRemoved = hunk.removed.map((l) => l.trim()).filter(Boolean).join(' ');
      if (normAdded && normAdded === normRemoved) {
        signals.push(buildNoiseSignal(filePath, cls.kind, hunk.newStart, 'formatting-only', normAdded));
        continue;
      }

      const nonBlankAdded = hunk.added.filter((l) => l.trim() !== '');
      if (nonBlankAdded.length > 0 && nonBlankAdded.every((l) => isConfigOrEnvOnlyLine(l))) {
        signals.push(
          buildNoiseSignal(filePath, cls.kind, hunk.newStart, 'config-or-env-only', nonBlankAdded.join('\n')),
        );
        continue;
      }

      if (cls.kind === 'requirement' || cls.kind === 'test-case') {
        signals.push(buildDocHunkSignal(filePath, cls.kind, hunk, nonBlankAdded));
      } else if (cls.kind === 'playwright-spec') {
        signals.push(buildSpecHunkSignal(filePath, f.isNewFile, hunk));
      }

      if (signals.length > MAX_SIGNALS) {
        throw new LearnerError(
          `Số lượng tín hiệu bóc tách vượt quá giới hạn an toàn (${MAX_SIGNALS}). Hãy thu hẹp phạm vi --since.`,
          'SIGNAL_LIMIT_EXCEEDED',
        );
      }
    }
  }

  return { signals, skipped };
}

module.exports = { extractSignalsFromDiff };

