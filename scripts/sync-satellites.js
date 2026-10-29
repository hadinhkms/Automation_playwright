#!/usr/bin/env node

/**
 * Hub-to-Spoke Satellite Sync Script
 * Syncs Dashboard, Core Engine, Scripts, and AI Guidelines to Satellite Repositories:
 * 1. hadtv-ctrl/Vieclam24h-Automation_JS
 * 2. hadinhkms/Automation_Carthings
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const {
  HUB_ROOT, SATELLITES, MODULES_TO_SYNC, ROOT_FILES_TO_SYNC,
  assertNoForbiddenModules, assertNoProjectOwnedRootFiles,
  resolveExcludes, isExcluded, modulesToSkip, moduleOf,
  filesOverwrittenAnyway, ALWAYS_DELIVERED_MODULES,
} = require('./lib/sync-manifest');
const { verify: verifyDashboardFeatures } = require('./verify-dashboard-features');
const { auditSatellite } = require('./pre-sync-drift');
const { createHubHistoryProbe } = require('./lib/hubHistory');
const { pullUpstreamQaSkills } = require('./lib/qaUpstreamSync');
const {
  colors, mergeHubMpScripts, prepareSatelliteWorkingDir,
  reportSatelliteDrift, verifySatelliteAfterSync, finalizeSatelliteSyncRun,
} = require('./lib/satelliteSyncHelper');

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

/**
 * @param {string} targetDir
 * @param {{skipModules?: string[]}} [options] Module bị giữ lại vì vệ tinh có nội dung riêng
 *   trong đó. Giữ theo MODULE chứ không theo từng file: trong cùng một module các file phụ
 *   thuộc nhau (vd. core/utils/localExtensions.js mới đi cùng core/utils/commonUtils.js mới),
 *   trộn bản mới với bản cũ sẽ tạo ra trạng thái không ai kiểm thử bao giờ.
 */
function syncToDirectory(targetDir, options = {}) {
  if (options.pullUpstream !== false) {
    try { pullUpstreamQaSkills({ hubRoot: HUB_ROOT }); } catch (_) {}
  }
  const skip = new Set(options.skipModules || []);
  let updatedCount = 0;

  for (const mod of MODULES_TO_SYNC) {
    if (skip.has(mod.dest)) continue;
    const srcPath = path.join(HUB_ROOT, mod.src);
    const destPath = path.join(targetDir, mod.dest);
    const excludes = resolveExcludes(targetDir, mod);
    updatedCount += copyDirRecursive(srcPath, destPath, excludes);
  }

  if (skip.has('(root)')) return updatedCount;

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

  updatedCount += mergeHubMpScripts(HUB_ROOT, targetDir);
  return updatedCount;
}

async function run() {
  console.log(`${colors.cyan}${colors.bright}=====================================================${colors.reset}`);
  console.log(`${colors.cyan}${colors.bright}  HUB-TO-SPOKE AUTOMATED FRAMEWORK SYNCHRONIZATION   ${colors.reset}`);
  console.log(`${colors.cyan}${colors.bright}=====================================================${colors.reset}\n`);

  const token = process.env.SYNC_PAT || process.env.GH_PAT || process.env.GITHUB_TOKEN;
  const isCI = Boolean(process.env.CI || process.argv.includes('--ci'));
  console.log(`📌 Chế độ thực thi: ${isCI ? 'CI (GitHub Actions)' : 'Local Machine'}`);

  const upstreamRes = pullUpstreamQaSkills({ hubRoot: HUB_ROOT });
  if (upstreamRes.available) {
    console.log(
      `🔗 Upstream QA Skills (${upstreamRes.qaHubPath}): ${upstreamRes.syncedSkills.join(', ')} `
      + `(${upstreamRes.updatedCount} tệp mới cập nhật vào Hub)`,
    );
  }

  const failedSatellites = [];
  const partialSatellites = [];
  const history = createHubHistoryProbe(HUB_ROOT);
  if (!history.available) {
    console.log(`${colors.yellow}⚠️  Không tra được lịch sử Hub: ${history.reason}${colors.reset}`);
    console.log(`${colors.dim}   Mọi khác biệt sẽ bị coi là nội dung riêng, nên sync có thể dừng ở mọi vệ tinh.${colors.reset}`);
  }

  const isForce = process.argv.includes('--force');

  for (const sat of SATELLITES) {
    if (sat.autoSync === false && !isForce) {
      console.log('\n-----------------------------------------------------');
      console.log(`⏩ Bỏ qua vệ tinh: ${colors.yellow}${sat.name}${colors.reset} (Cấu hình tự quyết định cập nhật: autoSync = false - không tự động push/pull từ Hub)`);
      continue;
    }
    console.log('\n-----------------------------------------------------');
    console.log(`🚀 Đồng bộ vệ tinh: ${colors.green}${sat.name}${colors.reset} (${sat.repo})`);

    const prepared = prepareSatelliteWorkingDir(sat, { isCI, token });
    if (!prepared) continue;
    const { workingDir, isTempDir } = prepared;
    console.log(`📂 Thư mục làm việc: ${workingDir}`);

    const { blocked } = auditSatellite({ ...sat, localPath: workingDir }, history);
    const blockedPaths = blocked.map((f) => f.file);
    const skipModules = modulesToSkip(blockedPaths);
    const overwritten = filesOverwrittenAnyway(blockedPaths);

    reportSatelliteDrift({
      sat, blocked, skipModules, overwritten,
      alwaysDeliveredModules: ALWAYS_DELIVERED_MODULES,
      moduleOf, partialSatellites,
    });

    const delivered = MODULES_TO_SYNC.map((m) => m.dest).filter((m) => !skipModules.includes(m));
    const updatedFiles = syncToDirectory(workingDir, { skipModules });
    console.log(`${colors.green}📬 Module đã giao: ${delivered.join(', ')}${colors.reset}`);
    console.log(`📦 Số lượng tệp cập nhật: ${colors.yellow}${updatedFiles}${colors.reset}`);

    const verified = verifySatelliteAfterSync({
      sat, workingDir, isTempDir, verifyDashboardFeatures, failedSatellites,
    });
    if (!verified) continue;

    // Kiểm tra thay đổi git
    try {
      const gitStatus = execSync('git status --porcelain', { cwd: workingDir, encoding: 'utf8', windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
      if (!gitStatus) {
        console.log(`${colors.green}✅ Không có thay đổi mới nào cần commit.${colors.reset}`);
      } else {
        console.log('📝 Phát hiện thay đổi, đang commit và push...');
        // Danh tính bot chỉ áp cho ĐÚNG commit này qua `git -c`, KHÔNG ghi vào .git/config.
        // Trước đây dùng `git config` nên identity bị ghi đè vĩnh viễn trong repo vệ tinh:
        // mọi commit sau đó của con người cũng bị gán cho github-actions[bot].
        const botIdentity = '-c user.name="github-actions[bot]" '
          + '-c user.email="github-actions[bot]@users.noreply.github.com"';
        execSync('git add -A', { cwd: workingDir, windowsHide: true });
        execSync(
          `git ${botIdentity} commit --no-verify -m "chore(framework): sync latest dashboard and core engine from hub [skip ci]"`,
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

    if (isTempDir) {
      try { fs.rmSync(workingDir, { recursive: true, force: true }); } catch (_) {}
    }
  }

  finalizeSatelliteSyncRun({ partialSatellites, failedSatellites });
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
