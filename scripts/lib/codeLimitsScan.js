'use strict';

/**
 * Đo đếm dòng vật lý, độ dài dòng, dung lượng byte & chọn danh sách file cần quét.
 */

const path = require('path');
const { isForbiddenScratchFile, isAutomationProjectPath } = require('./codeLimitsPolicy');
const { walkSourceFiles } = require('./codeLimitsGit');

function splitPhysicalLines(text) {
  if (!text) return [];
  const lines = String(text).split(/\r\n|\n|\r/);
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

function measureContent(rawBuffer) {
  const text = rawBuffer.toString('utf8');
  const lines = splitPhysicalLines(text);
  let longestLine = 0;
  let longestLineNumber = 1;
  let nonEmptyChars = 0;
  let nonEmptyCount = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const len = lines[i].length;
    if (len > longestLine) {
      longestLine = len;
      longestLineNumber = i + 1;
    }
    if (lines[i].trim().length > 0) {
      nonEmptyChars += len;
      nonEmptyCount += 1;
    }
  }
  const avgLineLength = nonEmptyCount > 0 ? nonEmptyChars / nonEmptyCount : 0;
  return {
    text,
    lineCount: lines.length,
    longestLine,
    longestLineNumber,
    avgLineLength,
    byteLength: rawBuffer.length,
  };
}

function resolveTargetFiles(root, policy, gitCtx, options) {
  const extSet = new Set(policy.extensions.map((e) => e.toLowerCase()));
  const excludedSet = new Set(policy.excludedFolders.map((f) => f.toLowerCase()));
  const isCandidate = (rel) => {
    const posix = rel.replace(/^[/\\]+/, '').replace(/\\/g, '/');
    const parts = posix.split('/');
    if (parts.slice(0, -1).some((seg) => excludedSet.has(seg.toLowerCase()))) return false;
    return extSet.has(path.posix.extname(posix).toLowerCase()) || isForbiddenScratchFile(posix);
  };

  if (Array.isArray(options.targetArgs) && options.targetArgs.length > 0) {
    return [...new Set(options.targetArgs.map((f) => f.replace(/^[/\\]+/, '').replace(/\\/g, '/')))].filter(isCandidate);
  }
  if (options.scope === 'automation') {
    return walkSourceFiles(root, ['tests/e2e', 'tests/api', 'pages', 'core/local'], policy, gitCtx);
  }
  if (options.scope === 'automation-changed') {
    if (!gitCtx.isGit) return [];
    return [...gitCtx.workingChanged].filter((f) => isAutomationProjectPath(f) && isCandidate(f)).sort();
  }
  if (options.all) {
    return walkSourceFiles(root, null, policy, gitCtx);
  }
  if (!gitCtx.isGit) {
    return walkSourceFiles(root, ['tests/e2e', 'tests/api', 'pages', 'core/local'], policy, gitCtx);
  }
  const changedSet = options.stagedOnly ? gitCtx.staged : gitCtx.changedSinceBase;
  return [...changedSet].filter(isCandidate).sort();
}

module.exports = {
  splitPhysicalLines,
  measureContent,
  resolveTargetFiles,
};

