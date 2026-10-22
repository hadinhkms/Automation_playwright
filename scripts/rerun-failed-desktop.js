const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const failedSpecsPath = path.resolve(__dirname, '../test-results/failed-desktop-specs.json');
if (!fs.existsSync(failedSpecsPath)) {
  console.error('Không tìm thấy file danh sách test failed: test-results/failed-desktop-specs.json');
  process.exit(1);
}

const failedSpecs = JSON.parse(fs.readFileSync(failedSpecsPath, 'utf8'));
console.log(`[Rerun Failed Desktop] Chuẩn bị chạy lại ${failedSpecs.length} kịch bản Desktop failed với workers = 2...`);

const args = [
  'test',
  ...failedSpecs,
  '--project=Desktop Smoke Tests',
  '--project=Desktop Regression Tests',
  '--workers=2'
];

// Thêm các cờ CLI nếu có
const extraCliFlags = process.argv.slice(2).filter((arg) => arg.startsWith('--'));
if (extraCliFlags.length > 0) {
  args.push(...extraCliFlags);
}

const envVars = {
  ...process.env,
  NODE_ENV: process.env.NODE_ENV || 'qc',
  PW_WORKERS: '2'
};

const playwrightCli = require.resolve('@playwright/test/cli');
const child = spawn(process.execPath, [playwrightCli, ...args], {
  stdio: 'inherit',
  env: envVars,
});

child.on('close', (code) => {
  process.exit(code || 0);
});
