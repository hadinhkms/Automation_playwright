/**
 * dashboard/routes/mobileRoutes.js
 * /api/mobile/* endpoints for native app testing (Android P1, builds and run history P2, iOS via a remote Mac P3).
 */
const fs = require('fs');
const path = require('path');
const { sendJson, parseBody } = require('./routeUtils');
const { listAndroidDevices, runDoctor } = require('../services/mobileDeviceService');
const { getCatalog, PLATFORMS } = require('../services/mobileSpecService');
const { validateMobileOptions } = require('../services/mobileRunOptions');
const { startMobileRun, stopMobileRun, getActiveMobileRun, getMobileState, isBuildInUse } = require('../services/mobileRunnerService');
const { saveBuild, deleteBuild } = require('../services/mobileBuildService');
const { enrichApps } = require('../services/mobileApkInfo');
const { listRuns, getRun } = require('../services/mobileRunHistory');
const { assertNotFrozen } = require('../../core/utils/circuitBreaker');
const { handleIosRoutes, iosGet } = require('./mobileIosRoutes');
const { readIosConfig } = require('../services/mobileIosService');
const { assertIosReady } = require('../services/mobileIosCheck');

const BUILD_ROUTE = /^\/api\/mobile\/builds\/([^/]+)$/;
const RUN_ROUTE = /^\/api\/mobile\/runs\/([^/]+)(\/junit)?$/;

function platformParam(url) {
  return url.searchParams.get('platform') || 'android';
}

function statusOf(error) {
  if (error.status) return error.status;
  return String(error.message || '').includes('[CIRCUIT BREAKER]') ? 403 : 500;
}

function decodeSegment(segment) {
  try { return decodeURIComponent(segment); } catch (_) { return '\u0000'; }
}

async function handleBuildRoute(request, response, root, name, url) {
  if (request.method === 'PUT') {
    const overwrite = url.searchParams.get('overwrite') === '1';
    // A rejected upload leaves unread body bytes on the socket; never let the client reuse it.
    response.setHeader('Connection', 'close');
    return sendJson(response, 201, await saveBuild(root, request, name, { overwrite, isInUse: isBuildInUse }));
  }
  if (request.method === 'DELETE') return sendJson(response, 200, deleteBuild(root, name, { isInUse: isBuildInUse }));
  return sendJson(response, 405, { error: 'Chỉ hỗ trợ PUT hoặc DELETE.' });
}

function handleRunRoute(response, root, id, wantsJunit) {
  const run = getRun(root, id);
  if (!run) return sendJson(response, 404, { error: 'Không tìm thấy lượt chạy.' });
  if (!wantsJunit) return sendJson(response, 200, run);
  const file = run.junit?.file ? path.join(root, run.junit.file) : '';
  if (!file || !fs.existsSync(file)) return sendJson(response, 404, { error: 'Lượt chạy này không có file JUnit.' });
  response.writeHead(200, {
    'Content-Type': 'application/xml; charset=utf-8',
    'Content-Disposition': `attachment; filename="${path.basename(file)}"`,
  });
  fs.createReadStream(file).pipe(response);
  return true;
}

async function handleMobileRoutes(request, response, url, context = {}) {
  if (!url.pathname.startsWith('/api/mobile/')) return false;
  const root = context.root || process.env.QA_PROJECT_ROOT || process.cwd();
  const route = `${request.method} ${url.pathname}`;

  if (request.method === 'GET' && !PLATFORMS[platformParam(url)]) {
    return sendJson(response, 400, { error: 'Nền tảng chưa được hỗ trợ.' });
  }

  try {
    if (url.pathname.startsWith('/api/mobile/ios/')) return await handleIosRoutes(request, response, url, root);
    const ios = request.method === 'GET' && platformParam(url) === 'ios' ? await iosGet(url.pathname, root) : null;
    if (ios) return sendJson(response, 200, ios);
    const build = BUILD_ROUTE.exec(url.pathname);
    if (build) return await handleBuildRoute(request, response, root, decodeSegment(build[1]), url);
    const run = request.method === 'GET' && RUN_ROUTE.exec(url.pathname);
    if (run) return handleRunRoute(response, root, decodeSegment(run[1]), Boolean(run[2]));

    switch (route) {
      case 'GET /api/mobile/catalog': {
        const catalog = getCatalog(root, platformParam(url));
        const apps = catalog.platform === 'android' ? await enrichApps(root, catalog.apps) : catalog.apps;
        return sendJson(response, 200, { ...catalog, apps });
      }
      case 'GET /api/mobile/devices':
        return sendJson(response, 200, { platform: 'android', ...(await listAndroidDevices()) });
      case 'GET /api/mobile/doctor':
        return sendJson(response, 200, { platform: 'android', ...(await runDoctor()) });
      case 'GET /api/mobile/state':
        return sendJson(response, 200, getMobileState());
      case 'GET /api/mobile/runs':
        return sendJson(response, 200, { runs: listRuns(root, url.searchParams.get('limit')) });
      case 'POST /api/mobile/run': {
        const options = validateMobileOptions(await parseBody(request), root);
        assertNotFrozen({ suiteName: `mobile-${options.platform}`, projectRoot: root, exitOnError: false });
        if (options.platform === 'ios') await assertIosReady(readIosConfig(root));
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
    if (response.headersSent) return true;
    return sendJson(response, status, { error: status === 500 ? `Lỗi máy chủ: ${error.message}` : error.message });
  }
}

module.exports = { handleMobileRoutes };
