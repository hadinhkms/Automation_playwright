/**
 * dashboard/routes/systemMaintenanceRoutes.js
 * Ping site, kiểm tra/áp dụng cập nhật và cập nhật Framework (tách từ systemRoutes.js).
 */
const https = require('https');
const http = require('http');
const { checkForUpdates, applyUpdate } = require('../../core/system/updater');
const { loadUpdateFramework, NOT_AVAILABLE } = require('../services/frameworkUpdateLoader');
const { sendJson } = require('./routeUtils');

async function handleSystemMaintenanceRoutes(request, response, url, context = {}) {
  const root = context.root || process.env.QA_PROJECT_ROOT || process.cwd();

  if (request.method === 'GET' && url.pathname === '/api/system/ping-site') {
    const targetUrl = url.searchParams.get('url');
    if (!targetUrl) {
      return sendJson(response, 400, { ok: false, error: 'Thiếu tham số url.' }) || true;
    }
    const startTime = Date.now();
    try {
      const parsed = new URL(targetUrl);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return sendJson(response, 400, { ok: false, error: 'Chỉ hỗ trợ giao thức http hoặc https.' }) || true;
      }
      let responded = false;
      const sendPingResponse = (statusCode, payload) => {
        if (responded) return;
        responded = true;
        sendJson(response, statusCode, payload);
      };

      const client = parsed.protocol === 'https:' ? https : http;
      const req = client.request(parsed, {
        method: 'HEAD',
        timeout: 6000,
        rejectUnauthorized: false,
        headers: { 'User-Agent': 'QA-Dashboard/1.0' },
      }, (res) => {
        const timeMs = Date.now() - startTime;
        sendPingResponse(200, {
          ok: res.statusCode >= 200 && res.statusCode < 500,
          status: res.statusCode,
          statusText: res.statusMessage || '',
          timeMs,
        });
      });
      req.on('timeout', () => {
        req.destroy();
        sendPingResponse(200, { ok: false, status: 408, error: 'Timeout (>6s)', timeMs: Date.now() - startTime });
      });
      req.on('error', (err) => {
        sendPingResponse(200, { ok: false, status: 0, error: err.code || err.message, timeMs: Date.now() - startTime });
      });
      req.end();
      return true;
    } catch (e) {
      return sendJson(response, 400, { ok: false, error: e.message }) || true;
    }
  }
  if (request.method === 'GET' && url.pathname === '/api/system/check-update') {
    try { sendJson(response, 200, await checkForUpdates({ rootDir: root })); } catch (e) { sendJson(response, 500, { ok: false, error: e.message }); }
    return true;
  }
  if (request.method === 'POST' && url.pathname === '/api/system/apply-update') {
    try { const r = applyUpdate({ rootDir: root }); sendJson(response, r.ok ? 200 : 400, r); } catch (e) { sendJson(response, 500, { ok: false, error: e.message }); }
    return true;
  }
  if (request.method === 'POST' && (url.pathname === '/api/framework/update' || url.pathname === '/api/system/update-framework')) {
    try {
      const updateFramework = loadUpdateFramework();
      if (!updateFramework) return sendJson(response, 501, NOT_AVAILABLE) || true;
      const r = updateFramework({ targetDir: root });
      sendJson(response, r.ok ? 200 : 400, r);
    } catch (e) {
      sendJson(response, 500, { ok: false, error: e.message });
    }
    return true;
  }

  return false;
}

module.exports = { handleSystemMaintenanceRoutes };
