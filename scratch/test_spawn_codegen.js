const { spawn } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const outputPath = path.join(ROOT, '.tmp', 'recordings', 'test_spawn.js');
const targetUrl = 'https://example.com';

const args = [
  'playwright',
  'codegen',
  targetUrl,
  '--target=playwright-test',
  `--output=${outputPath}`,
];

console.log('Spawning with npx.cmd + shell: true...');
const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, {
  cwd: ROOT,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env },
  shell: true,
});

child.stdout.on('data', (d) => console.log('[STDOUT]', d.toString()));
child.stderr.on('data', (d) => console.log('[STDERR]', d.toString()));
child.on('error', (err) => console.error('[ERROR]', err));
child.on('exit', (code, sig) => console.log('[EXIT]', code, sig));

setTimeout(() => {
  console.log('PID:', child.pid);
  child.kill();
}, 6000);
