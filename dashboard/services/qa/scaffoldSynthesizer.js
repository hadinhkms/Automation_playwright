'use strict';

/**
 * dashboard/services/qa/scaffoldSynthesizer.js
 * Tổng hợp đường dẫn và nội dung 3 file REQ/TC/Spec từ thông số phân tích.
 */

const fs = require('fs');
const path = require('path');
const { appendTestCasesToDocument } = require('./documentUpdater');
const {
  buildReqMarkdown,
  buildTcMarkdown,
  buildSpecCode,
} = require('./scaffoldTemplateBuilder');

function resolveSpecRelPath(root, domain, slug) {
  const desktopDir = path.join(root, 'tests', 'e2e', 'desktop');
  const domainDir = path.join(root, 'tests', domain);
  if (fs.existsSync(desktopDir)) {
    return `tests/e2e/desktop/${slug}-bdd.spec.js`;
  }
  if (fs.existsSync(domainDir)) {
    return `tests/${domain}/${slug}.spec.js`;
  }
  return `tests/e2e/desktop/${slug}-bdd.spec.js`;
}

function resolveFixtureImport(root, specRelPath) {
  const absSpec = path.join(root, specRelPath);
  const baseTestAbs = path.join(root, 'core', 'fixtures', 'baseTest.js');
  if (fs.existsSync(baseTestAbs)) {
    let rel = path.relative(path.dirname(absSpec), baseTestAbs).replace(/\\/g, '/').replace(/\.js$/, '');
    if (!rel.startsWith('.')) rel = `./${rel}`;
    return rel;
  }
  return '@playwright/test';
}

function synthesizeScaffoldContents(root, params) {
  const {
    reqId,
    domain,
    title,
    slug,
    businessGoal,
    acs,
    rules = [],
    testCases = [],
    specCode = null,
  } = params;

  const reqRelPath = `requirements/${reqId}-${slug}.md`;
  const tcRelPath = `test-cases/${reqId}-${slug}.md`;
  const specRelPath = resolveSpecRelPath(root, domain, slug);

  const reqContent = buildReqMarkdown({ reqId, title, slug, tcRelPath, businessGoal, acs, rules });
  const tcContent = buildTcMarkdown({ reqId, title, reqRelPath, testCases, specRelPath, domain });

  let finalSpecContent = '';
  if (specCode && specCode.includes('test(')) {
    finalSpecContent = specCode;
  } else {
    const fixtureImport = resolveFixtureImport(root, specRelPath);
    finalSpecContent = buildSpecCode({ reqId, title, reqRelPath, testCases, domain, fixtureImport });
  }

  return {
    reqId,
    domain,
    title,
    slug,
    acs,
    testCases,
    reqRelPath,
    tcRelPath,
    specRelPath,
    reqContent,
    tcContent,
    specContent: finalSpecContent,
  };
}

module.exports = {
  appendTestCasesToDocument,
  synthesizeScaffoldContents,
};
