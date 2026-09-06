const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { execSync } = require('child_process');

const ENGINE_DIR = path.resolve(__dirname, '..', '..');
const PACKAGE_JSON_PATH = path.join(ENGINE_DIR, 'package.json');

/**
 * Lấy thông tin phiên bản hiện tại từ package.json của Engine
 */
function getCurrentVersion() {
  try {
    if (fs.existsSync(PACKAGE_JSON_PATH)) {
      const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));
      return pkg.version || '1.0.0';
    }
  } catch (_) {}
  return '1.0.0';
}

/**
 * So sánh 2 chuỗi phiên bản dạng SemVer (vd: 1.2.0 vs 1.1.0)
 * Trả về: > 0 nếu v1 > v2, < 0 nếu v1 < v2, 0 nếu bằng nhau
 */
function compareSemVer(v1, v2) {
  const parse = (v) => String(v).replace(/^v/i, '').split('.').map((x) => parseInt(x, 10) || 0);
  const parts1 = parse(v1);
  const parts2 = parse(v2);
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}

/**
 * Gửi HTTP/HTTPS request với timeout
 */
function fetchJson(targetUrl, timeoutMs = 6000) {
  return new Promise((resolve, reject) => {
    try {
      const urlObj = new URL(targetUrl);
      const client = urlObj.protocol === 'https:' ? https : http;
      const req = client.get(
        urlObj,
        {
          headers: {
            'User-Agent': 'QA-Automation-Dashboard-Updater/1.0',
            'Accept': 'application/json',
          },
          timeout: timeoutMs,
        },
        (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            return resolve(fetchJson(res.headers.location, timeoutMs));
          }
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject(new Error(`HTTP Status ${res.statusCode}`));
          }
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            try {
              resolve(JSON.parse(data));
            } catch (err) {
              reject(new Error('Phản hồi từ máy chủ không phải JSON hợp lệ'));
            }
          });
        }
      );

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Kết nối tới máy chủ cập nhật bị timeout (quá thời gian chờ).'));
      });

      req.on('error', (err) => {
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Kiểm tra xem có bản cập nhật mới hay không
 * @param {Object} options
 * @param {string} [options.updateUrl] URL manifest hoặc GitHub API release
 * @param {string} [options.githubRepo] Ví dụ: "hadinhkms/Automation_playwright_SV"
 */
async function checkForUpdates(options = {}) {
  const currentVersion = getCurrentVersion();
  const githubRepo = options.githubRepo || 'hadinhkms/Automation_playwright_SV';
  const updateUrl = options.updateUrl || `https://api.github.com/repos/${githubRepo}/releases/latest`;

  try {
    const releaseData = await fetchJson(updateUrl);
    const latestVersion = releaseData.tag_name ? releaseData.tag_name.replace(/^v/i, '') : (releaseData.version || currentVersion);
    const hasUpdate = compareSemVer(latestVersion, currentVersion) > 0;

    return {
      ok: true,
      hasUpdate,
      currentVersion,
      latestVersion,
      releaseName: releaseData.name || `Phiên bản v${latestVersion}`,
      releaseNotes: releaseData.body || releaseData.description || 'Bản cập nhật tối ưu hóa tính năng và sửa lỗi hệ thống.',
      publishedAt: releaseData.published_at || new Date().toISOString(),
      downloadUrl: releaseData.html_url || `https://github.com/${githubRepo}`,
      isOffline: false,
    };
  } catch (err) {
    if (String(err.message).includes('404')) {
      return {
        ok: true,
        hasUpdate: false,
        currentVersion,
        latestVersion: currentVersion,
        isOffline: false,
        message: `Bạn đang sử dụng phiên bản mới nhất (v${currentVersion}). Chưa có bản phát hành mới trên máy chủ.`,
      };
    }
    // Trường hợp thực sự không có mạng (ENOTFOUND, ETIMEDOUT, timeout, etc.)
    return {
      ok: false,
      hasUpdate: false,
      currentVersion,
      latestVersion: currentVersion,
      isOffline: true,
      error: err.message,
      message: 'Không thể kết nối Internet hoặc máy chủ cập nhật bị quá hạn. Đang chạy ở chế độ ngoại tuyến.',
    };
  }
}

/**
 * Thực hiện lệnh cập nhật (Tùy theo cấu hình dự án là Git repo hay NPM package)
 */
function applyUpdate(options = {}) {
  const isGitRepo = fs.existsSync(path.join(ENGINE_DIR, '.git'));
  const log = [];

  try {
    if (isGitRepo) {
      log.push('Phát hiện chế độ Git repository. Đang kéo mã nguồn mới nhất (git pull)...');
      const pullOutput = execSync('git pull --ff-only', { cwd: ENGINE_DIR, encoding: 'utf8', timeout: 30000 });
      log.push(pullOutput.trim());
      log.push('Đang cập nhật dependencies...');
      try {
        const npmOutput = execSync('npm install --prefer-offline', { cwd: ENGINE_DIR, encoding: 'utf8', timeout: 60000 });
        log.push('Dependencies đã được cập nhật.');
      } catch (npmErr) {
        log.push('Cảnh báo npm install: ' + npmErr.message);
      }
    } else {
      log.push('Phát hiện chế độ NPM package. Đang chạy lệnh npm update...');
      const pkgName = options.packageName || '@hadinhkms/qa-engine';
      const updateOutput = execSync(`npm install ${pkgName}@latest`, { cwd: process.cwd(), encoding: 'utf8', timeout: 60000 });
      log.push(updateOutput.trim());
    }

    return {
      ok: true,
      message: 'Đã hoàn tất cập nhật phiên bản mới. Vui lòng khởi động lại Dashboard để áp dụng thay đổi.',
      logs: log,
      newVersion: getCurrentVersion(),
    };
  } catch (err) {
    return {
      ok: false,
      message: 'Cập nhật thất bại: ' + (err.stderr || err.message),
      logs: log,
      error: err.message,
    };
  }
}

module.exports = {
  getCurrentVersion,
  compareSemVer,
  checkForUpdates,
  applyUpdate,
};
