/**
 * tests/dashboard-api/qa.test.js
 * API Contract tests cho QA Docs & Automation:
 * - GET  /api/qa/trace
 * - GET  /api/qa/candidates
 * - GET  /api/qa/decisions
 * - PUT  /api/qa/decision
 *
 * Chạy: npm run test:dashboard:api
 */
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { startDashboardHarness } = require('../dashboard/support/dashboardHarness');
const { createFixtureWorkspace } = require('../dashboard/support/fixtureWorkspace');

const REQ_DOC = `# REQ-001 Đăng nhập

- AC-001: Given người dùng hợp lệ, When đăng nhập, Then vào được trang chủ.
- AC-002: Given sai mật khẩu, When đăng nhập, Then hiện lỗi chung.
- AC-003: Given chưa đăng nhập, When mở trang riêng, Then bị chặn.
`;

const TC_DOC = `# Test Cases: REQ-001

## Traceability

| Requirement | Acceptance criterion | Test case | Automation | Spec | Priority |
|---|---|---|---|---|---|
| REQ-001 | AC-001 | TC-001 | Yes | x | P0 |
| REQ-001 | AC-002 | TC-002 | Candidate | - | P1 |
| REQ-001 | AC-003 | TC-003 | No | - | P2 |
`;

const SPEC = `const { test, expect } = require('x');
test.describe('Đăng nhập @REQ-001', () => {
  test('TC-001 - AC-001 vào được trang chủ @smoke', async () => { expect(1).toBe(1); });
});
`;

const DECISIONS = {
  version: 1,
  severityOrder: ['blocking', 'urgent'],
  decisions: [
    {
      id: 'D-01',
      title: 'Chọn analyzer duy nhất',
      severity: 'blocking',
      context: 'Hai công cụ cùng làm một việc.',
      options: [
        { id: 'giu-a', label: 'Giữ A', consequence: 'Phải port tính năng của B.' },
        { id: 'giu-b', label: 'Giữ B', consequence: 'Mất --since.' },
      ],
      recommended: 'giu-a',
      recommendationReason: 'A có unit test.',
      status: 'pending',
      answer: { optionId: null, note: 'Điền lý do khi chọn', confirmedBy: '', confirmedAt: '' },
    },
  ],
};

function seedDocs(root) {
  fs.mkdirSync(path.join(root, 'requirements'), { recursive: true });
  fs.mkdirSync(path.join(root, 'test-cases'), { recursive: true });
  fs.mkdirSync(path.join(root, 'tests', 'e2e'), { recursive: true });
  fs.writeFileSync(path.join(root, 'requirements', 'REQ-001.md'), REQ_DOC, 'utf8');
  fs.writeFileSync(path.join(root, 'test-cases', 'REQ-001.md'), TC_DOC, 'utf8');
  fs.writeFileSync(path.join(root, 'tests', 'e2e', 'login.spec.js'), SPEC, 'utf8');
}

