/**
 * dashboard/services/mobileInspectorService.test.js
 * PLAN-25 P4 TC-4.5 (AC-405, REQ-402) with a fake clock and a fake WebDriver fetch, plus the session rules:
 * lock (REQ-401), tab ownership (EDGE-403), lost device frees the lock, stop while starting, shutdown.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createInspectorService } = require('./mobileInspectorService');

const KEY = 'tab-aaaaaaaa';
const ROOT = __dirname;
const START = { key: KEY, platform: 'android', udid: 'SERIAL1', app: { type: 'installed', appPackage: 'com.vieclam24h.qa', appActivity: 'com.vieclam24h.MainActivity' } };

function fakeWebDriver() {
  const wd = { calls: [], deleted: [], lose: false };
  wd.fetchImpl = async (url, init) => {
    const route = new URL(url).pathname;
    wd.calls.push(`${init.method} ${route}`);
    const json = (status, value) => ({ ok: status < 400, status, json: async () => ({ value }) });
    if (wd.lose && route.startsWith('/session/')) return json(404, { error: 'invalid session id', message: 'session gone' });
    if (init.method === 'POST' && route === '/session') {
      wd.caps = JSON.parse(init.body).capabilities.alwaysMatch;
      return json(200, { sessionId: 's1', capabilities: {} });
    }
    if (init.method === 'DELETE') { wd.deleted.push(route); return json(200, null); }
    if (route.endsWith('/screenshot')) return json(200, 'PNGDATA');
    if (route.endsWith('/source')) return json(200, '<hierarchy/>');
    if (route.endsWith('/window/rect')) return json(200, { x: 0, y: 0, width: 1080, height: 2400 });
    if (route.endsWith('/elements')) return json(200, [{}, {}]);
    return json(200, null);
  };
  return wd;
}

function fakeClock() {
  const clock = { t: 1000, timers: [] };
  clock.now = () => clock.t;
  clock.setTimer = (fn, ms) => { const h = { fn, at: clock.t + ms, cleared: false }; clock.timers.push(h); return h; };
  clock.clearTimer = (h) => { if (h) h.cleared = true; };
  clock.advance = async (ms) => {
    clock.t += ms;
    for (const h of clock.timers.filter((x) => !x.cleared && x.at <= clock.t)) { h.cleared = true; await h.fn(); }
  };
  return clock;
}

function setup(extra = {}) {
  const wd = fakeWebDriver();
  const clock = fakeClock();
  const appium = { stopped: 0 };
  const events = [];
  const service = createInspectorService({
    fetchImpl: wd.fetchImpl, now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer,
    publish: (type, data) => events.push({ type, ...data }),
    ensureAppium: async () => ({ url: 'http://127.0.0.1:4723', owned: true, stop: () => { appium.stopped += 1; } }),
    ...extra,
  });
  return { service, wd, clock, appium, events };
}

test('TC-4.5 AC-405: 10 idle minutes close the session, delete it in Appium and stop the Appium we started', async () => {
  const { service, wd, clock, appium } = setup();
  const state = await service.start(START, ROOT);
  assert.equal(state.ready, true);
  assert.equal(wd.caps['appium:newCommandTimeout'], 660);
  assert.equal(wd.caps['appium:noReset'], true);
  await clock.advance(9 * 60 * 1000);
  await service.snapshot(KEY); // any command restarts the idle clock
  await clock.advance(9 * 60 * 1000);
  assert.equal(service.getState().active, true);
  await clock.advance(60 * 1000 + 1);
  assert.equal(service.getState().active, false);
  assert.deepEqual(wd.deleted, ['/session/s1']);
  assert.equal(appium.stopped, 1);
  assert.equal(service.busyReason(), '');
});

test('REQ-401: start refuses while a run is active; an open session reports itself busy for runs', async () => {
  const blocked = setup({ busyReason: () => 'Đang có một lượt chạy Mobile App.' });
  await assert.rejects(blocked.service.start(START, ROOT), (e) => e.status === 409);
  assert.equal(blocked.service.getState().active, false);
  const { service } = setup();
  await service.start(START, ROOT);
  assert.match(service.busyReason(), /Inspector đang mở/);
});

test('EDGE-403: a second tab gets 409 for start, commands and stop; the owner keeps working', async () => {
  const { service } = setup();
  await service.start(START, ROOT);
  await assert.rejects(service.start({ ...START, key: 'tab-bbbbbbbb' }, ROOT), (e) => e.status === 409);
  await assert.rejects(service.snapshot('tab-bbbbbbbb'), (e) => e.status === 409);
  await assert.rejects(service.stop('tab-bbbbbbbb'), (e) => e.status === 409);
  await assert.rejects(service.snapshot('bad'), (e) => e.status === 400);
  const snap = await service.snapshot(KEY);
  assert.deepEqual(snap, { platform: 'android', screenshot: 'PNGDATA', source: '<hierarchy/>', window: { width: 1080, height: 2400 } });
  assert.deepEqual(await service.find(KEY, { locator: 'id:com.vieclam24h.qa:id/x' }), { count: 2 });
  await assert.rejects(service.find(KEY, { locator: 'css:.x' }), (e) => e.status === 400);
  assert.deepEqual(await service.stop(KEY), { stopped: true });
  await assert.rejects(service.stop(KEY), (e) => e.status === 404);
});

test('A3: a lost device ends the session, frees the lock and tells the UI', async () => {
  const { service, wd, appium, events } = setup();
  await service.start(START, ROOT);
  wd.lose = true;
  await assert.rejects(service.snapshot(KEY), (e) => e.status === 503 && /đã đóng/.test(e.message));
  assert.equal(service.getState().active, false);
  assert.equal(appium.stopped, 1);
  assert.equal(events.at(-1).reason, 'lost');
});

test('stop while starting: the late session is deleted and Appium stopped (view left during start)', async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const { service, wd, appium } = setup({ ensureAppium: async () => { await gate; return { url: 'http://127.0.0.1:4723', stop: () => { appium.stopped += 1; } }; } });
  const starting = service.start(START, ROOT);
  await assert.rejects(service.snapshot(KEY), (e) => e.status === 409);
  await service.stop(KEY);
  release();
  await assert.rejects(starting, (e) => e.status === 409);
  assert.deepEqual(wd.deleted, ['/session/s1']);
  assert.ok(appium.stopped >= 1);
  assert.equal(service.getState().active, false);
});

test('actions validate input; Back is Android only; shutdown deletes the session', async () => {
  const { service, wd } = setup();
  await service.start(START, ROOT);
  await service.action(KEY, { type: 'tap', x: 540, y: 1200 });
  await service.action(KEY, { type: 'back' });
  for (const bad of [{ type: 'tap', x: -1, y: 0 }, { type: 'tap', x: 1.5, y: 2 }, { type: 'type', locator: '~x', text: 'a\nb' }, { type: 'type', locator: 'css:x', text: 'a' }, { type: 'swipe' }]) {
    await assert.rejects(service.action(KEY, bad), (e) => e.status === 400, JSON.stringify(bad));
  }
  assert.ok(wd.calls.includes('POST /session/s1/actions') && wd.calls.includes('POST /session/s1/back'));
  await service.shutdown();
  assert.deepEqual(wd.deleted, ['/session/s1']);
});

test('start validates the target before touching Appium', async () => {
  const { service, wd } = setup();
  await assert.rejects(service.start({ ...START, key: '' }, ROOT), (e) => e.status === 400);
  await assert.rejects(service.start({ ...START, platform: 'windows' }, ROOT), (e) => e.status === 400);
  await assert.rejects(service.start({ ...START, app: { type: 'installed', appPackage: 'x; rm' } }, ROOT), (e) => e.status === 400);
  assert.equal(wd.calls.length, 0);
  assert.equal(service.getState().active, false);
});
