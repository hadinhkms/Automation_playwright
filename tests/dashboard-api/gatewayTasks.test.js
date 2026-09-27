/**
 * tests/dashboard-api/gatewayTasks.test.js
 * Verifies AI gateway routing (AI17-03) and cancellation (AI17-08) via FakeAiProvider.
 * The QA tasks themselves are deterministic; these tests exercise callAi directly.
 * Strict ceiling <= 150 lines.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const FakeAiProvider = require('../dashboard/support/fakeAiProvider');
const { createFixtureWorkspace } = require('../dashboard/support/fixtureWorkspace');
const { callAi } = require('../../core/ai/gateway/index');

test('AI Gateway Tasks Suite', async (t) => {
  let fakeServer = null;
  let ws = null;

  t.beforeEach(async () => {
    ws = createFixtureWorkspace();
    fakeServer = new FakeAiProvider();
    await fakeServer.start();
  });

  t.afterEach(async () => {
    if (fakeServer) await fakeServer.stop();
    if (ws) ws.cleanup();
  });

  const ask = (promptText, extra = {}) => callAi({
    task: 'agentTurn',
    messages: [{ role: 'user', content: promptText }],
    clientConfig: { provider: '9router', apiKey: 'test-key', baseURL: fakeServer.getBaseUrl() },
    root: ws.rootPath,
    tier: 'fast',
    timeoutMs: 10000,
    ...extra
  });

  await t.test('AI17-03: 9Router configuration sends 100% requests to 9Router baseURL', async () => {
    fakeServer.options.responseText = 'ok completion';

    const first = await ask('ping 1');
    const second = await ask('ping 2');
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);

    const postRequests = fakeServer.requests.filter((r) => r.method === 'POST');
    assert.equal(postRequests.length, 2);
    for (const r of fakeServer.requests) {
      if (r.headers.authorization) {
        assert.equal(r.headers.authorization, 'Bearer test-key');
      }
    }
  });

  await t.test('AI17-08: Cancel signal aborts task execution cleanly', async () => {
    fakeServer.options.delayMs = 800;
    fakeServer.options.responseText = 'delayed response';

    const controller = new AbortController();
    const taskPromise = ask('will be cancelled', { signal: controller.signal });

    setTimeout(() => controller.abort(), 50);
    const res = await taskPromise;

    assert.equal(res.ok, false);
    assert.equal(res.code, 'CANCELLED');
  });
});
