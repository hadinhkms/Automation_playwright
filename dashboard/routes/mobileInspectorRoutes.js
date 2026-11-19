/**
 * dashboard/routes/mobileInspectorRoutes.js
 * /api/mobile/inspector/* — native Inspector session and Screen generation (PLAN-25 P4).
 * Called from mobileRoutes.js; errors bubble up to its handler. The single service instance also answers
 * the run lock (X-02) for /api/run, /api/ui and /api/mobile/run, and is closed on server shutdown.
 */
const { sendJson, parseBody } = require('./routeUtils');
const { createInspectorService } = require('../services/mobileInspectorService');
const { handlePageObject, listScreens } = require('../services/nativePageObjectGenerator');
const { publish, getActiveRun } = require('../services/runnerService');
const { getActiveMobileRun } = require('../services/mobileRunnerService');

const inspector = createInspectorService({
  publish,
  busyReason: () => {
    if (getActiveRun()) return 'Đang có một lượt chạy Playwright. Đợi xong hoặc dừng nó trước.';
    if (getActiveMobileRun()) return 'Đang có một lượt chạy Mobile App. Đợi xong hoặc dừng nó trước.';
    return '';
  },
});

async function handleInspectorRoutes(request, response, url, root) {
  const route = `${request.method} ${url.pathname.replace('/api/mobile/inspector', '')}`;
  const key = url.searchParams.get('key');
  switch (route) {
    case 'GET /state':
      return sendJson(response, 200, inspector.getState());
    case 'POST /start':
      return sendJson(response, 201, await inspector.start(await parseBody(request), root));
    case 'GET /snapshot':
      return sendJson(response, 200, await inspector.snapshot(key));
    case 'POST /find': {
      const body = await parseBody(request);
      return sendJson(response, 200, await inspector.find(body.key, body));
    }
    case 'POST /action': {
      const body = await parseBody(request);
      return sendJson(response, 200, await inspector.action(body.key, body));
    }
    case 'POST /stop': {
      const body = await parseBody(request);
      return sendJson(response, 200, await inspector.stop(body.key || key));
    }
    case 'GET /screens':
      return sendJson(response, 200, { screens: listScreens(root) });
    case 'POST /page-object': {
      const result = handlePageObject(root, await parseBody(request));
      return sendJson(response, result.status, result.body);
    }
    default:
      return sendJson(response, 404, { error: 'Không tìm thấy API Inspector.' });
  }
}

module.exports = { handleInspectorRoutes, inspector };
