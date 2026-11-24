/**
 * dashboard/services/requestGuard.js
 * Chặn CSRF / DNS-rebinding cho API Dashboard (chỉ chạy local):
 *  - Host phải là localhost | 127.0.0.1 | [::1] đúng port đang nghe.
 *  - Origin (nếu có) phải là http://localhost|127.0.0.1|[::1] đúng port.
 *  - API đổi trạng thái (POST/PUT/PATCH/DELETE dưới /api/) bắt buộc Content-Type application/json
 *    (ngoại lệ: PUT /api/mobile/builds/<name> upload app dùng application/octet-stream).
 * Trả về { status, error } khi từ chối, null khi hợp lệ.
 */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const STATE_CHANGING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function splitHostPort(value) {
  const match = /^(\[[^\]]+\]|[^:]+)(?::(\d+))?$/.exec(String(value || '').trim().toLowerCase());
  return match ? { host: match[1], port: match[2] || '' } : null;
}

function isLocalAuthority(value, port) {
  const parts = splitHostPort(value);
  return Boolean(parts) && LOCAL_HOSTS.has(parts.host) && parts.port === String(port);
}

function isLocalOrigin(origin, port) {
  let parsed;
  try { parsed = new URL(origin); } catch (_) { return false; }
  if (parsed.protocol !== 'http:') return false;
  return isLocalAuthority(parsed.host, port);
}

function isJsonContentType(value) {
  return /^application\/json\s*(;|$)/i.test(String(value || '').trim());
}

// Upload nhị phân hợp lệ duy nhất: UI gửi application/octet-stream (cross-site vẫn bị chặn bởi Origin/Host + không có CORS).
function isBinaryUpload(request, url) {
  return request.method === 'PUT' && url.pathname.startsWith('/api/mobile/builds/')
    && /^application\/octet-stream\s*(;|$)/i.test(String(request.headers['content-type'] || '').trim());
}

function checkRequest(request, url, port) {
  if (!url.pathname.startsWith('/api/')) return null;
  if (!isLocalAuthority(request.headers.host, port)) {
    return { status: 403, error: 'Host không hợp lệ: Dashboard chỉ nhận request tới localhost/127.0.0.1 đúng cổng.' };
  }
  const origin = request.headers.origin;
  if (origin !== undefined && !isLocalOrigin(origin, port)) {
    return { status: 403, error: 'Origin không được phép: Dashboard chỉ nhận request từ chính nó.' };
  }
  if (STATE_CHANGING.has(request.method) && !isJsonContentType(request.headers['content-type']) && !isBinaryUpload(request, url)) {
    return { status: 415, error: 'Content-Type phải là application/json cho API thay đổi dữ liệu.' };
  }
  return null;
}

/** Parse URL + áp guard; đã trả lỗi cho client thì trả null. */
function guardRequest(request, response, port, sendJson) {
  let url;
  try { url = new URL(request.url, 'http://localhost'); } catch (_) {
    sendJson(response, 400, { error: 'URL không hợp lệ.' });
    return null;
  }
  const rejected = checkRequest(request, url, port);
  if (!rejected) return url;
  request.resume();
  sendJson(response, rejected.status, { error: rejected.error });
  return null;
}

module.exports = { guardRequest, checkRequest, isLocalAuthority, isLocalOrigin, isJsonContentType };
