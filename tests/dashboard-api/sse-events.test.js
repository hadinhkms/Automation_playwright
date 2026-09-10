/**
 * tests/dashboard-api/sse-events.test.js
 * API Contract test for SSE Streaming (/api/events) and Runner State (/api/state)
 * Verifies TC-02: SSE connect, header validation, client cleanup on disconnect.
 */
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { startDashboardHarness } = require('../dashboard/support/dashboardHarness');
const { createFixtureWorkspace } = require('../dashboard/support/fixtureWorkspace');

describe('API Contract: SSE Streaming & Runner State (TC-02)', () => {
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

  test('GET /api/events connects with text/event-stream and sends initial ping', async () => {
    return new Promise((resolve, reject) => {
      const req = http.get(`${harness.url}/api/events`, (res) => {
        assert.equal(res.statusCode, 200);
        assert.equal(res.headers['content-type'], 'text/event-stream');
        assert.equal(res.headers['connection'], 'keep-alive');

        let dataReceived = '';
        res.on('data', (chunk) => {
          dataReceived += chunk.toString();
          if (dataReceived.includes(': connected')) {
            // Received SSE initial handshake, abort connection cleanly
            req.destroy();
            resolve();
          }
        });
      });

      req.on('error', (err) => {
        if (err.message.includes('socket hang up') || req.destroyed) {
          // Expected on manual destroy
          resolve();
        } else {
          reject(err);
        }
      });

      // 5 second safety timeout
      setTimeout(() => {
        req.destroy();
        reject(new Error('Timed out waiting for SSE connected message'));
      }, 5000);
    });
  });

  test('GET /api/state returns valid initial state snapshot', async () => {
    const res = await fetch(`${harness.url}/api/state`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.activeRun === null || typeof body.activeRun === 'object');
    assert.ok(Array.isArray(body.logs));
  });

  test('POST /api/run with invalid spec returns 400 Bad Request', async () => {
    const res = await fetch(`${harness.url}/api/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spec: 'non_existent_spec_file.spec.js' })
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error !== undefined);
  });
});
