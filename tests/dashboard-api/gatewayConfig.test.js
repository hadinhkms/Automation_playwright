/**
 * tests/dashboard-api/gatewayConfig.test.js
 * Unit tests for core/ai/gateway/config.js (AI17-02).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveConfig } = require('../../core/ai/gateway/config');

test('gatewayConfig: cá nhân có key -> ưu tiên dùng cấu hình cá nhân', () => {
  const env = {
    AI_PROVIDER: 'gemini',
    GEMINI_API_KEY: 'server-gemini-key',
    AI_MODEL: 'gemini-2.5-flash'
  };

  const clientConfig = {
    provider: 'openai',
    baseURL: 'http://localhost:20128/v1',
    apiKey: 'personal-key-123',
    model: 'gpt-4o'
  };

  const res = resolveConfig({ clientConfig, env });
  assert.equal(res.ok, true);
  assert.equal(res.scope, 'personal');
  assert.equal(res.apiKey, 'personal-key-123');
  assert.equal(res.model, 'gpt-4o');
  assert.equal(res.isNineRouter, true);
  assert.equal(res.provider, '9router');
});

test('gatewayConfig: không có key cá nhân -> fallback server .env', () => {
  const env = {
    AI_PROVIDER: '9router',
    AI_BASE_URL: 'http://localhost:20128/v1',
    AI_API_KEY: 'server-9router-key',
    AI_MODEL: 'qaDeep'
  };

  const res = resolveConfig({ clientConfig: null, env });
  assert.equal(res.ok, true);
  assert.equal(res.scope, 'server');
  assert.equal(res.provider, '9router');
  assert.equal(res.baseURL, 'http://localhost:20128/v1');
  assert.equal(res.apiKey, 'server-9router-key');
  assert.equal(res.model, 'qaDeep');
  assert.equal(res.isNineRouter, true);
});

test('gatewayConfig: server key chỉ gửi tới saved endpoint; từ chối khi request trỏ endpoint lạ', () => {
  const env = {
    AI_PROVIDER: 'openai',
    AI_BASE_URL: 'https://api.openai.com/v1',
    OPENAI_API_KEY: 'secret-server-key'
  };

  const clientConfig = {
    baseURL: 'http://malicious-external-site.com/v1'
  };

  const res = resolveConfig({ clientConfig, env });
  assert.equal(res.ok, false);
  assert.equal(res.error.code, 'AUTH');
});

test('gatewayConfig: không có key nào được khai báo -> trả NOT_CONFIGURED', () => {
  const env = {
    AI_PROVIDER: 'openai',
    OPENAI_API_KEY: ''
  };

  const res = resolveConfig({ clientConfig: null, env });
  assert.equal(res.ok, false);
  assert.equal(res.error.code, 'NOT_CONFIGURED');
  assert.match(res.error.message, /Chưa cấu hình AI/);
});
