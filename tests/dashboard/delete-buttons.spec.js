/**
 * tests/dashboard/delete-buttons.spec.js
 * NB-03: the "Xóa" buttons of Data, Fixtures and BDD scripts must confirm, call the API, tell the
 * result and refresh the list. Only data seeded inside the isolated fixture workspace is deleted.
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { startDashboardHarness } = require('./support/dashboardHarness');
const { createFixtureWorkspace } = require('./support/fixtureWorkspace');

const post = (h, url, body) => fetch(`${h.url}${url}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json());

test.describe('NB-03: delete buttons in Data / Fixtures / BDD', () => {
  let fixture; let harness;
  test.beforeAll(async () => {
    fixture = createFixtureWorkspace();
    harness = await startDashboardHarness(fixture.rootPath);
  });
  test.afterAll(async () => { if (harness) await harness.stop(); if (fixture) fixture.cleanup(); });

  const onDisk = (rel) => fs.existsSync(path.join(fixture.rootPath, rel));
  const confirmModal = async (page) => {
    await expect(page.locator('#modal-confirm-delete')).toBeVisible();
    await page.click('#modal-confirm-delete-submit-btn');
  };

  test('Data: Xóa file confirms, deletes the file, toasts and refreshes the list', async ({ page }) => {
    await post(harness, '/api/data/create-dataset', { fileName: 'zz-delete-me.json', templateType: 'array' });
    expect(onDisk('data/zz-delete-me.json')).toBe(true);
    await page.goto(`${harness.url}/#/data-view`);
    await page.locator('.data-file-card-item[data-file="zz-delete-me.json"]').click();
    await page.click('#data-delete-file-btn');
    await confirmModal(page);
    await expect(page.locator('#toast')).toContainText('Đã xóa');
    await expect.poll(() => onDisk('data/zz-delete-me.json')).toBe(false);
    expect(onDisk('data/sample-users.json')).toBe(true);
    await expect(page.locator('.data-file-card-item[data-file="zz-delete-me.json"]')).toHaveCount(0);
  });

  test('Data: a server error is shown, not swallowed', async ({ page }) => {
    await post(harness, '/api/data/create-dataset', { fileName: 'zz-keep.json', templateType: 'array' });
    await page.route('**/api/data/delete-dataset', (route) => route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Máy chủ từ chối xóa' }) }));
    await page.goto(`${harness.url}/#/data-view`);
    await page.locator('.data-file-card-item[data-file="zz-keep.json"]').click();
    await page.click('#data-delete-file-btn');
    await confirmModal(page);
    await expect(page.locator('#toast')).toContainText('Máy chủ từ chối xóa');
    expect(onDisk('data/zz-keep.json')).toBe(true);
  });

  test('Fixtures: Xóa Fixture confirms, deletes the file and refreshes the list', async ({ page }) => {
    const created = await post(harness, '/api/fixtures', { name: 'zzDeleteMe', template: 'cleanup_api', config: { description: 'x', deleteEndpoint: '/api/x/${id}', deleteMethod: 'DELETE' } });
    expect(created.success).toBe(true);
    await page.goto(`${harness.url}/#/fixtures-view`);
    await page.locator('.fixture-card-item[data-name="zzDeleteMe"]').click();
    await page.click('#btn-delete-fixture');
    await confirmModal(page);
    await expect(page.locator('#toast')).toContainText('zzDeleteMe');
    await expect.poll(() => onDisk('core/fixtures/custom/zzDeleteMe.fixture.js')).toBe(false);
    await expect(page.locator('.fixture-card-item[data-name="zzDeleteMe"]')).toHaveCount(0);
  });

  test('Fixtures: deleting a fixture whose name starts with "delete" removes exactly that fixture (Gate 3 H1)', async ({ page }) => {
    const cfg = { description: 'x', deleteEndpoint: '/api/x/${id}', deleteMethod: 'DELETE' };
    expect((await post(harness, '/api/fixtures', { name: 'deleteabc', template: 'cleanup_api', config: cfg })).success).toBe(true);
    expect((await post(harness, '/api/fixtures', { name: 'bc', template: 'cleanup_api', config: cfg })).success).toBe(true);
    await page.goto(`${harness.url}/#/fixtures-view`);
    await page.locator('.fixture-card-item[data-name="deleteabc"]').click();
    await page.click('#btn-delete-fixture');
    await confirmModal(page);
    await expect.poll(() => onDisk('core/fixtures/custom/deleteabc.fixture.js')).toBe(false);
    expect(onDisk('core/fixtures/custom/bc.fixture.js')).toBe(true);
    await expect(page.locator('.fixture-card-item[data-name="deleteabc"]')).toHaveCount(0);
    await expect(page.locator('.fixture-card-item[data-name="bc"]')).toHaveCount(1);
  });

  test('BDD: Xóa kịch bản confirms, deletes the spec and refreshes the list', async ({ page }) => {
    const created = await post(harness, '/api/builder/create-script', { fileName: 'zz-delete-me', platform: 'desktop' });
    expect(created.success).toBe(true);
    await page.goto(`${harness.url}/#/builder-view`);
    await page.locator('.script-card-item').filter({ hasText: 'zz-delete-me-bdd' }).first().click();
    await page.click('#script-delete-btn');
    await confirmModal(page);
    await expect(page.locator('#toast')).toContainText('xóa');
    await expect.poll(() => onDisk('tests/e2e/desktop/zz-delete-me-bdd.spec.js')).toBe(false);
    await expect(page.locator('.script-card-item').filter({ hasText: 'zz-delete-me-bdd' })).toHaveCount(0);
  });
});
