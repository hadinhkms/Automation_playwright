'use strict';

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
  runUpdateFrameworkCli,
};

