/**
 * tests/dashboard-api/settings-ai-security.test.js
 * API contract for the AI settings routes: the key saved in .env never leaves for an endpoint
 * chosen by the request, keys never travel in the URL, and cross-site requests are refused.
 */
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { startDashboardHarness } = require('../dashboard/support/dashboardHarness');
const { createFixtureWorkspace } = require('../dashboard/support/fixtureWorkspace');

const SERVER_KEY = 'fixture-server-key';

/** A fake OpenAI-compatible endpoint that records the Authorization header of every call. */
function startFakeProvider() {
  const calls = [];
  const server = http.createServer((req, res) => {
    calls.push({ url: req.url, authorization: req.headers.authorization || '' });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ data: [{ id: 'fake-model' }] }));
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({
      calls,
      base: `http://127.0.0.1:${server.address().port}/v1`,
      stop: () => new Promise((done) => server.close(done)),
    }));
  });
}

function rawRequest(url, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method, headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function clientConfigHeader(config) {
  return Buffer.from(JSON.stringify(config), 'utf8').toString('base64');
}

describe('API Contract: AI settings security', () => {
  let fixture;
  let harness;
  let saved;
  let other;
  let envPath;

  before(async () => {
    saved = await startFakeProvider();
    other = await startFakeProvider();
    fixture = createFixtureWorkspace();
    envPath = path.join(fixture.rootPath, '.env');
    fs.writeFileSync(envPath, `AI_PROVIDER=custom\nAI_BASE_URL=${saved.base}\nAI_MODEL=fake-model\nAI_API_KEY=${SERVER_KEY}\n`, 'utf8');
    harness = await startDashboardHarness(fixture.rootPath);
  });

  after(async () => {
    if (harness) await harness.stop();
    if (fixture) fixture.cleanup();
    if (saved) await saved.stop();
    if (other) await other.stop();
  });

  test('GET /api/ai/models gửi key .env tới đúng endpoint đã lưu', async () => {
    saved.calls.length = 0;
    const res = await fetch(`${harness.url}/api/ai/models?baseURL=${encodeURIComponent(saved.base)}`);
    assert.equal(res.status, 200);
    assert.deepEqual((await res.json()).models, ['fake-model']);
    assert.deepEqual(saved.calls.map((c) => c.authorization), [`Bearer ${SERVER_KEY}`]);
  });

  test('GET /api/ai/models chặn endpoint ngoài allowlist và không gọi ra ngoài', async () => {
    other.calls.length = 0;
    const res = await fetch(`${harness.url}/api/ai/models?baseURL=${encodeURIComponent(other.base)}`);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.error, /không được phép/);
    assert.equal(other.calls.length, 0);
  });

  test('GET /api/ai/models từ chối apiKey trên query string', async () => {
    saved.calls.length = 0;
    const res = await fetch(`${harness.url}/api/ai/models?baseURL=${encodeURIComponent(saved.base)}&apiKey=from-url`);
    assert.equal(res.status, 400);
    assert.equal(saved.calls.length, 0);
  });

  test('GET /api/ai/models dùng key cá nhân gửi qua header X-AI-Config', async () => {
    saved.calls.length = 0;
    const res = await fetch(`${harness.url}/api/ai/models?baseURL=${encodeURIComponent(saved.base)}`, {
      headers: { 'X-AI-Config': clientConfigHeader({ apiKey: 'personal-key' }) },
    });
    assert.equal(res.status, 200);
    assert.deepEqual(saved.calls.map((c) => c.authorization), ['Bearer personal-key']);
  });

  test('POST /api/ai/test-connection không gửi key .env tới endpoint do request chọn', async () => {
    other.calls.length = 0;
    const res = await fetch(`${harness.url}/api/ai/test-connection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'custom', baseURL: other.base, apiKey: '' }),
    });
    assert.equal(res.status, 400);
    assert.match((await res.json()).error, /Base URL khác với cấu hình đã lưu/);
    assert.equal(other.calls.length, 0);
  });

  test('POST /api/ai/test-connection vẫn thử được endpoint mới bằng key người dùng nhập', async () => {
    other.calls.length = 0;
    const res = await fetch(`${harness.url}/api/ai/test-connection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'custom', baseURL: other.base, apiKey: 'typed-key', model: 'fake-model' }),
    });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).success, true);
    assert.deepEqual(other.calls.map((c) => c.authorization), ['Bearer typed-key']);
  });

  test('POST /api/ai/config chặn giá trị có xuống dòng và giữ nguyên .env', async () => {
    const envBefore = fs.readFileSync(envPath, 'utf8');
    const res = await fetch(`${harness.url}/api/ai/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'custom', model: 'm\nNODE_OPTIONS=--require=./evil.js' }),
    });
    assert.equal(res.status, 400);
    assert.equal(fs.readFileSync(envPath, 'utf8'), envBefore);
  });

  test('Request từ trang web khác bị từ chối trước khi đọc body', async () => {
    const envBefore = fs.readFileSync(envPath, 'utf8');
    const port = new URL(harness.url).port;
    const crossSite = await rawRequest(`${harness.url}/api/ai/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain', Origin: 'http://attacker.example', 'Sec-Fetch-Site': 'cross-site' },
      body: JSON.stringify({ provider: 'custom', baseURL: 'http://attacker.example/v1' }),
    });
    assert.equal(crossSite.status, 403);
    assert.equal(fs.readFileSync(envPath, 'utf8'), envBefore);

    const rebinding = await rawRequest(`${harness.url}/api/ai/models`, { headers: { Host: `attacker.example:${port}` } });
    assert.equal(rebinding.status, 403);
  });

  test('GET /api/ai/config không trả key đầy đủ', async () => {
    const res = await fetch(`${harness.url}/api/ai/config`);
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.equal(text.includes(SERVER_KEY), false);
    assert.equal(JSON.parse(text).hasKey, true);
  });
});
