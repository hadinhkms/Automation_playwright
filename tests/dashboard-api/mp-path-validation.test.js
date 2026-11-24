/**
 * tests/dashboard-api/mp-path-validation.test.js
 * BUG-06: /api/mp/* target whitelist must reject absolute-outside, traversal, symlink escape and
 * foreign drive paths (C:\Windows) on every OS — via real HTTP, no Master Process Hub needed.
 */
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startDashboardHarness } = require('../dashboard/support/dashboardHarness');
const { createFixtureWorkspace } = require('../dashboard/support/fixtureWorkspace');

describe('API Security: /api/mp target path whitelist', () => {
  let fixture;
  let harness;
  let outside;

  before(async () => {
    fixture = createFixtureWorkspace();
    outside = fs.mkdtempSync(path.join(os.tmpdir(), 'mp-outside-'));
    fs.writeFileSync(path.join(outside, 'secret.txt'), 'x');
    try {
      fs.symlinkSync(outside, path.join(fixture.rootPath, 'escape-link'), 'junction');
    } catch (_) { /* symlink not permitted: that case is skipped below */ }
    harness = await startDashboardHarness(fixture.rootPath);
  });

  after(async () => {
    if (harness) await harness.stop();
    if (fixture) fixture.cleanup();
    if (outside) fs.rmSync(outside, { recursive: true, force: true });
  });

  const status = (target) => fetch(`${harness.url}/api/mp/status?target=${encodeURIComponent(target)}`);

  for (const [name, target] of [
    ['absolute path outside the project', () => outside],
    ['absolute system path', () => '/etc'],
    ['parent traversal', () => '../..'],
    ['nested traversal', () => 'inner/../../../etc'],
    ['sibling of the Hub root with the same name prefix', () => `${path.resolve(__dirname, '../..')}-evil`],
    ['Windows drive path with forward slash', () => 'C:/Windows'],
    ['Windows drive path with backslash', () => 'C:\\Windows\\System32'],
  ]) {
    test(`rejects ${name} with 403`, async () => {
      const res = await status(target());
      assert.equal(res.status, 403);
      const body = await res.json();
      assert.equal(body.ok, false);
      assert.match(body.error, /outside allowed project whitelist/);
    });
  }

  test('rejects a symlink inside the project that points outside (403)', async (t) => {
    if (!fs.existsSync(path.join(fixture.rootPath, 'escape-link'))) return t.skip('symlink not permitted on this OS/user');
    assert.equal((await status(path.join(fixture.rootPath, 'escape-link'))).status, 403);
    assert.equal((await status(path.join(fixture.rootPath, 'escape-link', 'secret.txt'))).status, 403);
  });

  test('still accepts the project root itself', async () => {
    const res = await status(fixture.rootPath);
    assert.notEqual(res.status, 403);
  });
});
