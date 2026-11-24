/**
 * dashboard/services/playwrightConfigLoader.js
 * Đọc playwright.config.js cho dashboard mà không để NODE_ENV của TIẾN TRÌNH dashboard (vd.
 * "development", "production") làm core/config/env.js ném "Unknown NODE_ENV" -> danh sách project
 * rỗng -> Run theo Test Suite trả 400 mơ hồ. Dashboard luôn truyền NODE_ENV riêng cho tiến trình
 * test con (runnerService), nên ở đây chỉ cần một môi trường hợp lệ để liệt kê project.
 */
const fs = require('fs');
const path = require('path');

let lastConfigError = null;

function knownEnvironments() {
  try {
    return Object.keys(require('../../core/config/dashboardConfig').getDashboardConfig().environments || {});
  } catch (_) {
    return [];
  }
}

function loadConfigFile(configPath) {
  const known = knownEnvironments();
  const original = process.env.NODE_ENV;
  const needsOverride = original !== undefined && known.length > 0 && !known.includes(String(original).trim());
  if (needsOverride) delete process.env.NODE_ENV;
  try {
    delete require.cache[require.resolve(configPath)];
    lastConfigError = null;
    return require(configPath);
  } catch (err) {
    lastConfigError = `${path.basename(configPath)}: ${err.message}`;
    throw err;
  } finally {
    if (needsOverride) process.env.NODE_ENV = original;
  }
}

function loadPlaywrightConfig(root = process.env.QA_PROJECT_ROOT || process.cwd()) {
  try {
    const configPath = path.join(root, 'playwright.config.js');
    if (!fs.existsSync(configPath)) return null;
    return loadConfigFile(configPath);
  } catch (err) {
    console.error('Lỗi khi đọc cấu hình playwright.config.js:', err.message);
    return null;
  }
}

function getPlaywrightProjects(root = process.env.QA_PROJECT_ROOT || process.cwd()) {
  const config = loadPlaywrightConfig(root);
  if (!config || !Array.isArray(config.projects)) {
    return ['all'];
  }
  const projectNames = config.projects
    .map((p) => p.name)
    .filter((name) => name && name !== 'setup');
  return ['all', ...projectNames];
}

/** Lý do lần đọc config gần nhất thất bại (null nếu thành công/chưa đọc). */
const getLastConfigError = () => lastConfigError;

module.exports = { loadConfigFile, loadPlaywrightConfig, getPlaywrightProjects, getLastConfigError };
