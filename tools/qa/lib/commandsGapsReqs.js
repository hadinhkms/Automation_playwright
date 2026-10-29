'use strict';

const { expectedCasesFromRule } = require('./commandsCore');
const { checkGlobalDocumentIntegrity } = require('./commandsGapsIntegrity');

const UI_HELPER_MATCHER_RE =
  /^helper:expect(?:NoHorizontalScroll|NoHorizontalOverflow|NoTextOverflow|PairwiseNoOverlap|NoOverlap|ContainedIn|ContainedWithin|NotOccluded|InteractiveA11y|ResponsiveIntegrity)$/;

function checkRequirementGaps(ctx, findings) {
  const { requirements, testCases, linksByAc, automatedTcIds, wipTcIds, activeTestsByReq, options, deepSeverity } = ctx;
  const knownTcIds = new Set(testCases.links.map((l) => l.tcId));

  for (const req of requirements) {
    if (!req.id) {
      findings.push({
        severity: 'blocker',
        kind: 'requirement-khong-co-front-matter',
        where: req.file,
        message: 'Requirement thiếu front-matter (id/status/...). Tool không đọc được.',
        action: 'Thêm front-matter theo templates/requirement-template.md',
      });
      continue;
    }

    const acCounts = new Map();
    for (const ac of req.acs) {
      if (ac.id) acCounts.set(ac.id, (acCounts.get(ac.id) || 0) + 1);
    }
    for (const [acId, count] of acCounts.entries()) {
      if (count > 1) {
        findings.push({
          severity: 'major',
          kind: 'ma-ac-trung',
          where: req.file,
          message: `Mã tiêu chí "${acId}" xuất hiện ${count} lần trong ${req.id}.`,
          action: 'Đổi mã AC để mỗi tiêu chí chấp nhận có định danh duy nhất trong requirement.',
        });
      }
    }

    for (const nm of req.nearMisses || []) {
      findings.push({
        severity: 'major',
        kind: 'dinh-danh-sai-quy-uoc',
        where: `${req.file}:${nm.line}`,
        message: `"${nm.raw}" trông giống mã định danh nhưng sai quy ước (đúng: AC-001, TC-001).`,
        action: 'Sửa về đúng 3 chữ số, nếu không mục này vô hình với mọi báo cáo.',
      });
    }

    for (const ac of req.acs) {
      const links = linksByAc.get(`${req.id}/${ac.id}`) || [];
      if (links.length === 0) {
        findings.push({
          severity: 'blocker',
          kind: 'ac-khong-co-test-case',
          where: `${req.file}:${ac.line}`,
          message: `${req.id}/${ac.id} "${ac.title}" chưa có test case nào.`,
          action: `Thêm TC vào ${req.testCaseFile || 'test-cases/'} rồi cân nhắc automation.`,
        });
        continue;
      }
      const hasAutomated = links.some((l) => automatedTcIds.has(l.tcId));
      const allManual = links.every((l) => l.automation === 'No');
      if (!hasAutomated && !allManual) {
        findings.push({
          severity: 'major',
          kind: 'ac-chua-co-script',
          where: `${req.file}:${ac.line}`,
          message: `${req.id}/${ac.id} có test case (${links.map((l) => l.tcId).join(', ')}) nhưng chưa test nào được automation.`,
          action: 'Viết script cho TC có điểm cao nhất trong automation plan.',
        });
      } else if (hasAutomated) {
        const autoLinks = links.filter((l) => automatedTcIds.has(l.tcId));
        if (autoLinks.length > 0 && autoLinks.every((l) => wipTcIds.has(l.tcId))) {
          findings.push({
            severity: 'minor',
            kind: 'ac-chi-co-script-wip',
            where: `${req.file}:${ac.line}`,
            message: `${req.id}/${ac.id} có test case (${autoLinks.map((l) => l.tcId).join(', ')}) nhưng toàn bộ script đều mang tag @wip/stub (chưa hoàn thiện).`,
            action: 'Hoàn thiện script và gỡ tag @wip để được tính vào độ phủ chính thức.',
          });
        }
      }
    }

    for (const rule of req.rules) {
      if (/^<.*>$/.test(rule.field) || !rule.field) continue;
      if (rule.testCases.length === 0) {
        findings.push({
          severity: 'major',
          kind: 'rule-chua-map-toi-test-case',
          where: req.file,
          message: `Dòng rule "${rule.field}" của ${req.id} để trống cột Test cases.`,
          action: `Cần tối thiểu: ${expectedCasesFromRule(rule).join('; ')}`,
        });
        continue;
      }
      const unknown = rule.testCases.filter((tc) => !knownTcIds.has(tc));
      if (unknown.length > 0) {
        findings.push({
          severity: 'blocker',
          kind: 'rule-tro-toi-tc-khong-ton-tai',
          where: req.file,
          message: `Dòng rule "${rule.field}" trỏ tới ${unknown.join(', ')} nhưng TC đó không có trong test-cases/.`,
          action: 'Sửa mã TC hoặc bổ sung test case.',
        });
      }
      if (options && options.checkBoundaryRules && rule.testCases.length === 1) {
        const hasMultiBoundary = rule.boundary && rule.boundary !== '-' && rule.boundary.includes(',');
        const hasMultiInvalid = rule.invalid && rule.invalid !== '-' && rule.invalid.includes(',');
        if (hasMultiBoundary || hasMultiInvalid) {
          const reason = hasMultiBoundary ? `nhiều giá trị biên (${rule.boundary})` : `nhiều giá trị không hợp lệ (${rule.invalid})`;
          findings.push({
            severity: 'minor',
            kind: 'rule-thieu-boundary-test',
            where: req.file,
            message: `Dòng rule "${rule.field}" có ${reason} nhưng chỉ gán 1 test case (${rule.testCases[0]}).`,
            action: `Khuyến nghị tách thêm test case độc lập (BVA/EP). Cần tối thiểu: ${expectedCasesFromRule(rule).join('; ')}`,
          });
        }
      }
    }

    const reqActiveTests = activeTestsByReq.get(req.id) || [];
    if (req.uiCoverage && req.uiCoverage.status === 'Required') {
      const hasUi = reqActiveTests.some((t) => {
        const tags = t.tags || [];
        const matchers = (t.assertionProfile && t.assertionProfile.matchers) || [];
        return tags.includes('@visual') || tags.includes('@ui') || matchers.some((m) => UI_HELPER_MATCHER_RE.test(m));
      });
      if (!hasUi) {
        findings.push({
          severity: deepSeverity,
          kind: 'missing-ui-coverage',
          where: req.file,
          message: `${req.id} khai UI coverage = Required nhưng chưa có test nào gắn @visual/@ui hoặc gọi helper kiểm tra bố cục (support/ui-checks).`,
          action: 'Bổ sung kịch bản kiểm thử UI/UX với helper từ support/ui-checks hoặc khai Exempt (reason: ...) nếu không áp dụng.',
        });
      }
    }
    if (req.xssApplicability && req.xssApplicability.status === 'Applicable') {
      const hasXss = reqActiveTests.some((t) => ((t.assertionProfile && t.assertionProfile.matchers) || []).includes('helper:expectSafeXssRender'));
      if (!hasXss) {
        findings.push({
          severity: deepSeverity,
          kind: 'missing-xss-coverage',
          where: req.file,
          message: `${req.id} khai XSS applicability = Applicable nhưng chưa có test nào gọi expectSafeXssRender.`,
          action: 'Bổ sung kịch bản @security gọi expectSafeXssRender từ support/deep-guards hoặc khai Not applicable (reason: ...) nếu không áp dụng.',
        });
      }
    }
  }
}

module.exports = { checkGlobalDocumentIntegrity, checkRequirementGaps };
