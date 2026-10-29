/**
 * dashboard/routes/aiExtendedRoutes.js
 * Router handling Extended AI features (PLAN-17e).
 * Strict ceiling <= 150 lines.
 */
const {
  runDraftDecisionRecord,
  formatForJira,
  runDetectFlakyTests,
  runSummarizeCiRun
} = require('../../core/ai/tasks/index');
const { parseBody, sendJson, abortSignalFor } = require('./routeUtils');

async function handleAiExtendedRoutes(request, response, url, clientConfig) {
  if (!url.pathname.startsWith('/api/ai/') || request.method !== 'POST') return false;
  const signal = abortSignalFor(request, response);

  try {
    if (url.pathname === '/api/ai/decision') {
      const body = await parseBody(request);
      const result = await runDraftDecisionRecord({
        topic: body.topic || 'Kiến trúc',
        contextText: body.contextText || '',
        proposedDecision: body.proposedDecision || '',
        existingDecisions: body.existingDecisions || [],
        signal,
        clientConfig
      });
      return sendJson(response, 200, result);
    }

    if (url.pathname === '/api/ai/copy-jira') {
      const body = await parseBody(request);
      const result = formatForJira({
        reqId: body.reqId || 'REQ-001',
        title: body.title || '',
        status: body.status || 'In Progress',
        testCases: body.testCases || [],
        openQuestions: body.openQuestions || [],
        risks: body.risks || []
      });
      return sendJson(response, 200, result);
    }

    if (url.pathname === '/api/ai/flaky-tests') {
      const body = await parseBody(request);
      const result = await runDetectFlakyTests({
        history: body.history || [],
        signal,
        clientConfig
      });
      return sendJson(response, 200, result);
    }

    if (url.pathname === '/api/ai/summarize-ci') {
      const body = await parseBody(request);
      const result = await runSummarizeCiRun({
        junitXml: body.junitXml || '',
        metadata: body.metadata || {},
        signal,
        clientConfig
      });
      return sendJson(response, 200, result);
    }
  } catch (err) {
    const status = Number.isInteger(err.status) ? err.status : 400;
    return sendJson(response, status, { ok: false, error: err.message });
  }

  return false;
}

module.exports = {
  handleAiExtendedRoutes
};
