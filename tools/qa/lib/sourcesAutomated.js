'use strict';

/**
 * tools/qa/lib/sourcesAutomated.js
 * Khám phá test tự động thực tế và phân tích deep assertion profile / missing await cho từng spec.
 */

const fs = require('node:fs');
const path = require('node:path');
const { readText } = require('./sourcesMarkdown');
const { ASYNC_MATCHERS, extractVerifiedHelperImports } = require('./sourcesAssertionConstants');
const { extractTestCallbackBody } = require('./sourcesCallbackExtractor');
const { analyzeTestAssertions } = require('./sourcesAssertionAnalyzer');
const { findMissingAwaits } = require('./sourcesMissingAwait');
const { runPlaywrightList } = require('./sourcesPlaywrightRunner');

const RE_TC_AC_TITLE = /^(TC-\d{3})\s*-\s*(AC-\d{3})\b/;
const RE_SETUP_FILE = /\.setup\.(spec\.)?[jt]sx?$/;

function loadAutomatedTests(root, options = {}) {
  const rel = options.projectDir || 'playwright';
  const project = options.project || 'chromium';
  const projectDir = path.resolve(root, rel);

  let json;
  if (options && options.listJson) {
    try {
      json = typeof options.listJson === 'string' ? JSON.parse(options.listJson) : options.listJson;
    } catch {
      return { tests: [], error: 'Output của playwright --list không phải JSON hợp lệ' };
    }
  } else {
    if (!fs.existsSync(projectDir)) {
      return {
        tests: [],
        error: `Không thấy thư mục Playwright "${rel}" — khai "projectDir" trong qa.config.json hoặc chạy lại với --project-dir=<đường dẫn>`,
      };
    }
    const listed = runPlaywrightList(root, projectDir, rel, project);
    if (listed.error) return { tests: [], error: listed.error };
    try { json = JSON.parse(listed.raw); } catch {
      return { tests: [], error: 'Output của playwright --list không phải JSON hợp lệ' };
    }
  }

  let rootRel = '';
  if (json.config && json.config.rootDir) {
    rootRel = path.relative(root, json.config.rootDir).replace(/\\/g, '/');
    if (rootRel === '.' || rootRel.startsWith('..')) rootRel = '';
  }
  const toRepoPath = (file) => {
    const f = (file || '').replace(/\\/g, '/');
    return rootRel ? `${rootRel}/${f}` : f;
  };

  const fileCache = new Map();
  const getFileLines = (relPath) => {
    if (!fileCache.has(relPath)) {
      const absPath = path.resolve(root, relPath);
      try { fileCache.set(relPath, fs.existsSync(absPath) ? readText(absPath).split('\n') : null); } catch { fileCache.set(relPath, null); }
    }
    return fileCache.get(relPath);
  };

  const tests = [];
  const walk = (suite) => {
    for (const spec of suite.specs || []) {
      const m = spec.title.match(RE_TC_AC_TITLE);
      const allTcIds = [...new Set([...spec.title.matchAll(/\bTC-(\d{3})\b/g)].map((match) => match[0]))];
      const allAcIds = [...new Set([...spec.title.matchAll(/\bAC-(\d{3})\b/g)].map((match) => match[0]))];
      const tags = spec.tags || [];
      const testPath = toRepoPath(spec.file);
      const fileLines = getFileLines(testPath);
      let assertionCount = null;
      let isSkipped = false;
      let assertionProfile = { kind: 'unknown', matchers: [], reason: 'no-source-file' };
      let onlyNavigationAssert = false;
      let missingAwaits = [];

      if (fileLines && spec.line > 0) {
        const verifiedHelpers = extractVerifiedHelperImports(fileLines);
        const start = spec.line - 1;
        if (/test\.(?:skip|fixme)\b/.test(fileLines[start] || '')) isSkipped = true;
        const extracted = extractTestCallbackBody(fileLines, spec.line);
        let end = fileLines.length;
        if (extracted.ok) {
          end = extracted.endLine;
          assertionProfile = analyzeTestAssertions(extracted.bodyText, { paramsText: extracted.paramsText, verifiedHelpers });
        } else {
          assertionProfile = { kind: 'unknown', matchers: [], reason: extracted.reason };
          for (let i = start; i < fileLines.length; i++) {
            if (i > start && /^\s{0,6}test(?:\.describe|\.only|\.skip|\.fixme)?\s*\(/.test(fileLines[i])) { end = i; break; }
          }
        }
        onlyNavigationAssert = assertionProfile.kind === 'navigation-only';
        let count = 0;
        for (let i = start; i < end; i++) {
          const mExpect = (fileLines[i] || '').match(/\bexpect(?:\.soft)?\s*\(/g);
          if (mExpect) count += mExpect.length;
        }
        assertionCount = assertionProfile.kind !== 'unknown' ? assertionProfile.matchers.length : count;
        missingAwaits = findMissingAwaits(fileLines.slice(start, end), start + 1, (options && options.asyncMatchers) || ASYNC_MATCHERS, verifiedHelpers);
      }

      const reqTag = tags.find((t) => /^@?REQ-\d{3}$/.test(t));
      const reqId = reqTag ? (reqTag.startsWith('@') ? reqTag.slice(1) : reqTag) : null;
      tests.push({
        title: spec.title, tcId: m ? m[1] : null, acId: m ? m[2] : null,
        allTcIds, allAcIds, reqId, tags,
        file: (spec.file || '').replace(/\\/g, '/'), path: testPath,
        isSetup: RE_SETUP_FILE.test(spec.file || ''), line: spec.line || 0,
        assertionCount, assertionProfile, onlyNavigationAssert, isSkipped, missingAwaits,
      });
    }
    for (const child of suite.suites || []) walk(child);
  };
  for (const suite of json.suites || []) walk(suite);

  const ignorePrefixes = (options.ignoreSpecs || []).filter(Boolean);
  const kept = ignorePrefixes.length
    ? tests.filter((t) => !ignorePrefixes.some((p) => t.path === p || t.path.startsWith(p.endsWith('/') ? p : `${p}/`)))
    : tests;
  const emptyResult = tests.length === 0;
  return {
    tests: kept, error: null, emptyResult,
    emptyMessage: emptyResult
      ? `Đọc được 0 test từ "${rel}" với project "${project}". Playwright chạy được nhưng không `
        + 'thấy spec nào — nhiều khả năng sai "projectDir" hoặc "project" trong qa.config.json. '
        + 'Mọi báo cáo dưới đây sẽ xanh giả vì không có gì để đối chiếu.'
      : null,
    ignoredCount: tests.length - kept.length, ignorePrefixes,
  };
}

module.exports = { loadAutomatedTests };
