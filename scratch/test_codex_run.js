const { spawn } = require('child_process');
const path = require('path');
const { locateCodex } = require('../core/ai/agentService');

const codexPath = locateCodex();
console.log('Codex path:', codexPath);

const model = 'gpt-oss:20b';
const workspace = process.cwd();

const args = [
  '-a', 'never', 'exec', '--ignore-user-config', '--oss', '--local-provider', 'ollama',
  '--model', model, '--json', '--ephemeral', '--sandbox', 'workspace-write', '-C', workspace,
  '-c', 'web_search="disabled"', '-c', 'model_context_window=65536', '-c', 'model_auto_compact_token_limit=48000', '-'
];

console.log('Spawning Codex with args:', args);
const child = spawn(codexPath, args, {
  cwd: workspace,
  env: { ...process.env, OLLAMA_HOST: 'http://127.0.0.1:11434', OLLAMA_NO_CLOUD: '1' },
  stdio: ['pipe', 'pipe', 'pipe']
});

child.stdout.on('data', d => console.log('STDOUT:', d.toString()));
child.stderr.on('data', d => console.log('STDERR:', d.toString()));
child.on('error', e => console.error('ERROR:', e));
child.on('close', code => console.log('EXIT CODE:', code));

child.stdin.end('Say "Hello World" in 3 words.');
