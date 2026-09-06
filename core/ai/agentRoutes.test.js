const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { once } = require('events');
const { createAgentRoutes, isLocalRequest } = require('./agentRoutes');

test('Rejects cross-site, origin spoofing and DNS rebinding', () => {
  const base = { headers: { host: '127.0.0.1:4188' }, socket: { localPort: 4188 } };
  assert.equal(isLocalRequest(base), true);
  for (const headers of [{ host: 'evil.test:4188' }, { host: '127.0.0.1:1234' }, { origin: 'http://evil.test' }, { 'sec-fetch-site': 'cross-site' }]) {
    assert.equal(isLocalRequest({ ...base, headers: { ...base.headers, ...headers } }), false);
  }
});

test('HTTP routes validate headers, payload, busy conflicts and session lifecycle', async t => {
  let busy = false;
  let started = 0;
  const id = '11111111-1111-4111-8111-111111111111';
  const service = {
    status: async () => ({ available: false, models: [] }), list: () => [],
    start: async body => { if (!body.prompt) throw Object.assign(new Error('Nhập yêu cầu.'), { statusCode: 400 }); started++; return { id, status: 'running' }; },
    get: sessionId => ({ id: sessionId, status: 'running' }), stop: sessionId => ({ id: sessionId, status: 'stopped' }),
  };
  const handler = createAgentRoutes({ service, isBusy: () => busy,
    sendJson: (response, code, body) => { response.writeHead(code, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(body)); },
    parseBody: async request => { let body = ''; for await (const chunk of request) body += chunk; return JSON.parse(body); } });
  const server = http.createServer(async (request, response) => {
    if (!await handler(request, response, new URL(request.url, 'http://localhost'))) { response.writeHead(404); response.end(); }
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${server.address().port}/api/agent`;
  const headers = { 'Content-Type': 'application/json', 'X-Dashboard-Agent': '1' };
  assert.equal((await fetch(`${base}/status`)).status, 200);
  assert.equal((await fetch(`${base}/status`, { headers: { Origin: 'http://evil.test' } })).status, 403);
  assert.equal((await fetch(`${base}/sessions`, { method: 'POST', body: '{}' })).status, 403);
  assert.equal((await fetch(`${base}/sessions`, { method: 'POST', headers, body: '{' })).status, 400);
  assert.equal((await fetch(`${base}/sessions`, { method: 'POST', headers, body: '{}' })).status, 400);
  busy = true;
  assert.equal((await fetch(`${base}/sessions`, { method: 'POST', headers, body: '{"prompt":"Fix"}' })).status, 409);
  assert.equal(started, 0); busy = false;
  const result = await fetch(`${base}/sessions`, { method: 'POST', headers, body: '{"prompt":"Fix"}' });
  assert.equal(result.status, 202);
  assert.equal((await result.json()).session.id, id);
  assert.equal((await fetch(`${base}/sessions/${id}`)).status, 200);
  const stopped = await fetch(`${base}/sessions/${id}/stop`, { method: 'POST', headers, body: '{}' });
  assert.equal((await stopped.json()).session.status, 'stopped');
});
