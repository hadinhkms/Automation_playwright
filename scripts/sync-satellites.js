#!/usr/bin/env node

/**
 * Hub-to-Spoke Satellite Sync Script
 * Syncs Dashboard, Core Engine, Scripts, and AI Guidelines to Satellite Repositories:
 * 1. hadtv-ctrl/Vieclam24h-Automation_JS
 * 2. hadinhkms/Automation_Carthings
 */

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

const {
  HUB_ROOT,
  SATELLITES,
  MODULES_TO_SYNC,
  ROOT_FILES_TO_SYNC,
  assertNoForbiddenModules,
  assertNoProjectOwnedRootFiles,
  resolveExcludes,
  isExcluded,
} = require('./lib/sync-manifest');
const { verify: verifyDashboardFeatures } = require('./verify-dashboard-features');
const { auditSatellite } = require('./pre-sync-drift');
const { createHubHistoryProbe } = require('./lib/hubHistory');

// Cấu hình sync (SATELLITES / MODULES_TO_SYNC / ROOT_FILES_TO_SYNC / excludes) nằm ở
// scripts/lib/sync-manifest.js để scripts/pre-sync-drift.js mô phỏng đúng hành vi tại đây.
assertNoForbiddenModules();
assertNoProjectOwnedRootFiles();

function copyDirRecursive(srcDir, destDir, excludes = []) {
  if (!fs.existsSync(srcDir)) return 0;
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

  let copied = 0;
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    // Kiểm tra loại trừ TRƯỚC khi đệ quy: một thư mục bị exclude (vd. core/local)
    // phải được bỏ qua trọn vẹn, không duyệt vào bên trong.
    if (isExcluded(destPath, excludes)) {
      continue;
    }

    if (entry.isDirectory()) {
      copied += copyDirRecursive(srcPath, destPath, excludes);
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
        copied++;
      }
    }
  }

  return copied;
}

function syncToDirectory(targetDir) {
  let updatedCount = 0;

  for (const mod of MODULES_TO_SYNC) {
    const srcPath = path.join(HUB_ROOT, mod.src);
    const destPath = path.join(targetDir, mod.dest);
    const excludes = resolveExcludes(targetDir, mod);
    updatedCount += copyDirRecursive(srcPath, destPath, excludes);
  }

  for (const file of ROOT_FILES_TO_SYNC) {
    const srcFile = path.join(HUB_ROOT, file);
    const destFile = path.join(targetDir, file);
    if (fs.existsSync(srcFile)) {
      let isDifferent = true;
      if (fs.existsSync(destFile)) {
        isDifferent = !fs.readFileSync(srcFile).equals(fs.readFileSync(destFile));
      }
      if (isDifferent) {
        fs.copyFileSync(srcFile, destFile);
        updatedCount++;
      }
    }
  }

  return updatedCount;
}

