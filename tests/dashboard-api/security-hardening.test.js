/**
 * tests/dashboard-api/security-hardening.test.js
 * Regression tests for server crash isolation, JSON body validation,
 * path traversal protection, Jira URL hygiene, and engine /tools/* fallback.
 */
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startDashboardHarness } = require('../dashboard/support/dashboardHarness');
const { createFixtureWorkspace } = require('../dashboard/support/fixtureWorkspace');

describe('API Security & Crash Hardening Regressions', () => {
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

  test('Malformed JSON and non-object JSON payloads return 400 without crashing server.js', async () => {
    const endpoints = [
      '/api/ai/generate-spec',
      '/api/ai/copy-jira',
      '/api/ai/context',
      '/api/jira/issue',
      '/api/qa/smart-link/apply',
      '/api/builder/insert-step',
      '/api/builder/create-script',
    ];
    const invalidBodies = ['{broken-json', 'null', '[]', '42', '"str"'];

    for (const ep of endpoints) {
      for (const rawBody of invalidBodies) {
        const res = await fetch(`${harness.url}${ep}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: rawBody,
        });
        assert.equal(res.status, 400, `${ep} with body ${rawBody} should return 400 (got ${res.status})`);
      }
    }

    const health = await fetch(`${harness.url}/api/health`);
    assert.equal(health.status, 200, 'Dashboard server must remain healthy after malformed requests');
  });

  test('Malformed percent-encoded static URLs return 4xx JSON without URIError crash, and /tools/visual_compare.html falls back to engine tools', async () => {
    for (const badPath of ['/reports/%E0%A4%A', '/evidence/%E0%A4%A', '/tools/%E0%A4%A']) {
      const res = await fetch(`${harness.url}${badPath}`);
      assert.ok(res.status === 400 || res.status === 404, `${badPath} should return 400/404 (got ${res.status})`);
    }

    const toolRes = await fetch(`${harness.url}/tools/visual_compare.html`);
    assert.equal(toolRes.status, 200, '/tools/visual_compare.html must fall back to engine tools directory');
    assert.match(toolRes.headers.get('content-type') || '', /text\/html/);
  });

  test('Smart Link apply rejects missing specPath (400) and traversal slug (400)', async () => {
    const emptyRes = await fetch(`${harness.url}/api/qa/smart-link/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(emptyRes.status, 400);

    const slugTraversalRes = await fetch(`${harness.url}/api/qa/smart-link/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        specPath: 'tests/e2e/sample.spec.js',
        action: 'create',
        newReqData: { title: 'Test Req', slug: '../../evil-escape' },
      }),
    });
    assert.equal(slugTraversalRes.status, 400);
    const body = await slugTraversalRes.json();
    assert.equal(body.code, 'INVALID_SLUG');
  });

  test('BDD Script routes block path traversal in insert-step and create-script', async () => {
    const insertRes = await fetch(`${harness.url}/api/builder/insert-step`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scriptPath: '../outside.js', actionName: 'open' }),
    });
    assert.equal(insertRes.status, 403);

    const createRes = await fetch(`${harness.url}/api/builder/create-script`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: '../../../evil', specCode: 'module.exports = 1;' }),
    });
    assert.equal(createRes.status, 400);
  });

  test('Jira config rejects embedded credentials, query strings, hashes, and non-http schemes', async () => {
    const unsafeUrls = [
      'javascript:alert(1)',
      'file:///C:/Windows/win.ini',
      'https://user:pass@team.atlassian.net',
      'https://team.atlassian.net?leak=1',
      'https://team.atlassian.net#frag',
    ];
    for (const baseUrl of unsafeUrls) {
      const res = await fetch(`${harness.url}/api/jira/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseUrl, email: 'qa@example.com', apiToken: 'tok_123456789012' }),
      });
      assert.equal(res.status, 400, `Jira baseUrl ${baseUrl} must be rejected with 400`);
    }
  });
});

