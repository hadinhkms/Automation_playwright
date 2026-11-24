/**
 * dashboard/services/masterProcessUtils.js
 * Tiện ích hỗ trợ Master Process: Whitelist Path Validation,
 * Master Root Detection, Subprocess Execution có Timeout 60s, Graceful Kill và windowsHide.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { canonicalPath, isForeignDrivePath } = require('./projectPathGuard');
const { controlCharError, hasControlChars } = require('./masterProcessErrors');
const { createMasker } = require('./secretMask');

let syncManifest = null;
try {
  syncManifest = require('../../scripts/lib/sync-manifest');
} catch (_) {}

function normalizePath(p) {
  return path.resolve(p).replace(/\\/g, '/').toLowerCase();
}

function detectMasterRoot(projectRoot = process.cwd()) {
  if (process.env.MASTER_PROCESS_ROOT && fs.existsSync(path.join(process.env.MASTER_PROCESS_ROOT, 'master.py'))) {
    return path.resolve(process.env.MASTER_PROCESS_ROOT);
  }
  const lockFile = path.join(projectRoot, '.ai', 'process-lock.json');
  if (fs.existsSync(lockFile)) {
    try {
      const lock = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
      if (lock.hub_path && fs.existsSync(path.join(lock.hub_path, 'master.py'))) {
        return path.resolve(lock.hub_path);
      }
    } catch (_) {}
  }
  const resolvedRoot = path.resolve(projectRoot);
  const driveRoot = path.parse(resolvedRoot).root;
  const candidates = [
    path.resolve(resolvedRoot, '../_Master_Process'),
    path.resolve(resolvedRoot, '../_Master_process'),
    path.resolve(resolvedRoot, '.master_process'),
    path.join(driveRoot, '_Master_Process'),
    path.join(driveRoot, '_Master_process'),
    'D:/_Master_Process',
    'C:/_Master_Process',
  ];
  for (const cand of candidates) {
    if (cand && fs.existsSync(path.join(cand, 'master.py'))) {
      return path.resolve(cand);
    }
  }
  return null;
}

function getAllowedProjectRoots(fallbackRoot) {
  const roots = new Set();
  const currentHub = syncManifest?.HUB_ROOT || path.resolve(__dirname, '../../');
  roots.add(currentHub);
  if (fallbackRoot) roots.add(path.resolve(fallbackRoot));
  roots.add(process.cwd());

  const detectedMaster = detectMasterRoot(fallbackRoot || currentHub);
  if (detectedMaster) roots.add(detectedMaster);

  if (syncManifest?.SATELLITES) {
    for (const sat of syncManifest.SATELLITES) {
      if (sat.localPath) roots.add(path.resolve(sat.localPath));
    }
  }

  if (process.env.QA_ALLOWED_PROJECTS) {
    process.env.QA_ALLOWED_PROJECTS.split(';').map((p) => p.trim()).filter(Boolean).forEach((p) => roots.add(path.resolve(p)));
  }
  if (process.env.MASTER_PROCESS_ROOT) {
    roots.add(path.resolve(process.env.MASTER_PROCESS_ROOT));
  }

  try {
    const parentDir = path.dirname(currentHub);
    if (fs.existsSync(parentDir)) {
      const siblings = fs.readdirSync(parentDir, { withFileTypes: true });
      for (const sib of siblings) {
        if (!sib.isDirectory()) continue;
        const sibPath = path.join(parentDir, sib.name);
        if (
          fs.existsSync(path.join(sibPath, 'package.json')) ||
          fs.existsSync(path.join(sibPath, '.git')) ||
          fs.existsSync(path.join(sibPath, '.ai')) ||
          fs.existsSync(path.join(sibPath, '.delivery')) ||
          fs.existsSync(path.join(sibPath, 'master.py'))
        ) {
          roots.add(path.resolve(sibPath));
        }
      }
    }
  } catch (_) {}

  return Array.from(roots);
}

function validateProjectPath(targetPath, fallbackRoot) {
  if (hasControlChars(targetPath)) throw controlCharError();
  const chosen = targetPath || fallbackRoot || process.cwd();
  const resolved = path.resolve(chosen);
  const canonical = canonicalPath(resolved);
  const normalized = canonical && normalizePath(canonical);
  const allowedRoots = getAllowedProjectRoots(fallbackRoot);
  const isAllowed = Boolean(canonical) && !isForeignDrivePath(chosen) && allowedRoots.some((allowed) => {
    const normAllowed = normalizePath(canonicalPath(allowed) || allowed);
    return normalized === normAllowed || normalized.startsWith(normAllowed + '/');
  });
  if (!isAllowed) {
    const err = new Error(`Target path '${targetPath}' is outside allowed project whitelist.`);
    err.statusCode = 403;
    throw err;
  }
  return resolved;
}

function runCommand(cmd, args, cwd, options = {}) {
  const timeout = options.timeout || 60000;
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { cwd, shell: false, windowsHide: true });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      try { proc.kill('SIGTERM'); } catch (_) {}
      setTimeout(() => { try { proc.kill('SIGKILL'); } catch (_) {} }, 2000);
    }, timeout);

    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    const mask = createMasker(); // Z-4: stdout/stderr đi qua HTTP (status, audit, probes...) không được lộ bí mật
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) {
        resolve({ code: 124, stdout: mask(stdout.trim()), stderr: mask((stderr + '\n[TIMEOUT] Subprocess timed out after 60s').trim()), ok: false, timedOut: true });
      } else {
        resolve({ code: code || 0, stdout: mask(stdout.trim()), stderr: mask(stderr.trim()), ok: code === 0, timedOut: false });
      }
    });
    proc.on('error', (err) => {
      clearTimeout(timer);
      resolve({ code: 1, stdout: '', stderr: mask(err.message), ok: false, timedOut: false });
    });
  });
}

module.exports = {
  getAllowedProjectRoots,
  validateProjectPath,
  detectMasterRoot,
  runCommand,
};
