const { spawn } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const playwrightCli = require.resolve('@playwright/test/cli');

console.log('Testing spawn with playwrightCli:');
console.log('playwrightCli path:', playwrightCli);

const args = [
  playwrightCli,
  'codegen',
  'https://example.com',
  '--target=playwright-test',
  `--output=${path.join(ROOT, '.tmp', 'recordings', 'test_out.js')}`
];

const child = spawn(process.execPath, args, {
  cwd: ROOT,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env },
  shell: false,
  windowsHide: false
});

child.stdout.on('data', d => console.log('STDOUT:', d.toString()));
child.stderr.on('data', d => console.log('STDERR:', d.toString()));
child.on('error', err => console.error('ERROR:', err));
child.on('exit', (code, sig) => console.log('EXIT:', code, sig));

setTimeout(() => {
  console.log('Child PID:', child.pid);
  child.kill();
  process.exit(0);
}, 4000);
