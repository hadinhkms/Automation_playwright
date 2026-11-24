/**
 * dashboard/routes/runnerRoutes.js
 * Handles all /api/run, /api/stop, /api/events, /api/state endpoints for test execution.
 */
const { sendJson, parseBody } = require('./routeUtils');
const { handleRunHistoryRoutes } = require('./runHistoryRoutes');
const {
  getActiveRun,
  isRunStarting,
  tryBeginStart,
  endStart,
  getLastRun,
  getClients,
  getLogBuffer,
  publicRun,
  validateOptions,
  startRun,
  stopRun
} = require('../services/runnerService');
const { assertNotFrozen } = require('../../core/utils/circuitBreaker');
const { getActiveMobileRun } = require('../services/mobileRunnerService');
const { inspector } = require('./mobileInspectorRoutes');

const MOBILE_BUSY = 'Đang có một lượt chạy Mobile App. Đợi xong hoặc dừng nó trước.';

/**
 * POST /api/run và /api/ui. Thứ tự: (1) await parseBody TRƯỚC (body chậm/nửa vời không giữ cờ, nên không làm các
 * /api/run khác nhận 409 sai lý do); (2) kiểm bận + đặt cờ "đang khởi động" ĐỒNG BỘ (không await giữa hai bước);
 * (3) await validate (cache lạnh có thể mất ~1 s). Nhờ vậy N POST đồng thời chỉ MỘT cái chạy, N-1 nhận 409.
 * Kiểm lại bận ngay trước startRun vì trong lúc await mobile/inspector có thể đã chiếm máy.
 */
async function launchRun(request, response, root, uiMode) {
  const fail = (error) => {
    // P-1: parseBody ném lỗi có `status` (413 cho body > 2 MB); các lỗi khác dùng statusCode.
    const code = error.statusCode ?? error.status;
    const status = Number.isInteger(code) ? code : (String(error.message || '').includes('[CIRCUIT BREAKER]') ? 403 : 400);
    return sendJson(response, status, { error: error.message });
  };
  const busy = () => {
    if (getActiveRun() || isRunStarting()) return uiMode ? 'Đang có một test run hoặc UI Mode khác.' : 'Đang có một test run khác.';
    if (getActiveMobileRun()) return MOBILE_BUSY;
    return inspector.busyReason() || null;
  };

  let body;
  try { body = await parseBody(request); } catch (error) { return fail(error); }

  const reason = busy();
  if (reason) return sendJson(response, 409, { error: reason });
  if (!tryBeginStart()) return sendJson(response, 409, { error: 'Đang có một test run khác.' });
  try {
    const options = await validateOptions(body, root);
    assertNotFrozen({ suiteName: options.suite || options.file, projectRoot: root, exitOnError: false });
    const stillBusy = getActiveMobileRun() ? MOBILE_BUSY : inspector.busyReason();
    if (stillBusy) return sendJson(response, 409, { error: stillBusy });
    return sendJson(response, 202, startRun(options, uiMode, root));
  } catch (error) {
    return fail(error);
  } finally {
    endStart();
  }
}

async function handleRunnerRoutes(request, response, url, context = {}) {
  const root = context.root || process.env.QA_PROJECT_ROOT || process.cwd();

  if (await handleRunHistoryRoutes(request, response, url, context)) return true;

  if (request.method === 'GET' && url.pathname === '/api/state') {
    return sendJson(response, 200, {
      activeRun: publicRun(getActiveRun()),
      lastRun: getLastRun(),
      logs: getLogBuffer()
    });
  }

  if (request.method === 'GET' && url.pathname === '/api/events') {
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    });
    response.write(': connected\n\n');
    const clients = getClients();
    clients.add(response);
    request.on('close', () => clients.delete(response));
    return true;
  }

  if (request.method === 'POST' && (url.pathname === '/api/run' || url.pathname === '/api/ui')) {
    return launchRun(request, response, root, url.pathname === '/api/ui');
  }

  if (request.method === 'POST' && url.pathname === '/api/stop') {
    if (!getActiveRun()) return sendJson(response, 409, { error: 'Không có test run đang chạy.' });
    stopRun();
    return sendJson(response, 202, { message: 'Đã gửi yêu cầu dừng.' });
  }

  if (request.method === 'POST' && url.pathname === '/api/shutdown') {
    sendJson(response, 200, { message: 'Đang tắt dashboard server...' });
    if (typeof context.shutdown === 'function') {
      setImmediate(context.shutdown);
    }
    return true;
  }

  return false;
}

module.exports = { handleRunnerRoutes };
