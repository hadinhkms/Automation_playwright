/**
 * tests/dashboard-api/master-process.test.js
 * API Contract tests for Master Process endpoints:
 * /api/mp/status, /api/mp/sync, /api/mp/audit, whitelist validation (403), mutex (409).
 * Executed via Node.js native test runner (node --test).
 */
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { startDashboardHarness } = require('../dashboard/support/dashboardHarness');

describe('API Contract: Master Process Integration Routes', () => {
  let harness;
  const projectRoot = path.resolve(__dirname, '../..');

  before(async () => {
    // Run harness on the actual project root so Master Process Hub is discoverable
    harness = await startDashboardHarness(projectRoot);
  });

  after(async () => {
    if (harness) await harness.stop();
  });

  test('GET /api/mp/status returns 200 and valid schema', async () => {
    const res = await fetch(`${harness.url}/api/mp/status`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.available, true);
    assert.ok(body.hub_path);
    assert.ok(body.quality);
    assert.equal(typeof body.quality.candidates_lines, 'number');
  });

  test('GET /api/mp/status?target=C:/Windows returns 403 Forbidden', async () => {
    const res = await fetch(`${harness.url}/api/mp/status?target=C:/Windows`);
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.ok, false);
    assert.match(body.error, /outside allowed project whitelist/);
  });

  test('POST /api/mp/sync with dryRun returns 200', async () => {
    const res = await fetch(`${harness.url}/api/mp/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dryRun: true }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
  });

  test('Concurrent direct mutation calls trigger Mutex 409 Conflict', async () => {
    // Fire doctor and audit simultaneously
    const p1 = fetch(`${harness.url}/api/mp/doctor`, { method: 'POST' });
    const p2 = await fetch(`${harness.url}/api/mp/doctor`, { method: 'POST' });
    const body2 = await p2.json();

    assert.equal(p2.status, 409);
    assert.equal(body2.code, 409);
    assert.equal(body2.ok, false);
    assert.match(body2.error, /đang chạy/);

    const r1 = await p1;
    await r1.json().catch(() => ({}));
  });

  test('POST /api/mp/audit returns modularity metrics and details breakdown', async () => {
    const res = await fetch(`${harness.url}/api/mp/audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staged: false }),
    });
    // Can be 200 or 400 depending on whether working copy has violations
    assert.ok(res.status === 200 || res.status === 400);
    const body = await res.json();
    assert.equal(typeof body.scanned, 'number');
    assert.equal(typeof body.violations, 'number');
    assert.ok(body.details);
    assert.ok(Array.isArray(body.details.violations));
    assert.ok(Array.isArray(body.details.exemptions));
  });
});
