'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { loadRequirements, loadTestCases, loadAutomatedTests } = require('./sources');
const { loadConfig } = require('./config');

const SEVERITY_RANK = { blocker: 3, major: 2, minor: 1 };

function mergeOptions(root, options) {
  try {
    const configFile = path.join(root, 'qa.config.json');
    if (!fs.existsSync(configFile)) {
      return options || {};
    }
    const conf = loadConfig(root);
    return { ...conf, ...(options || {}) };
  } catch {
    return options || {};
  }
}

function specPath(options, t) {
  return `${t.path || t.file}:${t.line}`;
}

function emptySpecFinding(testCases, automated, options) {
  if (!automated.emptyResult || automated.error) return null;
  if (testCases.links.length === 0) return null;
  return {
    severity: 'blocker',
    kind: 'doc-duoc-0-spec',
    where: (options && options.projectDir) || 'playwright',
    message: automated.emptyMessage,
    action: 'Sửa projectDir/project trong qa.config.json, hoặc chạy --project-dir=<đường dẫn>.',
  };
}

function getAutomatedTcIds(realTests) {
  return new Set(
    (realTests || []).flatMap((t) => (t.allTcIds && t.allTcIds.length ? t.allTcIds : [t.tcId])).filter(Boolean),
  );
}

function getWipTcIds(realTests) {
  return new Set(
    (realTests || [])
      .filter((t) => t.tags && t.tags.includes('@wip'))
      .flatMap((t) => (t.allTcIds && t.allTcIds.length ? t.allTcIds : [t.tcId]))
      .filter(Boolean),
  );
}

function expectedCasesFromRule(rule) {
  const wanted = [];
  if (rule.valid && rule.valid !== '-') wanted.push(`${rule.field}: lớp hợp lệ`);
  if (rule.invalid && rule.invalid !== '-') wanted.push(`${rule.field}: lớp không hợp lệ`);
  if (rule.boundary && rule.boundary !== '-') wanted.push(`${rule.field}: giá trị biên (${rule.boundary})`);
  return wanted;
}

function collect(root, rawOptions) {
  const options = mergeOptions(root, rawOptions);
  const loadAutomated = (options && options.loadAutomated) || loadAutomatedTests;
  let requirements = loadRequirements(root, options);
  let testCases = loadTestCases(root, options);
  const automated = loadAutomated(root, options);
  let realTests = (automated.tests || []).filter((t) => !t.isSetup);

  if (options && (options.filterReq || options.filterDomain || options.filterTag)) {
    if (options.filterReq) {
      const targetReq = options.filterReq.toUpperCase();
      requirements = requirements.filter((r) => r.id && r.id.toUpperCase() === targetReq);
      testCases = {
        ...testCases,
        links: testCases.links.filter((l) => l.reqId && l.reqId.toUpperCase() === targetReq),
      };
      realTests = realTests.filter(
        (t) => (t.tags && t.tags.includes(`@${targetReq}`)) || (t.reqId && t.reqId.toUpperCase() === targetReq),
      );
    }
    if (options.filterDomain) {
      const dom = options.filterDomain.toLowerCase();
      realTests = realTests.filter((t) => {
        const p = (t.path || t.file || '').toLowerCase();
        return p.includes(`/${dom}/`) || p.startsWith(`${dom}/`);
      });
      const activeTcIds = getAutomatedTcIds(realTests);
      testCases = {
        ...testCases,
        links: testCases.links.filter((l) => {
          const sp = (l.spec || '').toLowerCase();
          return sp.includes(`/${dom}/`) || sp.startsWith(`${dom}/`) || activeTcIds.has(l.tcId);
        }),
      };
      const activeReqIds = new Set(testCases.links.map((l) => l.reqId).filter(Boolean));
      if (activeReqIds.size > 0) requirements = requirements.filter((r) => activeReqIds.has(r.id));
    }
    if (options.filterTag) {
      const rawTag = options.filterTag;
      const tag = rawTag.startsWith('@') ? rawTag : `@${rawTag}`;
      realTests = realTests.filter((t) => t.tags && t.tags.includes(tag));
      const activeTcIds = getAutomatedTcIds(realTests);
      testCases = {
        ...testCases,
        links: testCases.links.filter((l) => activeTcIds.has(l.tcId)),
      };
      const activeReqIds = new Set(testCases.links.map((l) => l.reqId).filter(Boolean));
      if (activeReqIds.size > 0) requirements = requirements.filter((r) => activeReqIds.has(r.id));
    }
  }

  return { requirements, testCases, automated, realTests };
}

function coverage(root, rawOptions) {
  const options = mergeOptions(root, rawOptions);
  const { requirements, testCases, automated, realTests } = collect(root, options);
  const byAc = new Map();
  for (const link of testCases.links) {
    const key = `${link.reqId}/${link.acId}`;
    if (!byAc.has(key)) byAc.set(key, []);
    byAc.get(key).push(link);
  }
  const automatedTcIds = getAutomatedTcIds(realTests);
  const wipTcIds = getWipTcIds(realTests);

  const rows = [];
  for (const req of requirements) {
    if (!req.id) continue;
    for (const ac of req.acs) {
      const links = byAc.get(`${req.id}/${ac.id}`) || [];
      const tcs = links.map((l) => l.tcId);
      const done = tcs.filter((tc) => automatedTcIds.has(tc) && !wipTcIds.has(tc));
      const wipDone = tcs.filter((tc) => automatedTcIds.has(tc) && wipTcIds.has(tc));
      rows.push({
        reqId: req.id,
        status: req.status,
        acId: ac.id,
        acTitle: ac.title,
        testCases: tcs,
        automated: done,
        wip: wipDone,
        manualOnly: links.filter((l) => l.automation === 'No').map((l) => l.tcId),
        candidates: links.filter((l) => l.automation === 'Candidate').map((l) => l.tcId),
      });
    }
  }
  return {
    requirements: requirements.filter((r) => r.id).length,
    acceptanceCriteria: rows.length,
    testCases: testCases.links.length,
    automatedTests: realTests.length,
    playwrightError: automated.error,
    emptySpecs: Boolean(automated.emptyResult),
    emptyMessage: automated.emptyMessage || null,
    ignoredSpecs: automated.ignoredCount || 0,
    ignorePrefixes: automated.ignorePrefixes || [],
    rows,
  };
}

module.exports = {
  SEVERITY_RANK,
  mergeOptions,
  specPath,
  emptySpecFinding,
  getAutomatedTcIds,
  getWipTcIds,
  expectedCasesFromRule,
  collect,
  coverage,
};

