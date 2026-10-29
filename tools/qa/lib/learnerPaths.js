'use strict';
/**
 * Kiểm tra an toàn đường dẫn repo (chống symlink/junction traversal, kiểm tra vùng own)
 * và phân loại tệp nguồn phục vụ thu thập tín hiệu học tập.
 */

const fs = require('node:fs');
const path = require('node:path');
const { LearnerError } = require('./learnerConstants');
const { stripBomAndNormalizeLf } = require('./learnerText');

function resolveAndValidateRepoPath(root, relPath, options = {}) {
  const realRoot = fs.realpathSync(root);
  const targetAbs = path.resolve(realRoot, relPath);

  let probe = targetAbs;
  const tailSegments = [];
  while (!fs.existsSync(probe)) {
    const parent = path.dirname(probe);
    if (parent === probe) break;
    tailSegments.unshift(path.basename(probe));
    probe = parent;
  }
  const realExisting = fs.realpathSync(probe);
  const resolvedReal = tailSegments.length > 0 ? path.join(realExisting, ...tailSegments) : realExisting;

  const relFromRoot = path.relative(realRoot, resolvedReal).replace(/\\/g, '/');
  if (relFromRoot.startsWith('..') || path.isAbsolute(relFromRoot)) {
    throw new LearnerError(
      `Đường dẫn "${relPath}" trỏ ra ngoài phạm vi repo root (phát hiện symlink/junction hoặc path traversal).`,
      'PATH_ESCAPES_ROOT',
    );
  }

  if (options.requireOwn) {
    const manifestPath = path.join(realRoot, 'sync-manifest.json');
    if (fs.existsSync(manifestPath)) {
      let manifest;
      try {
        manifest = JSON.parse(stripBomAndNormalizeLf(fs.readFileSync(manifestPath, 'utf8')));
      } catch (err) {
        throw new LearnerError(`Không đọc được sync-manifest.json: ${err.message}`, 'INVALID_MANIFEST');
      }
      const ownPaths = (manifest.own || []).map((item) =>
        String(item.path || '').replace(/\\/g, '/').replace(/\/+$/, ''),
      );
      const normalizedRel = relFromRoot.replace(/\/+$/, '');
      const isInsideOwn = ownPaths.some(
        (ownP) => ownP && (normalizedRel === ownP || normalizedRel.startsWith(`${ownP}/`)),
      );
      if (!isInsideOwn) {
        throw new LearnerError(
          `Đường dẫn lưu trữ bài học "${relFromRoot}" không thuộc vùng "own" trong sync-manifest.json. Cấm ghi bài học vào vùng ship/seed.`,
          'STORAGE_NOT_IN_OWN',
        );
      }
    }
  }

  return { absPath: resolvedReal, relPath: relFromRoot };
}

function classifyRepoFile(relPath, cfg) {
  const p = String(relPath || '').replace(/\\/g, '/').replace(/^\.\//, '');
  const reqDir = (cfg.requirementsDir || 'requirements').replace(/\\/g, '/').replace(/\/+$/, '');
  const tcDir = (cfg.testCasesDir || 'test-cases').replace(/\\/g, '/').replace(/\/+$/, '');
  const projDir = (cfg.projectDir || 'playwright').replace(/\\/g, '/').replace(/\/+$/, '');
  const ignorePrefixes = (cfg.ignoreSpecs || []).map((x) => x.replace(/\\/g, '/').replace(/\/+$/, ''));

  if (p === `${tcDir}/traceability.md`) {
    return { eligible: false, skipReason: 'generated-traceability' };
  }
  if (p === `${tcDir}/_learning` || p.startsWith(`${tcDir}/_learning/`)) {
    return { eligible: false, skipReason: 'learning-overlay-artifact' };
  }
  if (ignorePrefixes.some((pref) => pref && (p === pref || p.startsWith(`${pref}/`)))) {
    return { eligible: false, skipReason: 'ignored-spec-prefix' };
  }

  if (p.startsWith(`${reqDir}/`) && p.toLowerCase().endsWith('.md')) {
    if (path.basename(p).toLowerCase() === 'readme.md') return { eligible: false, skipReason: 'readme-doc' };
    return { eligible: true, kind: 'requirement' };
  }
  if (p.startsWith(`${tcDir}/`) && p.toLowerCase().endsWith('.md')) {
    if (path.basename(p).toLowerCase() === 'readme.md') return { eligible: false, skipReason: 'readme-doc' };
    return { eligible: true, kind: 'test-case' };
  }
  const inProj = projDir === '.' ? true : p.startsWith(`${projDir}/`);
  if (inProj && /\.spec\.[jt]sx?$/i.test(p) && !/\.setup\.(?:spec\.)?[jt]sx?$/i.test(p)) {
    return { eligible: true, kind: 'playwright-spec' };
  }

  return { eligible: false, skipReason: null };
}

module.exports = {
  resolveAndValidateRepoPath,
  classifyRepoFile,
};

