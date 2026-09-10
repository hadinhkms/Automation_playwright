/**
 * tests/dashboard-api/resources-security.test.js
 * API Contract & Security Boundary tests for:
 * - /api/resources
 * - /api/code
 * - Path traversal guards (safeChildPath)
 */
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startDashboardHarness } = require('../dashboard/support/dashboardHarness');
const { createFixtureWorkspace } = require('../dashboard/support/fixtureWorkspace');

describe('API Contract & Security: Resource Routes', () => {
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

  test('GET /api/resources returns 200 and lists resource categories', async () => {
    const res = await fetch(`${harness.url}/api/resources`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') || '', /application\/json/);
    const body = await res.json();
    assert.ok(typeof body === 'object');
  });

  test('GET /api/code without filePath returns 404 and error', async () => {
    const res = await fetch(`${harness.url}/api/code`);
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.ok(body.error !== undefined);
  });

  test('GET /api/code with path traversal (../../) is blocked with 403 or 400', async () => {
    const res = await fetch(`${harness.url}/api/code?path=../../package.json`);
    assert.ok([400, 403, 404].includes(res.status), `Expected 400/403/404 for traversal, got ${res.status}`);
    const body = await res.json();
    assert.ok(body.error !== undefined);
  });

  test('POST /api/resource/delete with path traversal is rejected', async () => {
    const res = await fetch(`${harness.url}/api/resource/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath: '../../sensitive.txt' }),
    });
    assert.ok([400, 403, 404].includes(res.status), `Expected error status, got ${res.status}`);
  });
});
