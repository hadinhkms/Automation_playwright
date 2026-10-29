'use strict';

const { red, yellow, green, dim, bold } = require('./cliArgs');
const {
  learn,
  resolveAndValidateReviewOutputPath,
  exportReviewArtifact,
} = require('./learner');

function formatCandidateReason(item) {
  if (item.reason) return item.reason;
  if (item.gates && typeof item.gates === 'object') {
    const unknowns = Object.entries(item.gates)
      .filter(([, g]) => g && (g.status === 'unknown' || g.status === 'warn'))
      .map(([k, g]) => `${k} [${g.reasonCode || 'unknown'}]: ${g.reason}`);
    if (unknowns.length > 0) return unknowns.join(' | ');
    const passes = Object.entries(item.gates)
      .filter(([, g]) => g && g.status === 'pass')
      .map(([k, g]) => `${k}: ${g.reasonCode || 'pass'}`);
    if (passes.length > 0) return `Đạt 4 cổng (${passes.join(', ')})`;
  }
  return '-';
}

function formatCandidateSource(item) {
  const p = Array.isArray(item.provenance) && item.provenance[0] ? item.provenance[0] : null;
  if (!p) return item.source || '-';
  const loc = p.line ? `${p.file}:${p.line}` : p.file || '-';
  return `${p.source} @ ${loc}`;
}

function renderCandidateList(heading, badge, items, lineFormatter) {
  if (!items || items.length === 0) return;
  console.log(bold(`  ${heading}`));
  for (const item of items) {
    lineFormatter(item, badge);
  }
  console.log('');
}

