'use strict';
/**
 * Shared fixture & Git/tree-hash helpers cho bộ test của Learner Engine (L01 .. L16).
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const REAL_DEFECT_MD = fs.readFileSync(
  path.join(REPO_ROOT, '.agents/skills/qa-logic-gaps/references/defect-heuristics-catalog.md'),
  'utf8',
);
const REAL_PA_MD = fs.readFileSync(
  path.join(REPO_ROOT, '.agents/skills/qa-logic-gaps/references/playwright-antipatterns-catalog.md'),
  'utf8',
);

function createTempRepo(options = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-learner-test-'));
  const refDir = path.join(dir, '.agents', 'skills', 'qa-logic-gaps', 'references');
  fs.mkdirSync(refDir, { recursive: true });
  fs.writeFileSync(path.join(refDir, 'defect-heuristics-catalog.md'), options.defectMd || REAL_DEFECT_MD, 'utf8');
  fs.writeFileSync(path.join(refDir, 'playwright-antipatterns-catalog.md'), options.paMd || REAL_PA_MD, 'utf8');

  const manifest = options.manifest || {
    version: '1.0.0',
    ship: [{ path: '.agents', reason: 'Skills chung' }],
    seed: [{ path: 'qa.config.json', reason: 'Config layout' }],
    own: [
      { path: 'requirements', reason: 'Business req', hubModule: 'requirements' },
      { path: 'test-cases', reason: 'Business tc', hubModule: 'test-cases' },
      { path: 'decisions.json', reason: 'Decisions' },
    ],
  };
  fs.writeFileSync(path.join(dir, 'sync-manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

  if (options.qaConfig) {
    fs.writeFileSync(path.join(dir, 'qa.config.json'), JSON.stringify(options.qaConfig, null, 2), 'utf8');
  }

  const reqDir = path.join(dir, (options.qaConfig && options.qaConfig.requirementsDir) || 'requirements');
  const tcDir = path.join(dir, (options.qaConfig && options.qaConfig.testCasesDir) || 'test-cases');
  const pwDir = path.join(dir, (options.qaConfig && options.qaConfig.projectDir) || 'playwright', 'tests', 'auth');
  fs.mkdirSync(reqDir, { recursive: true });
  fs.mkdirSync(tcDir, { recursive: true });
  fs.mkdirSync(pwDir, { recursive: true });

  return dir;
}

function initGitRepo(dir) {
  const run = (args) => {
    const r = spawnSync('git', args, { cwd: dir, shell: false, encoding: 'utf8', windowsHide: true });
    if (r.status !== 0) {
      throw new Error(`git ${args.join(' ')} failed: ${r.stderr}`);
    }
    return r.stdout.trim();
  };
  run(['init']);
  run(['config', 'user.email', 'qa-test@example.local']);
  run(['config', 'user.name', 'QA Test Runner']);
  return { run };
}

function hashDirectoryTree(dir) {
  const files = [];
  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name === '.git') continue;
      const full = path.join(current, entry.name);
      const rel = path.relative(dir, full).replace(/\\/g, '/');
      if (entry.isDirectory()) walk(full);
      else {
        const bytes = fs.readFileSync(full);
        const h = crypto.createHash('sha256').update(bytes).digest('hex');
        files.push(`${rel}:${h}`);
      }
    }
  }
  walk(dir);
  files.sort();
  return crypto.createHash('sha256').update(files.join('\n')).digest('hex');
}

module.exports = {
  REPO_ROOT,
  REAL_DEFECT_MD,
  REAL_PA_MD,
  createTempRepo,
  initGitRepo,
  hashDirectoryTree,
};

