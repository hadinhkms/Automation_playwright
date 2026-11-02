'use strict';

const { c, red, yellow, green, dim, bold, severityLabel, emitCliError } = require('./cliArgs');
const { coverage, impact, SEVERITY_RANK } = require('./commands');

function printFindings(title, findings) {
  if (findings.length === 0) {
    console.log(`${green('OK')} ${title}: không phát hiện vấn đề.`);
    return;
  }
  const sorted = [...findings].sort(
    (a, b) => (SEVERITY_RANK[b.severity] || 0) - (SEVERITY_RANK[a.severity] || 0),
  );
  console.log(bold(`\n${title} — ${findings.length} phát hiện\n`));
  for (const f of sorted) {
    console.log(`${severityLabel(f.severity)} ${bold(f.kind)}`);
    console.log(`         ${f.message}`);
    console.log(`         ${dim(f.where)}`);
    if (f.action) console.log(`         ${dim('-> ' + f.action)}`);
    console.log('');
  }
  const counts = sorted.reduce((acc, f) => ({ ...acc, [f.severity]: (acc[f.severity] || 0) + 1 }), {});
  console.log(dim(`Tổng: ${counts.blocker || 0} blocker, ${counts.major || 0} major, ${counts.minor || 0} minor`));
}

function runCoverage(rootDir, options, flags) {
  const result = coverage(rootDir, options);
  if (flags.json) return console.log(JSON.stringify(result, null, 2));

  if (result.playwrightError) console.log(yellow(`! ${result.playwrightError}\n`));
  if (result.emptySpecs) console.log(red(`!! ${result.emptyMessage}\n`));
  if (result.ignoredSpecs > 0) {
    console.log(yellow(`! Đã bỏ qua ${result.ignoredSpecs} test theo ignoreSpecs: ${result.ignorePrefixes.join(', ')}\n`));
  }
  console.log(
    bold(
      `\n${result.requirements} requirement · ${result.acceptanceCriteria} AC · ` +
        `${result.testCases} test case · ${result.automatedTests} test đã automation\n`,
    ),
  );
  const width = Math.max(10, ...result.rows.map((r) => (r.acTitle.length > 42 ? 42 : r.acTitle.length)));
  console.log(dim(`${'REQ/AC'.padEnd(18)}${'Mô tả'.padEnd(width + 2)}Test case -> đã automation`));
  console.log(dim('-'.repeat(18 + width + 30)));
  for (const row of result.rows) {
    const key = `${row.reqId}/${row.acId}`;
    const desc = row.acTitle.length > 42 ? row.acTitle.slice(0, 39) + '...' : row.acTitle;
    const tcs = row.testCases.length ? row.testCases.join(',') : '-';
    const auto = row.automated.length ? green(row.automated.join(',')) : red('chưa có');
    const extra = [];
    if (row.manualOnly.length) extra.push(dim(`thủ công: ${row.manualOnly.join(',')}`));
    if (row.candidates.length) extra.push(dim(`candidate: ${row.candidates.join(',')}`));
    console.log(`${key.padEnd(18)}${desc.padEnd(width + 2)}${tcs} -> ${auto} ${extra.join(' ')}`);
  }
  console.log('');
}

function runImpact(rootDir, reqId, options, flags) {
  if (!reqId) {
    return emitCliError('Thiếu mã requirement. Ví dụ: node tools/qa impact REQ-001', flags.json);
  }
  const result = impact(rootDir, reqId, options);
  if (result.error) return emitCliError(result.error, flags.json);
  if (flags.json) return console.log(JSON.stringify(result, null, 2));

  const r = result.requirement;
  console.log(bold(`\n${r.id} — ${r.title}`));
  console.log(dim(`status: ${r.status} · version: ${r.version} · ${r.file}\n`));
  console.log(bold('Nếu requirement này đổi, rà lại:\n'));
  for (const ac of result.acs) {
    console.log(`  ${bold(ac.acId)} ${ac.title}`);
    if (ac.testCases.length === 0) console.log(`    ${red('chưa có test case nào')}`);
    for (const tc of ac.testCases) {
      const tag = tc.automation === 'Yes' ? green(tc.automation) : yellow(tc.automation || '?');
      console.log(`    ${tc.tcId} [${tc.priority}] ${tag}`);
      for (const s of tc.specs) console.log(`      ${dim(s)}`);
      if (tc.automation === 'Yes' && tc.specs.length === 0) {
        console.log(`      ${red('khai Yes nhưng không tìm thấy script')}`);
      }
    }
    console.log('');
  }
  console.log(bold('File cần mở:'));
  const uniqueFiles = [...new Set(result.filesToReview.map((f) => f.split(':')[0]))];
  for (const f of uniqueFiles) console.log(`  ${f}`);
  console.log('');
  return 0;
}

