'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

function isExcludedPath(targetPath, excludes = []) {
  const normTarget = path.normalize(targetPath).toLowerCase();
  return excludes.some((ex) => {
    const normEx = path.normalize(ex).toLowerCase();
    return normTarget.endsWith(normEx)
      || normTarget.includes(`${path.sep}${normEx}${path.sep}`)
      || normTarget.endsWith(`${path.sep}${normEx}`);
  });
}

function copyDirRecursive(srcDir, destDir, excludes = [], logs = []) {
  if (!fs.existsSync(srcDir)) return 0;
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

  let updatedCount = 0;
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (isExcludedPath(destPath, excludes)) {
      continue;
    }

    if (entry.isDirectory()) {
      updatedCount += copyDirRecursive(srcPath, destPath, excludes, logs);
    } else {
      let isDifferent = true;
      if (fs.existsSync(destPath)) {
        const srcBuf = fs.readFileSync(srcPath);
        const destBuf = fs.readFileSync(destPath);
        if (srcBuf.equals(destBuf)) {
          isDifferent = false;
        }
      }
      if (isDifferent) {
        fs.copyFileSync(srcPath, destPath);
        updatedCount++;
        if (logs.length < 50) {
          logs.push(`Cập nhật: ${path.relative(process.cwd(), destPath).replace(/\\/g, '/')}`);
        }
      }
    }
  }

  return updatedCount;
}

/**
 * Tìm nguồn cập nhật Hub hợp lệ
 * @param {string} targetDir Thư mục vệ tinh hiện tại
 */
