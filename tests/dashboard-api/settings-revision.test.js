/**
 * tests/dashboard-api/settings-revision.test.js
 * Optimistic concurrency for /api/settings (Gate 3 F2): a stale tab must not overwrite a newer save.
 * The fixture workspace has its own dashboardConfig.json, so the tracked core/config file is never written.
 */
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { startDashboardHarness } = require('../dashboard/support/dashboardHarness');
const { createFixtureWorkspace } = require('../dashboard/support/fixtureWorkspace');

describe('API Contract: /api/settings revision + 409', () => {
  let fixture; let harness; let cfgFile;
  const get = async () => (await fetch(`${harness.url}/api/settings`)).json();
  const put = (body, headers = {}) => fetch(`${harness.url}/api/settings`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
  });
  const withName = (cfg, name, extra = {}) => ({ ...cfg, branding: { ...cfg.branding, projectName: name }, ...extra });

  before(async () => {
    fixture = createFixtureWorkspace();
    cfgFile = path.join(fixture.rootPath, 'dashboardConfig.json');
    fs.writeFileSync(cfgFile, '{}\n');
    harness = await startDashboardHarness(fixture.rootPath);
  });
  after(async () => { if (harness) await harness.stop(); if (fixture) fixture.cleanup(); });

  test('GET returns a revision (sha1 of the saved file) and it is stable between reads', async () => {
    const a = await get();
    assert.match(a.revision, /^[0-9a-f]{40}$/);
    assert.equal((await get()).revision, a.revision);
  });

  test('two clients on the same base: second gets 409 CONFIG_CONFLICT and the file is untouched', async () => {
    const base = await get();
    const first = await put(withName(base, 'Tab-A', { baseRevision: base.revision }));
    assert.equal(first.status, 200);
    const firstBody = await first.json();
    assert.match(firstBody.revision, /^[0-9a-f]{40}$/);
    assert.notEqual(firstBody.revision, base.revision);

    const before = fs.readFileSync(cfgFile, 'utf8');
    const second = await put(withName(base, 'Tab-B', { baseRevision: base.revision }));
    assert.equal(second.status, 409);
    const body = await second.json();
    assert.equal(body.ok, false);
    assert.equal(body.code, 'CONFIG_CONFLICT');
    assert.match(body.error, /đã được thay đổi ở nơi khác/);
    assert.equal(body.revision, firstBody.revision);
    assert.equal(fs.readFileSync(cfgFile, 'utf8'), before, '409 must not write the file');
    assert.equal((await get()).branding.projectName, 'Tab-A');
  });

  test('without baseRevision the save still works (legacy client) and the revision changes', async () => {
    const cur = await get();
    const res = await put(withName(cur, 'Legacy'));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.notEqual(body.revision, cur.revision);
    assert.equal((await get()).revision, body.revision);
  });

  test('revision changes after every save and the response revision is the one GET returns', async () => {
    const seen = new Set();
    let cur = await get();
    for (const name of ['R1', 'R2', 'R3']) {
      const res = await put(withName(cur, name, { baseRevision: cur.revision }));
      assert.equal(res.status, 200);
      const { revision } = await res.json();
      assert.ok(!seen.has(revision));
      seen.add(revision);
      cur = await get();
      assert.equal(cur.revision, revision);
    }
  });

  test('If-Match header is honoured: stale -> 409, current (quoted or W/) -> 200', async () => {
    const cur = await get();
    const stale = await put(withName(cur, 'IM-stale'), { 'If-Match': '"0000000000000000000000000000000000000000"' });
    assert.equal(stale.status, 409);
    const ok = await put(withName(cur, 'IM-ok'), { 'If-Match': `W/"${cur.revision}"` });
    assert.equal(ok.status, 200);
  });

  test('editing the config file by hand also changes the revision (single, state-derived source)', async () => {
    const cur = await get();
    fs.writeFileSync(cfgFile, `${fs.readFileSync(cfgFile, 'utf8')}\n`);
    assert.notEqual((await get()).revision, cur.revision);
    const res = await put(withName(cur, 'After-manual-edit', { baseRevision: cur.revision }));
    assert.equal(res.status, 409);
  });
});
