/**
 * tests/dashboard-api/jira.test.js
 * Unit and API Contract tests for Jira Cloud Integration and Ticket Fetching.
 * Modularity ceiling <= 250 lines.
 */
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
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

  before(async () => {
    fixture = createFixtureWorkspace();
    harness = await startDashboardHarness(fixture.rootPath);
  });

  after(async () => {
    if (harness) await harness.stop();
    if (fixture) fixture.cleanup();
  });

  test('JIRA-01: adfToMarkdown parses paragraphs, headings, bold, lists, and links', () => {
    const adfSample = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Acceptance Criteria' }],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    { type: 'text', text: 'User must be logged in with ', marks: [{ type: 'strong' }] },
                    { type: 'text', text: 'valid token', marks: [{ type: 'code' }] },
                  ],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [
                    { type: 'text', text: 'See docs at ' },
                    { type: 'text', text: 'portal', marks: [{ type: 'link', attrs: { href: 'https://example.com' } }] },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    const md = adfToMarkdown(adfSample);
    assert.ok(md.includes('## Acceptance Criteria'));
    assert.ok(md.includes('**User must be logged in with **'));
    assert.ok(md.includes('`valid token`'));
    assert.ok(md.includes('[portal](https://example.com)'));
  });

  test('JIRA-02: extractAcceptanceCriteria extracts bullet items under AC heading', () => {
    const markdown = [
      '# Feature description',
      'This is an overview of the feature.',
      '',
      '## Acceptance Criteria',
      '- AC-1: Login with valid email and password redirects to dashboard',
      '- AC-2: Login with locked account shows error alert',
      '- AC-3: Session expires after 30 minutes',
      '',
      '## Technical notes',
      '- Uses Redis cache',
    ].join('\n');

    const acs = extractAcceptanceCriteria(markdown);
    assert.equal(acs.length, 3);
    assert.equal(acs[0], 'AC-1: Login with valid email and password redirects to dashboard');
    assert.equal(acs[1], 'AC-2: Login with locked account shows error alert');
    assert.equal(acs[2], 'AC-3: Session expires after 30 minutes');
  });

  test('JIRA-03: parseJiraDescription handles both ADF objects and plain wiki strings', () => {
    const wiki = 'h2. Title\n* Point 1\n* Point 2';
    const parsedWiki = parseJiraDescription(wiki);
    assert.ok(parsedWiki.includes('## Title'));
    assert.ok(parsedWiki.includes('- Point 1'));

    const adf = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'ADF text' }] }],
    };
    const parsedAdf = parseJiraDescription(adf);
    assert.ok(parsedAdf.includes('ADF text'));
  });

  test('JIRA-04: getJiraConfig & saveJiraConfig persist credentials to .env', () => {
    const root = fixture.rootPath;
    const initial = getJiraConfig(root);
    assert.ok(initial.baseUrl);

    saveJiraConfig(root, {
      baseUrl: 'https://mycompany.atlassian.net',
      email: 'qa@mycompany.com',
      apiToken: 'ATATT3xFfTESTTOKEN12345678',
    });

    const updated = getJiraConfig(root);
    assert.equal(updated.baseUrl, 'https://mycompany.atlassian.net');
    assert.equal(updated.email, 'qa@mycompany.com');
    assert.equal(updated.hasToken, true);
    assert.ok(updated.maskedToken.startsWith('ATATT3'));
    assert.ok(updated.maskedToken.endsWith('5678'));

    const envContent = fs.readFileSync(path.join(root, '.env'), 'utf8');
    assert.ok(envContent.includes('JIRA_BASE_URL=https://mycompany.atlassian.net'));
    assert.ok(envContent.includes('JIRA_EMAIL=qa@mycompany.com'));
    assert.ok(envContent.includes('JIRA_API_TOKEN=ATATT3xFfTESTTOKEN12345678'));
  });

  test('JIRA-05: GET /api/jira/config returns 200 and sanitized config payload', async () => {
    const res = await fetch(`${harness.url}/api/jira/config`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.baseUrl !== undefined);
    assert.ok(body.email !== undefined);
    assert.ok(typeof body.hasToken === 'boolean');
    assert.ok(body.maskedToken !== undefined);
  });

  test('JIRA-06: POST /api/jira/config updates Jira configuration via HTTP', async () => {
    const res = await fetch(`${harness.url}/api/jira/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baseUrl: 'https://testteam.atlassian.net',
        email: 'tester@testteam.com',
        apiToken: 'ATATT3TESTKEY998877',
      }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.message);
    assert.equal(body.config.baseUrl, 'https://testteam.atlassian.net');
    assert.equal(body.config.email, 'tester@testteam.com');
    assert.equal(body.config.hasToken, true);
  });

  test('JIRA-07: POST /api/jira/test-connection without token returns 400', async () => {
    const res = await fetch(`${harness.url}/api/jira/test-connection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baseUrl: '',
        email: '',
        apiToken: '',
      }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.ok(body.error);
  });

  test('JIRA-08: GET /api/jira/issue without key returns 400', async () => {
    const res = await fetch(`${harness.url}/api/jira/issue`);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.ok(body.error.includes('Vui lòng cung cấp mã ticket'));
  });

  test('JIRA-09: GET /api/jira/issue with invalid key string returns 400', async () => {
    const res = await fetch(`${harness.url}/api/jira/issue?key=invalid_key_no_dash`);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.ok(body.error.includes('Không nhận diện được mã Jira hợp lệ'));
  });
});
