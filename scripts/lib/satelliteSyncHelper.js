'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
};

/**
 * Tự động phân giải đường dẫn cục bộ của vệ tinh mà không phụ thuộc vào một đường dẫn tuyệt đối duy nhất.
 * Hỗ trợ làm việc trên nhiều máy tính, ổ đĩa khác nhau (C:, D:, E:...) và tên thư mục khác nhau.
 */
function resolveSatellitePath(sat, hubRoot) {
  // 1. Biến môi trường tường minh
  const envKey = sat.envVar || `SATELLITE_${sat.name.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}_PATH`;
  if (process.env[envKey] && fs.existsSync(process.env[envKey])) {
    return path.resolve(process.env[envKey]);
  }
  if (process.env.QA_SATELLITES_DIR) {
    const fromBase = path.join(process.env.QA_SATELLITES_DIR, sat.name);
    if (fs.existsSync(fromBase)) return path.resolve(fromBase);
  }

  const candidates = [];
  if (sat.candidates) candidates.push(...sat.candidates);
  if (sat.localPath) candidates.push(sat.localPath);

  // 2. Thư mục đồng cấp (anh em) tương đối với HUB_ROOT
  const parentDir = path.dirname(hubRoot);
  const normName = String(sat.name || '').toLowerCase();
  if (normName.includes('vieclam24h') || normName.includes('sieuviet')) {
    candidates.push(
      path.join(parentDir, '_SV_Automation'),
      path.join(parentDir, '_SieuVietGroup'),
      path.join(parentDir, 'Vieclam24h-Automation_JS'),
      path.join(parentDir, 'Vieclam24h'),
      path.join(parentDir, 'SieuVietGroup')
    );
  } else if (normName.includes('carthings')) {
    candidates.push(
      path.join(parentDir, 'Carthings', '_automation_carthings'),
      path.join(parentDir, '_automation_carthings'),
      path.join(parentDir, '_CarThings', 'Automation_Carthings'),
      path.join(parentDir, 'Automation_Carthings'),
      path.join(parentDir, 'Carthings', 'Automation_Carthings'),
      path.join(parentDir, 'Carthings'),
      path.join(parentDir, '_CarThings')
    );
  }

  // 3. Kiểm tra các ứng viên trên đĩa (chỉ nhận thư mục là code repo thực thụ)
  for (const cand of candidates) {
    if (cand && fs.existsSync(cand)) {
      const isRepo = fs.existsSync(path.join(cand, 'package.json')) || fs.existsSync(path.join(cand, '.git'));
      if (isRepo) {
        return path.resolve(cand);
      }
    }
  }

  // 4. Quét tự động các thư mục anh em đối chiếu git remote URL
  try {
    if (fs.existsSync(parentDir)) {
      const entries = fs.readdirSync(parentDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const entryPath = path.join(parentDir, entry.name);
        const gitConfigPath = path.join(entryPath, '.git', 'config');
        if (fs.existsSync(gitConfigPath)) {
          const configContent = fs.readFileSync(gitConfigPath, 'utf8');
          if (sat.repo && configContent.toLowerCase().includes(sat.repo.toLowerCase())) {
            return path.resolve(entryPath);
          }
        }
      }
    }
  } catch (_) {}

  // 5. Fallback về đường dẫn đầu tiên hoặc mặc định
  return path.resolve(sat.localPath || path.join(parentDir, sat.name));
}

function mergeHubMpScripts(hubRoot, targetDir) {
  const hubPkgPath = path.join(hubRoot, 'package.json');
  const targetPkgPath = path.join(targetDir, 'package.json');
  if (!fs.existsSync(hubPkgPath) || !fs.existsSync(targetPkgPath)) return 0;
  try {
    const hubPkg = JSON.parse(fs.readFileSync(hubPkgPath, 'utf8'));
    const targetPkg = JSON.parse(fs.readFileSync(targetPkgPath, 'utf8'));
    const hubScripts = hubPkg.scripts || {};
    targetPkg.scripts = targetPkg.scripts || {};
    let pkgModified = false;
    for (const [k, v] of Object.entries(hubScripts)) {
      if (k.startsWith('mp:') && targetPkg.scripts[k] !== v) {
        targetPkg.scripts[k] = v;
        pkgModified = true;
      }
    }
    if (pkgModified) {
      fs.writeFileSync(targetPkgPath, JSON.stringify(targetPkg, null, 2) + '\n', 'utf8');
      return 1;
    }
  } catch (_) {}
  return 0;
}

function prepareSatelliteWorkingDir(sat, { isCI, token }) {
  if (!isCI && fs.existsSync(sat.localPath)) {
    return { workingDir: sat.localPath, isTempDir: false };
  }
  if (!token) {
    console.error(`${colors.red}❌ Cần có SYNC_PAT hoặc GITHUB_TOKEN để đồng bộ từ xa tới ${sat.repo}${colors.reset}`);
    return null;
  }
  const workingDir = fs.mkdtempSync(path.join(os.tmpdir(), `sync-${sat.name}-`));
  const cloneUrl = `https://x-access-token:${token}@github.com/${sat.repo}.git`;
  console.log('📥 Đang clone repository từ GitHub về thư mục tạm...');
  try {
    execSync(`git clone --depth 1 --branch ${sat.branch} ${cloneUrl} "${workingDir}"`, {
      stdio: 'inherit',
      timeout: 60000,
    });
    return { workingDir, isTempDir: true };
  } catch (err) {
    console.error(`${colors.red}❌ Không thể clone ${sat.repo}: ${err.message}${colors.reset}`);
    try { fs.rmSync(workingDir, { recursive: true, force: true }); } catch (_) {}
    return null;
  }
}

