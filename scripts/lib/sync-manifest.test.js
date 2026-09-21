/**
 * Kiểm thử hợp đồng Hub-to-Spoke sync: predicate exclude + hiệu lực thực tế của core/local.
 *
 * File này (và sync-manifest.js, sync-satellites.js, pre-sync-drift.js) nằm trong excludes
 * của module `scripts`, nên không bị đẩy sang vệ tinh.
 *
 * Chạy: node --test scripts/lib/sync-manifest.test.js
 */
// master-process-disable-size-check: Comprehensive sync contract test suite covering Hub-to-Spoke predicates and package merges

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
  assertNoProjectOwnedRootFiles,
  ROOT_FILES_TO_SYNC,
  PROJECT_OWNED_ROOT_FILES,
  FORBIDDEN_SYNC_MODULES,
  moduleOf,
  modulesToSkip,
  filesOverwrittenAnyway,
  ALWAYS_DELIVERED_MODULES,
  ROOT_MODULE,
} = require('./sync-manifest');

// Dấu phân cách kiểu Windows, viết bằng mã ký tự để không phụ thuộc vào escape.
const SEP = String.fromCharCode(92);

// An toàn vì sync-satellites.js đã có guard require.main === module; require không chạy sync.
const { copyDirRecursive, syncToDirectory } = require('../sync-satellites');

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

test('file gốc thuộc về dự án không bao giờ được Hub đồng bộ', () => {
  assert.doesNotThrow(() => assertNoProjectOwnedRootFiles());
  assert.equal(ROOT_FILES_TO_SYNC.includes('decisions.json'), false);
  // Guard phải nổ nếu sau này có ai vô tình thêm vào.
  assert.throws(
    () => assertNoProjectOwnedRootFiles([...ROOT_FILES_TO_SYNC, 'decisions.json']),
    /decisions\.json/,
  );
});

test('KHÔNG file nào thuộc dự án lọt vào ROOT_FILES_TO_SYNC', () => {
  // decisions.json và qa.config.json chứa dữ liệu nghiệm thu của RIÊNG từng repo.
  // Đồng bộ chúng đi là lấy quyết định của dự án này đè lên dự án khác.
  for (const f of ['decisions.json', 'qa.config.json', '.env']) {
    assert.ok(PROJECT_OWNED_ROOT_FILES.includes(f), `${f} phải nằm trong danh sách loại trừ`);
    assert.equal(ROOT_FILES_TO_SYNC.includes(f), false, `${f} không được đồng bộ`);
  }
  assert.doesNotThrow(() => assertNoProjectOwnedRootFiles());

  // Guard phải nổ cho TẮT CẢ, không chỉ riêng decisions.json.
  for (const f of PROJECT_OWNED_ROOT_FILES) {
    assert.throws(
      () => assertNoProjectOwnedRootFiles([...ROOT_FILES_TO_SYNC, f]),
      (err) => err.message.includes(f),
      `thêm ${f} vào danh sách sync mà guard không nổ`,
    );
  }
});

test('KHÔNG module nào đi qua requirements/ hoặc test-cases/', () => {
  // Hai thư mục này là nghiệp vụ của riêng dự án. Mục QA chỉ ĐỌC chúng;
  // sync chạm vào là xoá tài liệu không có bản sao ở đâu khác.
  for (const dir of ['requirements', 'test-cases']) {
    assert.ok(FORBIDDEN_SYNC_MODULES.includes(dir), `${dir} phải nằm trong FORBIDDEN_SYNC_MODULES`);
  }

  for (const mod of MODULES_TO_SYNC) {
    for (const p of [mod.src, mod.dest]) {
      assert.equal(containsForbidden(p), false, `module ${p} đi qua thư mục bị cấm`);
    }
    // Cả excludes cũng không được nhắc tới hai thư mục đó: nếu phải exclude nghĩa là
    // ai đó đã định sync chúng.
    for (const ex of mod.excludes || []) {
      assert.equal(containsForbidden(ex), false, `exclude ${ex} cho thấy module đang trùm lên thư mục cấm`);
    }
  }
  assert.doesNotThrow(() => assertNoForbiddenModules());

  // Guard phải bắt cả trường hợp lồng nhau, không chỉ so bằng.
  assert.throws(() => assertNoForbiddenModules([{ src: 'docs/requirements', dest: 'docs/requirements' }]), /requirements/);
  assert.throws(() => assertNoForbiddenModules([{ src: 'ai', dest: 'ai/test-cases' }]), /test-cases/);
});

