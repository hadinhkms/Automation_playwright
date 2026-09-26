/**
 * tests/dashboard-api/gatewayExtended.test.js
 * API contract and task tests for Plan-17e Extended Features.
 * Strict ceiling <= 150 lines.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  runDraftDecisionRecord,
  formatForJira,
  runDetectFlakyTests,
  runSummarizeCiRun
} = require('../../core/ai/tasks/index');
const { handleAiExtendedRoutes } = require('../../dashboard/routes/aiExtendedRoutes');

test('Plan-17e Extended Features Suite', async (t) => {
  await t.test('P17E-TC-01: runDraftDecisionRecord generates ADR and catches conflicting decisions', async () => {
    const existing = [
      { id: 'ADR-001', title: 'Cho phép truy cập trực tiếp database trong test', decision: 'cho phép truy cập' }
    ];
    const res = await runDraftDecisionRecord({
      topic: 'Bảo mật DB',
      contextText: 'Cần giới hạn quyền DB',
      proposedDecision: 'Chặn truy cập trực tiếp database từ test runner',
      existingDecisions: existing
    });

    assert.ok(res.decisionId);
    assert.ok(res.title.includes('Bảo mật DB'));
    assert.ok(res.conflictWarning);
    assert.ok(res.consequences?.positive?.length > 0);
  });

  await t.test('P17E-TC-02: formatForJira outputs formatted Jira markup and markdown', () => {
    const res = formatForJira({
      reqId: 'REQ-009',
      title: 'Xác thực hai yếu tố',
      status: 'Ready',
      testCases: [{ id: 'TC-01', title: 'Nhập đúng OTP', type: 'Positive', acId: 'AC-01' }],
      openQuestions: ['Có hỗ trợ SMS fallback không?']
    });

    assert.ok(res.jiraMarkup.includes('h2. [REQ-009]'));
    assert.ok(res.jiraMarkup.includes('|| Mã TC || Tiêu đề ||'));
    assert.ok(res.jiraMarkup.includes('TC-01'));
    assert.ok(res.markdownFormat.includes('## [REQ-009]'));
  });

  await t.test('P17E-TC-03: runDetectFlakyTests flags tests with flipping results', async () => {
    const history = [
      { testId: 'TC-01', runs: ['pass', 'fail', 'pass', 'fail', 'pass'] },
      { testId: 'TC-02', runs: ['pass', 'pass', 'pass', 'pass'] }
    ];
    const res = await runDetectFlakyTests({ history });

    assert.equal(res.flakyCount, 1);
    assert.equal(res.flakyTests[0].testId, 'TC-01');
    assert.ok(res.flakyTests[0].flakinessRate >= 0.5);
    assert.ok(res.flakyTests[0].remediation);
  });

  await t.test('P17E-TC-04: runSummarizeCiRun parses JUnit XML into executive summary', async () => {
    const junitXml = `
      <testsuites tests="10" failures="1" errors="0" skipped="1">
        <testsuite name="Auth" tests="10" failures="1">
          <testcase name="Login failure" classname="auth.spec.js">
            <failure message="Timeout 5000ms" />
          </testcase>
        </testsuite>
      </testsuites>
    `;
    const res = await runSummarizeCiRun({
      junitXml,
      metadata: { branch: 'feat/ai-phase-5', commit: 'abc1234' }
    });

    assert.equal(res.status, 'FAILURE');
    assert.ok(res.summaryMarkdown.includes('1 failed'));
    assert.ok(res.summaryMarkdown.includes('8/10 passed'));
  });

  await t.test('P17E-TC-05: handleAiExtendedRoutes handles POST /api/ai/copy-jira', async () => {
    let sentStatus = null;
    let sentData = null;
    const mockReq = {
      method: 'POST',
      headers: {},
      on: (event, handler) => {
        if (event === 'data') handler(Buffer.from(JSON.stringify({ reqId: 'REQ-10', testCases: [] })));
        if (event === 'end') handler();
      }
    };
    const mockRes = {
      writeHead: (status) => { sentStatus = status; },
      end: (data) => { sentData = JSON.parse(data); },
      once: () => {}
    };

    const handled = await handleAiExtendedRoutes(mockReq, mockRes, new URL('http://localhost:3000/api/ai/copy-jira'), null);
    assert.equal(handled, true);
    assert.equal(sentStatus, 200);
    assert.ok(sentData.jiraMarkup);
  });
});
