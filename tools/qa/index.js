#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { dim, bold, parseArgs, validateCommandFlags, emitCliError } = require('./lib/cliArgs');
const { renderLearnReport, runLearn } = require('./lib/cliRenderLearn');
const {
  printFindings,
  runCoverage,
  runImpact,
  renderSummaryBox,
  renderFixResult,
} = require('./lib/cliRenderReport');
const { gaps, drift, matrix, summary, SEVERITY_RANK } = require('./lib/commands');
const { fixTraceability } = require('./lib/fixer');
const { loadConfig } = require('./lib/config');

const ROOT = path.resolve(__dirname, '..', '..');

function main(opts = {}) {
  const rootDir = opts.root ? path.resolve(opts.root) : ROOT;
  const argv = Array.isArray(opts.argv) ? opts.argv : process.argv.slice(2);
  const preDetectedJson = argv.some((a) => a === '--json');
  process.exitCode = 0;

  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    return emitCliError(err.message, preDetectedJson);
  }
  const { flags, positional } = parsed;
  const command = positional[0] || 'coverage';

  try {
    validateCommandFlags(command, flags, positional);
  } catch (err) {
    return emitCliError(err.message, flags.json);
  }

  let config;
  try {
    config = loadConfig(rootDir);
  } catch (err) {
    return emitCliError(err.message, flags.json);
  }
  const options = {
    project: flags.project || config.project,
    projectDir: flags.projectDir || config.projectDir,
    ignoreSpecs: config.ignoreSpecs || [],
    requirementsDir: config.requirementsDir,
    testCasesDir: config.testCasesDir,
    checkBoundaryRules: flags.checkBoundaryRules !== null ? flags.checkBoundaryRules : config.checkBoundaryRules,
    checkDeepCoverage: config.checkDeepCoverage,
    filterDomain: flags.domain,
    filterReq: flags.req,
    filterTag: flags.tag,
    dryRun: flags.dryRun,
  };
  if (options.ignoreSpecs.length > 0 && !flags.json && command !== 'learn') {
    console.log(dim(`(ignoreSpecs đang bật: ${options.ignoreSpecs.join(', ')})`));
  }
  if ((options.filterDomain || options.filterReq || options.filterTag) && !flags.json && command !== 'learn') {
    const filters = [];
    if (options.filterDomain) filters.push(`domain: ${options.filterDomain}`);
    if (options.filterReq) filters.push(`req: ${options.filterReq}`);
    if (options.filterTag) filters.push(`tag: ${options.filterTag}`);
    console.log(dim(`(Đang lọc theo ${filters.join(', ')})`));
  }

  let findings = null;
  try {
    switch (command) {
      case 'coverage':
        runCoverage(rootDir, options, flags);
        break;
      case 'gaps':
        findings = gaps(rootDir, options);
        if (flags.json) console.log(JSON.stringify(findings, null, 2));
        else printFindings('Gaps — nên thêm script nào', findings);
        break;
      case 'drift':
        findings = drift(rootDir, options);
        if (flags.json) console.log(JSON.stringify(findings, null, 2));
        else printFindings('Drift — traceability mục ở đâu', findings);
        break;
      case 'impact':
        runImpact(rootDir, positional[1], options, flags);
        break;
      case 'matrix': {
        const res = matrix(rootDir, options);
        if (flags.json) console.log(JSON.stringify(res, null, 2));
        else {
          console.log(bold(`\n✅ Đã tự động cập nhật ma trận truy vết (${res.rowsCount} dòng):`));
          console.log(`   -> ${res.file}\n`);
        }
        break;
      }
      case 'summary': {
        const res = summary(rootDir, options);
        if (flags.output) {
          const outPath = path.resolve(rootDir, flags.output);
          fs.mkdirSync(path.dirname(outPath), { recursive: true });
          fs.writeFileSync(outPath, JSON.stringify(res, null, 2), 'utf8');
        }
        if (flags.json) console.log(JSON.stringify(res, null, 2));
        else renderSummaryBox(res, flags.output);
        findings = res.findings;
        break;
      }
      case 'fix': {
        const res = fixTraceability(rootDir, options);
        if (flags.json) console.log(JSON.stringify(res, null, 2));
        else renderFixResult(res);
        break;
      }
      case 'learn':
        runLearn(rootDir, options, flags);
        break;
      default:
        return emitCliError(
          `Lệnh không hợp lệ: ${command}\nDùng: coverage | gaps | impact <REQ-xxx> | drift | matrix | summary | fix | learn`,
          flags.json,
        );
    }
  } catch (err) {
    return emitCliError(err.message || String(err), flags.json);
  }

  if (flags.strict && findings) {
    const blocking = findings.filter((f) => (SEVERITY_RANK[f.severity] || 0) >= SEVERITY_RANK.major);
    if (blocking.length > 0) process.exitCode = 1;
  }

  return process.exitCode || 0;
}

if (require.main === module) {
  main();
}

module.exports = {
  ROOT,
  parseArgs,
  validateCommandFlags,
  renderLearnReport,
  main,
};
