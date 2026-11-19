/**
 * dashboard/services/mobileInspectorService.js
 * One interactive Appium session for the native Inspector (PLAN-25 P4): screenshot + page source,
 * locator match counts, tap / type / Back. Shares the run lock (REQ-401) and closes itself after
 * 10 idle minutes, when the view is left or when the server stops (REQ-402, AC-405).
 */
const { wdCall, ensureLocalAppium, httpError } = require('./mobileAppiumClient');
const { buildInspectorTarget, validateKey } = require('./mobileInspectorTarget');
const commands = require('./mobileInspectorCommands');

const IDLE_MS = 10 * 60 * 1000;
const LOST = new Set(['invalid session id', 'unreachable', 'no such window']);

function createInspectorService(deps = {}) {
  const {
    fetchImpl = fetch, ensureAppium = ensureLocalAppium, busyReason = () => '', publish = () => {},
    idleMs = IDLE_MS, setTimer = setTimeout, clearTimer = clearTimeout, now = Date.now,
  } = deps;
  let session = null;

  const view = () => session && {
    active: true, ready: Boolean(session.sessionId), platform: session.platform, ...session.label,
    startedAt: session.startedAt, expiresAt: session.lastUsedAt ? session.lastUsedAt + idleMs : null,
  };
  const announce = (reason) => publish('mobile_inspector', { ...(view() || { active: false }), reason: reason || '' });

  async function close(reason, timeoutMs = 10000) {
    const current = session;
    if (!current) return false;
    session = null;
    clearTimer(current.timer);
    if (current.sessionId) {
      try { await wdCall(current.url, 'DELETE', `/session/${current.sessionId}`, undefined, { timeoutMs, fetchImpl }); } catch (_) {}
    }
    current.appium?.stop();
    publish('mobile_inspector', { active: false, reason });
    return true;
  }

  function touch() {
    clearTimer(session.timer);
    session.lastUsedAt = now();
    session.timer = setTimer(() => close('idle'), idleMs);
    session.timer?.unref?.();
  }

  /** The caller's tab must own the open session (EDGE-403). */
  function owned(key) {
    if (!session) throw httpError(404, 'Không có phiên Inspector nào đang mở.');
    if (session.key !== validateKey(key)) throw httpError(409, 'Inspector đang được dùng ở tab hoặc máy khác.');
    if (!session.sessionId) throw httpError(409, 'Phiên Inspector đang khởi động, thử lại sau giây lát.');
    touch();
    return session;
  }

  /** WebDriver call inside the session; a dead device or Appium ends the session and frees the lock. */
  async function call(method, route, body, timeoutMs) {
    const current = session;
    try {
      return await wdCall(current.url, method, `/session/${current.sessionId}${route}`, body, { timeoutMs, fetchImpl });
    } catch (err) {
      if (LOST.has(err.wdError)) {
        if (session === current) await close('lost'); // parallel calls fail together; close once
        throw httpError(503, `Phiên Inspector đã đóng: ${err.message}`);
      }
      throw err;
    }
  }

  async function start(input, root) {
    if (session) throw httpError(409, 'Inspector đang mở ở tab khác hoặc chưa đóng. Đóng phiên đó trước.');
    const busy = busyReason();
    if (busy) throw httpError(409, busy);
    const target = buildInspectorTarget(input, root);
    const current = { ...target, url: target.connection.url, startedAt: new Date(now()).toISOString(), timer: null };
    session = current; // reserve the lock before any await
    announce('starting');
    try {
      current.appium = target.connection.local ? await ensureAppium(target.connection, { root, fetchImpl }) : null;
      if (current.appium) current.url = current.appium.url;
      const value = await wdCall(current.url, 'POST', '/session', { capabilities: { alwaysMatch: target.caps, firstMatch: [{}] } }, { timeoutMs: 120000, fetchImpl });
      current.sessionId = value?.sessionId;
      if (!current.sessionId) throw httpError(502, 'Appium không trả về sessionId.');
    } catch (err) {
      if (session === current) session = null;
      current.appium?.stop();
      publish('mobile_inspector', { active: false, reason: 'failed' });
      throw err.status === 502 || err.status === 503 ? httpError(503, err.message) : err;
    }
    if (session !== current) { // stopped while starting (view left)
      try { await wdCall(current.url, 'DELETE', `/session/${current.sessionId}`, undefined, { timeoutMs: 10000, fetchImpl }); } catch (_) {}
      current.appium?.stop();
      throw httpError(409, 'Phiên Inspector đã bị đóng trong lúc khởi động.');
    }
    touch();
    announce('started');
    return view();
  }

  async function snapshot(key) { return commands.snapshot(call, owned(key).platform); }

  async function find(key, body) { return commands.find(call, owned(key).platform, body); }

  async function action(key, body) { return commands.action(call, owned(key).platform, body); }

  async function stop(key) {
    if (!session) throw httpError(404, 'Không có phiên Inspector nào đang mở.');
    if (session.key !== validateKey(key)) throw httpError(409, 'Inspector đang được dùng ở tab hoặc máy khác.');
    await close('stopped');
    return { stopped: true };
  }

  return {
    start, snapshot, find, action, stop,
    shutdown: () => close('shutdown', 2000),
    getState: () => view() || { active: false },
    busyReason: () => (session ? `Inspector đang mở trên ${session.label.device}. Đóng Inspector trước.` : ''),
  };
}

module.exports = { createInspectorService, IDLE_MS };
