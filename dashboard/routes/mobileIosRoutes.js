/**
 * dashboard/routes/mobileIosRoutes.js
 * /api/mobile/ios/* — remote Mac host settings and the connection check (PLAN-25 P3, REQ-301/302).
 * Called from mobileRoutes.js; errors bubble up to its handler.
 */
const { sendJson, parseBody } = require('./routeUtils');
const { readIosConfig, saveIosConfig, validateIosConfig, deviceKey } = require('../services/mobileIosService');
const { checkIosHost, iosDoctor } = require('../services/mobileIosCheck');

/** Device cards for frame 1, same fields the Android list uses. */
function iosDevices(root) {
  const config = readIosConfig(root);
  return {
    platform: 'ios',
    available: Boolean(config.host),
    error: config.error || (config.host ? '' : 'Chưa cấu hình Mac host.'),
    host: config.host ? `${config.host}:${config.port}` : '',
    devices: config.devices.map((d) => ({
      serial: deviceKey(d), model: d.name, state: 'device', ready: true,
      osLabel: `iOS ${d.platformVersion}`, emulator: d.simulator, udid: d.udid,
    })),
  };
}

async function handleIosRoutes(request, response, url, root) {
  const route = `${request.method} ${url.pathname}`;
  switch (route) {
    case 'GET /api/mobile/ios/config':
      return sendJson(response, 200, readIosConfig(root));
    case 'PUT /api/mobile/ios/config':
      return sendJson(response, 200, saveIosConfig(root, await parseBody(request)));
    case 'POST /api/mobile/ios/check': {
      const body = await parseBody(request);
      // Settings checks the values on screen before they are saved; an empty body checks the saved ones.
      const config = body && Object.keys(body).length ? validateIosConfig(body) : readIosConfig(root);
      return sendJson(response, 200, await checkIosHost(config));
    }
    default:
      return sendJson(response, 404, { error: 'Không tìm thấy API mobile iOS.' });
  }
}

/** iOS answers for the shared GET routes (?platform=ios). */
async function iosGet(pathname, root) {
  if (pathname === '/api/mobile/devices') return iosDevices(root);
  if (pathname === '/api/mobile/doctor') {
    const { ready, checks } = await iosDoctor(readIosConfig(root));
    return { platform: 'ios', ready, checks };
  }
  return null;
}

module.exports = { handleIosRoutes, iosGet, iosDevices };
