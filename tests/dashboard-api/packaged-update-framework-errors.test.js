/**
 * tests/dashboard-api/packaged-update-framework-errors.test.js
 * Gate 3 M1: only a missing scripts/update-framework itself maps to 501. If that script exists but
 * one of ITS dependencies (scripts/lib/frameworkUpdateHelper) is missing, the real error must
 * surface (loader throws, route answers 500) instead of being masked as "not in this package".
 */
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const { spawn, spawnSync } = require('child_process');

const ENGINE = path.resolve(__dirname, '../..');

describe('update-framework loader: missing child module is not masked as 501', () => {
  let pkgDir;

  before(() => {
    pkgDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dash-pkg2-'));
    const manifest = JSON.parse(fs.readFileSync(path.join(ENGINE, 'package.json'), 'utf8'));
    fs.copyFileSync(path.join(ENGINE, 'package.json'), path.join(pkgDir, 'package.json'));
    for (const entry of manifest.files) fs.cpSync(path.join(ENGINE, entry), path.join(pkgDir, entry), { recursive: true });
    fs.symlinkSync(path.join(ENGINE, 'node_modules'), path.join(pkgDir, 'node_modules'), 'junction');
    // scripts/update-framework.js present, its scripts/lib/frameworkUpdateHelper missing.
    fs.mkdirSync(path.join(pkgDir, 'scripts'));
    fs.copyFileSync(path.join(ENGINE, 'scripts/update-framework.js'), path.join(pkgDir, 'scripts/update-framework.js'));
  });

  after(() => { if (pkgDir) fs.rmSync(pkgDir, { recursive: true, force: true }); });

  test('loadUpdateFramework throws when a child module is missing', () => {
    const script = "try { require('./dashboard/services/frameworkUpdateLoader').loadUpdateFramework(); console.log('RETURNED'); } catch (e) { console.log('THROWN ' + e.code); }";
    const res = spawnSync(process.execPath, ['-e', script], { cwd: pkgDir, encoding: 'utf8' });
    assert.match(res.stdout, /THROWN MODULE_NOT_FOUND/, `stdout: ${res.stdout} stderr: ${res.stderr}`);
  });

  test('POST /api/framework/update answers 500 (not 501) with the real error', async () => {
    const port = await new Promise((resolve) => {
      const srv = net.createServer().listen(0, '127.0.0.1', () => { const p = srv.address().port; srv.close(() => resolve(p)); });
    });
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'dash-ws2-'));
    const child = spawn(process.execPath, [path.join(pkgDir, 'dashboard/server.js')], {
      cwd: pkgDir,
      env: { ...process.env, DASHBOARD_PORT: String(port), QA_PROJECT_ROOT: workspace, NODE_ENV: 'test' },
      stdio: 'ignore',
    });
    try {
      let up = false;
      for (let i = 0; i < 50 && !up; i += 1) {
        up = await fetch(`http://127.0.0.1:${port}/api/health`).then((r) => r.ok, () => false);
        if (!up) await new Promise((r) => setTimeout(r, 200));
      }
      assert.ok(up, 'server did not start');
      const res = await fetch(`http://127.0.0.1:${port}/api/framework/update`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      assert.equal(res.status, 500);
      const body = await res.json();
      assert.equal(body.ok, false);
      assert.match(body.error, /frameworkUpdateHelper/);
    } finally {
      child.kill('SIGTERM');
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });
});
