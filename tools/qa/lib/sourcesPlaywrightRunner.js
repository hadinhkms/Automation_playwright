'use strict';
/**
 * Thực thi `playwright test --list --reporter=json` kèm SHA-1 project fingerprint cache.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

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
        } catch { return false; }
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
  const execOpts = {
    cwd: projectDir,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  };

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
    if (AUTOMATED_RAW_CACHE.size >= MAX_AUTOMATED_CACHE) {
      AUTOMATED_RAW_CACHE.delete(AUTOMATED_RAW_CACHE.keys().next().value);
    }
    AUTOMATED_RAW_CACHE.set(cacheKey, { raw, ts: Date.now() });
  }
  return { raw };
}

module.exports = { runPlaywrightList };

