/**
 * dashboard/services/specProjectsService.js
 * specProjects[file] = các project của Playwright sẽ chạy ÍT NHẤT MỘT test của file (testMatch/testIgnore +
 * grep/grepInvert theo TIÊU ĐỀ ĐẦY ĐỦ từng test, gồm describe và tag). Lấy từ `playwright test --list
 * --reporter=json`: chính Playwright trả lời, nên không thể lệch (cách cũ thử grep/grepInvert trên TOÀN BỘ NỘI DUNG
 * file nên một chữ "@smoke" bất kỳ làm grepInvert loại project Regression oan).
 *
 * Cache theo (mtime+size mọi spec, các file cấu hình, NODE_ENV hiệu lực): lần ấm không spawn gì. Lần lạnh chạy
 * bất đồng bộ có timeout (DASHBOARD_SPEC_LIST_TIMEOUT_MS, mặc định 20 s). Lỗi/timeout/lỗi cấu hình -> dùng cách
 * ước lượng cũ và trả source:'estimate' để UI/D8 biết dữ liệu không chắc.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { getDashboardConfig, getResolvedConfigPath } = require('../../core/config/dashboardConfig');
const { listSpecs, specProjects: estimateSpecProjects } = require('./specService');

const DEFAULT_TIMEOUT_MS = 20000;
const MAX_OUTPUT_BYTES = 32 * 1024 * 1024;
const CONFIG_FILES = ['playwright.config.js', 'core/config/defineConfig.js', 'core/config/env.js', 'core/config/dashboardConfig.js', 'core/config/dashboardConfig.json', 'dashboardConfig.json', 'qa-engine.config.json'];

const cache = new Map(); // root -> { key, result }
const inflight = new Map(); // `${root}|${key}` -> Promise

const stamp = (file) => { try { const s = fs.statSync(file); return `${file}|${s.mtimeMs}|${s.size}`; } catch (_) { return `${file}|-`; } };

/** NODE_ENV cho tiến trình liệt kê: giá trị của dashboard chỉ khi là môi trường cấu hình, nếu không dùng mặc định (như runnerService). */
function listingEnv() {
  const settings = getDashboardConfig();
  const known = Object.keys(settings.environments || {});
  const current = String(process.env.NODE_ENV || '').trim();
  return { ...process.env, NODE_ENV: known.includes(current) ? current : settings.runtime.defaultEnvironment };
}

function cacheKey(root, specs, env) {
  const parts = [...specs.map((s) => stamp(path.join(root, s))), ...CONFIG_FILES.map((f) => stamp(path.join(root, f))), stamp(getResolvedConfigPath()), env.NODE_ENV];
  return crypto.createHash('sha1').update(parts.join('\n')).digest('hex');
}

function runList(root, env, timeoutMs) {
  return new Promise((resolve, reject) => {
    const cli = require.resolve('@playwright/test/cli');
    const child = spawn(process.execPath, [cli, 'test', '--list', '--reporter=json'], { cwd: root, env, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let tooBig = false;
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error(`playwright --list quá ${timeoutMs} ms`)); }, timeoutMs);
    child.stdout.on('data', (d) => { out += d; if (out.length > MAX_OUTPUT_BYTES) { tooBig = true; child.kill('SIGKILL'); } });
    child.on('error', (err) => { clearTimeout(timer); reject(err); });
    child.on('close', () => {
      clearTimeout(timer);
      if (tooBig) return reject(new Error('Kết quả playwright --list quá lớn'));
      try { resolve(JSON.parse(out)); } catch (_) { reject(new Error('playwright --list không trả JSON hợp lệ')); }
    });
  });
}

/** JSON của --list -> { 'tests/e2e/a.spec.js': ['Project A', ...] } theo thứ tự project trong cấu hình; mọi spec đều có khoá. */
function mapFromListing(listing, root, specs) {
  if (!listing || !Array.isArray(listing.suites) || (listing.errors || []).length > 0) throw new Error('playwright --list báo lỗi cấu hình/spec');
  const base = fs.realpathSync(root);
  const rootDir = listing.config && listing.config.rootDir ? fs.realpathSync(listing.config.rootDir) : base;
  const order = ((listing.config && listing.config.projects) || []).map((p) => p.name);
  const found = new Map();
  const visit = (suite) => {
    for (const spec of suite.specs || []) {
      const rel = path.relative(base, path.resolve(rootDir, spec.file)).split(path.sep).join('/');
      for (const t of spec.tests || []) {
        if (!t.projectName || t.projectName === 'setup') continue;
        if (!found.has(rel)) found.set(rel, new Set());
        found.get(rel).add(t.projectName);
      }
    }
    (suite.suites || []).forEach(visit);
  };
  listing.suites.forEach(visit);
  const rank = (name) => { const i = order.indexOf(name); return i < 0 ? order.length : i; };
  return Object.fromEntries(specs.map((s) => [s, [...(found.get(s) || [])].sort((a, b) => rank(a) - rank(b))]));
}

async function compute(root, key, specs, env, timeoutMs) {
  const started = Date.now();
  try {
    const map = mapFromListing(await runList(root, env, timeoutMs), root, specs);
    return { map, source: 'playwright', ms: Date.now() - started };
  } catch (err) {
    console.warn(`[specProjects] dùng ước lượng cũ: ${err.message}`);
    return { map: estimateSpecProjects(root), source: 'estimate', ms: Date.now() - started, reason: err.message };
  }
}

/** @returns {Promise<{map: Object<string,string[]>, source: 'playwright'|'estimate', ms: number, cached: boolean}>} */
async function getSpecProjects(root = process.env.QA_PROJECT_ROOT || process.cwd()) {
  const specs = listSpecs(null, root);
  const env = listingEnv();
  const key = cacheKey(root, specs, env);
  const hit = cache.get(root);
  if (hit && hit.key === key) return { ...hit.result, cached: true };

  const flightKey = `${root}|${key}`;
  if (!inflight.has(flightKey)) {
    const timeoutMs = Number(process.env.DASHBOARD_SPEC_LIST_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
    inflight.set(flightKey, compute(root, key, specs, env, timeoutMs).then((result) => {
      // Ước lượng không được cache: lần sau thử lại (lỗi tạm thời không "dính" mãi).
      if (result.source === 'playwright') cache.set(root, { key, result });
      return result;
    }).finally(() => inflight.delete(flightKey)));
  }
  return { ...(await inflight.get(flightKey)), cached: false };
}

const clearSpecProjectsCache = () => { cache.clear(); };

module.exports = { getSpecProjects, clearSpecProjectsCache };
