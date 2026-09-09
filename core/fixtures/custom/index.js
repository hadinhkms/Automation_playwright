const fs = require('fs');
const path = require('path');

const RESERVED_FIXTURE_NAMES = new Set([
  'test', 'expect', 'page', 'request', 'browser', 'context',
  'basePage', 'pages', 'workerUserData', 'authenticatedUser',
  'cleanupQueue', 'featureName', 'pageObjectsRoot', 'pageObjectsPlatform',
  'isMobile', 'viewport', 'browserName', 'storageState',
]);

/**
 * Dynamic Custom Fixtures Loader
 * Quét và nạp các custom fixtures do người dùng tạo:
 * 1. Ưu tiên 1 (Consumer-owned): fixtures/custom/*.fixture.js
 * 2. Ưu tiên 2 (Legacy engine fallback): core/fixtures/custom/*.fixture.js
 *
 * @param {string} [customDirOrRootDir]
 * @returns {Record<string, any>}
 */
function loadCustomFixtures(customDirOrRootDir = process.cwd()) {
  const fixtures = {};
  const originFiles = new Map(); // key -> filePath để phát hiện conflict

  const scanDir = (dirPath, isCanonical) => {
    if (!fs.existsSync(dirPath)) return;
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!entry.name.endsWith('.fixture.js') && !(entry.name.endsWith('.js') && entry.name !== 'index.js')) {
        continue;
      }

      const fullPath = path.join(dirPath, entry.name);
      try {
        const mod = require(fullPath);
        const registerFixture = (name, fnOrTuple) => {
          if (RESERVED_FIXTURE_NAMES.has(name)) {
            console.warn(`[CustomFixtures Warning] Fixture '${name}' trong file '${entry.name}' trùng từ khóa bảo vệ hệ thống. Bỏ qua.`);
            return;
          }

          if (originFiles.has(name)) {
            const prevFile = originFiles.get(name);
            if (prevFile !== fullPath) {
              console.warn(
                `[CustomFixtures Conflict] Phát hiện xung đột tên fixture '${name}' giữa:\n` +
                `  1. ${prevFile}\n` +
                `  2. ${fullPath}\n` +
                `Bản canonical hoặc bản nạp trước được giữ nguyên.`
              );
              return;
            }
          }

          fixtures[name] = fnOrTuple;
          originFiles.set(name, fullPath);
        };

        if (typeof mod === 'function' || Array.isArray(mod)) {
          const fixName = path.basename(entry.name, '.fixture.js').replace(/\.js$/, '');
          registerFixture(fixName, mod);
        } else if (mod && typeof mod === 'object') {
          for (const [key, val] of Object.entries(mod)) {
            if (typeof val === 'function' || Array.isArray(val)) {
              registerFixture(key, val);
            }
          }
        }
      } catch (err) {
        console.warn(`[CustomFixtures Warning] Không thể nạp custom fixture tại '${entry.name}': ${err.message}`);
      }
    }
  };

  // 1. Kiểm tra nếu truyền project root hoặc một thư mục fixture cụ thể
  if (fs.existsSync(customDirOrRootDir)) {
    const stat = fs.statSync(customDirOrRootDir);
    if (stat.isDirectory()) {
      let root = customDirOrRootDir;
      const normalized = customDirOrRootDir.replace(/\\/g, '/');
      if (normalized.endsWith('/core/fixtures/custom')) {
        root = path.resolve(customDirOrRootDir, '..', '..', '..');
      } else if (normalized.endsWith('/fixtures/custom')) {
        root = path.resolve(customDirOrRootDir, '..', '..');
      }

      const canonicalDir = path.join(root, 'fixtures', 'custom');
      const legacyDir = path.join(root, 'core', 'fixtures', 'custom');

      if (fs.existsSync(canonicalDir) || fs.existsSync(legacyDir)) {
        scanDir(canonicalDir, true);
        scanDir(legacyDir, false);
      }

      // Nếu customDirOrRootDir là một thư mục test tạm thời độc lập (không phải canonical/legacy)
      if (customDirOrRootDir !== canonicalDir && customDirOrRootDir !== legacyDir) {
        scanDir(customDirOrRootDir, true);
      }
    }
  }

  // Luôn dự phòng quét __dirname nếu chưa quét
  if (__dirname !== customDirOrRootDir && fs.existsSync(__dirname)) {
    scanDir(__dirname, false);
  }

  return fixtures;
}

const customFixtures = loadCustomFixtures();

module.exports = {
  customFixtures,
  loadCustomFixtures,
  RESERVED_FIXTURE_NAMES,
};
