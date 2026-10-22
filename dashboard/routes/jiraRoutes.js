/**
 * dashboard/routes/jiraRoutes.js
 * Router for Jira Cloud Configuration, Test Connection, and Ticket Fetching.
 * Modularity ceiling <= 150 lines.
 */
const { parseBody, sendJson } = require('./routeUtils');
const {
  getJiraConfig,
  saveJiraConfig,
  testJiraConnection,
  fetchJiraIssue,
} = require('../services/jiraService');

async function handleJiraRoutes(request, response, url, context = {}) {
  const root = context.root || process.env.QA_PROJECT_ROOT || process.cwd();

  if (request.method === 'GET' && url.pathname === '/api/jira/config') {
    const config = getJiraConfig(root);
    return sendJson(response, 200, config) || true;
  }

  if ((request.method === 'POST' || request.method === 'PUT') && url.pathname === '/api/jira/config') {
    try {
      const body = await parseBody(request);
      const updated = saveJiraConfig(root, {
        baseUrl: body.baseUrl,
        email: body.email,
        apiToken: body.apiToken,
      });
      return sendJson(response, 200, {
        message: 'Đã lưu cấu hình Jira Cloud thành công!',
        config: updated,
      }) || true;
    } catch (err) {
      return sendJson(response, 400, { error: `Lỗi lưu cấu hình Jira: ${err.message}` }) || true;
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/jira/test-connection') {
    try {
      const body = await parseBody(request);
      const result = await testJiraConnection({
        baseUrl: body.baseUrl,
        email: body.email,
        apiToken: body.apiToken,
        root,
      });
      const status = result.success ? 200 : (result.status || 400);
      return sendJson(response, status, result) || true;
    } catch (err) {
      return sendJson(response, 500, { success: false, error: err.message }) || true;
    }
  }

  if ((request.method === 'GET' || request.method === 'POST') && url.pathname === '/api/jira/issue') {
    try {
      let key = url.searchParams.get('key') || url.searchParams.get('url');
      if (!key && request.method === 'POST') {
        const body = await parseBody(request);
        key = body.key || body.url;
      }
      if (!key) {
        return sendJson(response, 400, { success: false, error: 'Vui lòng cung cấp mã ticket (ví dụ: ?key=JS-8824).' }) || true;
      }
      const result = await fetchJiraIssue(key, { root });
      const status = result.success ? 200 : (result.status || 400);
      return sendJson(response, status, result) || true;
    } catch (err) {
      return sendJson(response, 500, { success: false, error: err.message }) || true;
    }
  }

  return false;
}

module.exports = { handleJiraRoutes };
