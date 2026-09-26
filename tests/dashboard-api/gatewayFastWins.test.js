/**
 * tests/dashboard-api/gatewayFastWins.test.js
 * Verifies Plan-17c Fast Wins: Requirement Clarity (BA-1), Bug Draft (QA-4), TC Gen (QA-1).
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

  await t.test('P17C-TC-02: runCheckRequirementClarity returns clarity score, ambiguities and BDD draft', async () => {
    fakeServer.options.responseText = JSON.stringify({
      score: 65,
      status: 'needs_clarification',
      summary: 'Yêu cầu có tiêu chí nhưng chứa từ định tính thiếu mốc thời gian.',
      ambiguities: [{ phrase: 'nhanh chóng', reason: 'Không có mốc SLA', suggestion: 'xử lý dưới 2000ms' }],
      missingAspects: ['thiếu timeout', 'thiếu kịch bản mất mạng'],
      clarifiedDraft: 'Given giỏ hàng hợp lệ When bấm thanh toán Then hoàn tất dưới 2 giây'
    });

    const clientConfig = { provider: '9router', apiKey: 'test-key', baseURL: fakeServer.getBaseUrl() };
    const res = await runCheckRequirementClarity({
      requirementText: 'Hệ thống xử lý thanh toán nhanh chóng.',
      title: 'Thanh toán đơn hàng',
      clientConfig,
      root: ws.rootPath
    });

    assert.equal(res.ok, true);
    assert.equal(res.score, 65);
    assert.equal(res.status, 'needs_clarification');
    assert.equal(res.ambiguities.length >= 1, true);
    assert.match(res.clarifiedDraft, /Given/);
  });

  await t.test('P17C-TC-03: runDraftBugReport generates structured bug report from failure', async () => {
    fakeServer.options.responseText = JSON.stringify({
      title: '[Bug] Nút Thêm xe không thể bấm được do popup che khuất',
      severity: 'Major',
      stepsToReproduce: ['1. Đăng nhập học viên', '2. Mở tab Xe', '3. Bấm Thêm xe'],
      expectedResult: 'Mở form thêm xe mới',
      actualResult: 'TimeoutError: element obscured by backdrop',
      environment: 'URL: https://carthings.vn, Chrome',
      suggestedFix: 'Đóng modal trước khi bấm hoặc thêm timeout'
    });

    const clientConfig = { provider: '9router', apiKey: 'test-key', baseURL: fakeServer.getBaseUrl() };
    const res = await runDraftBugReport({
      testTitle: 'Học viên đăng ký xe mới',
      errorText: 'TimeoutError: locator.click obscured by backdrop',
      clientConfig,
      root: ws.rootPath
    });

    assert.equal(res.ok, true);
    assert.equal(res.severity, 'Major');
    assert.match(res.title, /\[Bug\]/);
    assert.equal(res.stepsToReproduce.length >= 1, true);
    assert.match(res.markdownReport, /### Steps to Reproduce/);
  });

  await t.test('P17C-TC-04: runGenerateTestCases generates BDD test cases with tags from AC', async () => {
    fakeServer.options.responseText = JSON.stringify({
      testCases: [
        { tcId: 'TC-001', acId: 'AC-001', title: 'Đăng ký xe hợp lệ', type: 'positive', given: 'Đã login', when: 'Gửi 29A-123.45', then: 'Lưu xe', tags: ['@smoke'] },
        { tcId: 'TC-002', acId: 'AC-001', title: 'Báo lỗi trống', type: 'negative', given: 'Ở form xe', when: 'Gửi rỗng', then: 'Báo lỗi', tags: ['@bva'] }
      ],
      coverageNotes: 'Bao phủ cả happy path và negative path'
    });
    const clientConfig = { provider: '9router', apiKey: 'test-key', baseURL: fakeServer.getBaseUrl() };
    const res = await runGenerateTestCases({
      reqId: 'REQ-013', reqTitle: 'Đăng ký xe học viên', criteriaText: 'AC-001: Biển số xe không được để trống.',
      startTcNumber: 1, clientConfig, root: ws.rootPath
    });
    assert.equal(res.ok, true);
    assert.equal(res.testCases.length, 2);
    assert.equal(res.testCases[0].tcId, 'TC-001');
    assert.equal(res.testCases[1].type, 'negative');
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