function reportSatelliteDrift({ sat, blocked, skipModules, overwritten, alwaysDeliveredModules, moduleOf, partialSatellites }) {
  if (overwritten.length) {
    console.warn(`${colors.yellow}⚠️  ${sat.name}: ghi đè ${overwritten.length} file trong ${alwaysDeliveredModules.join(', ')}/ — vùng Hub sở hữu hoàn toàn.${colors.reset}`);
    for (const f of blocked.filter((x) => overwritten.includes(x.file))) {
      console.warn(`${colors.yellow}   ${f.file} (${f.ownedLines.length} dòng riêng sẽ mất)${colors.reset}`);
      for (const l of f.ownedLines.slice(0, 3)) {
        console.warn(`${colors.dim}      | ${l.length > 110 ? `${l.slice(0, 107)}...` : l}${colors.reset}`);
      }
    }
    console.warn(`${colors.dim}   Dữ liệu riêng của dự án không được đặt trong dashboard/; xem ai/shared/SATELLITE_CORE_MIGRATION.md.${colors.reset}`);
  }

  const heldBack = blocked.filter((f) => skipModules.includes(moduleOf(f.file)));
  if (heldBack.length) {
    console.error(`${colors.yellow}${colors.bright}⛔ ${sat.name}: giữ lại module ${skipModules.join(', ')} — có nội dung riêng sẽ bị xoá.${colors.reset}`);
    for (const f of heldBack) {
      console.error(`${colors.red}   ${f.file} (${f.ownedLines.length} dòng)${colors.reset}`);
      for (const l of f.ownedLines.slice(0, 3)) {
        console.error(`${colors.dim}      | ${l.length > 110 ? `${l.slice(0, 107)}...` : l}${colors.reset}`);
      }
      if (f.ownedLines.length > 3) console.error(`${colors.dim}      | ... còn ${f.ownedLines.length - 3} dòng${colors.reset}`);
    }
    console.error(`${colors.yellow}   → Xem ai/shared/SATELLITE_CORE_MIGRATION.md để chuyển phần riêng sang core/local/.${colors.reset}`);
    partialSatellites.push({ name: sat.name, skipModules });
  }
}

function verifySatelliteAfterSync({ sat, workingDir, isTempDir, verifyDashboardFeatures, failedSatellites }) {
  const featureCheck = verifyDashboardFeatures(workingDir);
  if (featureCheck.errors.length) {
    console.error(`${colors.red}${colors.bright}❌ ${sat.name}: dashboard thiếu mảnh sau khi sync — KHÔNG commit.${colors.reset}`);
    for (const e of featureCheck.errors) {
      console.error(`${colors.red}   [${e.view}] ${e.part}: ${e.detail}${colors.reset}`);
    }
    failedSatellites.push(sat.name);
    if (isTempDir) {
      try { fs.rmSync(workingDir, { recursive: true, force: true }); } catch (_) {}
    }
    return false;
  }
  console.log(`${colors.green}✅ ${featureCheck.views.length} view dashboard đủ mảnh tại vệ tinh.${colors.reset}`);

  const checkScript = path.join(workingDir, 'scripts', 'check-framework-structure.js');
  if (fs.existsSync(checkScript)) {
    try {
      const qgOutput = execSync(`node "${checkScript}"`, { cwd: workingDir, encoding: 'utf8', windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
      console.log(`${colors.green}✅ Quality Gate ĐẠT:${colors.reset} ${qgOutput.trim()}`);
    } catch (qgErr) {
      console.error(`${colors.red}⚠️ Cảnh báo Quality Gate tại ${sat.name}:${colors.reset}\n${qgErr.stdout || qgErr.message}`);
    }
  }
  return true;
}

function finalizeSatelliteSyncRun({ partialSatellites, failedSatellites }) {
  if (partialSatellites.length) {
    console.log(`${colors.yellow}${colors.bright}-----------------------------------------------------${colors.reset}`);
    console.log(`${colors.yellow}${colors.bright}  ĐỒNG BỘ MỘT PHẦN${colors.reset}`);
    for (const item of partialSatellites) {
      console.log(`${colors.yellow}  ${item.name}: giữ lại ${item.skipModules.join(', ')}${colors.reset}`);
    }
    console.log(`${colors.yellow}${colors.bright}-----------------------------------------------------${colors.reset}`);
  }

  if (failedSatellites.length) {
    console.error(`\n${colors.red}${colors.bright}=====================================================${colors.reset}`);
    console.error(`${colors.red}${colors.bright}  ĐỒNG BỘ THẤT BẠI: ${failedSatellites.join(', ')}${colors.reset}`);
    console.error(`${colors.red}${colors.bright}=====================================================${colors.reset}\n`);
    throw new Error(`Vệ tinh chưa nhận được bản mới: ${failedSatellites.join(', ')}`);
  }

  if (partialSatellites.length) {
    const names = partialSatellites.map((i2) => `${i2.name} (${i2.skipModules.join('+')})`).join('; ');
    console.log(`${colors.yellow}⚠️  Chưa đồng bộ trọn vẹn: ${names}${colors.reset}`);
    process.exitCode = 2;
  }

  console.log(`\n${colors.green}${colors.bright}=====================================================${colors.reset}`);
  console.log(`${colors.green}${colors.bright}  HOÀN TẤT TOÀN BỘ TIẾN TRÌNH ĐỒNG BỘ CÁC VỆ TINH   ${colors.reset}`);
  console.log(`${colors.green}${colors.bright}=====================================================${colors.reset}\n`);
}

module.exports = {
  colors,
  resolveSatellitePath,
  mergeHubMpScripts,
  prepareSatelliteWorkingDir,
  reportSatelliteDrift,
  verifySatelliteAfterSync,
  finalizeSatelliteSyncRun,
};

