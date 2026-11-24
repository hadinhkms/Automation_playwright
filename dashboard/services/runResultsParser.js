/**
 * dashboard/services/runResultsParser.js
 * Rút gọn JSON reporter của Playwright thành { summary, files, failures } theo CONTRACT-run-history §2-§3.
 * Hàm thuần (trừ readResults đọc đĩa). Che token + cắt lỗi trước khi bản ghi được lưu/đọc qua API.
 */
const fs = require('fs');
const path = require('path');
const { getDashboardConfig } = require('../../core/config/dashboardConfig');

const MAX_RAW_BYTES = 20 * 1024 * 1024;
const MAX_FAILURES = 50;
const MAX_ERROR = 300;
const STATUS = { expected: 'passed', unexpected: 'failed', flaky: 'flaky', skipped: 'skipped' };
const ANSI = /\u001b\[[0-9;]*m/g;

/** Che registrationBearerToken (nếu có) và mọi `Bearer <...>`; dòng đầu của lỗi, tối đa 300 ký tự. */
function sanitizeError(message) {
  let text = String(message || '').replace(ANSI, '').split('\n')[0];
  let token = '';
  try { token = getDashboardConfig().api.registrationBearerToken || ''; } catch (_) { /* config unreadable: still mask Bearer */ }
  if (token) text = text.split(token).join('***');
  text = text.replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer ***');
  return text.length > MAX_ERROR ? `${text.slice(0, MAX_ERROR - 1)}…` : text;
}

const emptyCounts = () => ({ passed: 0, failed: 0, flaky: 0, skipped: 0 });

function fileStatus(c) {
  if (c.failed > 0) return 'failed';
  if (c.flaky > 0) return 'flaky';
  if (c.passed > 0) return 'passed';
  return 'skipped';
}

/** @returns {{summary, files, failures}} - file relative to `root` with "/" (matches listSpecs). */
function parseReport(report, root) {
  const summary = { total: 0, ...emptyCounts() };
  const byFile = new Map();
  const failures = [];
  const base = fs.realpathSync(root);
  const rootDir = report && report.config && report.config.rootDir ? report.config.rootDir : base;

  const visit = (suite) => {
    for (const spec of suite.specs || []) {
      const file = path.relative(base, path.resolve(rootDir, spec.file)).split(path.sep).join('/');
      const entry = byFile.get(file) || { file, ...emptyCounts(), durationMs: 0 };
      byFile.set(file, entry);
      for (const t of spec.tests || []) {
        const status = STATUS[t.status] || 'skipped';
        summary.total += 1; summary[status] += 1; entry[status] += 1;
        entry.durationMs += (t.results || []).reduce((sum, r) => sum + (Number(r.duration) || 0), 0);
        if (status === 'failed' && failures.length < MAX_FAILURES) {
          const last = (t.results || [])[Math.max(0, (t.results || []).length - 1)] || {};
          const err = last.error || (last.errors || [])[0] || {};
          failures.push({ file, title: spec.title, line: spec.line ?? null, project: t.projectName || '', error: sanitizeError(err.message) });
        }
      }
    }
    (suite.suites || []).forEach(visit);
  };
  ((report && report.suites) || []).forEach(visit);

  const files = [...byFile.values()].map((e) => ({ ...e, status: fileStatus(e) }));
  return { summary, files, failures };
}

function readJson(file) {
  try {
    if (fs.statSync(file).size > MAX_RAW_BYTES) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_) { return null; }
}

/** Newest playwright-report/**\/results.json whose mtime >= startedAt (configs that do not honour the env). */
function newestResultsJson(root, sinceMs) {
  let best = null;
  const visit = (dir) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) visit(full);
      else if (e.name === 'results.json') {
        const mtime = fs.statSync(full).mtimeMs;
        if (mtime >= sinceMs && (!best || mtime > best.mtime)) best = { full, mtime };
      }
    }
  };
  visit(path.join(root, 'playwright-report'));
  return best && best.full;
}

/**
 * Nguồn kết quả của một run web. LỆCH HỢP ĐỒNG §2 (CEO duyệt phương án A): dashboard đặt biến môi trường
 * PLAYWRIGHT_JSON_OUTPUT_FILE (ưu tiên hơn outputFile trong config) thay vì thêm reporter json thứ hai vào
 * core/config/defineConfig.js (chạm trần limits + chạm Hub). Hệ quả: lượt chạy do dashboard khởi động không ghi
 * results.json vào thư mục report (không code nào đọc nó; html/junit/summary vẫn đủ). Raw file bị XOÁ sau khi đọc.
 * @returns {{source:'json'|'none', summary, files, failures}}
 */
function readResults(root, rawFile, startedAtMs) {
  const candidates = [rawFile, newestResultsJson(root, startedAtMs)].filter(Boolean);
  for (const file of candidates) {
    const report = readJson(file);
    if (report) {
      if (file === rawFile) fs.rmSync(file, { force: true });
      return { source: 'json', ...parseReport(report, root) };
    }
  }
  if (rawFile) fs.rmSync(rawFile, { force: true });
  return { source: 'none', summary: { total: 0, ...emptyCounts() }, files: [], failures: [] };
}

module.exports = { parseReport, readResults, sanitizeError, MAX_FAILURES };
