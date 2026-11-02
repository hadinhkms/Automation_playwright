'use strict';

/**
 * Bộ phân tích giới hạn dòng code, vùng vàng 80%, độ dài dòng & file nháp cho
 * D:\_Automation-Project và toàn bộ dự án vệ tinh.
 */

const fs = require('fs');
const path = require('path');
const {
  loadQualityPolicy,
  loadSizeExemptions,
  checkFileExemption,
  determineFileRole,
  isForbiddenScratchFile,
  splitGuidanceForRole,
} = require('./codeLimitsPolicy');
const {
  resolveGitContext,
  getFileDiffAgainstBase,
  analyzeDiffLogic,
} = require('./codeLimitsGit');
const {
  splitPhysicalLines,
  measureContent,
  resolveTargetFiles,
} = require('./codeLimitsScan');

function evaluateFileLimits(root, relPath, policy, exemptions, todayIso, gitCtx, options = {}) {
  const posixPath = relPath.replace(/\\/g, '/');
  const absPath = path.join(root, posixPath);
  const violations = [];
  const warnings = [];

  if (!fs.existsSync(absPath) || !fs.statSync(absPath).isFile()) {
    return { report: null, exempted: false, violations, warnings };
  }

  if (isForbiddenScratchFile(posixPath)) {
    violations.push({
      file: posixPath,
      line: 1,
      kind: 'forbidden-scratch-file',
      message: `${posixPath}:1 file nháp/tạm của AI nằm ngoài vùng cách ly scratch/ hoặc tests/scratch/`,
      action: 'Di chuyển file nháp vào scratch/ hoặc tests/scratch/ (đã gitignore) hoặc đổi tên chuẩn nghiệp vụ.',
    });
    return { report: null, exempted: false, violations, warnings };
  }

  const rawBuffer = fs.readFileSync(absPath);
  const metrics = measureContent(rawBuffer);
  const role = determineFileRole(posixPath, metrics.text);
  const limit = policy.limits[role] || policy.limits.module || 250;
  const warningAt = Math.floor(limit * 0.8);
  const exemptReason = checkFileExemption(posixPath, rawBuffer, metrics.lineCount, exemptions, todayIso);

  const report = {
    path: posixPath,
    role,
    lines: metrics.lineCount,
    limit,
    warningAt,
    longestLine: metrics.longestLine,
    avgLineLength: Number(metrics.avgLineLength.toFixed(1)),
    exempted: Boolean(exemptReason),
  };
  if (exemptReason) return { report, exempted: true, violations, warnings };

  if (metrics.lineCount > limit) {
    violations.push({
      file: posixPath,
      line: limit + 1,
      kind: 'exceeds-line-limit',
      message: `${posixPath} có ${metrics.lineCount} dòng, vượt trần cứng ${limit} dòng (role '${role}'). ${splitGuidanceForRole(role, posixPath)}`,
      action: splitGuidanceForRole(role, posixPath),
    });
  } else if (metrics.lineCount >= warningAt) {
    const hasInjected = options.diffByFile && Object.prototype.hasOwnProperty.call(options.diffByFile, posixPath);
    const isTouched = hasInjected
      || (gitCtx && gitCtx.isGit && (options.stagedOnly ? gitCtx.staged.has(posixPath) : gitCtx.changedSinceBase.has(posixPath)));
    const diffText = hasInjected
      ? options.diffByFile[posixPath]
      : (isTouched ? getFileDiffAgainstBase(root, gitCtx, posixPath, metrics.text, Boolean(options.stagedOnly)) : '');
    const diffAnalysis = isTouched ? analyzeDiffLogic(diffText) : { addsLogic: false, reason: '' };

    if (diffAnalysis.addsLogic) {
      violations.push({
        file: posixPath,
        line: warningAt,
        kind: 'yellow-zone-added-logic',
        message: `${posixPath} đang ở vùng vàng >= 80% (${metrics.lineCount}/${limit} dòng, mốc vàng ${warningAt}, role '${role}') và ${diffAnalysis.reason} — pre-commit sẽ chặn SPLIT REQUIRED. ${splitGuidanceForRole(role, posixPath)}`,
        action: splitGuidanceForRole(role, posixPath),
      });
    } else {
      warnings.push({
        file: posixPath,
        line: warningAt,
        kind: 'yellow-zone-warning',
        message: `${posixPath} chạm vùng vàng >= 80% (${metrics.lineCount}/${limit} dòng, mốc vàng ${warningAt}, role '${role}'). Nếu thêm hàm/test mới (> 10 dòng), phải tách file trước khi commit.`,
        action: splitGuidanceForRole(role, posixPath),
      });
    }
  }

  if (metrics.longestLine > policy.maxLineLength) {
    violations.push({
      file: posixPath,
      line: metrics.longestLineNumber,
      kind: 'line-too-long',
      message: `${posixPath}:${metrics.longestLineNumber} dài ${metrics.longestLine} ký tự (trần ${policy.maxLineLength} ký tự).`,
      action: 'Ngắt dòng hoặc tách chuỗi/payload dài sang file data/*.json.',
    });
  }
  if (metrics.lineCount >= 50 && metrics.avgLineLength > policy.maxAvgLineLength) {
    violations.push({
      file: posixPath,
      line: 1,
      kind: 'dense-avg-line-length',
      message: `${posixPath} có độ dài dòng trung bình ${metrics.avgLineLength.toFixed(1)} ký tự (trần ${policy.maxAvgLineLength} cho file >= 50 dòng).`,
      action: 'Không dồn nhiều lệnh lên 1 dòng để lách trần số dòng; format chuẩn và tách file.',
    });
  }
  if (metrics.byteLength > policy.maxFileBytes) {
    violations.push({
      file: posixPath,
      line: 1,
      kind: 'file-too-large-bytes',
      message: `${posixPath} nặng ${metrics.byteLength} bytes (trần ${policy.maxFileBytes} bytes).`,
      action: 'Tách dữ liệu lớn sang data/*.json và chia nhỏ module.',
    });
  }

  return { report, exempted: false, violations, warnings };
}

function runCodeLimitsCheck(options = {}) {
  const root = path.resolve(options.root || process.cwd());
  const policy = loadQualityPolicy(root);
  const exemptions = loadSizeExemptions(root);
  const todayIso = options.todayIso || new Date().toISOString().slice(0, 10);
  const gitCtx = options.gitContext || resolveGitContext(root, { baseRef: options.baseRef });
  const targetFiles = resolveTargetFiles(root, policy, gitCtx, options);

  const violations = [];
  const warnings = [];
  const files = [];
  let exemptedCount = 0;

  for (const relPath of targetFiles) {
    const res = evaluateFileLimits(root, relPath, policy, exemptions, todayIso, gitCtx, options);
    if (res.report) files.push(res.report);
    if (res.exempted) exemptedCount += 1;
    violations.push(...res.violations);
    warnings.push(...res.warnings);
  }

  const effectiveViolations = options.strict ? [...violations, ...warnings] : violations;
  const passed = effectiveViolations.length === 0;

  return {
    ok: true,
    passed,
    strict: Boolean(options.strict),
    scannedCount: files.length,
    exemptedCount,
    files,
    violations,
    warnings,
  };
}

module.exports = {
  splitPhysicalLines,
  measureContent,
  evaluateFileLimits,
  runCodeLimitsCheck,
};
