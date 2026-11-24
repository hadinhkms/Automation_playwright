/**
 * tests/dashboard/request-guard-ui.spec.js
 * BUG-03 (UI side): the Origin/Host + JSON content-type guard must not break the dashboard UI.
 * Body-less writes issued by the UI (via fetch) still pass; explicit non-JSON writes get 415.
 */
const { test, expect } = require('@playwright/test');
const { startDashboardHarness } = require('./support/dashboardHarness');
const { createFixtureWorkspace } = require('./support/fixtureWorkspace');

test.describe('Request guard: UI keeps working', () => {
  let fixture;
  let harness;

  test.beforeAll(async () => {
    fixture = createFixtureWorkspace();
    harness = await startDashboardHarness(fixture.rootPath);
  });

  test.afterAll(async () => {
    if (harness) await harness.stop();
    if (fixture) fixture.cleanup();
  });

  test('same-origin body-less POST/DELETE from the page get JSON header by default; text/plain gets 415', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(harness.url);
    await page.waitForSelector('.shell');

    const statuses = await page.evaluate(async () => {
      const post = await fetch('/api/recorder/reset', { method: 'POST' });
      const del = await fetch('/api/ai/audit', { method: 'DELETE' });
      const plain = await fetch('/api/recorder/reset', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{}' });
      return { post: post.status, del: del.status, plain: plain.status };
    });
    expect(statuses.post).not.toBe(415);
    expect(statuses.post).not.toBe(403);
    expect(statuses.del).not.toBe(415);
    expect(statuses.plain).toBe(415);
    expect(errors).toEqual([]);
  });

  test('the Stop button path (UI request() with POST and no body) is not rejected', async ({ page }) => {
    const seen = [];
    page.on('response', (r) => { if (r.url().endsWith('/api/stop')) seen.push(r.status()); });
    await page.goto(harness.url);
    await page.waitForSelector('.shell');
    await page.evaluate(() => request('/api/stop', { method: 'POST' }).catch(() => null));
    await expect.poll(() => seen.length).toBeGreaterThan(0);
    expect(seen.every((s) => s !== 415 && s !== 403)).toBe(true);
  });
});
