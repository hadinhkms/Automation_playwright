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
    const updatedFiles = syncToDirectory(workingDir);
    console.log(`📦 Số lượng tệp cập nhật: ${colors.yellow}${updatedFiles}${colors.reset}`);

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