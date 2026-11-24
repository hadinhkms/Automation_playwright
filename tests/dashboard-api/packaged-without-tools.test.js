/**
 * tests/dashboard-api/packaged-without-tools.test.js
 * Gate 3 N1: package.json "files" does not ship tools/ or scripts/, so dashboard/server.js and
 * qaService must load and serve without tools/ (no MODULE_NOT_FOUND before the Soft Fallback).
 * Copies the "files" entries to a temp dir and runs from there.
 * The copy contains exactly the "files" entries: no tools/, no scripts/. The route that needs
 * scripts/update-framework must answer 501 instead of crashing the server at require time.
 */
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const { spawn, spawnSync } = require('child_process');

const ENGINE = path.resolve(__dirname, '../..');

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => { const { port } = srv.address(); srv.close(() => resolve(port)); });
    srv.on('error', reject);
  });
}

describe('Packaged install without tools/ (npm "files" only)', () => {
  let pkgDir;

  before(() => {
    pkgDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dash-pkg-'));
    const manifest = JSON.parse(fs.readFileSync(path.join(ENGINE, 'package.json'), 'utf8'));
    fs.copyFileSync(path.join(ENGINE, 'package.json'), path.join(pkgDir, 'package.json'));
    for (const entry of manifest.files) {
      fs.cpSync(path.join(ENGINE, entry), path.join(pkgDir, entry), { recursive: true });
    }
    fs.symlinkSync(path.join(ENGINE, 'node_modules'), path.join(pkgDir, 'node_modules'), 'junction');
    assert.ok(!fs.existsSync(path.join(pkgDir, 'tools')), 'tools/ must not be part of the package');
    assert.ok(!fs.existsSync(path.join(pkgDir, 'scripts')), 'scripts/ must not be part of the package');
  });

  after(() => { if (pkgDir) fs.rmSync(pkgDir, { recursive: true, force: true }); });

  test('require(dashboard/services/qaService) succeeds', () => {
    const res = spawnSync(process.execPath, ['-e', "require('./dashboard/services/qaService'); require('./dashboard/services/qaFindingCatalog')"], { cwd: pkgDir, encoding: 'utf8' });
    assert.equal(res.status, 0, res.stderr);
  });

  test('dashboard/server.js starts, /api/qa/summary uses Soft Fallback, update-framework routes answer 501', async () => {
    const port = await freePort();
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'dash-ws-'));
    const child = spawn(process.execPath, [path.join(pkgDir, 'dashboard/server.js')], {
      cwd: pkgDir,
      env: { ...process.env, DASHBOARD_PORT: String(port), QA_PROJECT_ROOT: workspace, NODE_ENV: 'test' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (d) => { output += d; });
    child.stderr.on('data', (d) => { output += d; });
    try {
      let health = null;
      for (let i = 0; i < 50 && !health; i += 1) {
        if (child.exitCode !== null) break;
        health = await fetch(`http://127.0.0.1:${port}/api/health`).then((r) => (r.ok ? r : null), () => null);
        if (!health) await new Promise((r) => setTimeout(r, 200));
      }
      assert.ok(health, `server did not start without tools/: ${output.slice(-600)}`);
      const summary = await fetch(`http://127.0.0.1:${port}/api/qa/summary?force=true`);
      assert.equal(summary.status, 200);
      assert.ok((await summary.json()).metrics);

      // scripts/update-framework is not packaged: clear 501 JSON, never a crash or a hang.
      for (const route of ['/api/framework/update', '/api/system/update-framework']) {
        const res = await fetch(`http://127.0.0.1:${port}${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        assert.equal(res.status, 501, route);
        const body = await res.json();
        assert.equal(body.ok, false);
        assert.match(body.error, /bản checkout repo/);
      }
      assert.equal(child.exitCode, null, 'server must still be running');
    } finally {
      child.kill('SIGTERM');
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });
});
