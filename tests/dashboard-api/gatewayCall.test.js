/**
 * tests/dashboard-api/gatewayCall.test.js
 * Integration tests for callAi using FakeAiProvider and isolated fixture workspaces.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const FakeAiProvider = require('../dashboard/support/fakeAiProvider');
const { createFixtureWorkspace } = require('../dashboard/support/fixtureWorkspace');
const { callAi } = require('../../core/ai/gateway/index');
const { clearAliasCache } = require('../../core/ai/gateway/models');

test('gatewayCall: map lỗi kết nối -> PROVIDER_DOWN (AI17-07)', async () => {
  const ws = createFixtureWorkspace();
  try {
    const clientConfig = {
      provider: 'openai',
      baseURL: 'http://127.0.0.1:19999/v1',
      apiKey: 'dummy-key',
      model: 'gpt-4o-mini'
    };

    const res = await callAi({
      task: 'arbitrateConflict',
      messages: [{ role: 'user', content: 'hello' }],
      clientConfig,
      root: ws.rootPath,
      timeoutMs: 3000
    });

    assert.equal(res.ok, false);
    assert.equal(res.code, 'PROVIDER_DOWN');
  } finally {
    ws.cleanup();
  }
});

test('gatewayCall: map lỗi 401/403 -> AUTH (AI17-07)', async () => {
  const ws = createFixtureWorkspace();
  const fake = new FakeAiProvider({ simulateAuthError: true });
  await fake.start();

  try {
    const clientConfig = {
      provider: 'openai',
      baseURL: fake.getBaseUrl(),
      apiKey: 'invalid-key',
      model: 'gpt-4o-mini'
    };

    const res = await callAi({
      task: 'arbitrateConflict',
      messages: [{ role: 'user', content: 'test auth' }],
      clientConfig,
      root: ws.rootPath
    });

    assert.equal(res.ok, false);
    assert.equal(res.code, 'AUTH');
  } finally {
    await fake.stop();
    ws.cleanup();
  }
});

test('gatewayCall: map lỗi 429 -> RATE_LIMITED kèm retry-after (AI17-07)', async () => {
  const ws = createFixtureWorkspace();
  const fake = new FakeAiProvider({ simulateRateLimit: true, retryAfterSeconds: 5 });
  await fake.start();

  try {
    const clientConfig = {
      provider: 'openai',
      baseURL: fake.getBaseUrl(),
      apiKey: 'key',
      model: 'gpt-4o-mini'
    };

    const res = await callAi({
      task: 'arbitrateConflict',
      messages: [{ role: 'user', content: 'test 429' }],
      clientConfig,
      root: ws.rootPath
    });

    assert.equal(res.ok, false);
    assert.equal(res.code, 'RATE_LIMITED');
    assert.match(res.message, /Hết hạn mức/);
  } finally {
    await fake.stop();
    ws.cleanup();
  }
});

test('gatewayCall: timeout -> TIMEOUT (AI17-07)', async () => {
  const ws = createFixtureWorkspace();
  const fake = new FakeAiProvider({ delayMs: 1500 });
  await fake.start();

  try {
    const clientConfig = {
      provider: 'openai',
      baseURL: fake.getBaseUrl(),
      apiKey: 'key',
      model: 'gpt-4o-mini'
    };

    const res = await callAi({
      task: 'arbitrateConflict',
      messages: [{ role: 'user', content: 'test timeout' }],
      clientConfig,
      root: ws.rootPath,
      timeoutMs: 300
    });

    assert.equal(res.ok, false);
    assert.equal(res.code, 'TIMEOUT');
    assert.match(res.message, /AI không trả lời/);
  } finally {
    await fake.stop();
    ws.cleanup();
  }
});

test('gatewayCall: hủy request (abort) trong khi gọi mạng -> CANCELLED (AI17-08)', async () => {
  const ws = createFixtureWorkspace();
  const fake = new FakeAiProvider({ delayMs: 1500 });
  await fake.start();

  const controller = new AbortController();
  setTimeout(() => controller.abort(), 150);

  try {
    const clientConfig = {
      provider: 'openai',
      baseURL: fake.getBaseUrl(),
      apiKey: 'key',
      model: 'gpt-4o-mini'
    };

    const res = await callAi({
      task: 'arbitrateConflict',
      messages: [{ role: 'user', content: 'test cancel' }],
      clientConfig,
      root: ws.rootPath,
      signal: controller.signal,
      timeoutMs: 5000
    });

    assert.equal(res.ok, false);
    assert.equal(res.code, 'CANCELLED');
    assert.equal(fake.abortedRequests.length, 1);
  } finally {
    await fake.stop();
    ws.cleanup();
  }
});

test('gatewayCall: alias 404 tự động fallback sang Settings model (AI17-05)', async () => {
  const ws = createFixtureWorkspace();
  clearAliasCache();
  const fake = new FakeAiProvider({
    simulate404Models: ['qaDeep'],
    responseText: '{"status":"fallback_success"}'
  });
  await fake.start();

  try {
    const clientConfig = {
      provider: '9router',
      baseURL: fake.getBaseUrl(),
      apiKey: 'key',
      model: 'gemini-2.5-flash'
    };

    const res = await callAi({
      task: 'inferTestCases',
      messages: [{ role: 'user', content: 'test alias 404' }],
      tier: 'deep',
      clientConfig,
      root: ws.rootPath,
      timeoutMs: 3000
    });

    assert.equal(res.ok, true);
    assert.equal(res.aliasFallback, true);
    assert.equal(res.model, 'gemini-2.5-flash');
  } finally {
    await fake.stop();
    ws.cleanup();
  }
});

test('gatewayCall: schema retry lần 1 sai lần 2 đúng -> ok (AI17-06)', async () => {
  const ws = createFixtureWorkspace();
  let callCount = 0;
  const fake = new FakeAiProvider({
    responseGenerator: () => {
      callCount++;
      if (callCount === 1) return 'Sai format không phải json';
      return '{"resolved": true, "reason": "Retried successfully"}';
    }
  });
  await fake.start();

  try {
    const clientConfig = {
      provider: 'openai',
      baseURL: fake.getBaseUrl(),
      apiKey: 'key',
      model: 'gpt-4o-mini'
    };

    const schema = {
      type: 'object',
      required: ['resolved', 'reason'],
      properties: {
        resolved: { type: 'boolean' },
        reason: { type: 'string' }
      }
    };

    const res = await callAi({
      task: 'arbitrateConflict',
      messages: [{ role: 'user', content: 'arbitrate' }],
      schema,
      clientConfig,
      root: ws.rootPath
    });

    assert.equal(res.ok, true);
    assert.equal(res.data.resolved, true);
    assert.equal(callCount, 2);
  } finally {
    await fake.stop();
    ws.cleanup();
  }
});
