/**
 * dashboard/routes/mobileRoutes.js
 * /api/mobile/* endpoints for native app testing (Android P1).
 */
const { sendJson, parseBody } = require('./routeUtils');
const { listAndroidDevices, runDoctor } = require('../services/mobileDeviceService');
const { getCatalog, PLATFORMS } = require('../services/mobileSpecService');
const { validateMobileOptions } = require('../services/mobileRunOptions');
const { startMobileRun, stopMobileRun, getActiveMobileRun, getMobileState } = require('../services/mobileRunnerService');
const { assertNotFrozen } = require('../../core/utils/circuitBreaker');

function platformParam(url) {
  return url.searchParams.get('platform') || 'android';
}

function statusOf(error) {
  if (error.status) return error.status;
  return String(error.message || '').includes('[CIRCUIT BREAKER]') ? 403 : 500;
}

async function handleMobileRoutes(request, response, url, context = {}) {
  if (!url.pathname.startsWith('/api/mobile/')) return false;
  const root = context.root || process.env.QA_PROJECT_ROOT || process.cwd();
  const route = `${request.method} ${url.pathname}`;

  if (request.method === 'GET' && !PLATFORMS[platformParam(url)]) {
    return sendJson(response, 400, { error: 'Nền tảng chưa được hỗ trợ.' });
  }

  try {
    switch (route) {
      case 'GET /api/mobile/catalog':
        return sendJson(response, 200, getCatalog(root, platformParam(url)));
      case 'GET /api/mobile/devices':
        return sendJson(response, 200, { platform: 'android', ...(await listAndroidDevices()) });
      case 'GET /api/mobile/doctor':
        return sendJson(response, 200, { platform: 'android', ...(await runDoctor()) });
      case 'GET /api/mobile/state':
        return sendJson(response, 200, getMobileState());
      case 'POST /api/mobile/run': {
        const options = validateMobileOptions(await parseBody(request), root);
        assertNotFrozen({ suiteName: `mobile-${options.platform}`, projectRoot: root, exitOnError: false });
        return sendJson(response, 202, startMobileRun(options, root));
      }
      case 'POST /api/mobile/stop':
        if (!getActiveMobileRun()) return sendJson(response, 409, { error: 'Không có lượt chạy Mobile nào đang chạy.' });
        stopMobileRun();
        return sendJson(response, 202, { message: 'Đã gửi yêu cầu dừng.' });
      default:
        return sendJson(response, 404, { error: 'Không tìm thấy API mobile.' });
    }
  } catch (error) {
    const status = statusOf(error);
    return sendJson(response, status, { error: status === 500 ? `Lỗi máy chủ: ${error.message}` : error.message });
  }
}

module.exports = { handleMobileRoutes };
