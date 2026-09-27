/**
 * tests/dashboard-api/gatewayFastWins.test.js
 * Verifies Plan-17c Fast Wins: Requirement Clarity (BA-1), Bug Draft (QA-4), TC Gen (QA-1).
 * All three are rule engines now; the fake provider only proves that no AI call is made.
 * Strict ceiling <= 150 lines.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const FakeAiProvider = require('../dashboard/support/fakeAiProvider');
const { createFixtureWorkspace } = require('../dashboard/support/fixtureWorkspace');
const { detectHeuristicAmbiguities, runCheckRequirementClarity } = require('../../core/ai/tasks/checkRequirementClarity');
const { runDraftBugReport } = require('../../core/ai/tasks/draftBugReport');
const { runGenerateTestCases } = require('../../core/ai/tasks/generateTestCases');

test('Plan-17c Fast Wins Tasks Suite', async (t) => {
  let fakeServer = null;
  let ws = null;

  t.beforeEach(async () => {
    ws = createFixtureWorkspace();
    fakeServer = new FakeAiProvider();
    await fakeServer.start();
  });

  t.afterEach(async () => {
    if (fakeServer) await fakeServer.stop();
    if (ws) ws.cleanup();
  });

  await t.test('P17C-TC-01: detectHeuristicAmbiguities catches vague qualitative words without AI (0 token)', () => {
    const text = 'Hệ thống phải xử lý đơn hàng nhanh chóng, giao diện đẹp mắt và dễ dàng sử dụng nếu cần.';
    const detected = detectHeuristicAmbiguities(text);
    assert.equal(detected.includes('nhanh chóng'), true);
    assert.equal(detected.includes('đẹp mắt'), true);
    assert.equal(detected.includes('dễ dàng'), true);
    assert.equal(detected.includes('nếu cần'), true);
  });

  await t.test('P17C-TC-02: runCheckRequirementClarity scores clarity by rules and never calls AI, even with a key', async () => {
    const clientConfig = { provider: '9router', apiKey: 'test-key', baseURL: fakeServer.getBaseUrl() };
    const res = await runCheckRequirementClarity({
      requirementText: 'Hệ thống xử lý thanh toán nhanh chóng.',
      title: 'Thanh toán đơn hàng',
      clientConfig,
      root: ws.rootPath
    });

    assert.equal(res.ok, true);
    assert.equal(res.source, 'rule');
    assert.equal(res.status, 'ambiguous');
    assert.deepEqual(res.ambiguities.map((a) => a.phrase), ['nhanh chóng']);
    assert.match(res.clarifiedDraft, /Given[\s\S]*When[\s\S]*Then .*<nhanh chóng → /);
    assert.equal(fakeServer.requests.length, 0);
  });

  await t.test('P17C-TC-03: runDraftBugReport builds the report from failure artifacts only', async () => {
    const clientConfig = { provider: '9router', apiKey: 'test-key', baseURL: fakeServer.getBaseUrl() };
    const res = await runDraftBugReport({
      testTitle: 'Học viên đăng ký xe mới',
      errorText: "TimeoutError: locator.click: Timeout 5000ms exceeded.\nCall log:\n  - waiting for getByRole('button', { name: 'Thêm xe' }) to be visible",
      locator: "getByRole('button', { name: 'Thêm xe' })",
      triageCategory: 'test_bug',
      clientConfig,
      root: ws.rootPath
    });

    assert.equal(res.ok, true);
    assert.equal(res.source, 'rule');
    assert.equal(res.severity, 'Minor');
    assert.match(res.title, /^\[Test\] Học viên đăng ký xe mới/);
    assert.match(res.expectedResult, /5000ms/);
    assert.match(res.markdownReport, /### Steps to Reproduce/);
    assert.match(res.markdownReport, /### Evidence:/);
    assert.equal(fakeServer.requests.length, 0);
  });

  await t.test('P17C-TC-04: runGenerateTestCases maps every case to its AC with positive, negative and format cases', async () => {
    const clientConfig = { provider: '9router', apiKey: 'test-key', baseURL: fakeServer.getBaseUrl() };
    const res = await runGenerateTestCases({
      reqId: 'REQ-013', reqTitle: 'Đăng ký xe học viên', criteriaText: 'AC-001: Biển số xe không được để trống và theo định dạng chuẩn Việt Nam.',
      startTcNumber: 1, clientConfig, root: ws.rootPath
    });
    assert.equal(res.ok, true);
    assert.equal(res.source, 'rule');
    assert.deepEqual(res.testCases.map((tc) => tc.tcId), ['TC-001', 'TC-002', 'TC-003']);
    assert.deepEqual(res.testCases.map((tc) => tc.type), ['positive', 'negative', 'negative']);
    assert.ok(res.testCases.every((tc) => tc.acId === 'AC-001'));
    assert.equal(fakeServer.requests.length, 0);
  });

  await t.test('P17C-TC-05: handleAiFastWinsRoutes dispatches fast wins API routes', async () => {
    const { handleAiFastWinsRoutes } = require('../../dashboard/routes/aiFastWinsRoutes');
    let sent = null;
    const resMock = { setHeader: () => {}, end: (d) => { sent = JSON.parse(d); } };
    const handled = await handleAiFastWinsRoutes({ method: 'POST', headers: {} }, resMock, { pathname: '/api/ai/unknown-route' }, { projectRoot: ws.rootPath });
    assert.equal(handled, false);
  });

  await t.test('P17C-TC-06: handleAiFastWinsRoutes handles GET and DELETE /api/ai/audit', async () => {
    const { handleAiFastWinsRoutes } = require('../../dashboard/routes/aiFastWinsRoutes');
    let sent = null;
    const resMock = { writeHead: () => {}, setHeader: () => {}, end: (d) => { sent = JSON.parse(d); } };
    const handledGet = await handleAiFastWinsRoutes({ method: 'GET', headers: {} }, resMock, { pathname: '/api/ai/audit' }, { projectRoot: ws.rootPath });
    assert.equal(handledGet, true);
    assert.equal(sent.ok, true);
    assert.equal(Array.isArray(sent.records), true);

    const handledDel = await handleAiFastWinsRoutes({ method: 'DELETE', headers: {} }, resMock, { pathname: '/api/ai/audit' }, { projectRoot: ws.rootPath });
    assert.equal(handledDel, true);
    assert.equal(sent.ok, true);
  });

  await t.test('P17C-TC-11: CarThings 10 requirements evaluate clarity & generate test cases', async () => {
    const fs = require('fs');
    const path = require('path');
    const datasetPath = path.resolve(__dirname, '../../test-fixtures/ai-eval/carthings-requirements.json');
    const reqs = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
    assert.equal(reqs.length >= 10, true);

    const sample = reqs[0];
    const clarityRes = await runCheckRequirementClarity({ requirementText: sample.content, title: sample.title, root: ws.rootPath });
    assert.equal(clarityRes.ok, true);
    assert.equal(typeof clarityRes.score, 'number');

    const tcRes = await runGenerateTestCases({ reqId: sample.id, reqTitle: sample.title, criteriaText: sample.content, root: ws.rootPath });
    assert.equal(tcRes.ok, true);
    assert.equal(tcRes.testCases.length >= 1, true);
  });
});
