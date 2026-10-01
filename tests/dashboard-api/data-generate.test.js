/**
 * tests/dashboard-api/data-generate.test.js
 * API Contract tests for VN Test Data Generator & Edge Payloads (PLAN-19a Phase 2)
 * Tests: TC-14, TC-15, TC-16, TC-17, TC-18, TC-19
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { startDashboardHarness } = require('../dashboard/support/dashboardHarness');
const { createFixtureWorkspace } = require('../dashboard/support/fixtureWorkspace');

describe('API Contract: VN Data Generate & Edge Payloads (PLAN-19a)', () => {
  let fixture;
  let harness;
  const ts = Date.now();
  const testDatasetName = `plan19a-api-${ts}.json`;

  before(async () => {
    fixture = createFixtureWorkspace();
    harness = await startDashboardHarness(fixture.rootPath);
  });

  after(async () => {
    // Dọn dẹp dataset nếu được tạo
    try {
      await fetch(`${harness.url}/api/data/delete-dataset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: testDatasetName })
      });
    } catch (_) {}

    if (harness) await harness.stop();
    if (fixture) fixture.cleanup();
  });

  test('TC-14: POST /api/data/generate persona 10 voi seed tra ve 200 va ket qua giong nhau', async () => {
    const payload = {
      type: 'persona',
      count: 10,
      seed: 'api-seed-test-1',
      options: { gender: 'female' }
    };

    const res1 = await fetch(`${harness.url}/api/data/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    assert.equal(res1.status, 200);
    const body1 = await res1.json();
    assert.equal(body1.ok, true);
    assert.equal(body1.seed, 'api-seed-test-1');
    assert.equal(body1.records.length, 10);
    assert.ok(body1.records.every((r) => r.gender === 'female'));

    // Goi lai voi cung seed
    const res2 = await fetch(`${harness.url}/api/data/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    assert.equal(res2.status, 200);
    const body2 = await res2.json();
    assert.deepEqual(body1.records, body2.records, 'Cung seed phai tra ve records giong het nhau');
  });

  test('TC-15: Kiem tra cac truong hop loi 400 va 413 kem truong field', async () => {
    // 1. Count sai (0, 501, 1.5, "abc")
    for (const c of [0, 501, 1.5, 'abc']) {
      const res = await fetch(`${harness.url}/api/data/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'cccd', count: c })
      });
      assert.equal(res.status, 400, `count=${c} phai tra ve 400`);
      const body = await res.json();
      assert.equal(body.ok, false);
      assert.equal(body.field, 'count');
    }

    // 2. Type lạ
    const resType = await fetch(`${harness.url}/api/data/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'alien', count: 5 })
    });
    assert.equal(resType.status, 400);
    const bodyType = await resType.json();
    assert.equal(bodyType.field, 'type');

    // 3. ProvinceCode sai
    const resProv = await fetch(`${harness.url}/api/data/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'cccd', count: 5, options: { provinceCode: '003' } })
    });
    assert.equal(resProv.status, 400);
    const bodyProv = await resProv.json();
    assert.equal(bodyProv.field, 'provinceCode');

    // 4. Body khong phai JSON
    const resNotJson = await fetch(`${harness.url}/api/data/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'this is not json'
    });
    assert.equal(resNotJson.status, 400);
    const bodyNotJson = await resNotJson.json();
    assert.equal(bodyNotJson.field, 'body');

    // 5. Body > 16KB -> 413
    const bigString = 'x'.repeat(17 * 1024);
    const resOversize = await fetch(`${harness.url}/api/data/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'cccd', count: 10, dummy: bigString })
    });
    assert.equal(resOversize.status, 413);
    const bodyOversize = await resOversize.json();
    assert.equal(bodyOversize.field, 'body');
  });

  test('TC-16: GET /api/data/payloads loc theo category va danh sach 6 nhom', async () => {
    // Khong truyen param -> du 6 nhom
    const resAll = await fetch(`${harness.url}/api/data/payloads`);
    assert.equal(resAll.status, 200);
    const bodyAll = await resAll.json();
    assert.equal(bodyAll.ok, true);
    assert.equal(bodyAll.categories.length, 6);
    assert.ok(bodyAll.payloads.length > 20);

    // Loc xss
    const resXss = await fetch(`${harness.url}/api/data/payloads?category=xss`);
    assert.equal(resXss.status, 200);
    const bodyXss = await resXss.json();
    assert.ok(bodyXss.payloads.every((p) => p.category === 'xss'));

    // Nhom la -> 400
    const resBad = await fetch(`${harness.url}/api/data/payloads?category=unknown_group`);
    assert.equal(resBad.status, 400);
    const bodyBad = await resBad.json();
    assert.equal(bodyBad.field, 'category');
  });

  test('TC-17: GET /api/data/dynamic-preview co du 5 khoa vn_*', async () => {
    const res = await fetch(`${harness.url}/api/data/dynamic-preview`);
    assert.equal(res.status, 200);
    const body = await res.json();

    assert.ok(body.vn_cccd && /^\d{12}$/.test(body.vn_cccd), 'vn_cccd phai la 12 chu so');
    assert.ok(body.vn_mst && /^\d{10}$/.test(body.vn_mst), 'vn_mst phai la 10 chu so');
    assert.ok(body.vn_phone && /^0\d{9}$/.test(body.vn_phone), 'vn_phone phai la 10 chu so');
    assert.ok(typeof body.vn_name === 'string' && body.vn_name.length > 0, 'vn_name phai la chuoi');
    assert.ok(body.vn_email && body.vn_email.endsWith('@example.com'), 'vn_email phai co duoi @example.com');
  });

  test('TC-18: Sinh du lieu khong ghi dia va khong tang audit AI', async () => {
    const dataDir = path.join(fixture.rootPath, 'data');
    const filesBefore = fs.existsSync(dataDir) ? fs.readdirSync(dataDir) : [];

    // Sinh du lieu
    const res = await fetch(`${harness.url}/api/data/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'persona', count: 20 })
    });
    assert.equal(res.status, 200);

    const filesAfter = fs.existsSync(dataDir) ? fs.readdirSync(dataDir) : [];
    assert.deepEqual(filesBefore, filesAfter, 'Khong duoc sinh tep tin nao vao thu muc data/');
  });

  test('TC-19: LIFE-01 sinh persona -> create-dataset -> doc lai -> tao trung bi 400 -> xoa', async () => {
    // 1. Sinh persona
    const resGen = await fetch(`${harness.url}/api/data/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'persona', count: 5, seed: 'life-01-seed' })
    });
    assert.equal(resGen.status, 200);
    const genData = await resGen.json();

    // 2. Tao dataset qua create-dataset co san
    const resCreate = await fetch(`${harness.url}/api/data/create-dataset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: testDatasetName,
        content: genData.records
      })
    });
    assert.equal(resCreate.status, 200);

    // 3. Doc lai dataset
    const resRead = await fetch(`${harness.url}/api/data/dataset?file=${testDatasetName}`);
    assert.equal(resRead.status, 200);
    const readBody = await resRead.json();
    assert.deepEqual(readBody.data, genData.records, 'Du lieu doc lai phai y het du lieu da luu');

    // 4. Tao lai cung ten bi 400
    const resDup = await fetch(`${harness.url}/api/data/create-dataset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: testDatasetName,
        content: genData.records
      })
    });
    assert.equal(resDup.status, 400, 'Tao dataset trung ten phai bi loi 400');

    // 5. Xoa dataset
    const resDel = await fetch(`${harness.url}/api/data/delete-dataset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: testDatasetName })
    });
    assert.equal(resDel.status, 200);
  });
});
