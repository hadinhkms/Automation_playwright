/**
 * tests/dashboard-api/server-lows-g4.test.js
 * Gate 4 (item #2) Low findings, via real HTTP:
 *  O-1 control characters (NUL, CR, LF) in the /api/mp target are rejected (400)
 *  O-5 /api/mp without a Master Process Hub answers 503 + JSON, not 500
 *  O-2 a dashboard process NODE_ENV that is not a configured environment must not empty the
 *      Playwright project list, and a genuinely unreadable playwright.config.js is named in the 400.
 */
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { startDashboardHarness } = require('../dashboard/support/dashboardHarness');
const { createFixtureWorkspace } = require('../dashboard/support/fixtureWorkspace');
const { detectMasterRoot } = require('../../dashboard/services/masterProcessUtils');

const ENGINE = path.resolve(__dirname, '../..');
const post = (h, p, body) => fetch(`${h.url}${p}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

describe('O-1: control characters in /api/mp target', () => {
  let fixture; let harness;
  before(async () => { fixture = createFixtureWorkspace(); harness = await startDashboardHarness(fixture.rootPath); });
  after(async () => { if (harness) await harness.stop(); if (fixture) fixture.cleanup(); });

  for (const [name, ch] of [['NUL', '%00'], ['CR', '%0d'], ['LF', '%0a'], ['ESC', '%1b'], ['DEL', '%7f']]) {
    test(`GET /api/mp/status?target=...${name} -> 400`, async () => {
      const res = await fetch(`${harness.url}/api/mp/status?target=${encodeURIComponent(fixture.rootPath)}${ch}x`);
      assert.equal(res.status, 400);
      const body = await res.json();
      assert.equal(body.ok, false);
      assert.match(body.error, /ký tự điều khiển/);
    });
  }

  test('NUL in a JSON body targetPath -> 400', async () => {
    const res = await post(harness, '/api/mp/doctor', { targetPath: `${fixture.rootPath}\u0000evil` });
    assert.equal(res.status, 400);
  });
});

describe('O-5: /api/mp without a Hub answers 503', () => {
  let fixture; let harness; let hubPresent;
  before(async () => {
    fixture = createFixtureWorkspace();
    hubPresent = Boolean(detectMasterRoot(fixture.rootPath));
    harness = await startDashboardHarness(fixture.rootPath);
  });
  after(async () => { if (harness) await harness.stop(); if (fixture) fixture.cleanup(); });

  for (const [method, route] of [['POST', '/api/mp/doctor'], ['POST', '/api/mp/sync'], ['POST', '/api/mp/init'], ['POST', '/api/mp/probes'], ['POST', '/api/mp/audit'], ['GET', '/api/mp/audit']]) {
    test(`${method} ${route} -> 503 JSON`, async (t) => {
      if (hubPresent) return t.skip('a Master Process Hub exists on this machine');
      const res = method === 'GET'
        ? await fetch(`${harness.url}${route}`)
        : await post(harness, route, {});
      assert.equal(res.status, 503);
      const body = await res.json();
      assert.equal(body.ok, false);
      assert.match(body.error, /Không tìm thấy Master Process Hub/);
    });
  }

  test('GET /api/mp/status keeps answering 200 {available:false}', async (t) => {
    if (hubPresent) return t.skip('a Master Process Hub exists on this machine');
    const res = await fetch(`${harness.url}/api/mp/status`);
    assert.equal(res.status, 200);
    assert.equal((await res.json()).available, false);
  });
});

describe('O-2: Playwright project list vs the dashboard process NODE_ENV', () => {
  let fixture; let harness; let brokenFixture; let brokenHarness;
  const configUsingEnv = `require(${JSON.stringify(path.join(ENGINE, 'core/config/env'))});\nmodule.exports = { projects: [{ name: 'setup' }, { name: 'Desktop Smoke Tests' }] };\n`;

  before(async () => {
    fixture = createFixtureWorkspace();
    fs.writeFileSync(path.join(fixture.rootPath, 'playwright.config.js'), configUsingEnv);
    // The harness starts the server with NODE_ENV=test, which is not a configured environment (qc, ...).
    harness = await startDashboardHarness(fixture.rootPath);
    brokenFixture = createFixtureWorkspace();
    fs.writeFileSync(path.join(brokenFixture.rootPath, 'playwright.config.js'), "throw new Error('boom-config');\n");
    brokenHarness = await startDashboardHarness(brokenFixture.rootPath);
  });
  after(async () => {
    for (const h of [harness, brokenHarness]) if (h) await h.stop();
    for (const f of [fixture, brokenFixture]) if (f) f.cleanup();
  });

  test('/api/config lists the real projects although NODE_ENV is not a configured environment', async () => {
    const body = await (await fetch(`${harness.url}/api/config`)).json();
    assert.ok(body.projects.includes('Desktop Smoke Tests'), JSON.stringify(body.projects));
    assert.ok(!body.projects.includes('setup'));
  });

  test('POST /api/run with an unknown project on a healthy config: plain 400, no config-error suffix', async () => {
    const res = await post(harness, '/api/run', { project: 'Nope' });
    assert.equal(res.status, 400);
    const { error } = await res.json();
    assert.match(error, /^Project không hợp lệ\.$/);
  });

  test('POST /api/run when playwright.config.js cannot be loaded: 400 names the file and the reason', async () => {
    const res = await post(brokenHarness, '/api/run', { project: 'Desktop Smoke Tests' });
    assert.equal(res.status, 400);
    const { error } = await res.json();
    assert.match(error, /Project không hợp lệ/);
    assert.match(error, /playwright\.config\.js/);
    assert.match(error, /boom-config/);
  });
});
