'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { mergeOptions, specPath, emptySpecFinding, collect } = require('./commandsCore');

function impact(root, reqId, rawOptions) {
  const options = mergeOptions(root, rawOptions);
  const { requirements, testCases, realTests } = collect(root, options);
  const req = requirements.find((r) => r.id === reqId);
  if (!req) return { error: `Không tìm thấy ${reqId} trong requirements/` };

  const testsByTc = new Map();
  for (const t of realTests) {
    const ids = t.allTcIds && t.allTcIds.length ? t.allTcIds : t.tcId ? [t.tcId] : [];
    for (const id of ids) {
      if (!testsByTc.has(id)) testsByTc.set(id, []);
      testsByTc.get(id).push(t);
    }
  }

  const acs = req.acs.map((ac) => {
    const links = testCases.links.filter((l) => l.reqId === reqId && l.acId === ac.id);
    return {
      acId: ac.id,
      title: ac.title,
      testCases: links.map((l) => ({
        tcId: l.tcId,
        automation: l.automation,
        priority: l.priority,
        specs: (testsByTc.get(l.tcId) || []).map((t) => specPath(options, t)),
      })),
    };
  });

  const files = new Set();
  for (const ac of acs) {
    for (const tc of ac.testCases) {
      for (const s of tc.specs) files.add(s);
    }
  }

  return {
    requirement: { id: req.id, title: req.title, status: req.status, version: req.version, file: req.file },
    acs,
    filesToReview: [req.file, req.testCaseFile, ...files].filter(Boolean),
  };
}

function drift(root, rawOptions) {
  const options = mergeOptions(root, rawOptions);
  const { requirements, testCases, automated } = collect(root, options);
  const knownReq = new Set(requirements.map((r) => r.id).filter(Boolean));
  const knownAc = new Set();
  for (const r of requirements) for (const ac of r.acs) knownAc.add(`${r.id}/${ac.id}`);
  const knownTc = new Set(testCases.links.map((l) => l.tcId));
  const findings = [];

  for (const t of automated.tests) {
    if (t.isSetup) continue;
    if (!t.tcId) {
      findings.push({
        severity: 'major',
        kind: 'test-khong-co-ma-tc',
        where: specPath(options, t),
        message: `Test "${t.title}" không mở đầu bằng TC-xxx, không trace được.`,
      });
      continue;
    }
    if (!t.reqId) {
      findings.push({
        severity: 'major',
        kind: 'test-thieu-tag-req',
        where: specPath(options, t),
        message: `${t.tcId} thiếu tag @REQ-xxx ở describe.`,
      });
    } else if (!knownReq.has(t.reqId)) {
      findings.push({
        severity: 'blocker',
        kind: 'test-tro-toi-req-khong-ton-tai',
        where: specPath(options, t),
        message: `${t.tcId} gắn tag ${t.reqId} nhưng requirement đó không tồn tại.`,
      });
    }
    if (t.acId && t.reqId && !knownAc.has(`${t.reqId}/${t.acId}`)) {
      findings.push({
        severity: 'blocker',
        kind: 'test-tro-toi-ac-khong-ton-tai',
        where: specPath(options, t),
        message: `${t.tcId} trỏ tới ${t.reqId}/${t.acId} nhưng AC đó không còn trong requirement.`,
      });
    }
    if (!knownTc.has(t.tcId)) {
      findings.push({
        severity: 'major',
        kind: 'script-khong-co-trong-test-case',
        where: specPath(options, t),
        message: `${t.tcId} có script nhưng không có trong bảng traceability của test-cases/.`,
      });
    }
  }

  for (const req of requirements) {
    if (!req.id) continue;
    const reqTests = automated.tests.filter((t) => t.reqId === req.id && !t.isSetup);
    if (reqTests.length > 0 && /^draft/i.test(req.status)) {
      const allWip = reqTests.every((t) => t.tags && t.tags.includes('@wip'));
      if (allWip) {
        findings.push({
          severity: 'minor',
          kind: 'requirement-moi-scaffold-chua-hoan-thien',
          where: req.file,
          message: `${req.id} đang Draft và mọi script trỏ vào đều là @wip/stub vừa scaffold.`,
          action: 'Hoàn thiện requirement và triển khai test script thật trước khi chuyển status.',
        });
      } else {
        findings.push({
          severity: 'major',
          kind: 'requirement-draft-nhung-da-co-script',
          where: req.file,
          message: `${req.id} đang Draft nhưng đã có script trỏ vào. Script có thể đang test hành vi chưa chốt.`,
          action: 'Chuyển status sang Review/Approved hoặc đánh dấu script là @wip.',
        });
      }
    }
    if (req.testCaseFile) {
      const abs = path.join(root, req.testCaseFile);
      if (!fs.existsSync(abs)) {
        findings.push({
          severity: 'blocker',
          kind: 'test-case-file-khong-ton-tai',
          where: req.file,
          message: `${req.id} trỏ tới ${req.testCaseFile} nhưng file không tồn tại.`,
        });
      }
    }
  }

  for (const link of testCases.links) {
    if (link.reqId && !knownReq.has(link.reqId)) {
      findings.push({
        severity: 'blocker',
        kind: 'test-case-tro-toi-req-khong-ton-tai',
        where: link.file,
        message: `${link.tcId} trỏ tới ${link.reqId} nhưng requirement đó không tồn tại.`,
        action: 'Sửa mã REQ trong bảng Traceability, hoặc xoá dòng đã chết.',
      });
    } else if (link.acId && !knownAc.has(`${link.reqId}/${link.acId}`)) {
      findings.push({
        severity: 'blocker',
        kind: 'test-case-tro-toi-ac-khong-ton-tai',
        where: link.file,
        message: `${link.tcId} trỏ tới ${link.reqId}/${link.acId} nhưng AC đó không còn.`,
        action: 'AC có thể đã bị xoá hoặc đổi số. Rà lại bảng Traceability.',
      });
    }
  }

  const emptyDrift = emptySpecFinding(testCases, automated, options);
  if (emptyDrift) findings.push(emptyDrift);
  if (automated.error) {
    findings.push({
      severity: 'blocker',
      kind: 'khong-doc-duoc-playwright',
      where: (options && options.projectDir) || 'playwright',
      message: automated.error,
      action: 'Không đọc được spec thì drift không kết luận được gì.',
    });
  }
  return findings;
}

module.exports = { impact, drift };

