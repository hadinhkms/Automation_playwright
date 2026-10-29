#!/usr/bin/env node

/**
 * scripts/update-framework.js
 *
 * Tải và cập nhật Dashboard Framework & Core Automation Engine cho các nhánh con / dự án vệ tinh.
 *
 * NGUYÊN TẮC BẤT BIẾN (ASSET SHIELD):
 * 1. CHỈ cập nhật Dashboard Framework, Core Engine dùng chung, Bin và Scripts hỗ trợ.
 * 2. TUYỆT ĐỐI KHÔNG ghi đè hoặc thay đổi tài sản nghiệp vụ riêng của dự án:
 *    - tests/, pages/, data/, requirements/, test-cases/
 *    - core/local/, core/config/dashboardConfig.json
 *    - decisions.json, qa.config.json, .env
 * 3. Hỗ trợ 2 nguồn tải (Multi-source Fallback):
 *    - Nguồn Local: Nếu có thư mục Hub cục bộ (D:\_Automation-Project) -> Đồng bộ trực tiếp siêu tốc.
 *    - Nguồn Remote: Nếu máy độc lập -> Fetch từ origin/main (hoặc upstream) và bóc tách riêng phần Framework.
 */

const fs = require('fs');
const path = require('path');
const {
  isExcludedPath,
  resolveFrameworkSource,
  extractRemoteFrameworkSnapshot,
  syncFrameworkAssets,
  ensureUpdateFrameworkScript,
  runFrameworkQualityGate,
  runUpdateFrameworkCli,
} = require('./lib/frameworkUpdateHelper');

let pullUpstreamQaSkills = null;
try {
  ({ pullUpstreamQaSkills } = require('./lib/qaUpstreamSync'));
} catch (_) {}

// Cấu hình các module Framework được phép cập nhật
const FRAMEWORK_MODULES = [
  { name: 'dashboard', src: 'dashboard', dest: 'dashboard', excludes: [] },
  {
    name: 'core',
    src: 'core',
    dest: 'core',
    excludes: [
      'core/local',
      'core/config/dashboardConfig.json',
      'core/fixtures/custom',
    ],
  },
  { name: 'bin', src: 'bin', dest: 'bin', excludes: [] },
  {
    name: 'scripts',
    src: 'scripts',
    dest: 'scripts',
    excludes: [
      'scripts/sync-satellites.js',
      'scripts/pre-sync-drift.js',
      'scripts/lib/sync-manifest.js',
      'scripts/lib/sync-manifest.test.js',
      'scripts/lib/satelliteSyncHelper.js',
      'scripts/lib/hubHistory.js',
      'scripts/lib/hubHistory.test.js',
    ],
  },
  {
    name: 'ai',
    src: 'ai',
    dest: 'ai',
    excludes: [
      'ai/shared/TEST_AUTOMATION_LESSONS.md',
      'ai/dashboard/AI_LESSONS.md',
      'ai/personal',
    ],
  },
  { name: 'tools', src: 'tools', dest: 'tools', excludes: [] },
  { name: 'skills', src: '.agents/skills', dest: '.agents/skills', excludes: [] },
];

const FRAMEWORK_ROOT_FILES = [
  'Start_Dashboard.bat',
  'Stop_Dashboard.bat',
  'AGENTS.md',
  'CLAUDE.md',
  'GEMINI.md',
  'QA_AI_RULES.md',
];

// Danh mục cấm kỵ: Tuyệt đối không được phép ghi đè
const FORBIDDEN_PATHS = [
  'tests',
  'pages',
  'data',
  'requirements',
  'test-cases',
  'decisions.json',
  'qa.config.json',
  '.env',
  'core/local',
  'core/config/dashboardConfig.json',
];

/**
 * Thực thi cập nhật Framework vào targetDir
 * @param {Object} options
 * @param {string} [options.targetDir] Thư mục dự án vệ tinh cần cập nhật
 * @param {boolean} [options.silent] Không in log console
 */
function updateFramework(options = {}) {
  const targetDir = path.resolve(options.targetDir || process.cwd());
  const logs = [];

  // Kiểm tra nếu đang chạy ngay tại Hub chính
  const isTargetHub = fs.existsSync(path.join(targetDir, 'scripts', 'sync-satellites.js'))
    && fs.existsSync(path.join(targetDir, 'ai', 'shared', 'SATELLITE_CORE_MIGRATION.md'));

  if (isTargetHub && (!options.targetDir || path.resolve(options.targetDir) === path.resolve('D:\\_Automation-Project'))) {
    const msg = 'Bạn đang đứng tại Hub Repository chính. Hub là nguồn phát hành Framework gốc, không cần tải về.';
    return { ok: true, isHub: true, updatedCount: 0, message: msg, logs: [msg] };
  }

  const source = options._testSourceDir
    ? { type: 'local', path: path.resolve(options._testSourceDir), label: 'Mock Hub Source' }
    : resolveFrameworkSource(targetDir);
  if (!source) {
    const err = 'Không tìm thấy nguồn Framework hợp lệ (Cần có Hub cục bộ hoặc remote Git origin).';
    return { ok: false, error: err, logs: [err] };
  }

  logs.push(`Nguồn cập nhật: ${source.label}`);
  logs.push(`Đích cập nhật  : ${targetDir}`);

  let tempExtractDir = null;

  try {
    let sourceRoot = null;

    if (source.type === 'local') {
      sourceRoot = source.path;
      if (pullUpstreamQaSkills && !options._testSourceDir) {
        try {
          const upstream = pullUpstreamQaSkills({ hubRoot: sourceRoot });
          if (upstream.available && upstream.updatedCount > 0) {
            logs.push(`Upstream QA Skills (${upstream.qaHubPath}): Đã cập nhật ${upstream.updatedCount} tệp vào Hub.`);
          }
        } catch (_) {}
      }
    } else if (source.type === 'git-origin-main') {
      tempExtractDir = extractRemoteFrameworkSnapshot(targetDir, logs);
      sourceRoot = tempExtractDir;
    }

    const totalUpdated = syncFrameworkAssets(sourceRoot, targetDir, FRAMEWORK_MODULES, FRAMEWORK_ROOT_FILES, logs);
    ensureUpdateFrameworkScript(targetDir, logs);
    const qgPassed = runFrameworkQualityGate(targetDir, logs);

    const successMsg = totalUpdated > 0
      ? `Đã cập nhật thành công ${totalUpdated} tệp Dashboard Framework!`
      : 'Dashboard Framework đã ở phiên bản mới nhất (không có tệp nào cần cập nhật).';

    logs.push(`✅ ${successMsg}`);

    return {
      ok: true,
      updatedCount: totalUpdated,
      message: successMsg,
      logs,
      qgPassed,
    };
  } catch (err) {
    const errorMsg = `Lỗi cập nhật Framework: ${err.message}`;
    logs.push(errorMsg);
    return {
      ok: false,
      error: errorMsg,
      message: errorMsg,
      logs,
    };
  } finally {
    if (tempExtractDir && fs.existsSync(tempExtractDir)) {
      try { fs.rmSync(tempExtractDir, { recursive: true, force: true }); } catch (_) {}
    }
  }
}

// CLI Execution
if (require.main === module) {
  runUpdateFrameworkCli(updateFramework);
}

module.exports = {
  FRAMEWORK_MODULES,
  FRAMEWORK_ROOT_FILES,
  FORBIDDEN_PATHS,
  updateFramework,
  resolveFrameworkSource,
  isExcludedPath,
};