describe('API Contract: QA Docs & Automation', () => {
  let fixture;
  let harness;

  before(async () => {
    fixture = createFixtureWorkspace();
    harness = await startDashboardHarness(fixture.rootPath);
  });

  after(async () => {
    if (harness) await harness.stop();
    if (fixture) fixture.cleanup();
  });

  // --- Nhánh bootstrap: repo chưa có tài liệu (trạng thái mặc định của Hub) ---

  test('GET /api/qa/trace ở repo chưa có tài liệu trả 200 và bootstrap = true', async () => {
    const res = await fetch(`${harness.url}/api/qa/trace`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.available, true);
    assert.equal(body.bootstrap, true, 'chưa có requirements/ và test-cases/ thì phải là bootstrap');
    assert.equal(body.counts.requirements, 0);
    assert.equal(body.counts.testCases, 0);
    assert.ok(body.dirs && body.dirs.specs, 'phải cho biết đang đọc thư mục nào');
  });

  test('GET /api/qa/candidates ở repo rỗng trả mảng rỗng, không lỗi', async () => {
    const res = await fetch(`${harness.url}/api/qa/candidates`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body.candidates, []);
    assert.equal(body.total, 0);
  });

  test('GET /api/qa/decisions khi thiếu decisions.json là trạng thái rỗng, không phải lỗi', async () => {
    const res = await fetch(`${harness.url}/api/qa/decisions`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.exists, false);
    assert.deepEqual(body.decisions, []);
  });

  // --- Nhánh có dữ liệu ---

  test('GET /api/qa/trace sau khi có tài liệu trả đúng số đếm và nhãn tiếng Việt', async () => {
    seedDocs(fixture.rootPath);
    const res = await fetch(`${harness.url}/api/qa/trace`);
    assert.equal(res.status, 200);
    const body = await res.json();

    assert.equal(body.bootstrap, false);
    assert.equal(body.counts.requirements, 1);
    assert.equal(body.counts.acceptanceCriteria, 3);
    assert.equal(body.counts.testCases, 3);
    assert.equal(body.counts.specs, 1);
    assert.equal(body.requirements[0].id, 'REQ-001');
    assert.equal(body.requirements[0].acCount, 3);
    assert.equal(body.requirements[0].tcCount, 3);
    // TC-001 xuất hiện trong spec -> đã automation
    assert.equal(body.automatedCount, 1);
    for (const f of body.findings.major.concat(body.findings.minor, body.findings.info)) {
      assert.ok(f.label && f.label !== f.kind, `finding "${f.kind}" phải có nhãn tiếng Việt`);
    }
  });

  test('ứng viên automation loại TC đã có script và TC cố ý thủ công', async () => {
    const res = await fetch(`${harness.url}/api/qa/candidates`);
    assert.equal(res.status, 200);
    const body = await res.json();
    const ids = body.candidates.map((c) => c.id);
    assert.ok(!ids.includes('TC-001'), 'TC-001 đã có spec, không còn là ứng viên');
    assert.ok(!ids.includes('TC-003'), 'TC-003 khai No, không phải nợ automation');
    assert.deepEqual(ids, ['TC-002']);
    assert.equal(body.candidates[0].priority, 'P1');
    assert.deepEqual(body.candidates[0].acs, ['AC-002']);
  });

  test('limit của /api/qa/candidates được kẹp về mặc định khi không hợp lệ', async () => {
    const res = await fetch(`${harness.url}/api/qa/candidates?limit=-5`);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray((await res.json()).candidates));
  });

  // --- Sổ quyết định ---

  test('GET /api/qa/decisions đọc được file và đếm đúng số đã trả lời', async () => {
    fs.writeFileSync(
      path.join(fixture.rootPath, 'decisions.json'),
      `${JSON.stringify(DECISIONS, null, 2)}\n`,
      'utf8',
    );
    const res = await fetch(`${harness.url}/api/qa/decisions`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.exists, true);
    assert.equal(body.decisions.length, 1);
    assert.equal(body.decisions[0].answered, false);
    assert.equal(body.answeredCount, 0);
    assert.equal(body.decisions[0].recommended, 'giu-a');
  });

  test('PUT /api/qa/decision ghi answer, đổi status và trả về backup', async () => {
    const res = await fetch(`${harness.url}/api/qa/decision`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'D-01', optionId: 'giu-a', note: 'Đã thống nhất', confirmedBy: 'Hà' }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.decision.answered, true);
    assert.equal(body.decision.status, 'answered');
    assert.equal(body.decision.answer.optionId, 'giu-a');
    assert.ok(body.decision.answer.confirmedAt, 'phải đóng dấu thời gian');
    assert.ok(body.backup, 'phải sao lưu trước khi ghi');

    const onDisk = JSON.parse(fs.readFileSync(path.join(fixture.rootPath, 'decisions.json'), 'utf8'));
    assert.equal(onDisk.decisions[0].answer.confirmedBy, 'Hà');
    assert.equal(onDisk.version, 1, 'các field khác của file phải giữ nguyên');
    assert.equal(onDisk.decisions[0].title, 'Chọn analyzer duy nhất');
    assert.deepEqual(onDisk.severityOrder, ['blocking', 'urgent']);
  });

  test('chọn phương án nhưng bỏ trống người ký thì CHƯA coi là đã trả lời', async () => {
    const res = await fetch(`${harness.url}/api/qa/decision`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'D-01', optionId: 'giu-b', note: 'đang cân nhắc', confirmedBy: '   ' }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.decision.answered, false);
    assert.equal(body.decision.status, 'pending');
    assert.equal(body.decision.answer.confirmedAt, '');
  });

  test('PUT /api/qa/decision từ chối mã quyết định không tồn tại', async () => {
    const res = await fetch(`${harness.url}/api/qa/decision`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'D-99', optionId: 'giu-a', confirmedBy: 'Hà' }),
    });
    assert.equal(res.status, 404);
    assert.ok((await res.json()).error.includes('D-99'));
  });

  test('PUT /api/qa/decision từ chối phương án không thuộc quyết định đó', async () => {
    const res = await fetch(`${harness.url}/api/qa/decision`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'D-01', optionId: 'phuong-an-ma', confirmedBy: 'Hà' }),
    });
    assert.equal(res.status, 400);
  });

  test('PUT /api/qa/decision thiếu mã trả 400', async () => {
    const res = await fetch(`${harness.url}/api/qa/decision`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ optionId: 'giu-a', confirmedBy: 'Hà' }),
    });
    assert.equal(res.status, 400);
  });

  // --- Ranh giới Hub <-> project ---

  test('cấu hình QA riêng của repo được tôn trọng và KHÔNG bị mục QA ghi đè', async () => {
    const cfgDir = path.join(fixture.rootPath, 'core', 'config');
    fs.mkdirSync(cfgDir, { recursive: true });
    const cfgPath = path.join(cfgDir, 'dashboardConfig.json');
    fs.writeFileSync(cfgPath, `${JSON.stringify({
      environments: { qc: { label: 'QC', baseURL: 'https://qc.example.com' } },
      runtime: { defaultEnvironment: 'qc' },
      qa: { specs: 'tests/e2e', requirements: 'requirements', testCases: 'test-cases' },
    }, null, 2)}\n`, 'utf8');
    const before = fs.readFileSync(cfgPath, 'utf8');

    const res = await fetch(`${harness.url}/api/qa/trace`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.dirs.specs, 'tests/e2e', 'phải đọc thư mục spec khai trong config của repo');
    assert.equal(body.configPath, 'core/config/dashboardConfig.json');

    assert.equal(fs.readFileSync(cfgPath, 'utf8'), before, 'mục QA chỉ đọc, không được ghi vào config');
  });

  test('mục QA không bao giờ ghi vào requirements/ hay test-cases/', async () => {
    const reqDir = path.join(fixture.rootPath, 'requirements');
    const tcDir = path.join(fixture.rootPath, 'test-cases');
    const snapshot = (dir) => fs.readdirSync(dir).map((f) => `${f}:${fs.readFileSync(path.join(dir, f), 'utf8').length}`).sort();
    const beforeReq = snapshot(reqDir);
    const beforeTc = snapshot(tcDir);

    await fetch(`${harness.url}/api/qa/trace`);
    await fetch(`${harness.url}/api/qa/candidates`);
    await fetch(`${harness.url}/api/qa/decision`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'D-01', optionId: 'giu-a', confirmedBy: 'Hà' }),
    });

    assert.deepEqual(snapshot(reqDir), beforeReq);
    assert.deepEqual(snapshot(tcDir), beforeTc);
  });
});
