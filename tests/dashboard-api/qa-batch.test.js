/**
 * tests/dashboard-api/qa-batch.test.js
 * API contract cho batch fixer (PLAN-18) trên server thật + scanner thật + file thật:
 * batch-plan, batch-input, batch-apply, batch-rollback, batch-last, context.
 *
 * Chạy: npm run test:dashboard:api
 */
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { startDashboardHarness } = require('../dashboard/support/dashboardHarness');
const { createFixtureWorkspace } = require('../dashboard/support/fixtureWorkspace');
const { seedBatchFixture } = require('../dashboard/support/batchFixtureSeed');

const LOGIN = 'tests/e2e/login.spec.js';

describe('API Contract: QA batch fixer (PLAN-18)', () => {
  let fixture;
  let harness;
  const read = (rel) => fs.readFileSync(path.join(fixture.rootPath, rel), 'utf8');
  const get = (p) => fetch(`${harness.url}${p}`);
  const post = (p, body, raw) => fetch(`${harness.url}${p}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: raw !== undefined ? raw : JSON.stringify(body),
  });
  const summary = async () => (await get('/api/qa/summary?force=true')).json();
  const keyAt = (s, kind, where) => s.findings.find((f) => f.kind === kind && f.where === where).findingKey;

  before(async () => {
    fixture = createFixtureWorkspace();
    seedBatchFixture(fixture.rootPath);
    harness = await startDashboardHarness(fixture.rootPath);
  });

  after(async () => {
    if (harness) await harness.stop();
    if (fixture) fixture.cleanup();
  });

  test('GET /api/qa/summary trả finding đã gộp, có findingKey + fixRoute + scanId', async () => {
    const body = await summary();
    assert.ok(Number.isInteger(body.scanId));
    const awaits = body.findings.filter((f) => f.kind === 'assertion-thieu-await');
    assert.equal(awaits.length, 3);
    assert.ok(awaits.every((f) => /^[0-9a-f]{16}$/.test(f.findingKey) && f.fixRoute === 'quick' && f.occurrences === 2));
  });

  test('plan -> đổi lựa chọn -> apply -> quét lại -> rollback -> rollback lần 2 (200 cả luồng)', async () => {
    const before = await summary();
    const awaitKey = keyAt(before, 'assertion-thieu-await', `${LOGIN}:6`);
    const skipKey = keyAt(before, 'test-bi-skip-am-tham', `${LOGIN}:11`);
    const manualKey = keyAt(before, 'spec-thieu-assertion', `${LOGIN}:21`);
    const original = read(LOGIN);

    const planRes = await post('/api/qa/finding/batch-plan', { findingKeys: [awaitKey, skipKey, manualKey] });
    assert.equal(planRes.status, 200);
    const plan = await planRes.json();
    assert.equal(plan.totals.patches, 2);
    assert.equal(plan.skipped[0].reasonCode, 'MANUAL_ROUTE');
    assert.equal(read(LOGIN), original, 'lập kế hoạch không ghi file');

    const inputRes = await post('/api/qa/finding/batch-input', {
      sessionId: plan.session.sessionId, revision: 1, findingKey: skipKey, input: { skipMode: 'unskip' },
    });
    assert.equal(inputRes.status, 200);
    const input = await inputRes.json();
    assert.equal(input.revision, 2);

    const applyRes = await post('/api/qa/finding/batch-apply', {
      sessionId: plan.session.sessionId, revision: 2, acceptedFindingKeys: [awaitKey, skipKey],
    });
    assert.equal(applyRes.status, 200);
    const applied = await applyRes.json();
    assert.deepEqual(new Set(applied.appliedFindingKeys), new Set([awaitKey, skipKey]));
    const lines = read(LOGIN).split('\n');
    assert.equal(lines[5], "    await expect(page.locator('#home')).toBeVisible();");
    assert.equal(lines[10], "  test('TC-003 - AC-003 chặn trang riêng', async ({ page }) => {");

    const after = await summary();
    assert.ok(after.scanId > before.scanId);
    assert.ok(!after.findings.some((f) => f.findingKey === awaitKey || f.findingKey === skipKey));

    const last = await (await get('/api/qa/finding/batch-last')).json();
    assert.equal(last.latest.sessionId, plan.session.sessionId);
    assert.equal(last.latest.status, 'COMMITTED');

    const rollbackRes = await post('/api/qa/finding/batch-rollback', { sessionId: plan.session.sessionId });
    assert.equal(rollbackRes.status, 200);
    assert.deepEqual((await rollbackRes.json()).restoredFiles, [LOGIN]);
    assert.equal(read(LOGIN), original);
    const again = await (await post('/api/qa/finding/batch-rollback', { sessionId: plan.session.sessionId })).json();
    assert.equal(again.alreadyRolledBack, true);
  });

  test('409 STALE_FILES khi file đổi sau khi lập kế hoạch; 409 REVISION_STALE', async () => {
    const s = await summary();
    const key = keyAt(s, 'assertion-thieu-await', `${LOGIN}:7`);
    const plan = await (await post('/api/qa/finding/batch-plan', { findingKeys: [key] })).json();
    const stale = await post('/api/qa/finding/batch-apply', { sessionId: plan.session.sessionId, revision: 5, acceptedFindingKeys: [key] });
    assert.equal(stale.status, 409);
    assert.equal((await stale.json()).code, 'REVISION_STALE');

    const original = read(LOGIN);
    fs.writeFileSync(path.join(fixture.rootPath, LOGIN), `${original}// sửa tay\n`, 'utf8');
    try {
      const res = await post('/api/qa/finding/batch-apply', { sessionId: plan.session.sessionId, revision: 1, acceptedFindingKeys: [key] });
      assert.equal(res.status, 409);
      const body = await res.json();
      assert.equal(body.code, 'STALE_FILES');
      assert.deepEqual(body.details.files, [LOGIN]);
    } finally {
      fs.writeFileSync(path.join(fixture.rootPath, LOGIN), original, 'utf8');
    }
  });

  test('400 cho body sai, 404 cho session/finding không tồn tại', async () => {
    const cases = [
      [await post('/api/qa/finding/batch-plan', null, '{hỏng'), 400, 'INVALID_BODY'],
      [await post('/api/qa/finding/batch-plan', { findingKeys: [] }), 400, 'INVALID_BODY'],
      [await post('/api/qa/finding/batch-apply', { sessionId: 'qb-000000-aaaaaa', revision: 1, acceptedFindingKeys: [] }), 404, 'SESSION_NOT_FOUND'],
      [await post('/api/qa/finding/batch-rollback', { sessionId: '../../etc' }), 400, 'INVALID_BODY'],
      [await get('/api/qa/finding/context'), 400, 'INVALID_BODY'],
      [await get('/api/qa/finding/context?findingKey=khongco'), 404, 'FINDING_NOT_FOUND'],
    ];
    for (const [res, status, code] of cases) {
      assert.equal(res.status, status, code);
      assert.equal((await res.json()).code, code);
    }
  });

  test('GET context trả đoạn mã quanh finding; finding thư mục trả file null', async () => {
    const s = await summary();
    const res = await get(`/api/qa/finding/context?findingKey=${keyAt(s, 'assertion-thieu-await', `${LOGIN}:6`)}`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.file.relPath, LOGIN);
    assert.equal(body.file.line, 6);
    assert.equal(body.file.startLine, 1);
    assert.ok(body.file.lines[5].includes("expect(page.locator('#home'))"));
  });
});
