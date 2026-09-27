/**
 * tests/dashboard-api/deterministicQaRoutes.test.js
 * HTTP contract for the QA features that run on rule engines instead of AI.
 * The dashboard runs with a saved server key AND every request carries a personal key in
 * X-AI-Config, so any AI call would reach the fake provider. Every test asserts it received none.
 */
const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { startDashboardHarness } = require('../dashboard/support/dashboardHarness');
const { createFixtureWorkspace } = require('../dashboard/support/fixtureWorkspace');

function startFakeProvider() {
  const calls = [];
  const server = http.createServer((req, res) => {
    calls.push(req.url);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message: { content: '{"category":"flaky","confidence":99}' } }] }));
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({
      calls,
      base: `http://127.0.0.1:${server.address().port}/v1`,
      stop: () => new Promise((done) => server.close(done)),
    }));
  });
}

const write = (root, rel, content) => {
  fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
  fs.writeFileSync(path.join(root, rel), content, 'utf8');
};

describe('API Contract: rule-based QA features never call AI', () => {
  let fixture;
  let harness;
  let provider;
  let aiHeader;

  const post = async (url, body) => {
    const res = await fetch(`${harness.url}${url}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-AI-Config': aiHeader },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  };

  before(async () => {
    provider = await startFakeProvider();
    aiHeader = Buffer.from(JSON.stringify({ enabled: true, apiKey: 'personal-key', baseURL: provider.base, provider: 'custom', model: 'fake' })).toString('base64');
    fixture = createFixtureWorkspace();
    const root = fixture.rootPath;
    write(root, '.env', `AI_PROVIDER=custom\nAI_BASE_URL=${provider.base}\nAI_MODEL=fake-model\nAI_API_KEY=server-key\n`);
    write(root, 'requirements/REQ-001.md', '# REQ-001\n\n- AC-001: Given a, When b, Then c.\n- AC-003: Given d, When e, Then f.\n');
    write(root, 'test-cases/REQ-001.md', '# TC\n\n| Requirement | Acceptance criterion | Test case | Automation | Priority |\n|---|---|---|---|---|\n| REQ-001 | AC-003 | TC-011 | Yes | P1 |\n');
    write(root, 'tests/login.spec.js', "test('TC-011 @AC-009', async () => { expect(1).toBe(1); });\n");
    spawnSync('git', ['init', '-q'], { cwd: root, windowsHide: true });
    harness = await startDashboardHarness(root);
  });

  after(async () => {
    if (harness) await harness.stop();
    if (fixture) fixture.cleanup();
    if (provider) await provider.stop();
  });

  beforeEach(() => { provider.calls.length = 0; });

  test('POST /api/diagnostics/triage phân loại bằng luật và trả locator trích từ log', async () => {
    const res = await post('/api/diagnostics/triage', { error: "Error: locator.click: strict mode violation: getByRole('button', { name: 'Lưu' }) resolved to 2 elements", mode: 'ai' });
    assert.equal(res.status, 200);
    assert.equal(res.body.source, 'rule');
    assert.equal(res.body.category, 'test_bug');
    assert.equal(res.body.locator, "getByRole('button', { name: 'Lưu' })");
    assert.equal(provider.calls.length, 0);
  });

  test('POST /api/diagnostics/triage: lỗi không nhận diện được trả "unknown", không đoán', async () => {
    const res = await post('/api/diagnostics/triage', { error: 'Some random failure log' });
    assert.equal(res.status, 200);
    assert.equal(res.body.category, 'unknown');
    assert.equal(provider.calls.length, 0);
  });

  test('POST /api/ai/req-clarity nhận đúng cụm tiếng Việt có dấu', async () => {
    const res = await post('/api/ai/req-clarity', { requirementText: 'Khi nhập sai thì hiển thị thông báo không hợp lệ trong 1 giây, xử lý nhanh chóng.' });
    assert.equal(res.status, 200);
    assert.equal(res.body.source, 'rule');
    assert.deepEqual(res.body.ambiguities.map((a) => a.phrase), ['nhanh chóng']);
    assert.deepEqual(res.body.missingAspects, []);
    assert.equal(provider.calls.length, 0);
  });

  test('POST /api/ai/draft-bug dựng báo cáo từ dữ kiện lỗi', async () => {
    const res = await post('/api/ai/draft-bug', {
      testTitle: 'Áp dụng voucher', errorText: 'Error: expect(received).toHaveText(expected)\nExpected: Thành công\nReceived: 500 Internal Server Error',
      triageCategory: 'product_bug',
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.severity, 'Critical');
    assert.match(res.body.title, /^\[Bug\] Áp dụng voucher/);
    assert.match(res.body.actualResult, /500 Internal Server Error/);
    assert.equal(provider.calls.length, 0);
  });

  test('POST /api/ai/generate-tc sinh ca biên từ AC', async () => {
    const res = await post('/api/ai/generate-tc', { criteriaText: '- AC-001: Mật khẩu từ 8 đến 20 ký tự, bắt buộc nhập.' });
    assert.equal(res.status, 200);
    assert.equal(res.body.source, 'rule');
    const titles = res.body.testCases.map((tc) => tc.title).join('\n');
    assert.match(titles, /< 8/);
    assert.match(titles, /> 20/);
    assert.ok(res.body.testCases.every((tc) => tc.acId === 'AC-001'));
    assert.equal(provider.calls.length, 0);
  });

  test('POST /api/ai/generate-spec sinh spec hợp lệ, test thiếu bước là test.fixme; thiếu dữ liệu trả 400', async () => {
    const ok = await post('/api/ai/generate-spec', {
      reqId: 'REQ-001',
      tcList: [{ tcId: 'TC-001', acId: 'AC-001', title: 'Đăng nhập', given: 'mở trang "/login"', when: 'bấm nút "Đăng nhập"', then: 'hiển thị "Xin chào"' },
        { tcId: 'TC-002', acId: 'AC-001', title: 'Chưa rõ', given: 'Hệ thống sẵn sàng', when: 'Thao tác', then: 'Thành công' }],
    });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.syntaxValid, true);
    assert.match(ok.body.specCode, /test\('TC-001 - AC-001 Đăng nhập'/);
    assert.match(ok.body.specCode, /test\.fixme\('TC-002 - AC-001 Chưa rõ'/);
    assert.doesNotMatch(ok.body.specCode, /\bpage\.(?:locator|getBy\w+)\(/);
    const empty = await post('/api/ai/generate-spec', { reqId: 'REQ-001' });
    assert.equal(empty.status, 400);
    assert.equal(provider.calls.length, 0);
  });

  test('POST /api/qa/conflict/arbitrate dùng luật truy vết', async () => {
    const res = await post('/api/qa/conflict/arbitrate', { tcId: 'TC-011', specFile: 'tests/login.spec.js' });
    assert.equal(res.status, 200);
    assert.equal(res.body.engine, 'heuristic');
    assert.equal(res.body.recommendation, 'sync_spec_to_doc');
    assert.match(res.body.reason, /AC-009/);
    assert.equal(provider.calls.length, 0);
  });

  test('POST /api/qa/analyze-requirement mặc định chạy luật', async () => {
    const res = await post('/api/qa/analyze-requirement', { rawText: 'Mật khẩu từ 8 đến 20 ký tự', scanExisting: false });
    assert.equal(res.status, 200);
    assert.equal(res.body.engine, 'heuristic');
    assert.equal(provider.calls.length, 0);
  });
});
