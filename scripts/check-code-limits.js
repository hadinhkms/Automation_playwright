#!/usr/bin/env node
'use strict';

/**
 * Cổng kiểm tra giới hạn kích thước code & vùng vàng 80% trước khi commit.
 *
 * Cách dùng:
 *   node scripts/check-code-limits.js                  # quét file mới/đã sửa (changed + untracked)
 *   node scripts/check-code-limits.js --strict         # fail luôn cả cảnh báo vùng vàng >= 80%
 *   node scripts/check-code-limits.js --staged         # chỉ quét file đã git add (giống pre-commit)
 *   node scripts/check-code-limits.js --scope=automation # quét toàn bộ tests/e2e, tests/api, pages, core/local
 *   node scripts/check-code-limits.js --all            # quét toàn bộ repo
 *   node scripts/check-code-limits.js pages/desktop/LoginPage.js
 */

const { runCodeLimitsCheck } = require('./lib/codeLimits');

function parseCliArgs(argv) {
  const targetArgs = [];
  const opts = {
    strict: false,
    stagedOnly: false,
    all: false,
    asJson: false,
    scope: null,
    baseRef: undefined,
  };

  for (const arg of argv) {
    if (arg === '--strict') opts.strict = true;
    else if (arg === '--staged') opts.stagedOnly = true;
    else if (arg === '--all') opts.all = true;
    else if (arg === '--json') opts.asJson = true;
    else if (arg.startsWith('--scope=')) opts.scope = arg.slice('--scope='.length).trim();
    else if (arg.startsWith('--base=')) opts.baseRef = arg.slice('--base='.length).trim();
    else if (!arg.startsWith('-')) targetArgs.push(arg);
  }
  opts.targetArgs = targetArgs;
  return opts;
}

function main() {
  const opts = parseCliArgs(process.argv.slice(2));
  const result = runCodeLimitsCheck({
    root: process.cwd(),
    strict: opts.strict,
    stagedOnly: opts.stagedOnly,
    all: opts.all,
    scope: opts.scope,
    baseRef: opts.baseRef,
    targetArgs: opts.targetArgs,
  });

  if (opts.asJson) {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.passed ? 0 : 1);
  }

  for (const warn of result.warnings) {
    const tag = opts.strict ? 'VIOLATION (strict yellow-zone)' : 'YELLOW ZONE (>=80%)';
    console.warn(`[${tag}] ${warn.message}`);
  }
  for (const v of result.violations) {
    console.error(`[LIMIT VIOLATION] ${v.message}`);
  }

  if (!result.passed) {
    const total = opts.strict
      ? result.violations.length + result.warnings.length
      : result.violations.length;
    console.error(
      `Code limit check FAILED (${total} lỗi trên ${result.scannedCount} file đã quét). `
      + 'Vui lòng tách nhỏ module/Page Object/spec trước khi commit.',
    );
    process.exit(1);
  }

  console.log(
    `Code limit check passed (quét ${result.scannedCount} file, `
    + `${result.warnings.length} cảnh báo vùng vàng 80%, ${result.exemptedCount} miễn trừ).`,
  );
}

if (require.main === module) {
  main();
}

module.exports = { parseCliArgs };