async function run() {
  console.log(`${colors.cyan}${colors.bright}=====================================================${colors.reset}`);
  console.log(`${colors.cyan}${colors.bright}  HUB-TO-SPOKE AUTOMATED FRAMEWORK SYNCHRONIZATION   ${colors.reset}`);
  console.log(`${colors.cyan}${colors.bright}=====================================================${colors.reset}\n`);

  const token = process.env.SYNC_PAT || process.env.GH_PAT || process.env.GITHUB_TOKEN;
  const isCI = Boolean(process.env.CI || process.argv.includes('--ci'));

  console.log(`📌 Chế độ thực thi: ${isCI ? 'CI (GitHub Actions)' : 'Local Machine'}`);

  // Vệ tinh nào không qua được kiểm chứng tính năng thì tiến trình phải kết thúc bằng lỗi,
  // nếu không CI vẫn xanh trong khi nhánh con nhận về một dashboard hỏng.
  const failedSatellites = [];

  // Cổng drift chạy THEO TỪNG VỆ TINH, ngay trước khi ghi vào vệ tinh đó. Trước đây cổng
  // chạy một lần cho tất cả rồi chặn cả job: một nhánh chưa migrate là nhánh còn lại cũng
  // không bao giờ nhận được tính năng mới, dù nó hoàn toàn sạch.
  const history = createHubHistoryProbe(HUB_ROOT);
  if (!history.available) {
    console.log(`${colors.yellow}⚠️  Không tra được lịch sử Hub: ${history.reason}${colors.reset}`);
    console.log(`${colors.dim}   Mọi khác biệt sẽ bị coi là nội dung riêng, nên sync có thể dừng ở mọi vệ tinh.${colors.reset}`);
  }

  for (const sat of SATELLITES) {
    console.log(`\n-----------------------------------------------------`);
    console.log(`🚀 Đồng bộ vệ tinh: ${colors.green}${sat.name}${colors.reset} (${sat.repo})`);

    let workingDir = sat.localPath;
    let isTempDir = false;

    if (isCI || !fs.existsSync(sat.localPath)) {
      if (!token) {
        console.error(`${colors.red}❌ Cần có SYNC_PAT hoặc GITHUB_TOKEN để đồng bộ từ xa tới ${sat.repo}${colors.reset}`);
        continue;
      }

      isTempDir = true;
      workingDir = fs.mkdtempSync(path.join(os.tmpdir(), `sync-${sat.name}-`));
      const cloneUrl = `https://x-access-token:${token}@github.com/${sat.repo}.git`;

      console.log(`📥 Đang clone repository từ GitHub về thư mục tạm...`);
      try {
        execSync(`git clone --depth 1 --branch ${sat.branch} ${cloneUrl} "${workingDir}"`, {
          stdio: 'inherit',
          timeout: 60000,
        });
      } catch (err) {
        console.error(`${colors.red}❌ Không thể clone ${sat.repo}: ${err.message}${colors.reset}`);
        continue;
      }
    }

    console.log(`📂 Thư mục làm việc: ${workingDir}`);

    const { blocked } = auditSatellite({ ...sat, localPath: workingDir }, history);
    if (blocked.length) {
      console.error(`${colors.red}${colors.bright}⛔ ${sat.name}: ${blocked.length} file có nội dung riêng sẽ bị xoá — KHÔNG ghi gì cả.${colors.reset}`);
      for (const f of blocked) {
        console.error(`${colors.red}   ${f.file} (${f.ownedLines.length} dòng)${colors.reset}`);
        for (const l of f.ownedLines.slice(0, 3)) {
          console.error(`${colors.dim}      | ${l.length > 110 ? `${l.slice(0, 107)}...` : l}${colors.reset}`);
        }
        if (f.ownedLines.length > 3) console.error(`${colors.dim}      | ... còn ${f.ownedLines.length - 3} dòng${colors.reset}`);
      }
      console.error(`${colors.yellow}   → Xem ai/shared/SATELLITE_CORE_MIGRATION.md để chuyển phần riêng sang core/local/.${colors.reset}`);
      failedSatellites.push(sat.name);
      if (isTempDir) {
        try { fs.rmSync(workingDir, { recursive: true, force: true }); } catch (_) {}
      }
      continue;
    }

    const updatedFiles = syncToDirectory(workingDir);
    console.log(`📦 Số lượng tệp cập nhật: ${colors.yellow}${updatedFiles}${colors.reset}`);

    // Số tệp đã copy KHÔNG chứng minh tính năng chạy được. Một view chỉ sống khi đủ cả
    // slice + section + template + stylesheet + route; thiếu một mảnh thì view hiện ra
    // trắng mà không có lỗi nào. Kiểm ngay tại ĐÍCH, trước khi commit bất cứ thứ gì.
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
      continue;
    }
    console.log(`${colors.green}✅ ${featureCheck.views.length} view dashboard đủ mảnh tại vệ tinh.${colors.reset}`);

    // Kiểm tra Quality Gate nếu có script
    const checkScript = path.join(workingDir, 'scripts', 'check-framework-structure.js');
    if (fs.existsSync(checkScript)) {
      try {
        const qgOutput = execSync(`node "${checkScript}"`, { cwd: workingDir, encoding: 'utf8', windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
        console.log(`${colors.green}✅ Quality Gate ĐẠT:${colors.reset} ${qgOutput.trim()}`);
      } catch (qgErr) {
        console.error(`${colors.red}⚠️ Cảnh báo Quality Gate tại ${sat.name}:${colors.reset}\n${qgErr.stdout || qgErr.message}`);
      }
    }

    // Kiểm tra thay đổi git
    try {
      const gitStatus = execSync('git status --porcelain', { cwd: workingDir, encoding: 'utf8', windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
      if (!gitStatus) {
        console.log(`${colors.green}✅ Không có thay đổi mới nào cần commit.${colors.reset}`);
      } else {
        console.log(`📝 Phát hiện thay đổi, đang commit và push...`);
        // Danh tính bot chỉ áp cho ĐÚNG commit này qua `git -c`, KHÔNG ghi vào .git/config.
        // Trước đây dùng `git config` nên identity bị ghi đè vĩnh viễn trong repo vệ tinh:
        // mọi commit sau đó của con người cũng bị gán cho github-actions[bot].
        const botIdentity = '-c user.name="github-actions[bot]" '
          + '-c user.email="github-actions[bot]@users.noreply.github.com"';
        execSync('git add -A', { cwd: workingDir, windowsHide: true });
        execSync(
          `git ${botIdentity} commit -m "chore(framework): sync latest dashboard and core engine from hub [skip ci]"`,
          { cwd: workingDir, windowsHide: true },
        );

        if (isCI) {
          execSync(`git push origin ${sat.branch}`, { cwd: workingDir, stdio: 'inherit', windowsHide: true });
          console.log(`${colors.green}${colors.bright}🎉 Đã push thành công lên GitHub của ${sat.name}!${colors.reset}`);
        } else {
          console.log(`${colors.green}✅ Đã cập nhật và commit tại thư mục cục bộ ${sat.localPath}.${colors.reset}`);
          console.log(`   (Bạn có thể chạy git push từ ${sat.name} khi sẵn sàng)`);
        }
      }
    } catch (gitErr) {
      console.error(`${colors.red}❌ Lỗi Git tại ${sat.name}: ${gitErr.message}${colors.reset}`);
    }

    // Dọn dẹp temp dir nếu tạo tạm
    if (isTempDir) {
      try {
        fs.rmSync(workingDir, { recursive: true, force: true });
      } catch (_) {}
    }
  }

  if (failedSatellites.length) {
    console.error(`\n${colors.red}${colors.bright}=====================================================${colors.reset}`);
    console.error(`${colors.red}${colors.bright}  ĐỒNG BỘ THẤT BẠI: ${failedSatellites.join(', ')}${colors.reset}`);
    console.error(`${colors.red}${colors.bright}=====================================================${colors.reset}\n`);
    throw new Error(`Vệ tinh chưa nhận được bản mới: ${failedSatellites.join(', ')}`);
  }

  console.log(`\n${colors.green}${colors.bright}=====================================================${colors.reset}`);
  console.log(`${colors.green}${colors.bright}  HOÀN TẤT TOÀN BỘ TIẾN TRÌNH ĐỒNG BỘ CÁC VỆ TINH   ${colors.reset}`);
  console.log(`${colors.green}${colors.bright}=====================================================${colors.reset}\n`);
}

// AN TOÀN: chỉ chạy sync khi được gọi trực tiếp. Trước đây run() được gọi ở top-level,
// nên bất kỳ require() nào (kể cả từ test hay tooling) cũng kích hoạt ghi đè thật lên vệ tinh.
if (require.main === module) {
  run().catch((err) => {
    console.error(`${colors.red}Lỗi nghiêm trọng: ${err.message}${colors.reset}`);
    process.exit(1);
  });
}

module.exports = { copyDirRecursive, syncToDirectory, run };