/**
 * tests/dashboard-api/http-output-masking.test.js
 * Gate 3 Z-4 (subprocess output returned over HTTP is masked) and Z-5 (prototype keys in PUT /api/settings).
 */
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { startDashboardHarness } = require('../dashboard/support/dashboardHarness');
const { createFixtureWorkspace } = require('../dashboard/support/fixtureWorkspace');
const { runCommand } = require('../../dashboard/services/masterProcessUtils');

describe('Z-4: recorder start error does not leak secrets from stderr', () => {
  let fixture; let harness;
  before(async () => {
    fixture = createFixtureWorkspace();
    // Codegen fails fast (no browser at this path) and prints the path in stderr: it carries a secret-looking value.
    process.env.PLAYWRIGHT_BROWSERS_PATH = '/tmp/no-browsers/token=sk_' + 'live_abc12345XYZ';
    try { harness = await startDashboardHarness(fixture.rootPath); } finally { delete process.env.PLAYWRIGHT_BROWSERS_PATH; }
  });
  after(async () => { if (harness) await harness.stop(); if (fixture) fixture.cleanup(); });

  test('POST /api/recorder/start 500 message is masked', async () => {
    let seen = null;
    for (let attempt = 0; attempt < 8 && !seen; attempt += 1) {
      const res = await fetch(`${harness.url}/api/recorder/start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: 'https://example.com' }) });
      if (res.status === 500) seen = await res.json();
      else await fetch(`${harness.url}/api/recorder/reset`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    }
    assert.ok(seen, 'codegen never exited early; cannot check the error path');
    assert.match(seen.error, /tiến trình đã thoát sớm/);
    assert.ok(!seen.error.includes('sk_' + 'live_abc12345XYZ'), seen.error);
    assert.match(seen.error, /token=\*\*\*/);
  });
});

describe('Z-4: runCommand (Master Process) masks stdout and stderr', () => {
  test('stdout, stderr and a spawn error never carry the secret', async () => {
    const res = await runCommand(process.execPath, ['-e', "console.log('audit api_key=sk_" + "live_abc12345XYZ ok IN_SYNC'); console.error('failed https://admin:Pa55w0rdXYZ@host.example/x')"], process.cwd());
    assert.ok(!res.stdout.includes('sk_' + 'live_abc12345XYZ'));
    assert.ok(!res.stderr.includes('Pa55w0rdXYZ'));
    assert.match(res.stdout, /api_key=\*\*\*/);
    assert.match(res.stdout, /IN_SYNC/, 'the text the service parses is untouched');
    const missing = await runCommand('/nonexistent/bin//admin:Pa55w0rdXYZ@host/cmd', [], process.cwd());
    assert.ok(!missing.stderr.includes('Pa55w0rdXYZ'), missing.stderr);
  });
});

describe('Z-5: PUT /api/settings ignores prototype keys', () => {
  let fixture; let harness;
  before(async () => {
    fixture = createFixtureWorkspace();
    fs.writeFileSync(path.join(fixture.rootPath, 'dashboardConfig.json'), JSON.stringify({ branding: { projectName: 'Keep', fontSize: '14px' } }));
    harness = await startDashboardHarness(fixture.rootPath);
  });
  after(async () => { if (harness) await harness.stop(); if (fixture) fixture.cleanup(); });

  test('a body with __proto__/constructor keys saves normally and leaves the config clean', async () => {
    const cur = await (await fetch(`${harness.url}/api/settings`)).json();
    const raw = `{"branding":{"__proto__":{"polluted":"yes"},"projectName":"Renamed"},"__proto__":{"top":"x"},"constructor":{"prototype":{"c":"x"}},"baseRevision":"${cur.revision}"}`;
    const res = await fetch(`${harness.url}/api/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: raw });
    assert.equal(res.status, 200);
    const next = await (await fetch(`${harness.url}/api/settings`)).json();
    assert.equal(next.branding.projectName, 'Renamed');
    assert.equal(next.branding.fontSize, '14px');
    assert.equal(next.polluted, undefined);
    assert.ok(!('polluted' in next.branding));
    const onDisk = JSON.parse(fs.readFileSync(path.join(fixture.rootPath, 'dashboardConfig.json'), 'utf8'));
    assert.ok(!JSON.stringify(onDisk).includes('polluted'));
    // the server is still healthy afterwards
    assert.equal((await fetch(`${harness.url}/api/health`)).status, 200);
  });
});
