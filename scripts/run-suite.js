const { spawn } = require('child_process');
const path = require('path');
const { getDashboardConfig } = require('../core/config/dashboardConfig');
const { assertNotFrozen } = require('../core/utils/circuitBreaker');
const { resolveConfiguredSuiteArgs } = require('./lib/suiteRunnerHelper');

const suiteName = process.argv[2] ? process.argv[2].trim() : '';
let env = 'qc';
let explicitSpec = '';
for (const raw of process.argv.slice(3)) {
  const lower = raw.trim().toLowerCase();
  if (['qc', 'stg', 'prod', 'staging', 'production'].includes(lower)) {
    env = lower === 'staging' ? 'stg' : (lower === 'production' ? 'prod' : lower);
  } else if (!raw.startsWith('--') && !explicitSpec) {
    explicitSpec = raw.trim();
  }
}

assertNotFrozen({ suiteName, projectRoot: path.resolve(__dirname, '..'), exitOnError: true });

if (!suiteName) {
  console.error('Vui lòng cung cấp tên suite. Ví dụ: node scripts/run-suite.js admin-flows dev');
  process.exit(1);
}

const norm = (str) => String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const config = getDashboardConfig();
const suiteEntries = Object.entries(config.suites || {});
const matchedEntry = suiteEntries.find(([key, val]) => norm(key) === norm(suiteName) || norm(val.label) === norm(suiteName));
const suite = matchedEntry ? matchedEntry[1] : null;

const args = ['test'];

if (suiteName.toLowerCase() === 'check') {
  require('./check-framework-structure');
  process.exit(0);
} else if (suiteName.toLowerCase() === 'e2e') {
  args.push('tests/e2e');
} else if (suiteName.toLowerCase() === 'file') {
  if (!explicitSpec) { console.error('Vui lòng cung cấp đường dẫn file spec.'); process.exit(1); }
  args.push(explicitSpec);
} else if (suite) {
  args.push(...resolveConfiguredSuiteArgs(suite, config, matchedEntry));
} else {
  const s = suiteName.toLowerCase();
  if (s === 'smoke') args.push('--grep', '@smoke');
  else if (s === 'regression' || s === 'ci') args.push('--grep', '@regression');
  else if (s === 'deep') args.push('--grep', '@deep');
  else if (s === 'negative') args.push('--grep', '@negative|@validation');
  else if (s === 'edge' || s === 'boundary') args.push('--grep', '@boundary|@edge|@concurrency|@responsive');
  else if (s === 'security') args.push('--grep', '@security');
  else if (s === 'auth' || s === 'authenticated') args.push('--grep', '@auth');
  else if (s === 'guest' || s === 'no-auth' || s === 'unauth') args.push('--grep', '@guest');
  else if (s === 'applyjob' || s === 'apply-job') args.push('--grep', '@applyjob');
  else if (s === 'profile') args.push('--grep', '@profile');
  else if (s === 'desktop') args.push('--project=Desktop Smoke Tests', '--project=Desktop Regression Tests');
  else if (s === 'mobile') args.push('--project=Mobile Chrome Regression Tests', '--project=Mobile Safari Regression Tests');
  else if (s === 'api') args.push('--project=API Tests');
  else {
    console.error(`Không tìm thấy kịch bản nào phù hợp với: "${suiteName}"`);
    console.error('Các kịch bản hợp lệ:', ['check', 'e2e', 'smoke', 'regression', 'ci', 'deep', 'negative', 'edge', 'security', 'applyjob', 'profile', 'desktop', 'mobile', 'api', 'file', ...Object.keys(config.suites || {})].join(', '));
    process.exit(1);
  }
}

const envVars = { ...process.env, NODE_ENV: env };
if (suite?.viewport) {
  envVars.PW_VIEWPORT_WIDTH = String(suite.viewport.width || 1920);
  envVars.PW_VIEWPORT_HEIGHT = String(suite.viewport.height || 1080);
}

const extraCliFlags = process.argv.slice(3).filter((arg) => arg.startsWith('--'));
if (extraCliFlags.length > 0) args.push(...extraCliFlags);

const playwrightCli = require.resolve('@playwright/test/cli');
const child = spawn(process.execPath, [playwrightCli, ...args], { stdio: 'inherit', env: envVars });
child.on('close', (code) => { process.exit(code || 0); });
