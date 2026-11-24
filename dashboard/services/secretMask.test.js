'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { maskSecrets, createMasker } = require('./secretMask');

// Gate 3 R-1: patterns a stored error must never leak.
const LEAKY = [
  ['URL userinfo user:pass', 'GET https://admin:hunter2pass@db.example.com/x failed', ['admin', 'hunter2pass']],
  ['URL userinfo token only', 'clone //ghtoken12345@github.com/org/repo', ['ghtoken12345']],
  ['Authorization Basic', 'Authorization: Basic dXNlcjpwYXNzd29yZA==', ['dXNlcjpwYXNzd29yZA']],
  ['Authorization Bearer header', 'request headers authorization: Bearer abc.def-123', ['abc.def-123']],
  ['Bearer colon', 'sent Bearer: qqq111zzz', ['qqq111zzz']],
  ['bearer equals', 'param bearer=zzz999yyy', ['zzz999yyy']],
  ['api_key in query', 'GET /v1/items?page=2&api_key=abcd1234efgh&x=1', ['abcd1234efgh']],
  ['password key=value', 'login failed password=hunter2hunter2 for user', ['hunter2hunter2']],
  ['passwd quoted', 'config passwd: "my secret pass" here', ['my secret pass']],
  ['client_secret json-ish', 'body {"client_secret":"s3cr3t-value-xyz"}', ['s3cr3t-value-xyz']],
  ['GitHub token', `clone with ghp_${'A1b2C3d4E5'.repeat(3)} failed`, ['ghp_' + 'A1b2']],
  ['GitHub fine-grained', `token github_pat_${'abcDEF0123456789_'.repeat(3)}`, ['github_' + 'pat_abc']],
  ['Slack token', 'slack xoxb' + '-1234567890-abcdefghij failed', ['xoxb' + '-1234567890']],
  ['JWT', 'jwt eyJ' + 'hbGciOiJIUzI1NiJ9.eyJ' + 'zdWIiOiIxMjM0In0.SflKxwRJSMeKKF2QT4fwpM failed', ['eyJ' + 'hbGciOiJIUzI1NiJ9', 'SflKxwRJSMeKKF2QT4fwpM']],
  ['x-api-key header', 'headers x-api-key: key-998877 rest', ['key-998877']],
  ['cookie header', 'Cookie: session=abc123; theme=dark', ['abc123', 'theme=dark']],
  ['Discord webhook', 'POST https://discord.com/api/webhooks/' + '123456789012345678/AbCdEfGhIjKl-mnop_QRST failed', ['AbCdEfGhIjKl']],
];

for (const [name, input, secrets] of LEAKY) {
  test(`masks: ${name}`, () => {
    const out = maskSecrets(input);
    for (const secret of secrets) assert.ok(!out.includes(secret), `"${secret}" leaked in: ${out}`);
    assert.match(out, /\*\*\*/);
  });
}

test('masks environment values whose NAME matches TOKEN|SECRET|KEY|PASSWORD|WEBHOOK and are >= 8 chars', () => {
  process.env.DEPLOY_WEBHOOK_URL = 'https://hooks.example.com/abcdef';
  process.env.MY_SERVICE_PASSWORD = 'plainpw-9988';
  process.env.SHORT_TOKEN = 'abc'; // too short: left alone
  process.env.UNRELATED_NAME = 'not-a-secret-value';
  try {
    const out = maskSecrets('webhook https://hooks.example.com/abcdef pw plainpw-9988 short abc unrelated not-a-secret-value');
    assert.ok(!out.includes('hooks.example.com/abcdef'));
    assert.ok(!out.includes('plainpw-9988'));
    assert.match(out, /short abc /);
    assert.match(out, /not-a-secret-value/);
  } finally {
    for (const k of ['DEPLOY_WEBHOOK_URL', 'MY_SERVICE_PASSWORD', 'SHORT_TOKEN', 'UNRELATED_NAME']) delete process.env[k];
  }
});

test('ordinary text is untouched', () => {
  assert.equal(maskSecrets('expect(received).toBe(expected) // Object.is equality at a.spec.js:12'), 'expect(received).toBe(expected) // Object.is equality at a.spec.js:12');
});

// Gate 3 Z-1: no pattern may backtrack quadratically; the mask runs synchronously on EVERY live log line.
const rep = (s, n) => s.repeat(Math.ceil(n / s.length)).slice(0, n);
const N = 100 * 1024;
const BAD_INPUTS = {
  'jwt eyJ + a. repeated': () => `eyJ${rep('a.', N)}`,
  'jwt eyJa repeated': () => rep('eyJa', N),
  'jwt eyJa.a. blocks': () => rep('eyJa.a.', N),
  'bearer + spaces': () => `bearer${rep(' ', N)}`,
  'bearer repeated': () => rep('bearer ', N),
  'basic + spaces': () => `basic${rep(' ', N)}`,
  'key a.a.a.': () => rep('a.', N),
  'key a-a-a-': () => rep('a-', N),
  'token repeated': () => rep('token', N),
  'token + spaces': () => `token${rep(' ', N)}`,
  'token= repeated': () => rep('token=', N),
  'api_key_ repeated': () => rep('api_key_', N),
  'cookie + spaces': () => `cookie${rep(' ', N)}`,
  'cookie repeated': () => rep('cookie ', N),
  'authorization: repeated': () => rep('authorization: ', N),
  'userinfo //a*N': () => `//${rep('a', N)}`,
  'userinfo //a repeated': () => rep('//a', N),
  'discord long id': () => `https://discord.com/api/webhooks/${rep('1', N)}`,
  'discord repeated': () => rep('https://discord.com/api/webhooks/' + '1/', N),
  'ghp_ long': () => `ghp_${rep('a', N)}`,
  'xox- long': () => `xoxb-${rep('a', N)}`,
  'open quote': () => `password="${rep('a', N)}`,
  'password=" repeated': () => rep('password="', N),
  'ansi unterminated': () => rep('\u001b[1', N),
  'spaces only': () => rep(' ', N),
};

for (const [name, make] of Object.entries(BAD_INPUTS)) {
  test(`ReDoS guard: ${name} (100 KB) is masked in < 50 ms`, () => {
    const mask = createMasker();
    const input = make();
    const started = process.hrtime.bigint();
    const out = mask(input);
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    assert.ok(ms < 50, `${name} took ${ms.toFixed(1)} ms`);
    assert.equal(typeof out, 'string');
  });
}

test('a very long line is never emitted verbatim: split at whitespace in <= 16 KB parts, a longer solid blob is replaced', () => {
  const mask = createMasker();
  const secret = 'https://admin:Pa55w0rdXYZ@host.example/db';
  const long = `${rep('word ', 40000)}${secret} tail ${rep('word ', 40000)}`;
  const out = mask(long);
  assert.ok(!out.includes('Pa55w0rdXYZ'), 'a secret inside a >16 KB line is still masked');
  assert.match(out, /https:\/\/\*\*\*@host\.example\/db/);
  const blob = mask(`before ${'A'.repeat(50000)} after`);
  assert.equal(blob, 'before ***(50000 ký tự) after');
});

test('ordinary throughput is kept: 20000 typical lines well under a second', () => {
  const mask = createMasker();
  const started = process.hrtime.bigint();
  for (let i = 0; i < 20000; i += 1) mask(`  ✓ ${i} [Desktop Smoke Tests] › tests/e2e/desktop/a.spec.js:12:5 › login works @smoke (1.2s)`);
  const ms = Number(process.hrtime.bigint() - started) / 1e6;
  assert.ok(ms < 1000, `20000 lines took ${ms.toFixed(0)} ms`);
});
