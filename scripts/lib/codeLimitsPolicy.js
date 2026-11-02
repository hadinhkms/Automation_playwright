'use strict';

/**
 * Chính sách giới hạn kích thước code & phân loại role cho Automation Framework.
 * Đồng bộ 1-1 với Master Process `quality-policy.json` (trần cứng 100% & vùng vàng 80%).
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DEFAULT_POLICY = {
  extensions: ['.js', '.cjs', '.mjs', '.jsx', '.ts', '.tsx', '.mts', '.cts', '.vue', '.py'],
  excludedFolders: [
    'node_modules', '.git', 'dist', 'build', '.next', '.nuxt', 'coverage', '.ai',
    'scratch', '_scratch', 'out', 'vendor', 'venv', '.venv', '__pycache__', '.pytest_cache',
    'playwright-report', 'test-results', 'blob-report', 'evidence', '.auth', '.cache',
  ],
  limits: {
    test: 800,
    component: 150,
    hook: 150,
    service: 200,
    utils: 150,
    module: 250,
  },
  maxLineLength: 500,
  maxAvgLineLength: 100,
  maxFileBytes: 150000,
};

const AUTOMATION_SCOPE_PREFIXES = ['tests/', 'pages/', 'core/local/'];

const TEST_NAME_RE = /(^test_|_test\.)|\.(test|spec)\.[cm]?[jt]sx?$/i;
const TEST_DIR_RE = /(^|\/)(tests?|specs?|e2e|__tests__)(\/|$)/i;
const TEST_CASE_CALL_RE = /\b(?:def test_|async def test_|class Test|describe\(|it\(|test\()\b/;
const COMPONENT_EXTS = new Set(['.tsx', '.jsx', '.vue']);
const COMPONENT_DIR_RE = /(^|\/)components(\/|$)/;
const HOOK_NAME_RE = /^use[A-Z]/;
const HOOK_DIR_RE = /(^|\/)hooks(\/|$)/;
const SERVICE_NAME_RE = /(^|[.\-_])(service|api|client)([.\-_]|$)/i;
const SERVICE_DIR_RE = /(^|\/)services(\/|$)/i;
const UTILS_NAME_RE = /(^|[.\-_])(utils?|helpers?)([.\-_]|$)/i;
const UTILS_DIR_RE = /(^|\/)(utils?|helpers?)(\/|$)/i;

const ISOLATED_SCRATCH_DIR_RE = /(^|\/)(_?scratch|tests\/scratch)(\/|$)/i;
const FORBIDDEN_SCRATCH_FILE_PATTERNS = [
  /\.ai[-_.]test\./i,
  /\.ai\.spec\./i,
  /\.scratch\./i,
  /(^|\/)(draft_|temp_|ai_test|ai-test)[^/]*$/i,
];

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
  } catch (_) {
    return null;
  }
}

function loadQualityPolicy(root) {
  const policy = {
    extensions: [...DEFAULT_POLICY.extensions],
    excludedFolders: [...DEFAULT_POLICY.excludedFolders],
    limits: { ...DEFAULT_POLICY.limits },
    maxLineLength: DEFAULT_POLICY.maxLineLength,
    maxAvgLineLength: DEFAULT_POLICY.maxAvgLineLength,
    maxFileBytes: DEFAULT_POLICY.maxFileBytes,
  };
  for (const rel of ['.quality-policy.json', '.ai/quality-policy.json', 'quality-policy.json']) {
    const custom = readJsonIfExists(path.join(root, rel));
    if (!custom || !custom.code) continue;
    const { code } = custom;
    if (code.limits && typeof code.limits === 'object') {
      for (const [role, val] of Object.entries(code.limits)) {
        if (Number.isInteger(val) && val > 0) policy.limits[role] = val;
      }
    }
    for (const key of ['maxLineLength', 'maxAvgLineLength', 'maxFileBytes']) {
      if (Number.isInteger(code[key]) && code[key] > 0) policy[key] = code[key];
    }
    break;
  }
  return policy;
}

function loadSizeExemptions(root) {
  const map = new Map();
  for (const rel of ['size-exemptions.json', '.ai/size-exemptions.json', '.size-exemptions.json']) {
    const parsed = readJsonIfExists(path.join(root, rel));
    const list = Array.isArray(parsed) ? parsed : (parsed && parsed.exemptions);
    if (!Array.isArray(list)) continue;
    for (const entry of list) {
      if (entry && typeof entry.path === 'string') {
        map.set(entry.path.replace(/\\/g, '/'), entry);
      }
    }
    break;
  }
  return map;
}

function checkFileExemption(relPath, rawBuffer, lineCount, exemptions, todayIso) {
  const entry = exemptions.get(relPath.replace(/\\/g, '/'));
  if (!entry) return null;
  if (entry.expires && String(entry.expires) < todayIso) return null;
  if (Number.isInteger(entry.maxLines) && lineCount > entry.maxLines) return null;
  if (typeof entry.sha256 === 'string') {
    const actualSha = crypto.createHash('sha256').update(rawBuffer).digest('hex');
    if (actualSha.toLowerCase() !== entry.sha256.toLowerCase()) return null;
  }
  return entry.reason || 'exempted';
}

function determineFileRole(relPath, content = '') {
  const posixPath = relPath.replace(/\\/g, '/');
  const baseName = path.posix.basename(posixPath);
  const ext = path.posix.extname(baseName).toLowerCase();

  if (TEST_NAME_RE.test(baseName) || TEST_DIR_RE.test(posixPath)) {
    if (!TEST_NAME_RE.test(baseName) && !TEST_CASE_CALL_RE.test(content)) {
      return 'module';
    }
    return 'test';
  }
  if (COMPONENT_EXTS.has(ext) || COMPONENT_DIR_RE.test(posixPath)) return 'component';
  if (HOOK_NAME_RE.test(baseName) || HOOK_DIR_RE.test(posixPath)) return 'hook';
  if (SERVICE_NAME_RE.test(baseName) || SERVICE_DIR_RE.test(posixPath)) return 'service';
  if (UTILS_NAME_RE.test(baseName) || UTILS_DIR_RE.test(posixPath)) return 'utils';
  return 'module';
}

function isForbiddenScratchFile(relPath) {
  const posixPath = relPath.replace(/\\/g, '/');
  if (ISOLATED_SCRATCH_DIR_RE.test(posixPath)) return false;
  return FORBIDDEN_SCRATCH_FILE_PATTERNS.some((re) => re.test(posixPath));
}

function isAutomationProjectPath(relPath) {
  const posixPath = relPath.replace(/\\/g, '/');
  return AUTOMATION_SCOPE_PREFIXES.some((prefix) => posixPath.startsWith(prefix));
}

function splitGuidanceForRole(role, relPath) {
  const posixPath = relPath.replace(/\\/g, '/');
  if (role === 'test') {
    return 'Tách spec theo nhóm luồng nghiệp vụ/AC (vd: *.smoke.spec.js, *.negative.spec.js), giữ @REQ-xxx ở test.describe và TC-xxx - AC-yyy (< 640 dòng/file).';
  }
  if (posixPath.startsWith('pages/')) {
    return 'Tách Page Object theo màn hình con hoặc khối UI độc lập (Modal, FilterBar, FormSection) kế thừa BasePage (< 200 dòng/file).';
  }
  if (role === 'service') {
    return 'Tách service/API client theo từng domain resource vào core/local/ (< 160 dòng/file).';
  }
  if (role === 'utils') {
    return 'Tách helper/utils trong core/local/ theo miền chức năng đơn lẻ (< 120 dòng/file).';
  }
  return 'Phân rã module/fixture thành các file nhỏ đơn trách nhiệm dưới ngưỡng vùng vàng 80% (< 200 dòng/file).';
}

module.exports = {
  DEFAULT_POLICY,
  AUTOMATION_SCOPE_PREFIXES,
  loadQualityPolicy,
  loadSizeExemptions,
  checkFileExemption,
  determineFileRole,
  isForbiddenScratchFile,
  isAutomationProjectPath,
  splitGuidanceForRole,
};

