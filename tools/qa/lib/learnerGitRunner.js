'use strict';
/**
 * Thực thi Git an toàn (argv array, shell: false, timeout) và xác định base SHA / danh sách tệp thay đổi.
 */

const { spawnSync } = require('node:child_process');
const { GIT_TIMEOUT_MS, LearnerError } = require('./learnerConstants');
const { classifyRepoFile } = require('./learnerPaths');

function runGit(root, args, options = {}) {
  const runner = options.gitRunner || spawnSync;
  const res = runner('git', args, {
    cwd: root,
    shell: false,
    timeout: options.gitTimeoutMs || GIT_TIMEOUT_MS,
    maxBuffer: 16 * 1024 * 1024,
    encoding: 'buffer',
    input: options.stdinBuffer || undefined,
    windowsHide: true,
  });

  if (res.error) {
    if (res.error.code === 'ETIMEDOUT') {
      throw new LearnerError(
        `Lệnh git quá thời gian chờ (${GIT_TIMEOUT_MS}ms): git ${args.join(' ')}`,
        'GIT_TIMEOUT',
      );
    }
    throw new LearnerError(`Không chạy được git: ${res.error.message}`, 'GIT_EXEC_ERROR');
  }
  const stdout = res.stdout ? res.stdout.toString('utf8') : '';
  const stderr = res.stderr ? res.stderr.toString('utf8') : '';
  return { status: res.status, stdout, stderr, rawStdout: res.stdout || Buffer.alloc(0) };
}

function resolveDiffBaseSha(root, options = {}) {
  const checkRepo = runGit(root, ['rev-parse', '--is-inside-work-tree'], options);
  if (checkRepo.status !== 0 || checkRepo.stdout.trim() !== 'true') {
    throw new LearnerError(
      `Thư mục "${root}" không phải là một Git repository hợp lệ: ${checkRepo.stderr.trim()}`,
      'NOT_A_GIT_REPO',
    );
  }

  let baseSha = null;
  let scopeMode = 'working-tree';
  const sinceRef = options.since !== undefined && options.since !== null ? String(options.since).trim() : null;

  if (sinceRef !== null) {
    if (!sinceRef || sinceRef.startsWith('-')) {
      throw new LearnerError(`Giá trị --since không hợp lệ: "${options.since}"`, 'INVALID_SINCE_REF');
    }
    const rev = runGit(root, ['rev-parse', '--verify', '--end-of-options', `${sinceRef}^{commit}`], options);
    if (rev.status !== 0) {
      throw new LearnerError(
        `Không tìm thấy Git ref "${sinceRef}": ${rev.stderr.trim() || 'ref không tồn tại'}`,
        'UNKNOWN_GIT_REF',
      );
    }
    baseSha = rev.stdout.trim();
    scopeMode = 'since';
  } else {
    const headRev = runGit(root, ['rev-parse', '--verify', 'HEAD^{commit}'], options);
    if (headRev.status === 0 && headRev.stdout.trim()) {
      baseSha = headRev.stdout.trim();
      scopeMode = 'working-tree';
    } else {
      const emptyTree = runGit(root, ['hash-object', '-t', 'tree', '--stdin'], {
        ...options,
        stdinBuffer: Buffer.alloc(0),
      });
      if (emptyTree.status !== 0) {
        throw new LearnerError(`Không tạo được empty tree SHA: ${emptyTree.stderr.trim()}`, 'GIT_EMPTY_TREE_ERROR');
      }
      baseSha = emptyTree.stdout.trim();
      scopeMode = 'unborn-head';
    }
  }

  return { baseSha, scopeMode, sinceRef };
}

function listUntrackedAndChanged(root, baseSha, cfg, options = {}) {
  const pathspecs = [cfg.requirementsDir || 'requirements', cfg.testCasesDir || 'test-cases'];
  const projDir = cfg.projectDir || 'playwright';
  pathspecs.push(projDir === '.' ? '.' : projDir);

  const untrackedRes = runGit(
    root,
    ['ls-files', '--others', '--exclude-standard', '-z', '--', ...pathspecs],
    options,
  );
  const untrackedRaw = untrackedRes.rawStdout.toString('utf8').split('\0').filter(Boolean);
  const untrackedEligible = [];
  for (const uFile of untrackedRaw) {
    if (classifyRepoFile(uFile, cfg).eligible) untrackedEligible.push(uFile.replace(/\\/g, '/'));
  }

  const statusRes = runGit(
    root,
    ['diff', '--name-status', '--no-renames', '--no-ext-diff', '--no-color', '-z', baseSha, '--', ...pathspecs],
    options,
  );
  if (statusRes.status !== 0) {
    throw new LearnerError(`Lỗi khi lấy danh sách diff từ Git: ${statusRes.stderr.trim()}`, 'GIT_DIFF_ERROR');
  }

  const tokens = statusRes.rawStdout.toString('utf8').split('\0').filter(Boolean);
  const changedItems = [];
  for (let i = 0; i < tokens.length; i += 2) {
    const st = tokens[i];
    const filePath = tokens[i + 1];
    if (st && filePath) changedItems.push({ status: st[0], file: filePath.replace(/\\/g, '/') });
  }

  return { untrackedEligible, changedItems };
}

module.exports = {
  runGit,
  resolveDiffBaseSha,
  listUntrackedAndChanged,
};