function renderSummaryBox(res, outputFlag) {
  const m = res.metrics;
  const h = res.health;
  const b = res.boundary;
  const d = res.decisions;
  const healthColor = h.status === 'HEALTHY' ? green : h.status === 'WARNING' ? yellow : red;

  console.log(bold('\n┌─────────────────────────────────────────────────────────────┐'));
  console.log(bold(`│  ${c('36;1', 'QA TRACEABILITY & HEALTH DASHBOARD SUMMARY')}                │`));
  console.log(bold('├─────────────────────────────────────────────────────────────┤'));
  console.log(`│  Trạng thái hệ thống: ${healthColor(bold(h.status.padEnd(9)))}                           │`);
  console.log(`│  Độ phủ Automation  : ${bold(String(m.coveragePercent + '%').padEnd(7))} (${m.coveredAcCount}/${m.acceptanceCriteria} ACs có script)         │`);
  console.log(`│  Requirements       : ${bold(String(m.requirements).padEnd(4))}  · Test Cases       : ${bold(String(m.testCases).padEnd(5))}     │`);
  console.log(`│  Automated Tests    : ${bold(String(m.automatedTests).padEnd(4))}  · WIP / Stub Tests : ${bold(String(m.wipTests).padEnd(5))}     │`);
  console.log(`│  Vấn đề (Findings)  : ${red(h.blockers)} blocker · ${yellow(h.majors)} major · ${dim(h.minors)} minor    │`);
  console.log(`│  Quyết định chờ duyệt: ${bold(String(d.pending).padEnd(3))} (Chặn: ${d.blocking > 0 ? red(d.blocking) : green(0)})                   │`);
  console.log(`│  Ranh giới Hub-Repo : ${b.status === 'ALIGNED' ? green('ALIGNED') : red('DRIFTED')} (ship ${b.shipCount}, seed ${b.seedCount}, own ${b.ownCount})  │`);
  console.log(bold('└─────────────────────────────────────────────────────────────┘\n'));
  if (outputFlag) console.log(dim(`(Đã xuất báo cáo JSON ra: ${outputFlag})\n`));
}

function renderFixResult(res) {
  const prefix = res.dryRun ? '[DRY-RUN] ' : '';
  if (res.fixedCount === 0) {
    console.log(green(`\n${prefix}OK: Toàn bộ bảng traceability đã đồng bộ, không phát hiện lỗi cần sửa.\n`));
    return;
  }
  console.log(bold(`\n${prefix}🔧 Đã xử lý ${res.fixedCount} vấn đề truy vết (${res.modifiedFilesCount} file):\n`));
  for (const chg of res.changes) {
    if (chg.kind === 'chuan-hoa-duong-dan-spec') {
      console.log(`  - [${chg.file}:${chg.line}] Chuẩn hoá đường dẫn: ${dim(chg.from)} -> ${green(chg.to)}`);
    } else if (chg.kind === 'them-test-case-chua-khai-bao') {
      console.log(`  + [${chg.file}:${chg.line}] Tự động bổ sung test case: ${bold(chg.tcId)} (${chg.acId}) -> ${dim(chg.spec)}`);
    }
  }
  if (res.dryRun) {
    console.log(yellow('\n(Đây là chế độ dry-run: không có file nào trên đĩa bị thay đổi. Bỏ cờ --dry-run để áp dụng).\n'));
  } else {
    console.log(green('\n(Đã cập nhật file và đồng bộ lại test-cases/traceability.md).\n'));
  }
}

module.exports = {
  printFindings,
  runCoverage,
  runImpact,
  renderSummaryBox,
  renderFixResult,
};

