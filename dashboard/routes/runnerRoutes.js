/**
 * dashboard/routes/runnerRoutes.js
 * Handles all /api/run, /api/stop, /api/events, /api/state endpoints for test execution.
 */
const { sendJson, parseBody } = require('./routeUtils');
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
 * POST /api/run và /api/ui. Kiểm 409 + đặt cờ "đang khởi động" xảy ra ĐỒNG BỘ (không await giữa hai bước), rồi mới
 * await validate (cache lạnh có thể mất ~1 s). Nhờ vậy N POST đồng thời chỉ MỘT cái chạy, N-1 nhận 409 (trước đây
 * cả N cùng 202 và N-1 tiến trình playwright mồ côi). Kiểm lại bận ngay trước startRun vì trong lúc await
 * mobile/inspector có thể đã chiếm máy.
 */
async function launchRun(request, response, root, uiMode) {
  const busy = () => {
    if (getActiveRun() || isRunStarting()) return uiMode ? 'Đang có một test run hoặc UI Mode khác.' : 'Đang có một test run khác.';
    if (getActiveMobileRun()) return MOBILE_BUSY;
    return inspector.busyReason() || null;
  };
  const reason = busy();
  if (reason) return sendJson(response, 409, { error: reason });
  if (!tryBeginStart()) return sendJson(response, 409, { error: 'Đang có một test run khác.' });
  try {
    const options = await validateOptions(await parseBody(request), root);
    assertNotFrozen({ suiteName: options.suite || options.file, projectRoot: root, exitOnError: false });
    const stillBusy = getActiveMobileRun() ? MOBILE_BUSY : inspector.busyReason();
    if (stillBusy) return sendJson(response, 409, { error: stillBusy });
    return sendJson(response, 202, startRun(options, uiMode, root));
  } catch (error) {
    const status = Number.isInteger(error.statusCode) ? error.statusCode : (String(error.message || '').includes('[CIRCUIT BREAKER]') ? 403 : 400);
    return sendJson(response, status, { error: error.message });
  } finally {
    endStart();
  }
}

async function handleRunnerRoutes(request, response, url, context = {}) {
  const root = context.root || process.env.QA_PROJECT_ROOT || process.cwd();

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
