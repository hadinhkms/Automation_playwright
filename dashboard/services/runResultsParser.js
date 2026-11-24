/**
 * dashboard/services/runResultsParser.js
 * Rút gọn JSON reporter của Playwright thành { summary, files, failures } theo CONTRACT-run-history §2-§3.
 * Hàm thuần (trừ readResults đọc đĩa). Che token + cắt lỗi trước khi bản ghi được lưu/đọc qua API.
 */
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const { maskSecrets } = require('./secretMask');

const MAX_RAW_BYTES = 20 * 1024 * 1024;
const MAX_FAILURES = 50;
const MAX_ERROR = 300;
const STATUS = { expected: 'passed', unexpected: 'failed', flaky: 'flaky', skipped: 'skipped' };

/** Dòng đầu của lỗi, đã che bí mật (secretMask), tối đa 300 ký tự. */
function sanitizeError(message) {
  const text = maskSecrets(String(message || '').split('\n')[0]);
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
          failures.push({ file, title: maskSecrets(spec.title), line: spec.line ?? null, project: t.projectName || '', error: sanitizeError(err.message) });
        }
      }
    }
    (suite.suites || []).forEach(visit);
  };
  ((report && report.suites) || []).forEach(visit);

  const files = [...byFile.values()].map((e) => ({ ...e, status: fileStatus(e) }));
  return { summary, files, failures };
}

async function readJson(file) {
  try {
    if ((await fsp.stat(file)).size > MAX_RAW_BYTES) return null;
    return JSON.parse(await fsp.readFile(file, 'utf8'));
  } catch (_) { return null; }
}

/** Duyệt playwright-report bất đồng bộ (không chặn event loop), trả results.json mới nhất có mtime >= sinceMs. */
async function newestResultsJson(root, sinceMs) {
  let best = null;
  const pending = [path.join(root, 'playwright-report')];
  while (pending.length > 0) {
    const dir = pending.pop();
    let entries;
    try { entries = await fsp.readdir(dir, { withFileTypes: true }); } catch (_) { continue; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) pending.push(full);
      else if (e.name === 'results.json') {
        const mtime = (await fsp.stat(full)).mtimeMs;
        if (mtime >= sinceMs && (!best || mtime > best.mtime)) best = { full, mtime };
      }
    }
  }
  return best && best.full;
}

/** R-2: một results.json "tìm thấy" chỉ thuộc về run này nếu bắt đầu trong khoảng của run và project ⊆ projects của run. */
function belongsToRun(report, run) {
  const start = Date.parse(report && report.stats && report.stats.startTime);
  const from = Date.parse(run.startedAt);
  const to = Date.parse(run.finishedAt);
  if (!Number.isFinite(start) || !Number.isFinite(from) || !Number.isFinite(to) || start < from || start > to) return false;
  const wanted = Array.isArray(run.projects) ? run.projects : [];
  if (wanted.length === 0) return true;
  const seen = new Set();
  const visit = (suite) => { (suite.specs || []).forEach((sp) => (sp.tests || []).forEach((t) => seen.add(t.projectName))); (suite.suites || []).forEach(visit); };
  ((report && report.suites) || []).forEach(visit);
  return [...seen].every((name) => wanted.includes(name));
}

/**
 * Nguồn kết quả của một run web. LỆCH HỢP ĐỒNG §2 (CEO duyệt phương án A): dashboard đặt biến môi trường
 * PLAYWRIGHT_JSON_OUTPUT_FILE (ưu tiên hơn outputFile trong config) thay vì thêm reporter json thứ hai vào
 * core/config/defineConfig.js (chạm trần limits + chạm Hub). Hệ quả: lượt chạy do dashboard khởi động không ghi
 * results.json vào thư mục report (không code nào đọc nó; html/junit/summary vẫn đủ). Raw file bị XOÁ sau khi đọc.
 * Lười (R-3): chỉ quét playwright-report khi raw không đọc được; kết quả quét chỉ nhận khi thuộc về run (R-2).
 * @param {{startedAt:string, finishedAt:string, projects?:string[]}} run
 * @returns {Promise<{source:'json'|'none', summary, files, failures}>}
 */
async function readResults(root, rawFile, run) {
  const none = () => ({ source: 'none', summary: { total: 0, ...emptyCounts() }, files: [], failures: [] });
  if (rawFile) {
    const report = await readJson(rawFile);
    await fsp.rm(rawFile, { force: true });
    if (report) return { source: 'json', ...parseReport(report, root) };
  }
  const found = await newestResultsJson(root, Date.parse(run.startedAt) || 0);
  const report = found ? await readJson(found) : null;
  if (report && belongsToRun(report, run)) return { source: 'json', ...parseReport(report, root) };
  return none();
}

module.exports = { parseReport, readResults, sanitizeError, MAX_FAILURES };
