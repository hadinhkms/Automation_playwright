/**
 * dashboard/services/mobileRunHistory.js
 * Durable history of Mobile runs in test-results/mobile-runs/index.json (newest first, max 30).
 * Writes go through a temp file + rename so a crash never leaves half a JSON document.
 */
const path = require('path');
const { createJsonRunStore } = require('./jsonRunStore');

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

const store = createJsonRunStore({ fileFor: historyFile, maxRuns: MAX_RUNS, isValidRecord });

/** Reads the history; a corrupt file or record is skipped instead of breaking the view (EDGE-203). */
const readHistory = (root) => store.read(root);

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
  return store.append(root, toRecord(run));
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
