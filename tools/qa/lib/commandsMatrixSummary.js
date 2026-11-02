'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { loadAutomatedTests } = require('./sources');
const {
  SEVERITY_RANK,
  mergeOptions,
  specPath,
  getAutomatedTcIds,
  collect,
  coverage,
} = require('./commandsCore');
const { gaps } = require('./commandsGapsSpecs');
const { drift } = require('./commandsDrift');

function matrix(root, rawOptions) {
  const options = mergeOptions(root, rawOptions);
  const { testCases, automated, realTests } = collect(root, options);
  const automatedTcIds = getAutomatedTcIds(realTests);
  const specsByTc = new Map();
  for (const t of realTests) {
    const ids = t.allTcIds && t.allTcIds.length ? t.allTcIds : t.tcId ? [t.tcId] : [];
    for (const id of ids) {
      if (!specsByTc.has(id)) specsByTc.set(id, []);
      specsByTc.get(id).push(specPath(options, t));
    }
  }

  const lines = [
    '# Ma Trận Truy Vết Kiểm Thử (Traceability Matrix)',
    '',
    '<!-- AUTO-GENERATED FILE. DO NOT EDIT MANUALLY. -->',
    '<!-- Sinh tự động bằng lệnh: npm run qa:matrix -->',
    '',
    'Bảng tổng hợp sống đối chiếu giữa Requirement, Acceptance Criteria, Test Case và Playwright script.',
    '',
  ];
  if (automated.error) {
    lines.push(`> ⚠️ Không liệt kê được test Playwright nên cột Trạng thái Automation chưa đúng: ${automated.error}`, '');
  }
  lines.push(
    '| Requirement | Acceptance criterion | Test case | Trạng thái Automation | Spec file | Priority |',
    '|---|---|---|---|---|---|',
  );

  let rowsCount = 0;
  for (const link of testCases.links) {
    const isAuto = automatedTcIds.has(link.tcId);
    let statusText = link.automation || 'No';
    if (link.automation === null) {
      statusText = '(KHÔNG ĐỌC ĐƯỢC)';
    } else if (link.automation === 'Yes') {
      statusText = isAuto ? 'Yes (Automated)' : 'Yes (Thiếu script)';
    }

    const specs = specsByTc.get(link.tcId) || [];
    let specCol = '-';
    if (specs.length > 0) {
      specCol = specs.map((s) => `\`${s}\``).join('<br>');
    } else if (link.spec) {
      let normalizedSpec = link.spec;
      if (normalizedSpec.startsWith('tests/')) {
        normalizedSpec = `${(options && options.projectDir) || 'playwright'}/${normalizedSpec}`;
      }
      specCol = `\`${normalizedSpec}\``;
    }

    lines.push(
      `| ${link.reqId} | ${link.acId} | ${link.tcId} | ${statusText} | ${specCol} | ${link.priority || '-'} |`,
    );
    rowsCount++;
  }

  lines.push('');
  const outPath = path.join(root, (options && options.testCasesDir) || 'test-cases', 'traceability.md');
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');

  return {
    ok: true,
    file: path.relative(root, outPath).replace(/\\/g, '/'),
    rowsCount,
  };
}

function summary(root, rawOptions) {
  const options = mergeOptions(root, rawOptions);
  const loadAutomated = (options && options.loadAutomated) || loadAutomatedTests;
  const sharedAutomated = loadAutomated(root, options);
  const sharedOpts = { ...options, loadAutomated: () => sharedAutomated };
  const cov = coverage(root, sharedOpts);
  const gapsList = gaps(root, sharedOpts);
  const driftList = drift(root, sharedOpts);

  const allFindings = [...gapsList, ...driftList];
  const blockerCount = allFindings.filter((f) => f.severity === 'blocker').length;
  const majorCount = allFindings.filter((f) => f.severity === 'major').length;
  const minorCount = allFindings.filter((f) => f.severity === 'minor').length;

  let decisionsTotal = 0;
  let decisionsPending = 0;
  let decisionsBlocking = 0;
  const decisionsPath = path.join(root, 'decisions.json');
  if (fs.existsSync(decisionsPath)) {
    try {
      const dData = JSON.parse(fs.readFileSync(decisionsPath, 'utf8').replace(/^\uFEFF/, ''));
      if (dData && Array.isArray(dData.decisions)) {
        decisionsTotal = dData.decisions.length;
        const pendingList = dData.decisions.filter((d) => !d.answer || !d.answer.optionId);
        decisionsPending = pendingList.length;
        decisionsBlocking = pendingList.filter((d) => d.severity === 'blocking').length;
      }
    } catch {
      // Bỏ qua lỗi parse decisions
    }
  }

  let boundaryStatus = 'ALIGNED';
  let boundaryProblems = [];
  let shipCount = 0;
  let seedCount = 0;
  let ownCount = 0;
  const { loadManifest, analyse, countByCategory } = require('../../boundary');
  const loaded = loadManifest(root);
  if (loaded.error) {
    boundaryStatus = fs.existsSync(path.join(root, 'sync-manifest.json')) ? 'DRIFTED' : 'MISSING';
  } else {
    const counts = countByCategory(loaded.manifest);
    shipCount = counts.ship;
    seedCount = counts.seed;
    ownCount = counts.own;
    boundaryProblems = analyse(loaded.manifest, root).problems;
    const blocking = boundaryProblems.filter(
      (p) => (SEVERITY_RANK[p.severity] || 0) >= SEVERITY_RANK.major,
    );
    if (blocking.length > 0) boundaryStatus = 'DRIFTED';
  }

  const acsCovered = cov.rows.filter((r) => r.automated && r.automated.length > 0).length;
  const coveragePercent =
    cov.acceptanceCriteria === 0 ? 0 : Number(((acsCovered / cov.acceptanceCriteria) * 100).toFixed(1));
  const wipTestsCount = cov.rows.reduce((sum, r) => sum + (r.wip ? r.wip.length : 0), 0);
  const candidateCount = cov.rows.reduce((sum, r) => sum + (r.candidates ? r.candidates.length : 0), 0);

  let systemHealth = 'HEALTHY';
  if (blockerCount > 0 || boundaryStatus === 'MISSING' || boundaryStatus === 'DRIFTED') {
    systemHealth = 'CRITICAL';
  } else if (majorCount > 0 || decisionsBlocking > 0) {
    systemHealth = 'WARNING';
  }

  return {
    schemaVersion: '1.0.0',
    timestamp: new Date().toISOString(),
    systemHealth,
    metrics: {
      requirements: cov.requirements,
      acceptanceCriteria: cov.acceptanceCriteria,
      coveredAcCount: acsCovered,
      coveragePercent,
      testCases: cov.testCases,
      automatedTests: cov.automatedTests,
      wipTests: wipTestsCount,
      candidateTests: candidateCount,
    },
    health: {
      status: systemHealth,
      blockers: blockerCount,
      majors: majorCount,
      minors: minorCount,
      totalFindings: allFindings.length,
    },
    boundary: { status: boundaryStatus, shipCount, seedCount, ownCount, problems: boundaryProblems },
    decisions: { total: decisionsTotal, pending: decisionsPending, blocking: decisionsBlocking },
    findings: allFindings,
  };
}

module.exports = { matrix, summary };

