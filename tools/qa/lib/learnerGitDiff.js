'use strict';
/**
 * Thu thập unified diff an toàn từ Git repository theo cấu hình layout của dự án.
 */

const fs = require('node:fs');
const path = require('node:path');
const { loadConfig } = require('./config');
const { MAX_DIFF_BYTES, LearnerError } = require('./learnerConstants');
const { resolveAndValidateRepoPath, classifyRepoFile } = require('./learnerPaths');
const { runGit, resolveDiffBaseSha, listUntrackedAndChanged } = require('./learnerGitRunner');

function collectDiff(root, options = {}) {
  const cfg = { ...loadConfig(root), ...options };

  for (const dirRel of [cfg.requirementsDir, cfg.testCasesDir, cfg.projectDir]) {
    if (dirRel && fs.existsSync(path.join(root, dirRel))) {
      resolveAndValidateRepoPath(root, dirRel);
    }
  }

  const { baseSha, scopeMode, sinceRef } = resolveDiffBaseSha(root, options);
  const { untrackedEligible, changedItems } = listUntrackedAndChanged(root, baseSha, cfg, options);

  const skipped = [];
  const diffChunks = [];
  let totalDiffBytes = 0;

  for (const item of changedItems) {
    const cls = classifyRepoFile(item.file, cfg);
    if (!cls.eligible) {
      if (cls.skipReason) skipped.push({ file: item.file, reason: cls.skipReason });
      continue;
    }

    resolveAndValidateRepoPath(root, item.file);

    if (item.status === 'D') {
      skipped.push({ file: item.file, reason: 'deleted-file' });
      continue;
    }

    const fileDiff = runGit(
      root,
      [
        'diff',
        '--no-ext-diff',
        '--no-textconv',
        '--no-color',
        '--no-renames',
        '--unified=8',
        baseSha,
        '--',
        item.file,
      ],
      options,
    );
    if (fileDiff.status !== 0) {
      throw new LearnerError(`Lỗi diff file "${item.file}": ${fileDiff.stderr.trim()}`, 'GIT_FILE_DIFF_ERROR');
    }

    const chunkBuf = fileDiff.rawStdout;
    totalDiffBytes += chunkBuf.length;
    if (totalDiffBytes > MAX_DIFF_BYTES) {
      throw new LearnerError(
        `Tổng dung lượng diff (${totalDiffBytes} bytes) vượt quá giới hạn an toàn (${MAX_DIFF_BYTES} bytes / 8 MiB).`,
        'DIFF_SIZE_LIMIT_EXCEEDED',
      );
    }

    const chunkText = chunkBuf.toString('utf8');
    if (/^Binary files .* differ$/m.test(chunkText) || chunkBuf.includes(0)) {
      skipped.push({ file: item.file, reason: 'binary-file' });
      continue;
    }

    if (chunkText.trim()) diffChunks.push(chunkText);
  }

  return {
    diffText: diffChunks.join('\n'),
    totalDiffBytes,
    skipped,
    scope: {
      mode: scopeMode,
      since: sinceRef,
      resolvedBaseSha: baseSha,
      layout: {
        requirementsDir: cfg.requirementsDir,
        testCasesDir: cfg.testCasesDir,
        projectDir: cfg.projectDir,
        ignoreSpecs: cfg.ignoreSpecs,
      },
      untrackedSkippedCount: untrackedEligible.length,
      untrackedFiles: untrackedEligible,
    },
  };
}

module.exports = { collectDiff };

