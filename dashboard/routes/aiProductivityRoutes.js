/**
 * dashboard/routes/aiProductivityRoutes.js
 * Router handling Core Productivity AI endpoints (PLAN-17d).
 * Strict ceiling <= 150 lines.
 */
const { buildAiContext } = require('../../core/ai/context/contextBuilder');
const {
  runSuggestLocator,
  runReviewSpec,
  runAnalyzeTestImpact,
  runGenerateReleaseBriefing,
  runAnalyzeRequirementChange,
  runGeneratePlaywrightSpec
} = require('../../core/ai/tasks/index');
const { parseBody, sendJson, abortSignalFor } = require('./routeUtils');

async function handleAiProductivityRoutes(request, response, url, clientConfig) {
  if (!url.pathname.startsWith('/api/ai/') || request.method !== 'POST') return false;
  const signal = abortSignalFor(request, response);

  try {
    if (url.pathname === '/api/ai/context') {
      const body = await parseBody(request);
      const context = buildAiContext({
        task: body.task || 'general',
        budgetTokens: body.budgetTokens || 4000,
        customSnippet: body.customSnippet || ''
      });
      return sendJson(response, 200, context);
    }

    if (url.pathname === '/api/ai/suggest-locator') {
      const body = await parseBody(request);
      const result = await runSuggestLocator({
        brokenLocator: body.brokenLocator || '',
        errorMessage: body.errorMessage || '',
        domSnippet: body.domSnippet || '',
        pageUrl: body.pageUrl || '',
        signal,
        clientConfig
      });
      return sendJson(response, 200, result);
    }

    if (url.pathname === '/api/ai/review-spec') {
      const body = await parseBody(request);
      const result = await runReviewSpec({
        specCode: body.specCode || '',
        filePath: body.filePath || '',
        signal,
        clientConfig
      });
      return sendJson(response, 200, result);
    }

    if (url.pathname === '/api/ai/test-impact') {
      const body = await parseBody(request);
      const result = await runAnalyzeTestImpact({
        changedFiles: body.changedFiles || [],
        diffText: body.diffText || '',
        signal,
        clientConfig
      });
      return sendJson(response, 200, result);
    }

    if (url.pathname === '/api/ai/release-briefing') {
      const body = await parseBody(request);
      const result = await runGenerateReleaseBriefing({
        testMetrics: body.testMetrics || {},
        uncoveredReqCount: body.uncoveredReqCount || 0,
        openBlockersCount: body.openBlockersCount || 0,
        releaseName: body.releaseName || 'Next Release',
        signal,
        clientConfig
      });
      return sendJson(response, 200, result);
    }

    if (url.pathname === '/api/ai/req-change') {
      const body = await parseBody(request);
      const result = await runAnalyzeRequirementChange({
        reqId: body.reqId || 'REQ-001',
        oldContent: body.oldContent || '',
        newContent: body.newContent || '',
        signal,
        clientConfig
      });
      return sendJson(response, 200, result);
    }

    if (url.pathname === '/api/ai/generate-spec') {
      const body = await parseBody(request);
      const result = await runGeneratePlaywrightSpec({
        reqId: body.reqId || 'REQ-001',
        requirementTitle: body.requirementTitle || '',
        tcList: Array.isArray(body.tcList) ? body.tcList : [],
        criteriaText: typeof body.criteriaText === 'string' ? body.criteriaText : ''
      });
      return sendJson(response, result.ok ? 200 : 400, result);
    }
  } catch (err) {
    const status = Number.isInteger(err.status) ? err.status : 400;
    return sendJson(response, status, { ok: false, error: err.message });
  }

  return false;
}

module.exports = {
  handleAiProductivityRoutes
};
