'use strict';
/**
 * Shared Git repo fixture & CLI subprocess runner cho bộ integration tests của tools/qa/index.js.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync, execFileSync } = require('node:child_process');
const { seedInitialRepoFiles, applySecondCommitChanges } = require('./cliRepoSeedData');

const QA_DIR = path.resolve(__dirname, '..');
const WORKSPACE_ROOT = path.resolve(QA_DIR, '..', '..');
const CLI_SOURCE = path.join(QA_DIR, 'index.js');
const LIB_DIR = path.join(QA_DIR, 'lib');
const BOUNDARY_SOURCE = path.join(WORKSPACE_ROOT, 'tools', 'boundary', 'index.js');
const REFS_DIR = path.join(WORKSPACE_ROOT, '.agents', 'skills', 'qa-logic-gaps', 'references');

const ANSI_REGEX = /\u001b\[[0-9;]*m/;

function git(cwd, args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function hashDirectoryState(dir) {
  const entries = [];
  function walk(curr) {
    const items = fs.readdirSync(curr, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const item of items) {
      if (item.name === '.git') continue;
      const full = path.join(curr, item.name);
      const rel = path.relative(dir, full).replace(/\\/g, '/');
      if (item.isDirectory()) {
        entries.push(`D:${rel}`);
        walk(full);
      } else if (item.isFile()) {
        const hash = crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex');
        entries.push(`F:${rel}:${hash}`);
      }
    }
  }
  walk(dir);
  return crypto.createHash('sha256').update(entries.join('\n')).digest('hex');
}

function createCliRepo(t, options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-cli-p3-'));
  t.after(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  const targetQaDir = path.join(root, 'tools', 'qa');
  const targetLibDir = path.join(targetQaDir, 'lib');
  fs.mkdirSync(targetLibDir, { recursive: true });
  fs.copyFileSync(CLI_SOURCE, path.join(targetQaDir, 'index.js'));
  for (const f of fs.readdirSync(LIB_DIR)) {
    if (f.endsWith('.js') && !f.endsWith('.test.js')) {
      fs.copyFileSync(path.join(LIB_DIR, f), path.join(targetLibDir, f));
    }
  }

  const targetBoundaryDir = path.join(root, 'tools', 'boundary');
  fs.mkdirSync(targetBoundaryDir, { recursive: true });
  if (fs.existsSync(BOUNDARY_SOURCE)) {
    fs.copyFileSync(BOUNDARY_SOURCE, path.join(targetBoundaryDir, 'index.js'));
  }

  const targetRefsDir = path.join(root, '.agents', 'skills', 'qa-logic-gaps', 'references');
  fs.mkdirSync(targetRefsDir, { recursive: true });
  for (const f of fs.readdirSync(REFS_DIR)) {
    fs.copyFileSync(path.join(REFS_DIR, f), path.join(targetRefsDir, f));
  }

  const { reqDir, specDir } = seedInitialRepoFiles(root, options);

  if (options.initGit !== false) {
    git(root, ['init']);
    git(root, ['config', 'user.name', 'QA Test Bot']);
    git(root, ['config', 'user.email', 'qa-bot@example.local']);
    git(root, ['config', 'commit.gpgsign', 'false']);
    git(root, ['add', '.']);
    git(root, ['commit', '-m', 'Initial baseline commit']);

    if (options.createSecondCommit !== false) {
      applySecondCommitChanges(reqDir, specDir);
      git(root, ['add', '.']);
      git(root, ['commit', '-m', 'Add boundary rate limit rule and replace weak toBeTruthy assertion']);
    }
  }

  return root;
}

function runCli(root, args = [], opts = {}) {
  const cliPath = path.join(root, 'tools', 'qa', 'index.js');
  const env = { ...process.env, ...opts.env };
  if (opts.forceColor) {
    delete env.NO_COLOR;
    env.FORCE_COLOR = '1';
  }
  const res = spawnSync(process.execPath, [cliPath, ...args], {
    cwd: opts.cwd || root,
    encoding: 'utf8',
    env,
  });
  assert.equal(res.error, undefined, `Lỗi spawn CLI: ${res.error}`);
  return {
    status: res.status,
    stdout: res.stdout || '',
    stderr: res.stderr || '',
  };
}

module.exports = {
  WORKSPACE_ROOT,
  ANSI_REGEX,
  git,
  hashDirectoryState,
  createCliRepo,
  runCli,
};
