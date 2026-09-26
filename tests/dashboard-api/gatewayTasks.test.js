/**
 * tests/dashboard-api/gatewayTasks.test.js
 * Verifies AI tasks (AI17-03, 08, 15, 16, 17) via FakeAiProvider.
 * Strict ceiling <= 150 lines.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const FakeAiProvider = require('../dashboard/support/fakeAiProvider');
const { createFixtureWorkspace } = require('../dashboard/support/fixtureWorkspace');
const { runArbitrateConflict } = require('../../core/ai/tasks/arbitrateConflict');
const { runInferTestCases } = require('../../core/ai/tasks/inferTestCases');
const { runInlineSuggest } = require('../../core/ai/tasks/inlineSuggest');

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

  await t.test('AI17-15: runArbitrateConflict validates schema and resolves conflict', async () => {
    const verdictPayload = {
      recommendation: 'sync_doc_to_spec',
      confidence: 0.92,
      reason: 'Specification reflects true business requirement'
    };
    fakeServer.options.responseText = JSON.stringify(verdictPayload);

    const clientConfig = { provider: '9router', apiKey: 'test-key', baseURL: fakeServer.getBaseUrl() };
    const res = await runArbitrateConflict({
      ctx: { specFile: 'tests/cart.spec.js', acDefinitions: { AC1: { text: 'Tax is 10%', file: 'req.md', line: 5 } } },
      clientConfig,
      root: ws.rootPath
    });

    assert.equal(res.ok, true);
    assert.equal(res.recommendation, 'sync_doc_to_spec');
    assert.equal(res.confidence >= 0, true);
    assert.equal(fakeServer.requests.length >= 1, true);
  });

  await t.test('AI17-16: runInferTestCases parses valid test scenarios', async () => {
    const inferPayload = {
      suggestedTestCases: [
        { id: 'TC-NEW-01', title: 'Verify checkout with voucher', priority: 'P1', rationale: 'Missing discount test' }
      ]
    };
    fakeServer.options.responseText = JSON.stringify(inferPayload);

    const clientConfig = { provider: '9router', apiKey: 'test-key', baseURL: fakeServer.getBaseUrl() };
    const res = await runInferTestCases({
      reqId: 'REQ-01',
      specContent: 'test("cart", () => {});',
      clientConfig,
      root: ws.rootPath
    });

    assert.equal(res.ok, true);
    assert.equal(res.suggestedTestCases.length, 1);
    assert.equal(res.suggestedTestCases[0].id, 'TC-NEW-01');
  });

  await t.test('AI17-17: runInlineSuggest executes on fast tier', async () => {
    fakeServer.options.responseText = 'await page.locator("#btn-submit").click();';
    const clientConfig = { provider: '9router', apiKey: 'test-key', baseURL: fakeServer.getBaseUrl() };

    const res = await runInlineSuggest({
      promptText: 'Complete button click:',
      clientConfig,
      root: ws.rootPath
    });

    assert.equal(res.ok, true);
    assert.equal(res.tier, 'fast');
    assert.match(res.suggestion, /await page\.locator/);
  });

  await t.test('AI17-03: 9Router configuration sends 100% requests to 9Router baseURL', async () => {
    fakeServer.options.responseText = 'ok completion';
    const clientConfig = { provider: '9router', apiKey: 'test-key', baseURL: fakeServer.getBaseUrl() };

    await runInlineSuggest({ promptText: 'ping 1', clientConfig, root: ws.rootPath });
    await runInlineSuggest({ promptText: 'ping 2', clientConfig, root: ws.rootPath });

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
    const clientConfig = { provider: '9router', apiKey: 'test-key', baseURL: fakeServer.getBaseUrl() };

    const taskPromise = runInlineSuggest({
      promptText: 'will be cancelled',
      clientConfig,
      root: ws.rootPath,
      signal: controller.signal
    });

    setTimeout(() => controller.abort(), 50);
    const res = await taskPromise;

    assert.equal(res.ok, false);
    assert.equal(res.error?.code, 'CANCELLED');
  });
});
