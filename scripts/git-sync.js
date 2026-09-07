#!/usr/bin/env node

/**
 * CLI Tool: Đồng bộ Git & Quản lý Mã nguồn An Toàn (Git Sync CLI)
 * Dự án: QA Automation Engine & Playwright Platform
 */

const path = require('path');
const gitSyncService = require('../core/system/gitSyncService');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

const args = process.argv.slice(2);
const command = args[0] || 'status';

function printBanner() {
  console.log(`${colors.cyan}${colors.bright}=====================================================${colors.reset}`);
  console.log(`${colors.cyan}${colors.bright}  QA AUTOMATION STUDIO - GIT SYNC & ASSET SHIELD     ${colors.reset}`);
  console.log(`${colors.cyan}${colors.bright}=====================================================${colors.reset}`);
}

async function runStatus() {
  printBanner();
  const status = gitSyncService.getGitStatus();

  if (!status.ok) {
    console.error(`${colors.red}❌ Lỗi: ${status.message}${colors.reset}`);
    process.exit(1);
  }

  console.log(`🌿 Nhánh hiện tại : ${colors.green}${colors.bright}${status.currentBranch}${colors.reset}`);
  console.log(`🌐 Kho từ xa     : ${colors.blue}${status.remoteUrl || 'Chưa cấu hình'}${colors.reset}`);
  console.log(`📊 Trạng thái sync: ${status.ahead} Ahead ↑ | ${status.behind} Behind ↓`);
  console.log('-----------------------------------------------------');

  const permitted = status.permittedFiles || [];
  const blocked = status.blockedFiles || [];

  if (permitted.length === 0 && blocked.length === 0) {
    console.log(`${colors.green}✅ Working tree sạch (Clean). Không có thay đổi nào dở dang.${colors.reset}`);
  } else {
    if (permitted.length > 0) {
      console.log(`${colors.green}${colors.bright}🟢 TỆP HỢP LỆ ĐƯỢC PHÉP ĐỒNG BỘ (${permitted.length}):${colors.reset}`);
      for (const f of permitted) {
        console.log(`   [${f.status}] ${colors.yellow}${f.categoryLabel.padEnd(16)}${colors.reset} : ${f.path}`);
      }
    }

    if (blocked.length > 0) {
      console.log(`\n${colors.red}${colors.bright}🛡️ TỆP BỊ CHẶN BẢO MẬT & ĐÃ CÁCH LY (${blocked.length}):${colors.reset}`);
      for (const f of blocked) {
        console.log(`   [${f.status}] ${colors.dim}${f.path}${colors.reset}`);
      }
    }
  }

  console.log('\n📜 5 Commit gần nhất:');
  for (const c of (status.recentCommits || []).slice(0, 5)) {
    console.log(`   ${colors.yellow}${c.hash}${colors.reset} ${colors.dim}(${c.timeAgo})${colors.reset} ${c.subject}`);
  }
}

async function runPull() {
  printBanner();
  console.log(`${colors.blue}🔄 Đang tiến hành kéo mã nguồn mới nhất từ remote...${colors.reset}`);
  const result = gitSyncService.pullCode({ stashIfDirty: true });

  if (Array.isArray(result.logs)) {
    for (const log of result.logs) {
      console.log(`  > ${log}`);
    }
  }

  if (result.ok) {
    console.log(`\n${colors.green}${colors.bright}✅ ${result.message}${colors.reset}`);
  } else {
    console.error(`\n${colors.red}${colors.bright}❌ ${result.message}${colors.reset}`);
    process.exit(1);
  }
}

