const { spawn } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const fileName = `rec_test_${Date.now()}.js`;
const outputPath = path.join(ROOT, '.tmp', 'recordings', fileName);
const targetUrl = 'https://seeker.vl24hv2.qc.sieuviet-team.com';

const args = [
  'playwright',
  'codegen',
  targetUrl,
  '--target=playwright-test',
  `--output=${outputPath}`,
  '--viewport-size=1920,1080'
];

console.log('Running npx with args:', args);
const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, {
  cwd: ROOT,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env },
  shell: true,
});

child.stdout.on('data', d => console.log('[STDOUT]', d.toString()));
child.stderr.on('data', d => console.log('[STDERR]', d.toString()));
child.on('error', err => console.error('[ERROR]', err));
child.on('exit', (code, sig) => console.log('[EXIT]', code, sig));

// Check after 5 seconds
setTimeout(() => {
  console.log('Still alive? PID:', child.pid);
  child.kill();
}, 5000);
