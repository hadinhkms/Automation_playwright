const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]']);

function isLocalRequest(request) {
  try {
    const host = new URL(`http://${request.headers.host}`);
    if (!LOOPBACK.has(host.hostname) || Number(host.port || 80) !== request.socket.localPort) return false;
    if (request.headers['sec-fetch-site'] === 'cross-site') return false;
    if (request.headers.origin && request.headers.origin !== host.origin) return false;
    return true;
  } catch { return false; }
}

function createAgentRoutes({ service, parseBody, sendJson, isBusy = () => false }) {
  return async function agentRoutes(request, response, url) {
    if (!url.pathname.startsWith('/api/agent/')) return false;
    response.setHeader('Cache-Control', 'no-store');
    if (!isLocalRequest(request)) { sendJson(response, 403, { error: 'Chỉ truy cập Agent từ Dashboard trên máy này.' }); return true; }
    if (request.method !== 'GET' && (request.headers['x-dashboard-agent'] !== '1'
      || !String(request.headers['content-type'] || '').startsWith('application/json'))) {
      sendJson(response, 403, { error: 'Yêu cầu Agent không hợp lệ. Hãy tải lại Dashboard.' }); return true;
    }
    try {
      const sessionRoute = /^\/api\/agent\/sessions\/([a-f\d-]{36})(\/stop)?$/.exec(url.pathname);
      if (request.method === 'GET' && url.pathname === '/api/agent/status') {
        let clientConfig = null;
        if (request.headers['x-ai-config']) {
          try { clientConfig = JSON.parse(Buffer.from(request.headers['x-ai-config'], 'base64').toString('utf8')); } catch {}
        }
        sendJson(response, 200, await service.status({ refresh: url.searchParams.get('refresh') === '1', clientConfig }));
      } else if (request.method === 'GET' && url.pathname === '/api/agent/sessions') {
        sendJson(response, 200, { sessions: service.list() });
      } else if (request.method === 'POST' && url.pathname === '/api/agent/sessions') {
        const body = await parseBody(request, 40 * 1024);
        if (isBusy()) sendJson(response, 409, { error: 'Dashboard đang chạy test, ghi hình hoặc lưu dữ liệu. Hãy chờ tác vụ đó kết thúc.' });
        else sendJson(response, 202, { session: await service.start(body) });
      } else if (sessionRoute && request.method === 'GET' && !sessionRoute[2]) {
        sendJson(response, 200, { session: service.get(sessionRoute[1]) });
      } else if (sessionRoute && request.method === 'POST' && sessionRoute[2]) {
        sendJson(response, 200, { session: service.stop(sessionRoute[1]) });
      } else sendJson(response, 404, { error: 'Không tìm thấy thao tác Agent.' });
    } catch (error) {
      const known = [400, 404, 409, 503].includes(error.statusCode);
      sendJson(response, known ? error.statusCode : error instanceof SyntaxError ? 400 : 500,
        { error: known ? error.message : 'Không thể xử lý yêu cầu Agent. Kiểm tra dữ liệu và thử lại.' });
    }
    return true;
  };
}

module.exports = { createAgentRoutes, isLocalRequest };
