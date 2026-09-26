/**
 * tests/dashboard-api/gatewayTriage.test.js
 * Verifies Plan-17b: Failure Triage (QA-3), Jira Parser (BA-4), and Dual-engine.
 * Strict ceiling <= 150 lines.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const FakeAiProvider = require('../dashboard/support/fakeAiProvider');
const { createFixtureWorkspace } = require('../dashboard/support/fixtureWorkspace');
const { runTriageFailure } = require('../../core/ai/tasks/triageFailure');
const { parseJiraMarkupToMarkdown, extractJiraKey, cleanConfluenceHtml } = require('../../core/ai/tasks/jiraStoryParser');
const { analyzeDiagnostics } = require('../../core/diagnostics/diagnosticsAnalyzer');

test('Plan-17b Failure Triage & Jira Parser Suite', async (t) => {
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

  await t.test('P17B-TC-01: Rule-based static diagnostics runs first (0 token)', async () => {
    const res = analyzeDiagnostics({
      error: 'Error: expect(received).toBe(expected) // Object.is equality\nExpected: 200\nReceived: 500',
      stepTitle: 'Check status code'
    });
    assert.equal(res.topCategory, 'product_bug');
    assert.equal(res.findings.length >= 1, true);
    assert.equal(res.findings[0].code, 'assertion-mismatch');
    assert.equal(res.findings[0].confidence >= 0.9, true);
  });

  await t.test('P17B-TC-02 & 03: runTriageFailure classifies root cause via AI gateway', async () => {
    const aiPayload = {
      category: 'product_bug',
      confidence: 88,
      summary: 'Backend trả về mã lỗi 500 khi submit form thanh toán.',
      evidence: 'Expected: 200\nReceived: 500',
      suggestedFix: 'Kiểm tra backend API /api/checkout xử lý ngoại lệ.'
    };
    fakeServer.options.responseText = JSON.stringify(aiPayload);

    const clientConfig = { provider: '9router', apiKey: 'test-key', baseURL: fakeServer.getBaseUrl() };
    const res = await runTriageFailure({
      errorText: 'Server responded with 500 Internal Server Error',
      testTitle: 'User completes purchase flow',
      clientConfig,
      root: ws.rootPath
    });

    assert.equal(res.ok, true);
    assert.equal(res.category, 'product_bug');
    assert.equal(res.confidence, 88);
    assert.match(res.summary, /Backend/);
    assert.equal(['product_bug', 'test_bug', 'environment', 'flaky'].includes(res.category), true);
  });

  await t.test('P17B-TC-04: Diagnostics detects flaky and locator issues correctly', async () => {
    const overlayRes = analyzeDiagnostics({
      error: 'Element is not receiving click events, obscured by <div class="modal-backdrop">'
    });
    assert.equal(overlayRes.topCategory, 'flaky');

    const locatorRes = analyzeDiagnostics({
      error: 'waiting for locator(\'button#submit\') to be visible\nstrict mode violation: resolved to 2 elements'
    });
    assert.equal(locatorRes.topCategory, 'test_bug');
  });

  await t.test('P17B-TC-05: parseJiraMarkupToMarkdown converts headings, bold, code, links, lists', async () => {
    const jiraMarkup = [
      'h1. User Login Feature',
      'As a user, I want to *log in* securely.',
      'h2. Acceptance Criteria',
      '* Valid credentials show dashboard',
      '* Invalid credentials show error',
      '{code:javascript}',
      'const user = { username: "admin" };',
      '{code}',
      'See [Jira Documentation|https://jira.example.com] for more info.'
    ].join('\n');

    const md = parseJiraMarkupToMarkdown(jiraMarkup);
    assert.match(md, /# User Login Feature/);
    assert.match(md, /\*\*log in\*\*/);
    assert.match(md, /## Acceptance Criteria/);
    assert.match(md, /- Valid credentials show dashboard/);
    assert.match(md, /```javascript/);
    assert.match(md, /\[Jira Documentation\]\(https:\/\/jira\.example\.com\)/);
  });

  await t.test('P17B-TC-06: cleanConfluenceHtml cleans HTML tags and tables', async () => {
    const confluenceHtml = '<h1>Epic Summary</h1><p>This is a <strong>critical</strong> story.</p><ul><li>Task 1</li></ul>';
    const cleaned = cleanConfluenceHtml(confluenceHtml);
    assert.match(cleaned, /# Epic Summary/);
    assert.match(cleaned, /\*\*critical\*\*/);
    assert.match(cleaned, /- Task 1/);

    const jiraTable = '||Key||Summary||\n|PROJ-1|Setup Auth|\n|PROJ-2|Add Cart|';
    const parsedTable = parseJiraMarkupToMarkdown(jiraTable);
    assert.match(parsedTable, /\| Key \| Summary \|/);
    assert.match(parsedTable, /\| --- \| --- \|/);
    assert.match(parsedTable, /\| PROJ-1 \| Setup Auth \|/);
  });

  await t.test('extractJiraKey extracts standard issue keys', async () => {
    assert.equal(extractJiraKey('PROJ-1234: Add checkout flow'), 'PROJ-1234');
    assert.equal(extractJiraKey('Fix login bug (PAY-99) in prod'), 'PAY-99');
    assert.equal(extractJiraKey('No jira key here'), null);
    assert.equal(extractJiraKey(''), null);
  });
});
