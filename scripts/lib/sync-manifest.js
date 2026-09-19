'use strict';

/**
 * Nguồn sự thật DUY NHẤT cho cấu hình Hub-to-Spoke sync.
 *
 * `scripts/sync-satellites.js` (ghi) và `scripts/pre-sync-drift.js` (chỉ đọc) cùng
 * nạp module này, nên bản mô phỏng drift không bao giờ lệch khỏi hành vi sync thật.
 * Đặc biệt quan trọng với logic `excludes`: một bản mô phỏng bỏ qua excludes sẽ báo
 * sai hàng loạt file (vd. core/local, core/config/dashboardConfig.json).
 */

const path = require('path');

const HUB_ROOT = path.resolve(__dirname, '..', '..');

const SATELLITES = [
  {
    name: 'Vieclam24h-Automation_JS',
    repo: 'hadtv-ctrl/Vieclam24h-Automation_JS',
    branch: 'main',
    localPath: 'D:\\_SieuVietGroup',
  },
  {
    name: 'Automation_Carthings',
    repo: 'hadinhkms/Automation_Carthings',
    branch: 'main',
    localPath: 'D:\\_CarThings\\Automation_Carthings',
  },
];

/**
 * QUY TẮC BẤT BIẾN (HUB-TO-SPOKE ARCHITECTURE):
 * - data/, tests/, pages/, requirements/, test-cases/ TUYỆT ĐỐI KHÔNG ĐƯỢC ĐỒNG BỘ từ Hub sang Vệ tinh.
 *   requirements/ và test-cases/ là business riêng của từng dự án, không phải tài sản của Hub.
 * - Mỗi dự án vệ tinh (Vieclam24h, CarThings, v.v.) sở hữu tập Test Data và Test Scripts
 *   riêng biệt theo nghiệp vụ dự án đó. Không bao giờ ghi đè hay đẩy data của Hub sang vệ tinh.
 */
const FORBIDDEN_SYNC_MODULES = ['data', 'tests', 'pages', 'requirements', 'test-cases'];

const MODULES_TO_SYNC = [
  { src: 'dashboard', dest: 'dashboard' },
  {
    src: 'core',
    dest: 'core',
    // 'core/local' là ĐIỂM NỐI DUY NHẤT cho code riêng của từng dự án vệ tinh.
    // Hub sở hữu 100% phần còn lại của core/; mọi mở rộng riêng phải nằm trong core/local/
    // để không bao giờ bị ghi đè. KHÔNG thêm từng file riêng lẻ vào danh sách này.
    excludes: [
      'core/local',
      'core/config/dashboardConfig.json',
      'core/fixtures/custom',
    ], // Không ghi đè vùng riêng của dự án, config riêng và custom fixtures legacy
  },
  { src: 'bin', dest: 'bin' },
  {
    src: 'scripts',
    dest: 'scripts',
    // Công cụ vận hành Hub, vệ tinh không cần và không được nhận.
    excludes: [
      'scripts/sync-satellites.js',
      'scripts/sync-from-core.js',
      'scripts/pre-sync-drift.js',
      'scripts/lib/sync-manifest.js',
      'scripts/lib/sync-manifest.test.js',
      'scripts/lib/hubHistory.js',
      'scripts/lib/hubHistory.test.js',
    ],
  },
  {
    src: 'ai',
    dest: 'ai',
    // Hub sở hữu PROMPT (AI_PROMPTS.md, DASHBOARD_AI_PROMPT.md) — sửa ở Hub thì vệ tinh nhận.
    // Nhưng BÀI HỌC là nhật ký riêng của từng dự án: mỗi repo tự giữ bản của mình,
    // Hub không bao giờ ghi đè. Bài học áp dụng cho mọi dự án thì đưa vào file prompt.
    excludes: [
      'ai/shared/TEST_AUTOMATION_LESSONS.md',
      'ai/dashboard/AI_LESSONS.md',
    ],
  },
  { src: 'tools', dest: 'tools' },
];

// File ở gốc repo thuộc về TỪNG dự án: Hub không bao giờ được đẩy chúng đi.
// decisions.json là sổ quyết định do dashboard ghi (PUT /api/qa/decision) — đưa nó vào
// ROOT_FILES_TO_SYNC sẽ khiến quyết định của dự án này ghi đè lên dự án khác.
const PROJECT_OWNED_ROOT_FILES = ['decisions.json', 'qa.config.json', '.env'];

const ROOT_FILES_TO_SYNC = [
  'Start_Dashboard.bat',
  'Stop_Dashboard.bat',
  // Entry-point prompt cho AI: khung chung của Hub, không phải của riêng dự án.
  // Bài học riêng của từng dự án nằm ở .ai/learning/ (không bao giờ được sync).
  'AGENTS.md',
  'CLAUDE.md',
  'GEMINI.md',
  'QA_AI_RULES.md',
];

// Bảo vệ an toàn: ngăn mọi hành vi vô tình thêm thư mục bị cấm vào danh sách sync.
// Bắt cả trường hợp lồng nhau, ví dụ { src: "docs/requirements" }, chứ không chỉ so sánh bằng.
const containsForbidden = (p) =>
  String(p || '')
    .split(/[\\/]+/)
    .some((seg) => FORBIDDEN_SYNC_MODULES.includes(seg));

function assertNoProjectOwnedRootFiles(files = ROOT_FILES_TO_SYNC) {
  const leaked = files.filter((f) => PROJECT_OWNED_ROOT_FILES.includes(f));
  if (leaked.length) {
    throw new Error(
      `VI PHẠM NGUYÊN TẮC: ${leaked.join(', ')} thuộc về từng dự án, không được đồng bộ từ Hub!`,
    );
  }
}

function assertNoForbiddenModules(modules = MODULES_TO_SYNC) {
  if (modules.some((m) => containsForbidden(m.src) || containsForbidden(m.dest))) {
    throw new Error(
      `VI PHẠM NGUYÊN TẮC: ${FORBIDDEN_SYNC_MODULES.join(', ')} không được phép đồng bộ sang vệ tinh!`,
    );
  }
}

/** Chuyển excludes tương đối của module thành đường dẫn tuyệt đối trong repo đích. */
function resolveExcludes(targetDir, mod) {
  return (mod.excludes || []).map((e) => path.join(targetDir, e));
}

/**
 * Vị ngữ loại trừ dùng chung. `destPath` là đường dẫn ĐÍCH (trong repo vệ tinh),
 * `excludes` là danh sách tuyệt đối do resolveExcludes() tạo ra.
 * Áp dụng cho CẢ file lẫn thư mục, và phải được gọi TRƯỚC khi đệ quy vào thư mục.
 */
function isExcluded(destPath, excludes) {
  return excludes.some((ex) => destPath.toLowerCase().endsWith(path.normalize(ex).toLowerCase()));
}

module.exports = {
  HUB_ROOT,
  SATELLITES,
  FORBIDDEN_SYNC_MODULES,
  MODULES_TO_SYNC,
  ROOT_FILES_TO_SYNC,
  containsForbidden,
  assertNoForbiddenModules,
  assertNoProjectOwnedRootFiles,
  PROJECT_OWNED_ROOT_FILES,
  resolveExcludes,
  isExcluded,
};
