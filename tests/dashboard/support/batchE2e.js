/**
 * tests/dashboard/support/batchE2e.js
 * Tiện ích E2E cho batch fixer (PLAN-18): chuẩn bị fixture về trạng thái gốc, mở tab "Vấn đề",
 * tìm dòng finding theo vị trí, và gom lỗi console / HTTP ngoài dự kiến.
 */
const fs = require('fs');
const path = require('path');
const { expect } = require('@playwright/test');
const { seedBatchFixture } = require('./batchFixtureSeed');

const LOGIN = 'tests/e2e/login.spec.js';

/** Trả fixture về trạng thái gốc: file seed, xoá batch cũ, ép server quét lại để bỏ cache 60s. */
async function prepareFixture(rootPath, harnessUrl) {
  seedBatchFixture(rootPath);
  fs.rmSync(path.join(rootPath, '.dashboard-backups'), { recursive: true, force: true });
  const res = await fetch(`${harnessUrl}/api/qa/summary?force=true`);
  if (res.status !== 200) throw new Error(`Không làm mới được summary: ${res.status}`);
}

async function openFindings(page, url, theme = 'dark') {
  await page.addInitScript((t) => {
    try { localStorage.setItem('playwright-dashboard-theme', t); } catch (_) { /* ignore */ }
  }, theme);
  await page.goto(url);
  await page.waitForSelector('.shell');
  await page.waitForFunction(() => Boolean(window.__STUDIO_CORE__));
  await page.evaluate(() => window.__STUDIO_CORE__.featureRegistry.switchView('qa-view'));
  await page.locator('[data-qa-tab="findings"]').click();
  await waitScanDone(page);
}

async function waitScanDone(page) {
  await expect(page.locator('#qa-batch-toolbar')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('#qa-batch-toolbar')).not.toHaveClass(/is-locked/, { timeout: 20_000 });
}

/** Dòng finding theo loại + vị trí chính xác (vd. 'tests/e2e/login.spec.js:6'). */
function rowAt(page, where, kindLabel) {
  const escaped = where.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let row = page.locator('.qa-static-gap-row', { has: page.locator('.qa-gap-location', { hasText: new RegExp(`^${escaped}$`) }) });
  if (kindLabel) row = row.filter({ hasText: kindLabel });
  return row;
}

function read(rootPath, rel) {
  return fs.readFileSync(path.join(rootPath, rel), 'utf8');
}

/** Gắn bộ gom lỗi; `allow(res)` trả true cho phản hồi lỗi mà test cố ý gây ra. */
function watchErrors(page, allow = () => false) {
  const errors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('response', (res) => {
    if (res.status() < 400) return;
    if (res.url().endsWith('/tools/visual_compare.html')) return;
    if (allow(res)) return;
    errors.push(`${res.status()} ${res.url()}`);
  });
  return () => errors.filter((e) => !/^Failed to load resource/.test(e));
}

module.exports = { LOGIN, prepareFixture, openFindings, waitScanDone, rowAt, read, watchErrors };
