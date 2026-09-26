/**
 * dashboard/routes/aiFastWinsRoutes.js
 * Route handlers for Plan-17c Fast Wins: Requirement Clarity (BA-1), Bug Draft (QA-4), and TC Generation (QA-1).
 * Strict ceiling <= 150 lines.
 */
const { parseBody, sendJson, abortSignalFor } = require('./routeUtils');
const { runCheckRequirementClarity } = require('../../core/ai/tasks/checkRequirementClarity');
const { runDraftBugReport } = require('../../core/ai/tasks/draftBugReport');
const { runGenerateTestCases } = require('../../core/ai/tasks/generateTestCases');
const { readRecentAuditRecords, clearAuditLogs } = require('../../core/ai/gateway/audit');

function extractClientConfig(request) {
  try {
    const raw = request.headers['x-ai-config'];
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return null;
}

async function handleAiFastWinsRoutes(request, response, url, context = {}) {
  const root = context.projectRoot || process.cwd();
  const clientConfig = extractClientConfig(request);

  if (request.method === 'GET' && url.pathname === '/api/ai/audit') {
    const limit = Number(url.searchParams?.get('limit')) || 50;
    const records = readRecentAuditRecords({ root, limit });
    sendJson(response, 200, { ok: true, records, count: records.length });
    return true;
  }

  if (request.method === 'DELETE' && url.pathname === '/api/ai/audit') {
    const cleared = clearAuditLogs({ root });
    sendJson(response, 200, { ok: cleared });
    return true;
  }

  if (request.method === 'POST' && url.pathname === '/api/ai/req-clarity') {
    try {
      const body = await parseBody(request, 128 * 1024);
      const res = await runCheckRequirementClarity({
        requirementText: body.requirementText || '',
        title: body.title || '',
        source: body.source || '',
        clientConfig,
        root,
        signal: abortSignalFor(request, response)
      });
      sendJson(response, res.ok ? 200 : 502, res);
    } catch (e) {
      sendJson(response, 422, { ok: false, error: e.message });
    }
    return true;
  }

  if (request.method === 'POST' && url.pathname === '/api/ai/draft-bug') {
    try {
      const body = await parseBody(request, 128 * 1024);
      const res = await runDraftBugReport({
        testTitle: body.testTitle || '',
        errorText: body.errorText || '',
        locator: body.locator || '',
        snippet: body.snippet || '',
        url: body.url || '',
        triageCategory: body.triageCategory || '',
        triageSummary: body.triageSummary || '',
        clientConfig,
        root,
        signal: abortSignalFor(request, response)
      });
      sendJson(response, res.ok ? 200 : 502, res);
    } catch (e) {
      sendJson(response, 422, { ok: false, error: e.message });
    }
    return true;
  }

  if (request.method === 'POST' && url.pathname === '/api/ai/generate-tc') {
    try {
      const body = await parseBody(request, 128 * 1024);
      const res = await runGenerateTestCases({
        reqId: body.reqId || 'REQ-001',
        reqTitle: body.reqTitle || '',
        criteriaText: body.criteriaText || '',
        startTcNumber: Number(body.startTcNumber) || 1,
        clientConfig,
        root,
        signal: abortSignalFor(request, response)
      });
      sendJson(response, res.ok ? 200 : 502, res);
    } catch (e) {
      sendJson(response, 422, { ok: false, error: e.message });
    }
    return true;
  }

  return false;
}

module.exports = { handleAiFastWinsRoutes };
