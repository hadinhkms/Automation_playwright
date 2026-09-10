/**
 * tests/dashboard-api/data-crud.test.js
 * API Contract tests for Test Data Studio:
 * - GET /api/data/datasets
 * - POST /api/data/create
 * - GET /api/data/dataset?file=...
 * - POST /api/data/delete
 */
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startDashboardHarness } = require('../dashboard/support/dashboardHarness');
const { createFixtureWorkspace } = require('../dashboard/support/fixtureWorkspace');

describe('API Contract: Data Routes CRUD & Validation', () => {
  let fixture;
  let harness;
  const testFileName = 'test_crud_dataset.json';

  before(async () => {
    fixture = createFixtureWorkspace();
    harness = await startDashboardHarness(fixture.rootPath);
  });

  after(async () => {
    if (harness) await harness.stop();
    if (fixture) fixture.cleanup();
  });

  test('GET /api/data/datasets returns 200 and datasets list', async () => {
    const res = await fetch(`${harness.url}/api/data/datasets`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.datasets));
  });

  test('GET /api/data/dataset without file param returns 400', async () => {
    const res = await fetch(`${harness.url}/api/data/dataset`);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error !== undefined);
  });

  test('POST /api/data/create-dataset creates a new dataset successfully', async () => {
    const res = await fetch(`${harness.url}/api/data/create-dataset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: testFileName,
        templateType: 'array'
      })
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
  });

  test('GET /api/data/dataset retrieves the created dataset', async () => {
    const res = await fetch(`${harness.url}/api/data/dataset?file=${testFileName}`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.data !== undefined || Array.isArray(body));
  });

  test('POST /api/data/delete-dataset deletes the created dataset cleanly', async () => {
    const res = await fetch(`${harness.url}/api/data/delete-dataset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: testFileName })
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.success === true || body.message !== undefined);
  });
});
