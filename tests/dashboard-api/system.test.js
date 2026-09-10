/**
 * tests/dashboard-api/system.test.js
 * API Contract tests for system endpoints: /api/config, /api/health, /api/state
 * Executed via Node.js native test runner (node --test).
 */
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startDashboardHarness } = require('../dashboard/support/dashboardHarness');
const { createFixtureWorkspace } = require('../dashboard/support/fixtureWorkspace');

describe('API Contract: System & Lifecycle Routes', () => {
  let fixture;
  let harness;

  before(async () => {
    fixture = createFixtureWorkspace();
    harness = await startDashboardHarness(fixture.rootPath);
  });

  after(async () => {
    if (harness) await harness.stop();
    if (fixture) fixture.cleanup();
  });

  test('GET /api/health returns 200 and healthy server payload', async () => {
    const res = await fetch(`${harness.url}/api/health`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') || '', /application\/json/);
    const body = await res.json();
    assert.ok(body.appName !== undefined);
    assert.ok(body.port !== undefined);
    assert.ok(body.pid !== undefined);
    assert.ok(body.workspaceRoot !== undefined);
  });

  test('GET /api/config returns 200 and valid configuration schema', async () => {
    const res = await fetch(`${harness.url}/api/config`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') || '', /application\/json/);
    const body = await res.json();
    assert.ok(typeof body === 'object');
    assert.ok(body.branding !== undefined || body.features !== undefined || body.port !== undefined);
  });

  test('GET /api/state returns 200 and runner state schema', async () => {
    const res = await fetch(`${harness.url}/api/state`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') || '', /application\/json/);
    const body = await res.json();
    assert.ok(body.status !== undefined || body.activeRun !== undefined || body.running !== undefined);
  });

  test('GET /api/unknown-endpoint returns 404 with error payload', async () => {
    const res = await fetch(`${harness.url}/api/unknown-endpoint`);
    assert.equal(res.status, 404);
    assert.match(res.headers.get('content-type') || '', /application\/json/);
    const body = await res.json();
    assert.ok(body.error !== undefined);
  });
});
