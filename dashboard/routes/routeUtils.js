const path = require('path');

/**
 * Sends a JSON response with the specified status code and UTF-8 charset.
 */
function sendJson(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
  return true;
}

/**
 * Sends a standardized JSON error response.
 */
function sendError(response, status, message) {
  return sendJson(response, status, { error: message });
}

function jsonError(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}

/**
 * Parses JSON object request body asynchronously with a maximum byte limit.
 */
function parseBody(request, maxBytes = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let raw = '';
    let bytes = 0;
    let settled = false;
    const fail = (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    };
    request.on('data', (chunk) => {
      if (settled) return;
      bytes += Buffer.byteLength(chunk);
      if (bytes > maxBytes) {
        raw = '';
        fail(jsonError(413, 'PAYLOAD_TOO_LARGE', 'Kích thước request vượt quá giới hạn cho phép.'));
        return;
      }
      raw += chunk;
    });
    request.on('end', () => {
      if (settled) return;
      if (!raw) { settled = true; resolve({}); return; }
      try {
        const parsed = JSON.parse(raw);
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
          fail(jsonError(400, 'INVALID_JSON', 'Dữ liệu JSON phải là một object.'));
          return;
        }
        settled = true;
        resolve(parsed);
      } catch (err) {
        fail(jsonError(400, 'INVALID_JSON', 'Dữ liệu JSON không hợp lệ: ' + err.message));
      }
    });
    request.on('error', fail);
  });
}

/**
 * Ensures the requested path stays strictly within the base directory (path traversal protection).
 */
function safeChildPath(base, requestedPath) {
  const resolved = path.resolve(base, `.${requestedPath}`);
  return resolved === base || resolved.startsWith(`${base}${path.sep}`) ? resolved : null;
}

/**
 * Returns an AbortSignal that triggers when the client terminates connection prematurely.
 */
function abortSignalFor(request, response) {
  const controller = new AbortController();
  const cleanup = () => {
    if (response && typeof response.removeListener === 'function') {
      response.removeListener('close', onClose);
    }
    if (request && typeof request.removeListener === 'function') {
      request.removeListener('close', onClose);
    }
  };

  const onClose = () => {
    if ((!response || !response.writableEnded) && !controller.signal.aborted) {
      controller.abort();
    }
    cleanup();
  };

  if (response && typeof response.once === 'function') {
    response.once('close', onClose);
  }
  if (request && typeof request.once === 'function') {
    request.once('close', onClose);
  }
  return controller.signal;
}

module.exports = {
  sendJson,
  sendError,
  parseBody,
  safeChildPath,
  abortSignalFor,
};
