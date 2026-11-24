/**
 * tests/dashboard-api/packaged-without-tools.test.js
 * Gate 3 N1: package.json "files" does not ship tools/ or scripts/, so dashboard/server.js and
 * qaService must load and serve without tools/ (no MODULE_NOT_FOUND before the Soft Fallback).
 * Copies the "files" entries to a temp dir and runs from there.
 * Known, separate gap: dashboard/routes/systemRoutes.js also requires scripts/update-framework,
 * which "files" does not ship either, so the server test below adds scripts/ (and only scripts/)
 * back; the qaService test uses the strict package contents.
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
  });

  after(() => { if (pkgDir) fs.rmSync(pkgDir, { recursive: true, force: true }); });

  test('require(dashboard/services/qaService) succeeds', () => {
    const res = spawnSync(process.execPath, ['-e', "require('./dashboard/services/qaService'); require('./dashboard/services/qaFindingCatalog')"], { cwd: pkgDir, encoding: 'utf8' });
    assert.equal(res.status, 0, res.stderr);
  });

  test('dashboard/server.js starts and /api/qa/summary answers via Soft Fallback', async () => {
    const port = await freePort();
    fs.cpSync(path.join(ENGINE, 'scripts'), path.join(pkgDir, 'scripts'), { recursive: true });
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
    } finally {
      child.kill('SIGTERM');
      fs.rmSync(workspace, { recursive: true, force: true });
    }
  });
});
