/**
 * dashboard/routes/settingsRoutes.js
 * GET/PUT /api/settings với optimistic concurrency (tách từ systemRoutes.js).
 *  GET  -> cấu hình công khai + `revision`.
 *  PUT  -> body = cấu hình, kèm `baseRevision` (hoặc header If-Match). Lệch revision hiện tại -> 409
 *          {ok:false, code:"CONFIG_CONFLICT", error, revision}, KHÔNG ghi file. Không gửi baseRevision
 *          vẫn lưu như cũ (tương thích client cũ) và ghi cảnh báo. Thành công trả `revision` mới.
 * So sánh + ghi chạy đồng bộ (không await giữa hai bước) nên hai PUT trong cùng tiến trình không chen nhau.
 */
const { CONFIG_PATH, publicDashboardConfig, saveDashboardConfig } = require('../../core/config/dashboardConfig');
const { createBackup } = require('../services/resourceService');
const { currentRevision, requestedBaseRevision, CONFLICT } = require('../services/configRevision');
const { sendJson, parseBody } = require('./routeUtils');

async function handleSettingsRoutes(request, response, url, context = {}) {
  if (url.pathname !== '/api/settings') return false;
  const root = context.root || process.env.QA_PROJECT_ROOT || process.cwd();

  if (request.method === 'GET') {
    return sendJson(response, 200, { ...publicDashboardConfig(), revision: currentRevision() }) || true;
  }
  if (request.method === 'PUT') {
    try {
      const body = await parseBody(request);
      const base = requestedBaseRevision(body, request.headers);
      delete body.baseRevision;
      delete body.revision;
      const revision = currentRevision();
      if (base !== undefined && base !== revision) return sendJson(response, 409, { ...CONFLICT, revision }) || true;
      if (base === undefined) console.warn('[settings] PUT /api/settings không có baseRevision: lưu không kiểm tra xung đột.');
      const backup = createBackup('core/config/dashboardConfig.json', CONFIG_PATH, root);
      const saved = saveDashboardConfig(body);
      sendJson(response, 200, { message: 'Đã lưu cấu hình.', backup, settings: publicDashboardConfig(saved), revision: currentRevision() });
    } catch (e) { sendJson(response, 400, { error: `Không thể lưu cấu hình: ${e.message}` }); }
    return true;
  }
  return false;
}

module.exports = { handleSettingsRoutes };
