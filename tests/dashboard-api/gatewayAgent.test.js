/**
 * tests/dashboard-api/gatewayAgent.test.js
 * Verifies Agent service integration with AI Gateway (AI17-09).
 * Strict ceiling <= 150 lines.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const FakeAiProvider = require('../dashboard/support/fakeAiProvider');
const { createFixtureWorkspace } = require('../dashboard/support/fixtureWorkspace');
const { createAgentService } = require('../../core/ai/agentService');

test('Agent Service Gateway Integration Suite', async (t) => {
  let fakeServer = null;
  let ws = null;
  let agentService = null;

  t.beforeEach(async () => {
    ws = createFixtureWorkspace();
    fakeServer = new FakeAiProvider();
    await fakeServer.start();
    agentService = createAgentService({ root: ws.rootPath });
  });

  t.afterEach(async () => {
    if (agentService) agentService.shutdown();
    if (fakeServer) await fakeServer.stop();
    if (ws) ws.cleanup();
  });

  await t.test('testConnection succeeds with FakeAiProvider', async () => {
    fakeServer.options.responseText = 'Connection test response';
    const result = await agentService.testConnection({
      provider: '9router',
      apiKey: 'test-key',
      baseURL: fakeServer.getBaseUrl(),
      model: 'qaFast'
    });

    assert.equal(result.success, true);
    assert.equal(result.provider, '9router');
    assert.equal(typeof result.latencyMs, 'number');
  });

  await t.test('inlineSuggest provides valid completion via Gateway', async () => {
    fakeServer.options.responseText = 'expect(page).toHaveTitle("Home");';
    const result = await agentService.inlineSuggest({
      prefix: 'await page.goto("/");\n// Check home title',
      suffix: '',
      clientConfig: { provider: '9router', apiKey: 'test-key', baseURL: fakeServer.getBaseUrl() }
    });

    assert.equal(result.success, true);
    assert.match(result.suggestion, /expect\(page\)\.toHaveTitle/);
  });

  await t.test('getQuotaStatus accurately reflects Gateway 5h token ledger', async () => {
    const status = agentService.status({
      clientConfig: { provider: '9router', apiKey: 'test-key', baseURL: fakeServer.getBaseUrl() }
    });

    assert.equal(status.available, true);
    assert.equal(typeof status.tokenQuota.remainingTokens, 'number');
    assert.equal(status.tokenQuota.limitLabel, '1.000.000 TPM / 5h');
  });

  await t.test('AI17-09: stop(id) aborts in-flight execution and marks session stopped', async () => {
    fakeServer.options.delayMs = 1500;
    fakeServer.options.responseText = 'Agent summary response';

    const session = await agentService.start({
      prompt: 'Write a new login test spec',
      clientConfig: { provider: '9router', apiKey: 'test-key', baseURL: fakeServer.getBaseUrl() }
    });

    assert.equal(session.status, 'running');

    // Wait a brief moment to ensure request is dispatched
    await new Promise((r) => setTimeout(r, 60));

    // Issue stop command
    const stopped = agentService.stop(session.id);
    assert.equal(stopped.status, 'stopped');

    // Give time for abort to bubble
    await new Promise((r) => setTimeout(r, 100));

    const finalSession = agentService.get(session.id);
    assert.equal(finalSession.status, 'stopped');
  });
});
