/**
 * tests/dashboard-api/recorder.test.js
 * API Contract tests for recorder endpoints: /api/recorder/status, reset, stop, scan-pages
 * Executed via Node.js native test runner (node --test).
 */
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startDashboardHarness } = require('../dashboard/support/dashboardHarness');
const { createFixtureWorkspace } = require('../dashboard/support/fixtureWorkspace');

describe('API Contract: Recorder & Codegen Routes', () => {
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

  test('GET /api/recorder/status returns 200 and recorder state', async () => {
    const res = await fetch(`${harness.url}/api/recorder/status`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') || '', /application\/json/);
    const body = await res.json();
    assert.equal(typeof body.isRecording, 'boolean');
    assert.ok(Array.isArray(body.recentRecordings));
  });

  test('POST /api/recorder/reset returns 200 and resets session state', async () => {
    const res = await fetch(`${harness.url}/api/recorder/reset`, { method: 'POST' });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.message !== undefined);
  });

  test('POST /api/recorder/stop returns 400 when no active recorder session', async () => {
    const res = await fetch(`${harness.url}/api/recorder/stop`, { method: 'POST' });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /Không có phiên ghi nào đang chạy/);
  });

  test('POST /api/recorder/scan-pages returns 200 with pages list', async () => {
    const res = await fetch(`${harness.url}/api/recorder/scan-pages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: 'desktop' }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.platform, 'desktop');
    assert.ok(Array.isArray(body.pages));
  });

  test('POST /api/recorder/start concurrent calls are guarded by mutex (one succeeds, one gets 409)', async () => {
    const [res1, res2] = await Promise.all([
      fetch(`${harness.url}/api/recorder/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://example.com', force: true }),
      }),
      fetch(`${harness.url}/api/recorder/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://example.com', force: true }),
      }),
    ]);

    const statuses = [res1.status, res2.status];
    assert.ok(statuses.includes(409), 'One concurrent start request must be rejected with 409 Conflict');
    assert.ok(statuses.includes(200), 'One concurrent start request must succeed with 200 OK');

    // Clean up active recorder session
    await fetch(`${harness.url}/api/recorder/reset`, { method: 'POST' });
  });
});