async function runPush() {
  printBanner();
  const status = gitSyncService.getGitStatus();

  if (!status.ok) {
    console.error(`${colors.red}❌ Lỗi: ${status.message}${colors.reset}`);
    process.exit(1);
  }

  const permitted = status.permittedFiles || [];
  if (permitted.length === 0) {
    console.log(`${colors.yellow}⚠️ Không có tệp hợp lệ nào thay đổi để commit & push.${colors.reset}`);
    return;
  }

  const branchIdx = args.indexOf('--branch');
  let targetBranch = branchIdx !== -1 && args[branchIdx + 1] ? args[branchIdx + 1] : null;
  const allowMain = args.includes('--allow-main');

  // RÀO CHẮN BẢO VỆ NHÁNH CHÍNH (MAIN / MASTER)
  if (status.isProtectedBranch && !targetBranch && !allowMain) {
    console.error(`${colors.red}${colors.bright}⛔ BẢO VỆ NHÁNH CHÍNH (PROTECTED BRANCH):${colors.reset}`);
    console.error(`${colors.yellow}Nhánh "${status.currentBranch}" là nhánh chính được bảo vệ! Bạn không được phép push trực tiếp vào main mà không qua Pull Request.${colors.reset}\n`);
    console.log(`💡 Cách giải quyết theo chuẩn Git Workflow:`);
    console.log(`   1. Tạo nhánh Feature trước:  ${colors.cyan}git checkout -b feature/<tên-tính-năng>${colors.reset}`);
    console.log(`   2. Hoặc chỉ định nhánh push: ${colors.cyan}npm run git:push -- "nội dung commit" --branch feature/<tên-tính-năng>${colors.reset}`);
    console.log(`   3. Sau đó mở link Pull Request được tạo để gửi Lead phê duyệt vào main.`);
    process.exit(1);
  }

  const filteredArgs = args.slice(1).filter((a, i) => a !== '--branch' && args[i - 1] !== '--branch' && a !== '--allow-main');
  const commitMessage = filteredArgs.join(' ').trim() || 'test(auto): update test automation scripts and data';

  console.log(`${colors.cyan}📦 Đang chuẩn bị commit ${permitted.length} tệp hợp lệ:${colors.reset}`);
  for (const f of permitted) {
    console.log(`  + ${f.path}`);
  }
  console.log(`📝 Commit message: "${commitMessage}"`);
  if (targetBranch) {
    console.log(`🌿 Nhánh đẩy lên: ${colors.green}${targetBranch}${colors.reset}\n`);
  } else {
    console.log(`🌿 Nhánh hiện tại: ${colors.green}${status.currentBranch}${colors.reset}\n`);
  }

  const result = gitSyncService.commitAndPush({
    files: permitted.map((f) => f.path),
    message: commitMessage,
    branch: targetBranch || status.currentBranch,
    newBranch: targetBranch && targetBranch !== status.currentBranch ? targetBranch : null,
    allowProtectedPush: allowMain,
  });

  if (Array.isArray(result.logs)) {
    for (const log of result.logs) {
      console.log(`  > ${log}`);
    }
  }

  if (result.ok) {
    console.log(`\n${colors.green}${colors.bright}🎉 ${result.message}${colors.reset}`);
    if (result.prUrl) {
      console.log(`\n${colors.cyan}${colors.bright}👉 MỞ PULL REQUEST TRÊN GITHUB ĐỂ GỬI LEAD PHÊ DUYỆT (APPROVAL):${colors.reset}`);
      console.log(`   ${colors.yellow}${result.prUrl}${colors.reset}\n`);
    }
  } else {
    console.error(`\n${colors.red}${colors.bright}❌ ${result.message}${colors.reset}`);
    process.exit(1);
  }
}

async function runCheck() {
  printBanner();
  console.log(`${colors.cyan}🔍 Đang chạy kiểm tra Framework Quality Gate...${colors.reset}`);
  const result = gitSyncService.runFrameworkQualityGate();

  if (result.passed) {
    console.log(`${colors.green}${colors.bright}✅ Quality Gate ĐẠT CHUẨN: ${result.summary}${colors.reset}`);
  } else {
    console.error(`${colors.red}${colors.bright}❌ Quality Gate KHÔNG ĐẠT:${colors.reset}`);
    for (const iss of result.issues) {
      console.error(`  - ${iss}`);
    }
    process.exit(1);
  }
}

async function main() {
  switch (command.toLowerCase()) {
    case 'pull':
      await runPull();
      break;
    case 'push':
      await runPush();
      break;
    case 'check':
      await runCheck();
      break;
    case 'status':
    default:
      await runStatus();
      break;
  }
}

main().catch((err) => {
  console.error(`${colors.red}Lỗi không xác định: ${err.message}${colors.reset}`);
  process.exit(1);
});
