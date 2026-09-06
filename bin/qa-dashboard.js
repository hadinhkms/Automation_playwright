#!/usr/bin/env node
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
QA Automation Studio - Multi-Project CLI
========================================
Sử dụng:
  npx qa-dashboard [options]
  node bin/qa-dashboard.js [options]

Tùy chọn:
  --project-root <path>   Chỉ định đường dẫn thư mục dự án (Mặc định: thư mục hiện tại)
  --port <number>         Cổng chạy server Dashboard (Mặc định: 5180)
  --version, -v           Hiển thị phiên bản hiện tại
  --help, -h              Hiển thị trợ giúp này
`);
  process.exit(0);
}

const ENGINE_DIR = path.resolve(__dirname, '..');
const pkgPath = path.join(ENGINE_DIR, 'package.json');
let version = '1.0.0';
if (fs.existsSync(pkgPath)) {
  try {
    version = JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version || version;
  } catch (_) {}
}

if (args.includes('--version') || args.includes('-v')) {
  console.log(`qa-dashboard v${version}`);
  process.exit(0);
}

// Xử lý --project-root nếu có
let projectRoot = process.cwd();
const rootIdx = args.indexOf('--project-root');
if (rootIdx !== -1 && args[rootIdx + 1]) {
  projectRoot = path.resolve(args[rootIdx + 1]);
}
process.env.QA_PROJECT_ROOT = projectRoot;

// Xử lý --port nếu có
const portIdx = args.indexOf('--port');
if (portIdx !== -1 && args[portIdx + 1]) {
  process.env.PORT = args[portIdx + 1];
}

console.log(`[QA Studio] Đang khởi chạy Dashboard cho dự án: ${projectRoot}`);
require('../dashboard/server.js');
