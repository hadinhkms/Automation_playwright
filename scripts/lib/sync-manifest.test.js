/**
 * Kiểm thử hợp đồng Hub-to-Spoke sync: predicate exclude + hiệu lực thực tế của core/local.
 *
 * File này (và sync-manifest.js, sync-satellites.js, pre-sync-drift.js) nằm trong excludes
 * của module `scripts`, nên không bị đẩy sang vệ tinh.
 *
 * Chạy: node --test scripts/lib/sync-manifest.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  HUB_ROOT,
  MODULES_TO_SYNC,
  resolveExcludes,
  isExcluded,
  containsForbidden,
  assertNoForbiddenModules,
} = require('./sync-manifest');

// An toàn vì sync-satellites.js đã có guard require.main === module; require không chạy sync.
const { copyDirRecursive } = require('../sync-satellites');

const TARGET = path.join('D:', '\\fake-satellite');
const coreModule = MODULES_TO_SYNC.find((m) => m.src === 'core');
const coreExcludes = resolveExcludes(TARGET, coreModule);
const dest = (...p) => path.join(TARGET, ...p);

test('core module khai báo đúng MỘT điểm nối core/local', () => {
  assert.ok(coreModule.excludes.includes('core/local'));
});

test('thư mục core/local bị loại trừ (chặn TRƯỚC khi đệ quy)', () => {
  assert.equal(isExcluded(dest('core', 'local'), coreExcludes), true);
});

test('config riêng và custom fixtures vẫn được loại trừ', () => {
  assert.equal(isExcluded(dest('core', 'config', 'dashboardConfig.json'), coreExcludes), true);
  assert.equal(isExcluded(dest('core', 'fixtures', 'custom'), coreExcludes), true);
});

test('phần còn lại của core/ KHÔNG bị loại trừ — Hub vẫn cập nhật được', () => {
  assert.equal(isExcluded(dest('core', 'utils', 'commonUtils.js'), coreExcludes), false);
  assert.equal(isExcluded(dest('core', 'config', 'dashboardConfig.js'), coreExcludes), false);
  assert.equal(isExcluded(dest('core', 'utils'), coreExcludes), false);
});

test('exclude không khớp nhầm tên na ná', () => {
  assert.equal(isExcluded(dest('core', 'locales'), coreExcludes), false);
  assert.equal(isExcluded(dest('core', 'localUtils.js'), coreExcludes), false);
  assert.equal(isExcluded(dest('core', 'config', 'dashboardConfig.json.bak'), coreExcludes), false);
});

test('công cụ vận hành riêng của Hub không bị đẩy sang vệ tinh', () => {
  const ex = resolveExcludes(TARGET, MODULES_TO_SYNC.find((m) => m.src === 'scripts'));
  for (const f of ['sync-satellites.js', 'pre-sync-drift.js']) {
    assert.equal(isExcluded(dest('scripts', f), ex), true, f);
  }
  for (const f of ['sync-manifest.js', 'sync-manifest.test.js']) {
    assert.equal(isExcluded(dest('scripts', 'lib', f), ex), true, f);
  }
  assert.equal(isExcluded(dest('scripts', 'check-framework-structure.js'), ex), false);
});

test('ai: Hub giữ prompt, dự án giữ lesson', () => {
  const ex = resolveExcludes(TARGET, MODULES_TO_SYNC.find((m) => m.src === 'ai'));

  // Bài học là nhật ký riêng của từng dự án -> không bao giờ ghi đè.
  assert.equal(isExcluded(dest('ai', 'shared', 'TEST_AUTOMATION_LESSONS.md'), ex), true);
  assert.equal(isExcluded(dest('ai', 'dashboard', 'AI_LESSONS.md'), ex), true);

  // Prompt là của Hub -> sửa ở Hub thì vệ tinh phải nhận được.
  assert.equal(isExcluded(dest('ai', 'shared', 'AI_PROMPTS.md'), ex), false);
  assert.equal(isExcluded(dest('ai', 'dashboard', 'DASHBOARD_AI_PROMPT.md'), ex), false);
  assert.equal(isExcluded(dest('ai', 'shared', 'SATELLITE_CORE_MIGRATION.md'), ex), false);
  assert.equal(isExcluded(dest('ai', 'README.md'), ex), false);
});

test('sync KHÔNG ghi đè vĩnh viễn git identity của repo vệ tinh', () => {
  const src = fs.readFileSync(path.join(HUB_ROOT, 'scripts', 'sync-satellites.js'), 'utf8');
  // `git config user.name ...` ghi thẳng vào .git/config của vệ tinh và tồn tại mãi,
  // khiến mọi commit sau đó của con người cũng bị gán cho bot.
  assert.equal(/execSync\('git config user\.(name|email)/.test(src), false);
  assert.ok(src.includes('-c user.name='), 'phải dùng `git -c` cho từng lệnh');
});

test('guard FORBIDDEN bắt cả path lồng nhau và dấu phân cách Windows', () => {
  assert.equal(containsForbidden('docs/requirements'), true);
  assert.equal(containsForbidden('docs\\tests'), true);
  assert.equal(containsForbidden('test-cases'), true);
  assert.equal(containsForbidden('core'), false);
  assert.equal(containsForbidden('dashboard/testing-utils'), false);
  assert.doesNotThrow(() => assertNoForbiddenModules());
});

// --- Hiệu lực thực tế: chạy chính copyDirRecursive() lên một vệ tinh giả trong thư mục tạm ---

function makeFakeSatellite() {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'fake-satellite-'));
  fs.mkdirSync(path.join(target, 'core', 'local'), { recursive: true });
  fs.mkdirSync(path.join(target, 'core', 'config'), { recursive: true });
  fs.writeFileSync(
    path.join(target, 'core', 'local', 'commonUtils.local.js'),
    "module.exports = { projectOnlyHelper: () => 'from-local' };\n",
    'utf8',
  );
  fs.writeFileSync(path.join(target, 'core', 'config', 'dashboardConfig.json'), '{"environments":{}}\n', 'utf8');
  return target;
}

const runCoreSync = (target) => copyDirRecursive(
  path.join(HUB_ROOT, 'core'),
  path.join(target, 'core'),
  resolveExcludes(target, coreModule),
);

test('sync KHÔNG chạm vào core/local của vệ tinh', () => {
  const target = makeFakeSatellite();
  try {
    const localFile = path.join(target, 'core', 'local', 'commonUtils.local.js');
    const before = fs.readFileSync(localFile, 'utf8');
    runCoreSync(target);
    assert.equal(fs.readFileSync(localFile, 'utf8'), before);
    assert.equal(fs.readFileSync(path.join(target, 'core', 'config', 'dashboardConfig.json'), 'utf8'), '{"environments":{}}\n');
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
  }
});

test('file Hub đặt trong core/local KHÔNG bao giờ tới vệ tinh (hệ quả cố ý)', () => {
  assert.ok(fs.existsSync(path.join(HUB_ROOT, 'core', 'local', 'README.md')));
  const target = makeFakeSatellite();
  try {
    runCoreSync(target);
    assert.equal(fs.existsSync(path.join(target, 'core', 'local', 'README.md')), false);
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
  }
});

test('Hub VẪN cập nhật được phần còn lại của core/ (không đóng băng commonUtils)', () => {
  const target = makeFakeSatellite();
  try {
    runCoreSync(target);
    const synced = path.join(target, 'core', 'utils', 'commonUtils.js');
    assert.ok(fs.existsSync(synced));
    assert.equal(
      fs.readFileSync(synced, 'utf8'),
      fs.readFileSync(path.join(HUB_ROOT, 'core', 'utils', 'commonUtils.js'), 'utf8'),
    );
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
  }
});

test('require(sync-satellites.js) không tự chạy sync', () => {
  const src = fs.readFileSync(path.join(HUB_ROOT, 'scripts', 'sync-satellites.js'), 'utf8');
  assert.ok(src.includes('require.main === module'));
});
