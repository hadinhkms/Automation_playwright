/**
 * tests/dashboard/script-picker-sse.spec.js
 * core/sseShare.js: when the FIRST connection fails for good (HTTP 500, wrong content-type: readyState CLOSED)
 * a later `new EventSource('/api/events')` must open a fresh connection and receive events (M-1).
 */
const { test, expect } = require('@playwright/test');
const { startDashboardHarness } = require('./support/dashboardHarness');
const { createPickerFixture } = require('./support/pickerFixture');

test('M-1: a dead first stream is replaced; the new proxy receives server events', async ({ page }) => {
  const fixture = createPickerFixture({ runnable: true });
  const harness = await startDashboardHarness(fixture.rootPath);
  try {
    let calls = 0;
    await page.route('**/api/events', (route) => { calls += 1; return calls === 1 ? route.fulfill({ status: 500, contentType: 'text/plain', body: 'down' }) : route.continue(); });
    await page.goto(harness.url);
    await page.waitForSelector('.sp-file');
    await page.waitForTimeout(600);
    const types = await page.evaluate(() => { window.__types = []; const es = new EventSource('/api/events'); es.onmessage = (m) => { try { window.__types.push(JSON.parse(m.data).type); } catch (_) { /* log line */ } }; return es.readyState; });
    expect(types).not.toBe(2); // the new proxy is not born dead
    const res = await fetch(`${harness.url}/api/run`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: harness.url }, body: JSON.stringify({ specs: ['tests/e2e/desktop/alpha.spec.js'] }) });
    expect(res.status).toBe(202);
    await expect.poll(() => page.evaluate(() => window.__types), { timeout: 30000 }).toContain('status');
    expect(calls).toBeGreaterThanOrEqual(2);
  } finally { await harness.stop(); fixture.cleanup(); }
});

test('closing the last proxy of a replaced (dead) entry does not remove the live one', async ({ page }) => {
  const fixture = createPickerFixture({ runnable: true });
  const harness = await startDashboardHarness(fixture.rootPath);
  try {
    let calls = 0;
    await page.route('**/api/events', (route) => { calls += 1; return calls === 1 ? route.fulfill({ status: 500, contentType: 'text/plain', body: 'down' }) : route.continue(); });
    await page.addInitScript(() => { const N = window.EventSource; window.__live = 0; window.EventSource = function C(...a) { const e = new N(...a); window.__live += 1; const c = e.close.bind(e); e.close = () => { window.__live -= 1; c(); }; return e; }; window.EventSource.prototype = N.prototype; });
    await page.goto(harness.url);
    await page.waitForSelector('.sp-file');
    await page.waitForTimeout(600);
    const r = await page.evaluate(() => {
      const a = new EventSource('/api/events'); // shares the live entry that replaced the dead one
      const b = new EventSource('/api/events');
      const before = window.__live;
      a.close();
      const afterOne = window.__live; // b still uses it: the real stream stays
      b.close();
      return { before, afterOne };
    });
    expect(r.afterOne).toBe(r.before);
  } finally { await harness.stop(); fixture.cleanup(); }
});
