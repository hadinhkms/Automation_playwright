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

const HUB_ROOT = path.resolve(__dirname, '..');

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

const MODULES_TO_SYNC = [
  { src: 'dashboard', dest: 'dashboard' },
  {
    src: 'core',
    dest: 'core',
    excludes: ['core/config/dashboardConfig.json'], // Không ghi đè config riêng
  },
  { src: 'bin', dest: 'bin' },
  { src: 'scripts', dest: 'scripts', excludes: ['scripts/sync-satellites.js', 'scripts/sync-from-core.js'] },
  { src: 'ai', dest: 'ai' },
  { src: 'tools', dest: 'tools' },
];

const ROOT_FILES_TO_SYNC = [
  'Start_Dashboard.bat',
  'Stop_Dashboard.bat',
  ];

function copyDirRecursive(srcDir, destDir, excludes = []) {
  if (!fs.existsSync(srcDir)) return 0;
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

  let copied = 0;
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (excludes.some((ex) => destPath.toLowerCase().endsWith(path.normalize(ex).toLowerCase()))) {
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
    const excludes = (mod.excludes || []).map((e) => path.join(targetDir, e));
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
        const qgOutput = execSync(`node "${checkScript}"`, { cwd: workingDir, encoding: 'utf8' });
        console.log(`${colors.green}✅ Quality Gate ĐẠT:${colors.reset} ${qgOutput.trim()}`);
      } catch (qgErr) {
        console.error(`${colors.red}⚠️ Cảnh báo Quality Gate tại ${sat.name}:${colors.reset}\n${qgErr.stdout || qgErr.message}`);
      }
    }

    // Kiểm tra thay đổi git
    try {
      const gitStatus = execSync('git status --porcelain', { cwd: workingDir, encoding: 'utf8' }).trim();
      if (!gitStatus) {
        console.log(`${colors.green}✅ Không có thay đổi mới nào cần commit.${colors.reset}`);
      } else {
        console.log(`📝 Phát hiện thay đổi, đang commit và push...`);
        execSync('git config user.name "github-actions[bot]"', { cwd: workingDir });
        execSync('git config user.email "github-actions[bot]@users.noreply.github.com"', { cwd: workingDir });
        execSync('git add -A', { cwd: workingDir });
        execSync('git commit -m "chore(framework): sync latest dashboard and core engine from hub [skip ci]"', { cwd: workingDir });

        if (isCI) {
          execSync(`git push origin ${sat.branch}`, { cwd: workingDir, stdio: 'inherit' });
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

run().catch((err) => {
  console.error(`${colors.red}Lỗi nghiêm trọng: ${err.message}${colors.reset}`);
  process.exit(1);
});