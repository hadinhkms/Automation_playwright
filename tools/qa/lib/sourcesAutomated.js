'use strict';

/**
 * tools/qa/lib/sourcesAutomated.js
 * Khám phá test tự động thực tế qua `playwright test --list --reporter=json`,
 * hỗ trợ direct CLI lookup + SHA-1 project fingerprint cache.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { readText } = require('./sourcesMarkdown');
const { ASYNC_MATCHERS, findMissingAwaits } = require('./sourcesMissingAwait');

const RE_TC_AC_TITLE = /^(TC-\d{3})\s*-\s*(AC-\d{3})\b/;
const RE_SETUP_FILE = /\.setup\.(spec\.)?[jt]sx?$/;
const AUTOMATED_RAW_CACHE = new Map();
const MAX_AUTOMATED_CACHE = 16;
const AUTOMATED_CACHE_TTL_MS = 30_000;
const SKIP_FINGERPRINT_DIRS = new Set([
  'node_modules', '.git', '.dashboard-backups', '.dashboard-drafts',
  'test-results', 'playwright-report', 'reports',
]);

function computeProjectFingerprint(dir) {
  const hash = crypto.createHash('sha1');
  let fileCount = 0;
  let totalBytes = 0;
  const walk = (curr, relPrefix) => {
    let entries;
    try { entries = fs.readdirSync(curr, { withFileTypes: true }); } catch { return true; }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const ent of entries) {
      if (ent.name.startsWith('.tmp') || SKIP_FINGERPRINT_DIRS.has(ent.name)) continue;
      const abs = path.join(curr, ent.name);
      const rel = relPrefix ? `${relPrefix}/${ent.name}` : ent.name;
      if (ent.isDirectory()) {
        if (!walk(abs, rel)) return false;
      } else if (/\.(?:[cm]?[jt]sx?|json)$/i.test(ent.name)) {
        fileCount += 1;
        if (fileCount > 350) return false;
        try {
          const buf = fs.readFileSync(abs);
          totalBytes += buf.length;
          if (totalBytes > 4 * 1024 * 1024) return false;
          hash.update(`${rel}:${buf.length}\0`);
          hash.update(buf);
        } catch {
          return false;
        }
      }
    }
    return true;
  };
  return walk(dir, '') ? hash.digest('hex') : null;
}

function runPlaywrightList(root, projectDir, rel, project) {
  const localCli = path.join(projectDir, 'node_modules', '@playwright', 'test', 'cli.js');
  const rootCli = path.join(root, 'node_modules', '@playwright', 'test', 'cli.js');
  let directCli = fs.existsSync(localCli) ? localCli : (fs.existsSync(rootCli) ? rootCli : null);
  if (!directCli) {
    try { directCli = require.resolve('@playwright/test/cli', { paths: [projectDir, root] }); } catch { directCli = null; }
  }
  const fp = computeProjectFingerprint(projectDir);
  const cacheKey = fp ? `${projectDir}::${project || 'all'}::${fp}` : null;
  const cached = cacheKey ? AUTOMATED_RAW_CACHE.get(cacheKey) : null;
  if (cached && (Date.now() - cached.ts < AUTOMATED_CACHE_TTL_MS)) return { raw: cached.raw };

  const baseArgs = ['test', '--list', '--reporter=json', '--pass-with-no-tests'];
  if (project && project !== 'all') baseArgs.push(`--project=${project}`);
  const execOpts = { cwd: projectDir, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true };

  let raw;
  try {
    if (directCli) {
      raw = execFileSync(process.execPath, [directCli, ...baseArgs], execOpts);
    } else {
      const useShell = process.platform === 'win32';
      const npxArgs = ['playwright', ...baseArgs].map((a) => (useShell && /\s/.test(a) ? `"${a}"` : a));
      raw = execFileSync('npx', npxArgs, { ...execOpts, shell: useShell });
    }
  } catch (err) {
    return {
      error: `Không chạy được playwright --list trong "${rel}": ${String(err.message).split(/\r?\n/)[0]} `
        + `(project đang dùng: "${project}" — đổi "project" trong qa.config.json nếu tên khác)`,
    };
  }
  if (cacheKey && typeof raw === 'string') {
    if (AUTOMATED_RAW_CACHE.size >= MAX_AUTOMATED_CACHE) AUTOMATED_RAW_CACHE.delete(AUTOMATED_RAW_CACHE.keys().next().value);
    AUTOMATED_RAW_CACHE.set(cacheKey, { raw, ts: Date.now() });
  }
  return { raw };
}

function loadAutomatedTests(root, options = {}) {
  const rel = options.projectDir || 'playwright';
  const project = options.project;
  const projectDir = path.resolve(root, rel);
  if (!fs.existsSync(projectDir)) {
    return {
      tests: [],
      error: `Không thấy thư mục Playwright "${rel}" — khai "projectDir" trong qa.config.json hoặc chạy lại với --project-dir=<đường dẫn>`,
    };
  }

  const listed = runPlaywrightList(root, projectDir, rel, project);
  if (listed.error) return { tests: [], error: listed.error };

  let json;
  try { json = JSON.parse(listed.raw); } catch {
    return { tests: [], error: 'Output của playwright --list không phải JSON hợp lệ' };
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
      let missingAwaits = [];

      if (fileLines && spec.line > 0) {
        const start = spec.line - 1;
        if (/test\.(?:skip|fixme)\b/.test(fileLines[start] || '')) isSkipped = true;
        let count = 0;
        let end = fileLines.length;
        for (let i = start; i < fileLines.length; i++) {
          const l = fileLines[i];
          if (i > start && /^\s{0,6}test(?:\.describe|\.only|\.skip|\.fixme)?\s*\(/.test(l)) { end = i; break; }
          const mExpect = l.match(/\bexpect(?:\.soft)?\s*\(/g);
          if (mExpect) count += mExpect.length;
        }
        assertionCount = count;
        missingAwaits = findMissingAwaits(fileLines.slice(start, end), start + 1, (options && options.asyncMatchers) || ASYNC_MATCHERS);
      }

      const reqTag = tags.find((t) => /^@?REQ-\d{3}$/.test(t));
      const reqId = reqTag ? (reqTag.startsWith('@') ? reqTag.slice(1) : reqTag) : null;
      tests.push({
        title: spec.title, tcId: m ? m[1] : null, acId: m ? m[2] : null,
        allTcIds, allAcIds, reqId, tags,
        file: (spec.file || '').replace(/\\/g, '/'), path: testPath,
        isSetup: RE_SETUP_FILE.test(spec.file || ''), line: spec.line || 0,
        assertionCount, isSkipped, missingAwaits,
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

