/**
 * tests/dashboard-api/request-guard.test.js
 * BUG-03: Origin/Host + Content-Type guard, exercised through a real HTTP dashboard server.
 */
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { startDashboardHarness } = require('../dashboard/support/dashboardHarness');
const { createFixtureWorkspace } = require('../dashboard/support/fixtureWorkspace');

function raw(harness, { method = 'GET', path = '/api/health', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: harness.port, method, path, headers, agent: false }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

describe('API Security: request guard (Origin/Host/Content-Type)', () => {
  let fixture;
  let harness;
  let local;
  before(async () => {
    fixture = createFixtureWorkspace();
    harness = await startDashboardHarness(fixture.rootPath);
    local = `http://127.0.0.1:${harness.port}`;
  });
  after(async () => {
    if (harness) await harness.stop();
    if (fixture) fixture.cleanup();
  });

  const json = (extra = {}) => ({ 'Content-Type': 'application/json', ...extra });

  test('valid GET and JSON POST pass (same-origin and no Origin)', async () => {
    assert.equal((await raw(harness)).status, 200);
    const noOrigin = await raw(harness, { method: 'POST', path: '/api/stop', headers: json(), body: '{}' });
    assert.ok([202, 409].includes(noOrigin.status), `unexpected ${noOrigin.status}`);
    const same = await raw(harness, { method: 'POST', path: '/api/stop', headers: json({ Origin: local }), body: '{}' });
    assert.ok([202, 409].includes(same.status), `unexpected ${same.status}`);
    const localhost = await raw(harness, { path: '/api/health', headers: { Host: `localhost:${harness.port}`, Origin: `http://localhost:${harness.port}` } });
    assert.equal(localhost.status, 200);
  });

  test('foreign Origin is rejected with 403 on state-changing and read APIs', async () => {
    for (const origin of ['http://evil.example', 'http://127.0.0.1:1', 'https://127.0.0.1:' + harness.port, 'null']) {
      const post = await raw(harness, { method: 'POST', path: '/api/stop', headers: json({ Origin: origin }), body: '{}' });
      assert.equal(post.status, 403, `Origin ${origin}`);
      assert.ok(JSON.parse(post.body).error);
    }
    const get = await raw(harness, { path: '/api/health', headers: { Origin: 'http://evil.example' } });
    assert.equal(get.status, 403);
  });

  test('foreign or wrong-port Host is rejected with 403 (DNS rebinding)', async () => {
    for (const host of ['evil.example', `evil.example:${harness.port}`, '127.0.0.1:1', '127.0.0.1']) {
      const res = await raw(harness, { path: '/api/health', headers: { Host: host } });
      assert.equal(res.status, 403, `Host ${host}`);
    }
  });

  test('non-JSON Content-Type on state-changing APIs gets 415, never reaching the handler', async () => {
    for (const type of ['text/plain', 'application/x-www-form-urlencoded', 'multipart/form-data; boundary=x']) {
      for (const method of ['POST', 'PUT', 'DELETE']) {
        const res = await raw(harness, { method, path: '/api/run', headers: { 'Content-Type': type }, body: '{}' });
        assert.equal(res.status, 415, `${method} ${type}`);
      }
    }
    const missing = await raw(harness, { method: 'POST', path: '/api/run' });
    assert.equal(missing.status, 415);
    const withCharset = await raw(harness, { method: 'POST', path: '/api/stop', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: '{}' });
    assert.ok([202, 409].includes(withCharset.status));
  });

  test('static assets (non-API) are not affected by the guard', async () => {
    const res = await raw(harness, { path: '/', headers: { Origin: 'http://evil.example' } });
    assert.equal(res.status, 200);
  });
});
