/**
 * dashboard/services/mobileRunArtifacts.js
 * Files a native run leaves behind: evidence screenshots and the JUnit report.
 */
const fs = require('fs');
const path = require('path');
const { mergeRunReports, parseJunitCases, summarize } = require('../../core/native/junitReport');

function junitDir(root, platform) {
  return path.join(root, 'test-results', 'native', platform);
}

function junitPath(root, platform, runId) {
  return path.join(junitDir(root, platform), `junit-${runId}.xml`);
}

function listPng(dir, urlBase, since) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((n) => /\.png$/i.test(n))
    .map((n) => ({ name: n, mtime: fs.statSync(path.join(dir, n)).mtimeMs }))
    .filter((f) => f.mtime >= since)
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, 12)
    .map((f) => ({ name: f.name, url: `${urlBase}/${encodeURIComponent(f.name)}` }));
}

/** Screenshots of one run: evidence/native/<platform>/<runId>/ (U-01); older runs wrote flat files, matched by time. */
function collectEvidence(root, platform, sinceIso, runId) {
  const base = path.join(root, 'evidence', 'native', platform);
  const since = Date.parse(sinceIso) - 1000;
  const own = /^[\w-]{1,40}$/.test(runId || '') ? listPng(path.join(base, runId), `/evidence/native/${platform}/${runId}`, since) : [];
  return own.length ? own : listPng(base, `/evidence/native/${platform}`, since);
}

/**
 * Merges the run's worker files (WDIO onComplete is skipped when a run is killed) and reads them back.
 * Returns null when the run produced no JUnit at all (e.g. Appium never started).
 */
function finalizeJunit(root, platform, runId) {
  let file = '';
  try { file = mergeRunReports(junitDir(root, platform), runId); } catch (_) { file = ''; }
  if (!file || !fs.existsSync(file)) return null;
  const cases = parseJunitCases(fs.readFileSync(file, 'utf8'));
  return {
    file: path.relative(root, file).split(path.sep).join('/'),
    ...summarize(cases),
    cases: cases.map((c) => ({ id: `${c.classname}.${c.name}`, title: c.name, status: c.status })),
  };
}

/** @wdio/cli does not export its bin through package "exports", so locate the file directly. */
function findWdioBin(root) {
  const rel = path.join('node_modules', '@wdio', 'cli', 'bin', 'wdio.js');
  const found = [root, process.cwd()].map((dir) => path.join(dir, rel)).find((p) => fs.existsSync(p));
  if (!found) throw Object.assign(new Error('Chưa cài WebdriverIO (@wdio/cli). Chạy "npm install" trong repo rồi thử lại.'), { status: 503 });
  return found;
}

module.exports = { collectEvidence, finalizeJunit, findWdioBin, junitPath };
