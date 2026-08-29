const { spawn } = require('child_process');
const { getDashboardConfig } = require('../core/config/dashboardConfig');

const suiteName = process.argv[2] ? process.argv[2].trim() : '';
const env = process.argv[3] ? process.argv[3].trim() : 'dev';
const explicitSpec = process.argv[4] ? process.argv[4].trim() : '';

if (!suiteName) {
  console.error('Vui lòng cung cấp tên suite. Ví dụ: node scripts/run-suite.js admin-flows dev');
  process.exit(1);
}

const norm = (str) => String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const config = getDashboardConfig();
const suiteEntries = Object.entries(config.suites || {});
const matchedEntry = suiteEntries.find(([key, val]) => {
  return norm(key) === norm(suiteName) || norm(val.label) === norm(suiteName);
});

const suite = matchedEntry ? matchedEntry[1] : null;

const args = ['test'];

if (suiteName.toLowerCase() === 'check') {
  require('./check-framework-structure');
  process.exit(0);
} else if (suiteName.toLowerCase() === 'e2e') {
  args.push('tests/e2e');
} else if (suiteName.toLowerCase() === 'file') {
  if (!explicitSpec) {
    console.error('Vui lòng cung cấp đường dẫn file spec.');
    process.exit(1);
  }
  args.push(explicitSpec);
} else if (suite) {
  console.log(`[Suite Runner] Đang chạy kịch bản: ${suite.label || matchedEntry[0]}`);
  if (Array.isArray(suite.specs) && suite.specs.length > 0 && suite.specs !== 'all') {
    args.push(...suite.specs);
  } else if (suite.spec && suite.spec !== 'all') {
    args.push(suite.spec);
  }
  if (suite.project && suite.project !== 'all') {
    args.push(`--project=${suite.project}`);
  }
  if (suite.grep) {
    args.push('--grep', suite.grep);
  }
  if (suite.workers) {
    args.push(`--workers=${suite.workers}`);
  }
} else {
  // Built-in presets
  const s = suiteName.toLowerCase();
  if (s === 'smoke') args.push('--grep', '@smoke');
  else if (s === 'regression') args.push('--grep-invert', '@smoke');
  else if (s === 'company-site' || s === 'companysite') args.push('--grep', '@CompanySite');
  else if (s === 'desktop') args.push('--project=Desktop Chrome');
  else if (s === 'fullhd') args.push('--project=Company Site Desktop Full HD');
  else if (s === '2k') args.push('--project=Company Site Desktop 2K');
  else {
    console.error(`Không tìm thấy kịch bản nào phù hợp với: "${suiteName}"`);
    console.error('Các kịch bản hợp lệ:', ['check', 'e2e', 'smoke', 'regression', 'company-site', 'desktop', 'fullhd', '2k', 'file', ...Object.keys(config.suites || {})].join(', '));
    process.exit(1);
  }
}

const envVars = {
  ...process.env,
  NODE_ENV: env,
};

if (suite?.viewport) {
  envVars.PW_VIEWPORT_WIDTH = String(suite.viewport.width || 1920);
  envVars.PW_VIEWPORT_HEIGHT = String(suite.viewport.height || 1080);
}

const playwrightCli = require.resolve('@playwright/test/cli');
const child = spawn(process.execPath, [playwrightCli, ...args], {
  stdio: 'inherit',
  env: envVars,
});

child.on('close', (code) => {
  process.exit(code || 0);
});
