/**
 * tests/dashboard-api/jira.test.js
 * Unit and API Contract tests for Jira Cloud Integration and Ticket Fetching.
 * Modularity ceiling <= 250 lines.
 */
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { startDashboardHarness } = require('../dashboard/support/dashboardHarness');
const { createFixtureWorkspace } = require('../dashboard/support/fixtureWorkspace');
const {
  adfToMarkdown,
  parseJiraDescription,
  extractAcceptanceCriteria,
  getJiraConfig,
  saveJiraConfig,
} = require('../../dashboard/services/jiraService');

describe('Jira Integration Unit & API Tests', () => {
  let fixture;
  let harness;
  let mockJira;
  let mockJiraUrl;
  let lastAuthHeader = null;

  before(async () => {
    fixture = createFixtureWorkspace();
    harness = await startDashboardHarness(fixture.rootPath);
    mockJira = http.createServer((req, res) => {
      lastAuthHeader = req.headers.authorization || null;
      res.setHeader('Content-Type', 'application/json');
      if (req.url === '/rest/api/3/myself') {
        res.end(JSON.stringify({ displayName: 'QA Bot', emailAddress: 'qa@local.test', timeZone: 'Asia/Ho_Chi_Minh', active: true }));
        return;
      }
      res.statusCode = 404;
      res.end(JSON.stringify({ errorMessages: ['Not Found'] }));
    });
    await new Promise((resolve) => mockJira.listen(0, '127.0.0.1', resolve));
    mockJiraUrl = `http://127.0.0.1:${mockJira.address().port}`;
  });

  after(async () => {
    if (mockJira) await new Promise((resolve) => mockJira.close(resolve));
    if (harness) await harness.stop();
    if (fixture) fixture.cleanup();
  });

  test('JIRA-01: adfToMarkdown parses headings, bold, lists, links, tables, hardBreak, orderedList, and inlineCard', () => {
    const adfSample = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Acceptance Criteria' }] },
        {
          type: 'bulletList',
          content: [{
            type: 'listItem',
            content: [{
              type: 'paragraph',
              content: [
                { type: 'text', text: 'User must be logged in with ', marks: [{ type: 'strong' }] },
                { type: 'text', text: 'valid token', marks: [{ type: 'code' }] },
                { type: 'hardBreak' },
                { type: 'inlineCard', attrs: { url: 'https://example.com/spec' } },
              ],
            }],
          }],
        },
        {
          type: 'orderedList',
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Step One' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Step Two' }] }] },
          ],
        },
        {
          type: 'table',
          content: [
            { type: 'tableRow', content: [{ type: 'tableHeader', content: [{ type: 'text', text: 'Field' }] }, { type: 'tableHeader', content: [{ type: 'text', text: 'Rule' }] }] },
            { type: 'tableRow', content: [{ type: 'tableCell', content: [{ type: 'text', text: 'Email' }] }, { type: 'tableCell', content: [{ type: 'text', text: 'Required' }] }] },
          ],
        },
      ],
    };
    const md = adfToMarkdown(adfSample);
    assert.ok(md.includes('## Acceptance Criteria'));
    assert.ok(md.includes('**User must be logged in with **'));
    assert.ok(md.includes('`valid token`'));
    assert.ok(md.includes('[https://example.com/spec](https://example.com/spec)'));
    assert.ok(md.includes('1. Step One\n2. Step Two'));
    assert.ok(md.includes('| Field | Rule |\n| --- | --- |\n| Email | Required |'));
  });

  test('JIRA-02: extractAcceptanceCriteria extracts bullet and numbered items without false digit matches', () => {
    const markdown = [
      '## Acceptance Criteria',
      'Note version 2.0 applies below:',
      '- AC-1: Login with valid email and password redirects to dashboard',
      '1. AC-2: Login with locked account shows error alert',
      '## Technical notes',
      '- Uses Redis cache',
    ].join('\n');

    const acs = extractAcceptanceCriteria(markdown);
    assert.deepEqual(acs, [
      'AC-1: Login with valid email and password redirects to dashboard',
      'AC-2: Login with locked account shows error alert',
    ]);
  });

  test('JIRA-03: parseJiraDescription handles ADF, wiki strings, and preserves Confluence HTML headings', () => {
    const parsedWiki = parseJiraDescription('h2. Title\n* Point 1');
    assert.ok(parsedWiki.includes('## Title'));
    assert.ok(parsedWiki.includes('- Point 1'));

    const parsedHtml = parseJiraDescription('<h1>Main Spec</h1><p>Body paragraph</p>');
    assert.ok(parsedHtml.startsWith('# Main Spec'), `Expected Markdown heading, got: ${parsedHtml}`);
  });

  test('JIRA-04: getJiraConfig & saveJiraConfig persist credentials to .env without polluting process.env', () => {
    const root = fixture.rootPath;
    const prevEnvToken = process.env.JIRA_API_TOKEN;
    saveJiraConfig(root, {
      baseUrl: 'https://mycompany.atlassian.net',
      email: 'qa@mycompany.com',
      apiToken: 'ATATT3xFfTESTTOKEN12345678',
    });
    assert.equal(process.env.JIRA_API_TOKEN, prevEnvToken);

    const updated = getJiraConfig(root);
    assert.equal(updated.baseUrl, 'https://mycompany.atlassian.net');
    assert.equal(updated.email, 'qa@mycompany.com');
    assert.equal(updated.hasToken, true);
    assert.ok(updated.maskedToken.startsWith('ATATT3'));

    const envContent = fs.readFileSync(path.join(root, '.env'), 'utf8');
    assert.ok(envContent.includes('JIRA_API_TOKEN=ATATT3xFfTESTTOKEN12345678'));
  });

  test('JIRA-05 & JIRA-06: GET & POST /api/jira/config return sanitized config and reject invalid URLs', async () => {
    const getRes = await fetch(`${harness.url}/api/jira/config`);
    assert.equal(getRes.status, 200);

    const badUrlRes = await fetch(`${harness.url}/api/jira/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseUrl: 'ftp://evil.example', email: 'a@b.com', apiToken: 'tok' }),
    });
    assert.equal(badUrlRes.status, 400);

    const okRes = await fetch(`${harness.url}/api/jira/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseUrl: mockJiraUrl, email: 'qa@local.test', apiToken: 'ATATT3SAVEDSECRET9988' }),
    });
    assert.equal(okRes.status, 200);
    const body = await okRes.json();
    assert.equal(body.config.baseUrl, mockJiraUrl);
    assert.equal(body.config.hasToken, true);
  });

  test('JIRA-07: POST /api/jira/test-connection without credentials returns 400', async () => {
    const res = await fetch(`${harness.url}/api/jira/test-connection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseUrl: '', email: '', apiToken: '' }),
    });
    assert.equal(res.status, 400);
  });

  test('JIRA-08 & JIRA-09: GET /api/jira/issue validates missing, invalid, and REQ-xxx keys', async () => {
    const missing = await fetch(`${harness.url}/api/jira/issue`);
    assert.equal(missing.status, 400);

    const invalid = await fetch(`${harness.url}/api/jira/issue?key=REQ-001`);
    assert.equal(invalid.status, 400);
  });

  test('JIRA-10: Cross-site browser requests to /api/jira/* are rejected with 403', async () => {
    const res = await fetch(`${harness.url}/api/jira/config`, {
      headers: { 'Sec-Fetch-Site': 'cross-site' },
    });
    assert.equal(res.status, 403);
  });

  test('JIRA-11: Saved token works when apiToken is empty for same origin, but blocks exfiltration to another host', async () => {
    lastAuthHeader = null;
    const okRes = await fetch(`${harness.url}/api/jira/test-connection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseUrl: mockJiraUrl, email: 'qa@local.test', apiToken: '' }),
    });
    assert.equal(okRes.status, 200);
    const okBody = await okRes.json();
    assert.equal(okBody.success, true);
    assert.equal(okBody.displayName, 'QA Bot');
    assert.ok(lastAuthHeader && lastAuthHeader.startsWith('Basic '));

    const ssrfRes = await fetch(`${harness.url}/api/jira/test-connection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseUrl: 'https://evil-exfil.example.com', email: 'qa@local.test', apiToken: '' }),
    });
    assert.equal(ssrfRes.status, 400);
  });
});
