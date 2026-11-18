/**
 * dashboard/services/mobileRunHistory.js
 * Durable history of Mobile runs in test-results/mobile-runs/index.json (newest first, max 30).
 * Writes go through a temp file + rename so a crash never leaves half a JSON document.
 */
const fs = require('fs');
const path = require('path');

const MAX_RUNS = 30;
const ID_PATTERN = /^[\w-]{1,40}$/;
const FINAL_STATUSES = new Set(['passed', 'failed', 'stopped']);

function historyFile(root) {
  return path.join(root, 'test-results', 'mobile-runs', 'index.json');
}

function isValidRecord(r) {
  return Boolean(r) && typeof r === 'object' && !Array.isArray(r)
    && ID_PATTERN.test(String(r.id || '')) && FINAL_STATUSES.has(r.status)
    && !Number.isNaN(Date.parse(r.startedAt));
}

/** Reads the history; a corrupt file or record is skipped instead of breaking the view (EDGE-203). */
function readHistory(root) {
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(historyFile(root), 'utf8'));
  } catch (_) {
    return [];
  }
  const runs = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.runs) ? parsed.runs : []);
  return runs.filter(isValidRecord).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

function writeAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  // Windows: antivirus or indexers can hold the target for a moment (EPERM/EBUSY); retry briefly.
  for (let attempt = 1; ; attempt += 1) {
    try { fs.renameSync(tmp, file); return; } catch (err) {
      if (attempt >= 5 || !['EPERM', 'EBUSY', 'EACCES'].includes(err.code)) { fs.rmSync(tmp, { force: true }); throw err; }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20 * attempt);
    }
  }
}

function toRecord(run) {
  const started = Date.parse(run.startedAt);
  const finished = Date.parse(run.finishedAt);
  const { options = {} } = run;
  return {
    id: run.id,
    platform: run.platform,
    status: run.status,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt || null,
    durationMs: Number.isFinite(finished - started) ? finished - started : null,
    exitCode: run.exitCode ?? null,
    device: { udid: options.udid || '', name: options.deviceName || '' },
    app: options.app || null,
    specs: options.specs || [],
    grep: options.grep || '',
    suite: options.suite || null,
    command: run.command || '',
    results: run.results || [],
    evidence: run.evidence || [],
    junit: run.junit ? { file: run.junit.file, tests: run.junit.tests, failures: run.junit.failures, skipped: run.junit.skipped } : null,
  };
}

/** Adds a finished run (replacing one with the same id) and keeps the newest MAX_RUNS. */
function appendRun(root, run) {
  const record = toRecord(run);
  if (!isValidRecord(record)) return null;
  const runs = [record, ...readHistory(root).filter((r) => r.id !== record.id)].slice(0, MAX_RUNS);
  writeAtomic(historyFile(root), { version: 1, runs });
  return record;
}

function listRuns(root, limit = MAX_RUNS) {
  const n = Number.parseInt(limit, 10);
  const max = Number.isInteger(n) && n > 0 ? Math.min(n, MAX_RUNS) : MAX_RUNS;
  return readHistory(root).slice(0, max);
}

function getRun(root, id) {
  if (!ID_PATTERN.test(String(id || ''))) return null;
  return readHistory(root).find((r) => r.id === id) || null;
}

module.exports = { appendRun, listRuns, getRun, readHistory, historyFile, MAX_RUNS, ID_PATTERN };
