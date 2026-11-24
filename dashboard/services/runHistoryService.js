/**
 * dashboard/services/runHistoryService.js
 * Lịch sử chạy test WEB (CONTRACT-run-history): test-results/web-runs/index.json, tối đa 100 run, mới nhất trước.
 * Ghi khi tiến trình con kết thúc (passed/failed/stopped, không ghi --ui); truy vấn chỉ đọc cho 4 endpoint.
 */
const fs = require('fs');
const path = require('path');
const { createJsonRunStore } = require('./jsonRunStore');
const { readResults } = require('./runResultsParser');
const { listSpecs } = require('./specService');

const MAX_RUNS = 100;
const ID_PATTERN = /^[\w-]{1,40}$/;
const FINAL = new Set(['passed', 'failed', 'stopped']);
const SUMMARY_DROP = ['failures', 'command'];

const historyDir = (root) => path.join(root, 'test-results', 'web-runs');
const historyFile = (root) => path.join(historyDir(root), 'index.json');
const rawResultsFile = (root, runId) => path.join(historyDir(root), `${runId}.raw.json`);

function isValidRecord(r) {
  return Boolean(r) && typeof r === 'object' && !Array.isArray(r)
    && ID_PATTERN.test(String(r.id || '')) && FINAL.has(r.status) && !Number.isNaN(Date.parse(r.startedAt));
}

const store = createJsonRunStore({ fileFor: historyFile, maxRuns: MAX_RUNS, isValidRecord, quarantineCorrupt: true });

function buildRecord(run, results) {
  const o = run.options || {};
  const started = Date.parse(run.startedAt);
  const finished = Date.parse(run.finishedAt);
  return {
    id: run.id,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt || null,
    durationMs: Number.isFinite(finished - started) ? finished - started : null,
    status: run.status,
    exitCode: run.exitCode ?? null,
    environment: o.environment || '',
    projects: Array.isArray(o.projects) && o.projects.length > 0 ? o.projects : (o.project && o.project !== 'all' ? [o.project] : []),
    specs: Array.isArray(o.specs) ? o.specs : [],
    tags: Array.isArray(o.tags) ? o.tags : [],
    grep: o.grep || '',
    suite: o.suite || null,
    suiteLabel: o.suiteLabel || '',
    workers: o.workers ?? null,
    headed: o.headed === true,
    command: run.command || '',
    resultsSource: results.source,
    reportAvailable: Boolean(run.reportAvailable),
    summary: results.summary,
    files: results.files,
    failures: results.failures,
  };
}

/** Gọi SAU khi run đã nhả activeRun và phát trạng thái kết thúc (R-3). Không bao giờ ném/reject (lỗi lịch sử không được đổi trạng thái run). */
async function recordWebRun(root, run, rawFile) {
  try {
    const results = await readResults(root, rawFile, { startedAt: run.startedAt, finishedAt: run.finishedAt, projects: buildRecord(run, { source: 'none' }).projects });
    return store.append(root, buildRecord(run, results)); // append đọc-sửa-ghi ĐỒNG BỘ
  } catch (err) {
    console.warn(`[run-history] không ghi được lịch sử run ${run && run.id}: ${err.message}`);
    return null;
  }
}

function listRuns(root, limit) {
  const n = Number.parseInt(limit, 10);
  const max = Number.isInteger(n) && n >= 1 ? Math.min(n, MAX_RUNS) : 20;
  return store.read(root).slice(0, max).map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !SUMMARY_DROP.includes(k))));
}

function getRun(root, id) {
  if (!ID_PATTERN.test(String(id || ''))) return null;
  return store.read(root).find((r) => r.id === id) || null;
}

const jsonRuns = (root) => store.read(root).filter((r) => r.resultsSource === 'json');

/** Run mới nhất có status failed + resultsSource json + >=1 file failed; specs = file failed ∩ listSpecs. */
function latestFailed(root) {
  const run = jsonRuns(root).find((r) => r.status === 'failed' && (r.files || []).some((f) => f.status === 'failed'));
  if (!run) return { run: null, specs: [], missing: [] };
  const existing = new Set(listSpecs(null, root));
  const failed = run.files.filter((f) => f.status === 'failed').map((f) => f.file);
  return {
    run: { id: run.id, startedAt: run.startedAt, environment: run.environment, projects: run.projects },
    specs: failed.filter((f) => existing.has(f)),
    missing: failed.filter((f) => !existing.has(f)),
  };
}

/** Kết quả mới nhất của từng file trong các run passed|failed có resultsSource json (stopped/none không đóng góp). */
function fileStatuses(root) {
  const files = {};
  for (const run of jsonRuns(root).filter((r) => r.status === 'passed' || r.status === 'failed')) {
    for (const f of run.files || []) {
      if (!files[f.file]) files[f.file] = { status: f.status, runId: run.id, at: run.startedAt };
    }
  }
  return { files };
}

module.exports = { recordWebRun, rawResultsFile, listRuns, getRun, latestFailed, fileStatuses, historyFile, MAX_RUNS, ID_PATTERN };
