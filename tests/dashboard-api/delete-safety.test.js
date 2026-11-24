/**
 * tests/dashboard-api/delete-safety.test.js
 * Gate 3 H1 (fixture name prefix "delete" ate a character and ignored expectedRevision) and
 * H2 (delete of script/dataset/fixture must not follow symlinks out of the allowed folder), via real HTTP.
 */
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startDashboardHarness } = require('../dashboard/support/dashboardHarness');
const { createFixtureWorkspace } = require('../dashboard/support/fixtureWorkspace');

const JSON_H = { 'Content-Type': 'application/json' };

describe('API: delete routes (H1 fixture names, H2 symlinks)', () => {
  let fixture; let harness; let root; let outside;
  const fx = (name) => path.join(root, 'core/fixtures/custom', `${name}.fixture.js`);
  const writeFixture = (name, body = `module.exports = { name: '${name}' };\n`) => fs.writeFileSync(fx(name), body);
  const revisionOf = (name) => crypto.createHash('sha256').update(fs.readFileSync(fx(name), 'utf8'), 'utf8').digest('hex').slice(0, 16);
  const del = (p, body) => fetch(`${harness.url}${p}`, { method: 'DELETE', headers: JSON_H, body: body ? JSON.stringify(body) : undefined });
  const post = (p, body) => fetch(`${harness.url}${p}`, { method: 'POST', headers: JSON_H, body: JSON.stringify(body) });

  before(async () => {
    fixture = createFixtureWorkspace();
    root = fixture.rootPath;
    outside = fs.mkdtempSync(path.join(os.tmpdir(), 'delete-outside-'));
    harness = await startDashboardHarness(root);
  });
  after(async () => {
    if (harness) await harness.stop();
    if (fixture) fixture.cleanup();
    if (outside) fs.rmSync(outside, { recursive: true, force: true });
  });

  describe('H1: fixture delete routing', () => {
    test('DELETE /api/fixtures/deleteabc deletes deleteabc, not "bc"', async () => {
      writeFixture('deleteabc'); writeFixture('bc');
      const res = await del('/api/fixtures/deleteabc');
      assert.equal(res.status, 200);
      assert.equal((await res.json()).name, 'deleteabc');
      assert.ok(!fs.existsSync(fx('deleteabc')));
      assert.ok(fs.existsSync(fx('bc')), 'the other fixture must survive');
    });

    test('a fixture literally named "delete" is deletable through DELETE /api/fixtures/delete', async () => {
      writeFixture('delete');
      const res = await del('/api/fixtures/delete');
      assert.equal(res.status, 200);
      assert.equal((await res.json()).name, 'delete');
      assert.ok(!fs.existsSync(fx('delete')));
    });

    test('POST /api/fixtures/delete {name} and legacy /api/fixtures/delete/<name> still work', async () => {
      writeFixture('deleteX'); writeFixture('legacyOne');
      assert.equal((await post('/api/fixtures/delete', { name: 'deleteX' })).status, 200);
      assert.ok(!fs.existsSync(fx('deleteX')));
      assert.equal((await del('/api/fixtures/delete/legacyOne')).status, 200);
      assert.ok(!fs.existsSync(fx('legacyOne')));
    });

    test('DELETE /api/fixtures/<name> honours expectedRevision (stale 409 keeps the file; right revision deletes)', async () => {
      writeFixture('deleteRev');
      const stale = await del('/api/fixtures/deleteRev', { expectedRevision: 'ffffffffffffffff' });
      assert.equal(stale.status, 409);
      assert.equal((await stale.json()).code, 'CONFLICT');
      assert.ok(fs.existsSync(fx('deleteRev')));
      const ok = await del('/api/fixtures/deleteRev', { expectedRevision: revisionOf('deleteRev') });
      assert.equal(ok.status, 200);
      assert.ok(!fs.existsSync(fx('deleteRev')));
    });

    test('without expectedRevision the delete still works (compatible)', async () => {
      writeFixture('deleteNoRev');
      assert.equal((await del('/api/fixtures/deleteNoRev')).status, 200);
    });
  });

  describe('H2: symlinks never let a delete reach outside the folder', () => {
    const link = (target, linkPath, type) => { try { fs.symlinkSync(target, linkPath, type); return true; } catch (_) { return false; } };

    test('script under a symlinked directory in tests/ -> 403, outside file stays', async (t) => {
      const victim = path.join(outside, 'victim.spec.js');
      fs.writeFileSync(victim, 'x');
      if (!link(outside, path.join(root, 'tests', 'linkdir'), 'junction')) return t.skip('symlink not permitted');
      const res = await post('/api/builder/delete-script', { spec: 'tests/linkdir/victim.spec.js' });
      assert.equal(res.status, 403);
      assert.ok(fs.existsSync(victim));
    });

    test('dangling symlink spec in tests/ -> 403 (not "deleted")', async (t) => {
      if (!link(path.join(outside, 'not-yet.spec.js'), path.join(root, 'tests', 'dangling.spec.js'))) return t.skip('symlink not permitted');
      const res = await post('/api/builder/delete-script', { spec: 'tests/dangling.spec.js' });
      assert.equal(res.status, 403);
    });

    test('a regular spec in tests/ is still deleted', async () => {
      fs.mkdirSync(path.join(root, 'tests/e2e'), { recursive: true });
      fs.writeFileSync(path.join(root, 'tests/e2e/plain.spec.js'), 'x');
      const res = await post('/api/builder/delete-script', { spec: 'tests/e2e/plain.spec.js' });
      assert.equal(res.status, 200);
      assert.ok(!fs.existsSync(path.join(root, 'tests/e2e/plain.spec.js')));
    });

    test('dataset that is a symlink to a file outside data/ -> 403, target and backups untouched', async (t) => {
      const secret = path.join(outside, 'secret.json');
      fs.writeFileSync(secret, '{"s":1}');
      if (!link(secret, path.join(root, 'data', 'leak.json'))) return t.skip('symlink not permitted');
      const res = await post('/api/data/delete-dataset', { fileName: 'leak.json' });
      assert.equal(res.status, 403);
      assert.ok(fs.existsSync(secret));
      assert.ok(!fs.existsSync(path.join(root, '.dashboard-backups', 'data')) || fs.readdirSync(path.join(root, '.dashboard-backups', 'data')).every((f) => !f.startsWith('leak.json')));
    });

    test('a regular dataset is still deleted', async () => {
      fs.writeFileSync(path.join(root, 'data', 'plain.json'), '[]');
      assert.equal((await post('/api/data/delete-dataset', { fileName: 'plain.json' })).status, 200);
    });

    test('custom fixture that is a symlink to a file outside -> 403, target untouched', async (t) => {
      const target = path.join(outside, 'target.js');
      fs.writeFileSync(target, 'module.exports = {};');
      if (!link(target, fx('evil'))) return t.skip('symlink not permitted');
      const res = await del('/api/fixtures/evil');
      assert.equal(res.status, 403);
      assert.ok(fs.existsSync(target));
    });
  });
});
