/**
 * dashboard/services/mobileIosCheck.js
 * "Kiểm tra kết nối" for the remote Mac host (REQ-302, TECH-304, EDGE-301/302).
 * The server calls Appium (no CORS for the browser) and the whole check ends within 5 s.
 */

const TIMEOUT_MS = 5000;
const NO_DRIVER = /could not find a driver|no driver.*xcuitest|driver.*not (be )?installed/i;

function describeNetworkError(err, base) {
  if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
    return `${base} không phản hồi trong 5 giây. Kiểm tra máy Mac đang bật, cùng mạng, và tường lửa cho phép cổng này.`;
  }
  const code = err?.cause?.code || err?.code || '';
  if (code === 'ECONNREFUSED') return `${base} từ chối kết nối: Appium chưa chạy hoặc sai cổng. Trên Mac chạy: appium --address 0.0.0.0 --port <cổng>.`;
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return `Không tìm thấy máy "${base}". Kiểm tra lại tên máy hoặc dùng địa chỉ IP.`;
  if (code === 'EHOSTUNREACH' || code === 'ENETUNREACH') return `Không tới được ${base}: máy Mac không cùng mạng hoặc đang tắt.`;
  return `Không kết nối được ${base}: ${err?.message || 'lỗi mạng'}.`;
}

/**
 * EDGE-302: Appium 2 does not list drivers in /status. Ask it for an XCUITest session on an iOS
 * version that cannot exist: without the driver Appium answers "Could not find a driver";
 * with it the driver itself rejects the device. Either way no session is started.
 */
async function probeXcuitest(base, signal) {
  try {
    const res = await fetch(`${base}/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ capabilities: { alwaysMatch: {
        platformName: 'iOS', 'appium:automationName': 'XCUITest',
        'appium:deviceName': 'dashboard-driver-probe', 'appium:platformVersion': '0.0',
      } } }),
      signal,
    });
    const body = await res.json().catch(() => ({}));
    const sessionId = body?.value?.sessionId || body?.sessionId;
    if (res.ok && sessionId) {
      await fetch(`${base}/session/${encodeURIComponent(sessionId)}`, { method: 'DELETE', signal }).catch(() => {});
      return true;
    }
    return !NO_DRIVER.test(String(body?.value?.message || body?.message || ''));
  } catch (_) {
    return null;
  }
}

/** Result: { configured, reachable, appiumVersion, xcuitest (true|false|null), latencyMs, error, warning }. */
async function checkIosHost(config, { timeoutMs = TIMEOUT_MS } = {}) {
  const result = { configured: Boolean(config?.host), reachable: false, appiumVersion: '', xcuitest: null, latencyMs: null, error: '', warning: '' };
  if (!result.configured) {
    result.error = 'Chưa cấu hình Mac host. Vào Cấu hình hệ thống → Mobile / iOS để nhập địa chỉ Appium trên máy Mac.';
    return result;
  }
  const base = `${config.host}:${config.port}`;
  const signal = AbortSignal.timeout(timeoutMs);
  const started = Date.now();
  let body;
  try {
    const res = await fetch(`${base}/status`, { signal, headers: { Accept: 'application/json' } });
    result.latencyMs = Date.now() - started;
    if (!res.ok) {
      result.error = `${base} trả HTTP ${res.status} cho /status. Kiểm tra đây đúng là Appium 2 (không thêm đường dẫn /wd/hub).`;
      return result;
    }
    body = await res.json().catch(() => null);
  } catch (err) {
    result.error = describeNetworkError(err, base);
    return result;
  }
  const value = body?.value;
  if (!value || typeof value !== 'object') {
    result.error = `${base} trả lời nhưng không giống Appium (thiếu "value" trong /status).`;
    return result;
  }
  result.reachable = true;
  result.appiumVersion = String(value.build?.version || '').slice(0, 40);
  result.xcuitest = await probeXcuitest(base, signal);
  if (result.xcuitest === false) result.warning = 'Appium chạy nhưng chưa có driver XCUITest. Trên Mac chạy: appium driver install xcuitest.';
  if (result.xcuitest === null) result.warning = 'Không xác định được driver XCUITest (hết thời gian chờ). Kiểm tra bằng: appium driver list --installed.';
  return result;
}

/** Frame-1 checklist for iOS, same shape as the Android doctor: { ready, checks: [{ label, ok, detail, hint }] }. */
async function iosDoctor(config) {
  const check = await checkIosHost(config);
  const devices = config.devices || [];
  const checks = [
    { label: 'Mac host', ok: check.configured, detail: `${config.host}:${config.port}`, hint: check.configured ? '' : check.error },
    { label: 'Appium trên Mac', ok: check.reachable, detail: `Appium ${check.appiumVersion || '?'} · ${check.latencyMs} ms`, hint: check.reachable ? '' : check.error || 'Chưa kiểm tra được.' },
    { label: 'Driver XCUITest', ok: check.xcuitest === true, detail: 'Đã cài', hint: check.warning || 'Cần Appium phản hồi trước.' },
    { label: 'Thiết bị iOS khai báo', ok: devices.length > 0, detail: `${devices.length} thiết bị`, hint: 'Khai báo simulator hoặc iPhone trong Cấu hình hệ thống → Mobile / iOS.' },
  ];
  return { ready: checks.every((c) => c.ok), checks, check };
}

/** POST /api/mobile/run for iOS answers 503 until the Mac host is configured, reachable and has XCUITest. */
async function assertIosReady(config) {
  const check = await checkIosHost(config);
  const reason = !check.reachable ? check.error : check.xcuitest === false ? check.warning : '';
  if (reason) throw Object.assign(new Error(`Mac host chưa sẵn sàng: ${reason}`), { status: 503 });
  return check;
}

module.exports = { checkIosHost, probeXcuitest, describeNetworkError, iosDoctor, assertIosReady, TIMEOUT_MS };