function renderLearnReport(report) {
  const modeLabels = {
    preview: 'Preview (Read-Only — chưa ghi vào kho tri thức)',
    'preview-dry-run': 'Preview Dry-Run (Read-Only — chưa ghi vào kho tri thức)',
    apply: 'Apply (Cập nhật Project Overlay)',
    'apply-dry-run': 'Apply Dry-Run (Read-Only — không ghi đĩa)',
  };
  const modeLabel = modeLabels[report.mode] || report.mode;
  const stats = report.catalogStats || {
    shared: { DH: 0, PA: 0, total: 0 },
    project: { DH: 0, PA: 0, active: 0, retired: 0, processed: 0 },
    effective: { DH: 0, PA: 0, total: 0, shadowedCount: 0 },
  };
  const scope = report.scope || {};
  const layout = scope.layout || {};

  console.log(bold(`\nQA Selective Learning — ${modeLabel}\n`));
  console.log(`  Shared Catalog (ship)  : ${bold(stats.shared.DH)} DH · ${bold(stats.shared.PA)} PA (tổng: ${stats.shared.total})`);
  console.log(
    `  Project Overlay (own)  : ${bold(stats.project.DH)} DH · ${bold(stats.project.PA)} PA ` +
      `(active: ${stats.project.active}, retired: ${stats.project.retired}, processed: ${stats.project.processed})`,
  );
  console.log(
    `  Effective Knowledge    : ${bold(stats.effective.DH)} DH · ${bold(stats.effective.PA)} PA ` +
      `(tổng: ${stats.effective.total}, shadowed: ${stats.effective.shadowedCount || 0})`,
  );
  console.log(`  Scope                  : mode=${scope.mode || report.mode} · since=${scope.since || '(working tree)'} · base=${scope.resolvedBaseSha || '-'}`);
  console.log(`  Layout                 : req=${layout.requirementsDir || 'requirements'} · tc=${layout.testCasesDir || 'test-cases'} · spec=${layout.projectDir || 'playwright'}`);
  if (Array.isArray(layout.ignoreSpecs) && layout.ignoreSpecs.length > 0) {
    console.log(`  Ignore Specs           : ${layout.ignoreSpecs.join(', ')}`);
  }
  console.log(
    `  Untracked skipped      : ${scope.untrackedSkippedCount || 0}` +
      (Array.isArray(scope.untrackedFiles) && scope.untrackedFiles.length > 0 ? ` (${scope.untrackedFiles.join(', ')})` : ''),
  );

  if (report.replayNoOp) {
    console.log(yellow('\n  [REPLAY NO-OP] Toàn bộ candidate trong review artifact đã được xử lý trước đó — không ghi lại kho tri thức.'));
  }

  console.log(
    bold(
      `\n  Tóm tắt: Proposed ${report.proposed.length} · Needs Review ${report.needsReview.length} · ` +
        `Rejected ${report.rejected.length} · Applied ${report.applied.length} · Skipped ${report.skipped.length}\n`,
    ),
  );

  renderCandidateList(
    'Proposed (Đề xuất chờ duyệt — CHƯA học / CHƯA ghi vào kho tri thức):',
    green('[PROPOSED]'),
    report.proposed,
    (item, badge) => {
      console.log(`    ${badge} ${bold(item.candidateId)} [${item.type}/${item.category}] ${item.title}`);
      console.log(`      source: ${dim(formatCandidateSource(item))}`);
      console.log(`      reason: ${dim(formatCandidateReason(item))}`);
    },
  );

  renderCandidateList(
    'Needs Review (Cần người/agent kiểm tra bổ sung — CHƯA học / CHƯA ghi vào kho tri thức):',
    yellow('[NEEDS_REVIEW]'),
    report.needsReview,
    (item, badge) => {
      console.log(`    ${badge} ${bold(item.candidateId)} [${item.type}/${item.category}] ${item.title}`);
      console.log(`      source: ${dim(formatCandidateSource(item))}`);
      console.log(`      reason: ${dim(formatCandidateReason(item))}`);
    },
  );

  renderCandidateList('Rejected (Bị từ chối):', red('[REJECTED]'), report.rejected, (item, badge) => {
    const tag = item.type || item.targetCatalog || 'rejected';
    console.log(`    ${badge} ${bold(item.candidateId)} [${tag}] ${item.title || '-'}`);
    console.log(`      source: ${dim(formatCandidateSource(item))}`);
    console.log(`      reason: ${dim(`[${item.failedGate || 'review'}/${item.reasonCode || 'rejected'}] ${item.reason || '-'}`)}`);
  });

  const applyBadge = green(report.mode === 'apply-dry-run' ? '[DRY-RUN APPLIED]' : '[APPLIED]');
  renderCandidateList('Applied (Cập nhật vào Project Overlay):', applyBadge, report.applied, (item, badge) => {
    console.log(`    ${badge} ${bold(item.id)} <- ${item.candidateId} [${item.targetCatalog}] ${item.title}`);
    console.log(`      action: ${dim(item.action || 'created')} · reason: ${dim('Đã được reviewer phê duyệt (approved)')}`);
  });

  renderCandidateList('Skipped (Đã bỏ qua):', dim('[SKIPPED]'), report.skipped, (item, badge) => {
    const target = item.candidateId || item.decisionId || item.file || '-';
    const src = item.source || item.file || item.reasonCode || 'skip';
    console.log(`    ${badge} ${bold(target)} (${src}) — reason: ${dim(item.reason || '-')}`);
  });

  if (report.reviewFile) {
    console.log(green(`  Đã xuất Review Artifact (trạng thái pending) ra: ${report.reviewFile}\n`));
  }
}

function runLearn(rootDir, options, flags) {
  if (flags.output) {
    resolveAndValidateReviewOutputPath(rootDir, flags.output, options);
  }
  const report = learn(rootDir, {
    ...options,
    since: flags.since,
    apply: flags.apply,
    review: flags.review,
    dryRun: flags.dryRun,
  });
  if (flags.output) {
    const exported = exportReviewArtifact(rootDir, flags.output, report, options);
    report.reviewFile = exported.outputPath;
  }
  if (flags.json) console.log(JSON.stringify(report, null, 2));
  else renderLearnReport(report);
  return report;
}

module.exports = { renderLearnReport, runLearn };

