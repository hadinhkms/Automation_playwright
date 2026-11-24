/**
 * dashboard/public/js/core/jsonFetchDefault.js
 * Server từ chối (415) API đổi trạng thái không có Content-Type: application/json.
 * Shim nhỏ này gắn header đó cho fetch cùng origin tới /api/* (POST/PUT/PATCH/DELETE) khi
 * caller chưa đặt và body là chuỗi hoặc không có (vd. POST /api/stop). Không đụng FormData/Blob.
 * GIỚI HẠN: không xử lý `fetch(new Request(...))` (Request tự gắn Content-Type riêng) và body
 * URLSearchParams (urlencoded) -> server trả 415. Caller phải tự đặt `Content-Type: application/json`
 * và truyền JSON.stringify(...) khi gọi API ghi theo hai kiểu đó.
 */
(function installJsonFetchDefault() {
  const nativeFetch = window.fetch.bind(window);
  const WRITE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

  window.fetch = function fetchWithJsonDefault(input, init) {
    try {
      const options = init || {};
      const method = String(options.method || (input && input.method) || 'GET').toUpperCase();
      const body = options.body;
      if (WRITE.has(method) && (body === undefined || body === null || typeof body === 'string')) {
        const target = new URL(typeof input === 'string' ? input : (input && input.url) || String(input), window.location.href);
        if (target.origin === window.location.origin && target.pathname.startsWith('/api/')) {
          const headers = new Headers(options.headers || (input && input.headers) || undefined);
          if (!headers.has('Content-Type')) {
            headers.set('Content-Type', 'application/json');
            return nativeFetch(input, { ...options, headers });
          }
        }
      }
    } catch (_) { /* fall through to the native fetch untouched */ }
    return nativeFetch(input, init);
  };
}());