test('MỘT LƯỢT SYNC THẬT không chạm vào dữ liệu của dự án', () => {
  // Chạy chính syncToDirectory() lên một vệ tinh giả, rồi đối chiếu BYTE.
  // Đây là bằng chứng cuối cùng cho giao kèo "mã đi, nội dung ở lại": ba nhóm dữ liệu
  // dưới đây được bảo vệ bởi ba cơ chế KHÁC NHAU, nên phải kiểm cả ba cùng một lượt:
  //   requirements/, test-cases/  -> FORBIDDEN_SYNC_MODULES (không hề có trong MODULES_TO_SYNC)
  //   decisions.json              -> PROJECT_OWNED_ROOT_FILES (không có trong ROOT_FILES_TO_SYNC)
  //   core/config/dashboardConfig.json -> excludes của module core
  const NL = String.fromCharCode(10);
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-noclobber-'));
  const files = {
    'requirements/REQ-001-dang-nhap.md': ['# REQ-001 Đăng nhập', '', '- AC-001: nghiệp vụ riêng của dự án.', ''].join(NL),
    'test-cases/REQ-001.md': ['| REQ-001 | AC-001 | TC-001 | Candidate | - | P0 |', ''].join(NL),
    'decisions.json': ['{"version":1,"decisions":[{"id":"D-01","answer":{"confirmedBy":"Hà"}}]}', ''].join(NL),
    'core/config/dashboardConfig.json': ['{"environments":{},"qa":{"specs":"tests/e2e"}}', ''].join(NL),
  };
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(target, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, 'utf8');
  }
  const before = Object.fromEntries(
    Object.keys(files).map((rel) => [rel, fs.readFileSync(path.join(target, rel))]),
  );

  try {
    syncToDirectory(target);

    for (const rel of Object.keys(files)) {
      const full = path.join(target, rel);
      assert.ok(fs.existsSync(full), `${rel} bị xoá mất sau khi sync`);
      assert.ok(fs.readFileSync(full).equals(before[rel]), `${rel} bị thay đổi sau khi sync`);
    }

    // Không được tạo thêm file nào trong hai thư mục nghiệp vụ.
    assert.deepEqual(fs.readdirSync(path.join(target, 'requirements')), ['REQ-001-dang-nhap.md']);
    assert.deepEqual(fs.readdirSync(path.join(target, 'test-cases')), ['REQ-001.md']);

    // Đối trọng: sync phải thực sự có ghi gì đó, nếu không bài test này xanh vô nghĩa.
    assert.ok(fs.existsSync(path.join(target, 'dashboard', 'server.js')), 'sync phải giao dashboard/');
    assert.ok(
      fs.existsSync(path.join(target, 'dashboard', 'public', 'templates', 'qa.html')),
      'sync phải giao template của mục QA',
    );
    assert.ok(fs.existsSync(path.join(target, 'scripts', 'lib', 'qaTrace.js')), 'sync phải giao analyzer');
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
  }
});

test('moduleOf quy đúng đường dẫn về module chứa nó', () => {
  assert.equal(moduleOf('core/utils/commonUtils.js'), 'core');
  assert.equal(moduleOf('dashboard/routes/qaRoutes.js'), 'dashboard');
  assert.equal(moduleOf('scripts/lib/qaTrace.js'), 'scripts');
  assert.equal(moduleOf('core'), 'core', 'chính thư mục gốc của module');
  assert.equal(moduleOf('CLAUDE.md'), ROOT_MODULE);
  assert.equal(moduleOf(''), ROOT_MODULE);
});

test('moduleOf chấp nhận cả dấu phân cách kiểu Windows', () => {
  // pre-sync-drift trả đường dẫn đã chuẩn hoá, nhưng đừng để một dấu BS làm cả module
  // rơi vào nhóm (root) rồi âm thầm chặn toàn bộ file gốc.
  assert.equal(moduleOf('core' + SEP + 'utils' + SEP + 'commonUtils.js'), 'core');
});

test('moduleOf không nhầm module trùng tiền tố', () => {
  assert.equal(moduleOf('corejs/x.js'), ROOT_MODULE, 'corejs không phải core');
  assert.equal(moduleOf('dashboards/y.js'), ROOT_MODULE);
});

