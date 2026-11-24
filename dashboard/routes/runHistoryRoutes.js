/**
 * dashboard/routes/runHistoryRoutes.js
 * GET /api/run-history, /latest-failed, /file-status, /:id (CONTRACT-run-history §4). Chỉ đọc. Route cố định đứng
 * TRƯỚC route :id (latest-failed khớp ID_PATTERN). Tệp lịch sử hỏng/thiếu -> 200 với danh sách rỗng, không 500.
 */
const { sendJson } = require('./routeUtils');
const { listRuns, getRun, latestFailed, fileStatuses, MAX_RUNS } = require('../services/runHistoryService');

async function handleRunHistoryRoutes(request, response, url, context = {}) {
  if (request.method !== 'GET' || !url.pathname.startsWith('/api/run-history')) return false;
  const root = context.root || process.env.QA_PROJECT_ROOT || process.cwd();
  const rest = url.pathname.slice('/api/run-history'.length);

  try {
    if (rest === '' || rest === '/') return sendJson(response, 200, { version: 1, runs: listRuns(root, url.searchParams.get('limit')) }) || true;
    if (rest === '/latest-failed') return sendJson(response, 200, latestFailed(root)) || true;
    if (rest === '/file-status') return sendJson(response, 200, fileStatuses(root)) || true;
    let id = rest.slice(1);
    try { id = decodeURIComponent(id); } catch (_) { id = ''; }
    const run = getRun(root, id);
    if (!run) return sendJson(response, 404, { error: 'Không tìm thấy lượt chạy.' }) || true;
    return sendJson(response, 200, run) || true;
  } catch (error) {
    return sendJson(response, 500, { error: `Không đọc được lịch sử chạy: ${error.message}` }) || true;
  }
}

module.exports = { handleRunHistoryRoutes, MAX_RUNS };