function resolveFrameworkSource(targetDir) {
  // 1. Kiểm tra nếu có Hub cục bộ (D:\_Automation-Project hoặc qua biến môi trường QA_HUB_PATH)
  const defaultLocalHub = process.env.QA_HUB_PATH || 'D:\\_Automation-Project';
  if (path.resolve(targetDir) !== path.resolve(defaultLocalHub)) {
    const hubDashboardServer = path.join(defaultLocalHub, 'dashboard', 'server.js');
    if (fs.existsSync(hubDashboardServer)) {
      return { type: 'local', path: defaultLocalHub, label: `Local Hub Repository (${defaultLocalHub})` };
    }
  }

  // 2. Kiểm tra nếu trong repo Git hiện tại có remote origin hoặc upstream
  try {
    const remotes = execSync('git remote -v', { cwd: targetDir, encoding: 'utf8', windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    if (remotes.includes('origin')) {
      return { type: 'git-origin-main', label: 'Remote origin/main (Đồng bộ qua GitHub)' };
    }
  } catch (_) {}

  return null;
}

function extractRemoteFrameworkSnapshot(targetDir, logs) {
  logs.push('Đang fetch origin/main từ remote...');
  execSync('git fetch origin main', { cwd: targetDir, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });

  const tempExtractDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fw-update-'));
  logs.push('Đang trích xuất snapshot Framework từ origin/main...');
  // Trích xuất qua git archive an toàn trên Windows với tar -xf - (tránh lỗi tape0)
  const candidatePaths = [
    'dashboard', 'core', 'bin', 'scripts', 'ai', 'tools', '.agents/skills',
    'Start_Dashboard.bat', 'Stop_Dashboard.bat',
    'AGENTS.md', 'CLAUDE.md', 'GEMINI.md', 'QA_AI_RULES.md',
  ];
  const existingPaths = [];
  for (const p of candidatePaths) {
    try {
      const out = execSync(`git ls-tree --name-only origin/main "${p}"`, {
        cwd: targetDir,
        encoding: 'utf8',
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();
      if (out) existingPaths.push(p);
    } catch (_) {}
  }
  const pathsArg = existingPaths.length ? existingPaths.join(' ') : 'dashboard core bin scripts ai';
  execSync(`git archive origin/main ${pathsArg} | tar -xf - -C "${tempExtractDir.replace(/\\/g, '/')}"`, {
    cwd: targetDir,
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return tempExtractDir;
}

function syncFrameworkAssets(sourceRoot, targetDir, modules, rootFiles, logs) {
  let totalUpdated = 0;

  // Tiến hành đồng bộ từng module Framework
  for (const mod of modules) {
    const srcModDir = path.join(sourceRoot, mod.src);
    const destModDir = path.join(targetDir, mod.dest);
    if (fs.existsSync(srcModDir)) {
      const count = copyDirRecursive(srcModDir, destModDir, mod.excludes, logs);
      totalUpdated += count;
      if (count > 0) {
        logs.push(`Module [${mod.name}]: Đã cập nhật ${count} tệp.`);
      }
    }
  }

  // Đồng bộ các file root
  for (const file of rootFiles) {
    const srcFile = path.join(sourceRoot, file);
    const destFile = path.join(targetDir, file);
    if (fs.existsSync(srcFile)) {
      let isDiff = true;
      if (fs.existsSync(destFile)) {
        isDiff = !fs.readFileSync(srcFile).equals(fs.readFileSync(destFile));
      }
      if (isDiff) {
        fs.copyFileSync(srcFile, destFile);
        totalUpdated++;
        logs.push(`Cập nhật tệp gốc: ${file}`);
      }
    }
  }

  return totalUpdated;
}

function ensureUpdateFrameworkScript(targetDir, logs) {
  const pkgPath = path.join(targetDir, 'package.json');
  if (!fs.existsSync(pkgPath)) return;
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    pkg.scripts = pkg.scripts || {};
    if (!pkg.scripts['update:framework']) {
      pkg.scripts['update:framework'] = 'node scripts/update-framework.js';
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
      logs.push('Đã đăng ký lệnh "npm run update:framework" vào package.json.');
    }
  } catch (_) {}
}

function runFrameworkQualityGate(targetDir, logs) {
  const checkScript = path.join(targetDir, 'scripts', 'check-framework-structure.js');
  if (!fs.existsSync(checkScript)) return true;
  try {
    const qgRes = execSync(`node "${checkScript}"`, { cwd: targetDir, encoding: 'utf8', windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    logs.push(`Quality Gate ĐẠT: ${qgRes.trim()}`);
    return true;
  } catch (_) {
    logs.push('Quality Gate lưu ý: Phát hiện cảnh báo trong mã kiểm thử riêng của dự án (không ảnh hưởng cập nhật Dashboard Framework).');
    return false;
  }
}

function runUpdateFrameworkCli(updateFrameworkFn) {
  console.log(`${colors.cyan}${colors.bright}=====================================================${colors.reset}`);
  console.log(`${colors.cyan}${colors.bright}  QA STUDIO - TẢI CẬP NHẬT DASHBOARD FRAMEWORK       ${colors.reset}`);
  console.log(`${colors.cyan}${colors.bright}=====================================================${colors.reset}\n`);

  const result = updateFrameworkFn();

  if (result.logs && result.logs.length) {
    for (const log of result.logs) {
      console.log(`  > ${log}`);
    }
  }

  console.log('');
  if (result.ok) {
    console.log(`${colors.green}${colors.bright}✅ ${result.message}${colors.reset}`);
    if (result.updatedCount > 0) {
      console.log(`${colors.yellow}💡 Vui lòng tải lại (F5) giao diện Dashboard để trải nghiệm các tính năng mới.${colors.reset}\n`);
    }
  } else {
    console.error(`${colors.red}${colors.bright}❌ ${result.error}${colors.reset}\n`);
    process.exit(1);
  }
}

module.exports = {
  colors,
  isExcludedPath,
  copyDirRecursive,
  resolveFrameworkSource,
  extractRemoteFrameworkSnapshot,
  syncFrameworkAssets,
  ensureUpdateFrameworkScript,
  runFrameworkQualityGate,
  runUpdateFrameworkCli,
};