test('modulesToSkip gộp trùng và giữ đúng tập', () => {
  assert.deepEqual(modulesToSkip([]), []);
  assert.deepEqual(
    modulesToSkip(['core/a.js', 'core/b.js', 'ai/shared/x.md']),
    ['core', 'ai'],
  );
});

test('dashboard/ KHÔNG BAO GIỜ bị giữ lại, dù vệ tinh có nội dung riêng trong đó', () => {
  // dashboard/ không có exclude nào, tức mọi thứ trong đó được thiết kế để bị ghi đè.
  // Giữ nó lại vì drift là tự mâu thuẫn, và hậu quả là chặn vĩnh viễn mọi tính năng
  // dashboard mới tới vệ tinh — đúng thứ họ cần nhất.
  assert.deepEqual(ALWAYS_DELIVERED_MODULES, ['dashboard']);

  const blocked = [
    'dashboard/public/app.js',
    'dashboard/services/resourceService.js',
    'core/utils/commonUtils.js',
  ];
  const skip = modulesToSkip(blocked);
  assert.ok(!skip.includes('dashboard'), 'dashboard phải luôn được giao');
  assert.deepEqual(skip, ['core'], 'chỉ core bị giữ lại');

  // Chỉ một mình drift trong dashboard/ thì không giữ lại gì cả.
  assert.deepEqual(modulesToSkip(['dashboard/public/index.html']), []);
});

test('những gì sẽ bị ghi đè phải liệt kê được, không được mất trong im lặng', () => {
  // Đây chính là cái bẫy 7ad6984: ghi đè thì được, nhưng phải nói ra.
  const blocked = ['dashboard/public/app.js', 'core/utils/commonUtils.js', 'CLAUDE.md'];
  assert.deepEqual(filesOverwrittenAnyway(blocked), ['dashboard/public/app.js']);
  assert.deepEqual(filesOverwrittenAnyway([]), []);
  assert.deepEqual(filesOverwrittenAnyway(['core/x.js']), []);
});

test('nội dung riêng trong core/ KHÔNG được chặn dashboard/', () => {
  // Đây là lý do của cả cơ chế: 129 dòng helper trong core/ từng chặn vĩnh viễn
  // mọi tính năng dashboard mới tới vệ tinh.
  const skip = modulesToSkip([
    'core/utils/commonUtils.js',
    'core/utils/commonUtils.test.js',
    'core/config/dashboardConfig.js',
  ]);
  assert.deepEqual(skip, ['core']);
  assert.ok(!skip.includes('dashboard'), 'dashboard phải vẫn được giao');
  assert.ok(!skip.includes('scripts'), 'scripts phải vẫn được giao');
  assert.ok(!skip.includes(ROOT_MODULE), 'file gốc phải vẫn được giao');
});

test('syncToDirectory hợp nhất đúng các scripts mp:* vào package.json của vệ tinh và bảo toàn metadata riêng', () => {
  const tmpSatellite = fs.mkdtempSync(path.join(os.tmpdir(), 'satellite-test-'));
  try {
    const fakePkg = {
      name: 'Vieclam24h-Custom-Satellite',
      version: '3.4.1',
      dependencies: { lodash: '^4.17.21' },
      scripts: {
        test: 'playwright test',
        'custom:job': 'node scripts/custom.js',
      },
    };
    fs.writeFileSync(path.join(tmpSatellite, 'package.json'), JSON.stringify(fakePkg, null, 2), 'utf8');

    syncToDirectory(tmpSatellite);

    const merged = JSON.parse(fs.readFileSync(path.join(tmpSatellite, 'package.json'), 'utf8'));
    assert.equal(merged.name, 'Vieclam24h-Custom-Satellite');
    assert.equal(merged.version, '3.4.1');
    assert.deepEqual(merged.dependencies, { lodash: '^4.17.21' });
    assert.equal(merged.scripts['custom:job'], 'node scripts/custom.js');
    assert.ok(merged.scripts['mp:doctor'], 'mp:doctor phải được thêm vào');
    assert.ok(merged.scripts['mp:audit'], 'mp:audit phải được thêm vào');
    assert.ok(merged.scripts['mp:drift'], 'mp:drift phải được thêm vào');
    assert.ok(merged.scripts['mp:sync'], 'mp:sync phải được thêm vào');
  } finally {
    fs.rmSync(tmpSatellite, { recursive: true, force: true });
  }
});
