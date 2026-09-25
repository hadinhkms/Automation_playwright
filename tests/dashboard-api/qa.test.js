// master-process-disable-size-check: QA Docs & Automation comprehensive contract test suite
/**
 * tests/dashboard-api/qa.test.js
 * API Contract tests cho QA Docs & Automation:
 * - GET  /api/qa/trace
 * - GET  /api/qa/candidates
 * - GET  /api/qa/decisions
 * - PUT  /api/qa/decision
 * - GET  /api/qa/document
 * - GET  /api/qa/bdd-drafts
 * - GET  /api/qa/document
 * - GET  /api/qa/conflict/context, POST /api/qa/conflict/{resolve,arbitrate,escalate}
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

  // --- Đọc tài liệu ---

  test('GET /api/qa/documents liệt kê đúng file và mã bên trong', async () => {
    const res = await fetch(`${harness.url}/api/qa/documents`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.available, true);

    const paths = body.documents.map((d) => d.path);
    assert.ok(paths.includes('requirements/REQ-001.md'), 'thiếu file requirement');
    assert.ok(paths.includes('test-cases/REQ-001.md'), 'thiếu file test case');

    const req = body.documents.find((d) => d.path === 'requirements/REQ-001.md');
    assert.equal(req.kind, 'requirement');
    assert.deepEqual(req.ids, ['REQ-001']);

    const tc = body.documents.find((d) => d.path === 'test-cases/REQ-001.md');
    assert.equal(tc.kind, 'test-case');
    assert.deepEqual(tc.ids.sort(), ['TC-001', 'TC-002', 'TC-003']);
  });

  test('GET /api/qa/document trả nội dung THÔ, không diễn giải sang HTML', async () => {
    const res = await fetch(`${harness.url}/api/qa/document?path=${encodeURIComponent('requirements/REQ-001.md')}`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.path, 'requirements/REQ-001.md');
    assert.equal(body.kind, 'requirement');
    assert.equal(body.content, REQ_DOC, 'phải đúng byte gốc trên đĩa');
    assert.ok(body.bytes > 0);
    assert.ok(!/<p>|<ul>|<h1>/i.test(body.content), 'server không được dựng HTML hộ');
  });

  test('GET /api/qa/document chặn mọi đường dẫn ngoài danh sách tài liệu', async () => {
    const outside = [
      '../../../../Windows/win.ini',
      'requirements/../../package.json',
      'core/config/dashboardConfig.json',
      'tests/e2e/login.spec.js',
      'decisions.json',
      '/etc/passwd',
    ];
    for (const p of outside) {
      const res = await fetch(`${harness.url}/api/qa/document?path=${encodeURIComponent(p)}`);
      assert.equal(res.status, 404, `${p} phải bị từ chối`);
      const body = await res.json();
      assert.ok(body.error, 'phải nói rõ vì sao');
    }
  });

  test('GET /api/qa/document thiếu path trả 400', async () => {
    const res = await fetch(`${harness.url}/api/qa/document`);
    assert.equal(res.status, 400);
  });

  test('GET /api/qa/bdd-draft dựng bản thảo từ tài liệu, không ghi gì ra đĩa', async () => {
    const tcDir = path.join(fixture.rootPath, 'test-cases');
    const snap = (dir) => fs.readdirSync(dir)
      .map((f) => `${f}:${fs.readFileSync(path.join(dir, f), 'utf8').length}`).sort();
    const snapBefore = snap(tcDir);

    const res = await fetch(`${harness.url}/api/qa/bdd-draft?ids=TC-001,TC-002`);
    assert.equal(res.status, 200);
    const body = await res.json();

    assert.deepEqual(body.ids, ['TC-001', 'TC-002']);
    assert.ok(body.text.includes('# TC-001'), 'phải có nội dung của TC-001');
    assert.ok(body.text.includes('Given Tiền điều kiện'), 'phải theo khuôn BDD');
    assert.ok(body.text.includes('KHÔNG được lưu lại'), 'phải nói rõ bản thảo là nhất thời');

    // Không được ghi bất cứ thứ gì vào test-cases/.
    assert.deepEqual(snap(tcDir), snapBefore);
  });

  test('GET /api/qa/bdd-draft từ chối đầu vào không hợp lệ', async () => {
    for (const q of ['', '?ids=', '?ids=khong-phai-ma', '?ids=REQ-001']) {
      const res = await fetch(`${harness.url}/api/qa/bdd-draft${q}`);
      assert.equal(res.status, 400, `"${q}" phải bị từ chối`);
    }
  });

  test('GET /api/qa/bdd-draft báo rõ mã không có trong tài liệu', async () => {
    const res = await fetch(`${harness.url}/api/qa/bdd-draft?ids=TC-999`);
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.ok(body.error.includes('TC-999'));
  });

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

  test('GET /api/qa/summary trả về 200 với đầy đủ schema 1.0.0, metrics và health', async () => {
    const res = await fetch(`${harness.url}/api/qa/summary`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.schemaVersion, '1.0.0');
    assert.ok(body.metrics && typeof body.metrics === 'object');
    assert.ok(body.health && typeof body.health === 'object');
    assert.ok(body.boundary && typeof body.boundary === 'object');
    assert.ok(Array.isArray(body.findings));
  });

  test('POST /api/qa/fix hỗ trợ dryRun preview và trả về danh sách thay đổi', async () => {
    const res = await fetch(`${harness.url}/api/qa/fix`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dryRun: true }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.dryRun, true);
    assert.equal(typeof body.reconciledLinks, 'number');
    assert.equal(typeof body.registeredCandidates, 'number');
    assert.ok(Array.isArray(body.changes));
  });

  test('GET /api/qa/scaffold/meta trả về nextReqId và danh mục domain', async () => {
    const res = await fetch(`${harness.url}/api/qa/scaffold/meta`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(/^REQ-\d{3}$/.test(body.nextReqId));
    assert.ok(Array.isArray(body.existingDomains));
  });

  test('POST /api/qa/scaffold khởi tạo đồng bộ 3 files', async () => {
    const res = await fetch(`${harness.url}/api/qa/scaffold`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reqId: 'REQ-099',
        title: 'Tính năng kiểm thử scaffold API',
        domain: 'auth',
        acCount: 2,
      }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.mode, 'scaffold');
    assert.equal(body.created.length, 3);
  });

  test('POST /api/qa/analyze-requirement phân tích yêu cầu thô ở chế độ heuristic', async () => {
    const rawText = `Tính năng thêm trung tâm sát hạch:
Trường "Trung tâm sát hạch" bắt buộc cả khi tạo mới và khi cập nhật.
Khu vực đào tạo (phường/xã) tối đa 10 mục. Bỏ trống trung tâm sát hạch sẽ bị chặn lưu.`;

    const res = await fetch(`${harness.url}/api/qa/analyze-requirement`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rawText,
        mode: 'heuristic',
        scanExisting: true,
      }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.engine, 'heuristic');
    assert.ok(body.testCaseEstimation.totalCount > 0);
    assert.ok(Array.isArray(body.testCaseEstimation.testCases));
    assert.ok(body.systemImpact && body.systemImpact.riskLevel);
    assert.ok(Array.isArray(body.logicClarifications));
    assert.ok(Array.isArray(body.qaTeamInquiries));
  });

  test('POST /api/qa/scaffold-from-analysis tạo file REQ và TC từ kết quả phân tích', async () => {
    const analysisResult = {
      summary: 'Yêu cầu kiểm thử scaffold tự động',
      testCaseEstimation: {
        testCases: [
          {
            suggestedId: 'TC-001',
            title: 'Kiểm tra lưu thành công',
            type: 'Positive',
            priority: 'P0',
            precondition: 'Hệ thống sẵn sàng',
            testData: 'Dữ liệu chuẩn',
            steps: [{ step: 1, action: 'Bấm Lưu', expected: 'Thành công' }],
          },
        ],
      },
      systemImpact: { riskLevel: 'Thấp', summary: 'Không rủi ro' },
      logicClarifications: [
        { topic: 'Data', question: 'Dữ liệu có xóa được không?', whyItMatters: 'Test cleanup', proposedDefault: 'Có' },
      ],
    };

    const res = await fetch(`${harness.url}/api/qa/scaffold-from-analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reqId: 'REQ-088',
        title: 'Tính năng scaffold từ phân tích',
        analysisResult,
      }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.files.length, 2);
  });

  test('PLAN-18: route AI sửa lỗi cũ đã bỏ — ai-analyze-fix và apply-fix trả 404', async () => {
    for (const route of ['/api/qa/finding/ai-analyze-fix', '/api/qa/finding/apply-fix']) {
      const res = await fetch(`${harness.url}${route}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ finding: { kind: 'test-khong-co-ma-tc', where: 'tests/example.spec.js:1' } }),
      });
      assert.equal(res.status, 404, route);
    }
  });

  // --- Traceability Conflict Studio ---
  // Cấu hình ở test phía trên đặt thư mục spec là tests/e2e, nên fixture xung đột nằm ở đó.
  const CONFLICT_SPEC = 'tests/e2e/conflict.spec.js';
  const CONFLICT_DOC = 'test-cases/REQ-002-conflict.md';

  const seedConflicts = (root) => {
    fs.writeFileSync(path.join(root, CONFLICT_DOC), `# Test Cases: REQ-001 (xung đột)

| Requirement | Acceptance criterion | Test case | Automation | Priority |
|---|---|---|---|---|
| REQ-001 | AC-003 | TC-021 | Yes | P1 |
| REQ-001 | AC-003 | TC-022 | Yes | P1 |
| REQ-001 | AC-001 | TC-023 | Yes | P1 |
`, 'utf8');
    fs.writeFileSync(path.join(root, CONFLICT_SPEC), `const { test, expect } = require('x');
test('TC-021 @AC-002 sai mật khẩu', async () => { expect(1).toBe(1); });
test('TC-022 @AC-001 @AC-002 đăng nhập', async () => { expect(1).toBe(1); });
test('TC-023 @AC-002 chặn', async () => { expect(1).toBe(1); });
`, 'utf8');
  };

  const post = (route, body) => fetch(`${harness.url}${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const conflictFindings = async () => {
    const body = await (await fetch(`${harness.url}/api/qa/trace`)).json();
    return (body.findings.major || []).filter((f) => f.kind === 'ac-lech-giua-tai-lieu-va-spec');
  };

  test('GET /api/qa/trace gắn dữ liệu xung đột có cấu trúc cho từng finding', async () => {
    seedConflicts(fixture.rootPath);
    const found = await conflictFindings();
    const tc22 = found.find((f) => f.conflict && f.conflict.tcId === 'TC-022');
    assert.ok(tc22, 'phải có finding TC-022');
    assert.equal(tc22.conflict.specFile, CONFLICT_SPEC);
    assert.deepEqual(tc22.conflict.specAcs, ['AC-001', 'AC-002']);
    assert.deepEqual(tc22.conflict.docOnly, ['AC-003']);
  });

  test('GET /api/qa/conflict/context trả test block, dòng tài liệu và định nghĩa AC', async () => {
    const res = await fetch(`${harness.url}/api/qa/conflict/context?tcId=TC-021&specFile=${encodeURIComponent(CONFLICT_SPEC)}`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.inSync, false);
    assert.deepEqual(body.specOnly, ['AC-002']);
    assert.equal(body.blocks[0].hasAssertion, true);
    assert.ok(body.docLocations.some((l) => l.file === CONFLICT_DOC));
    assert.match(body.acDefinitions['AC-002'].text, /sai mật khẩu/);
  });

  test('POST /api/qa/conflict/resolve sync_doc_to_spec sửa tài liệu, có backup và hết xung đột', async () => {
    const res = await post('/api/qa/conflict/resolve', { resolutionType: 'sync_doc_to_spec', tcId: 'TC-022', specFile: CONFLICT_SPEC });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.deepEqual(body.newAcs, ['AC-001', 'AC-002']);
    assert.ok(fs.existsSync(path.join(fixture.rootPath, body.backup)));
    assert.ok(fs.readFileSync(path.join(fixture.rootPath, CONFLICT_DOC), 'utf8').includes('| AC-001, AC-002 | TC-022 |'));
    assert.ok(!(await conflictFindings()).some((f) => f.id === 'TC-022'));

    const again = await (await post('/api/qa/conflict/resolve', { resolutionType: 'sync_doc_to_spec', tcId: 'TC-022', specFile: CONFLICT_SPEC })).json();
    assert.equal(again.noop, true, 'bấm lần hai (double-click / phản hồi muộn) không ghi gì');
  });

  test('POST /api/qa/conflict/resolve sync_spec_to_doc sửa tag trong tiêu đề test', async () => {
    const res = await post('/api/qa/conflict/resolve', { resolutionType: 'sync_spec_to_doc', tcId: 'TC-021', specFile: CONFLICT_SPEC });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.backup);
    assert.ok(fs.readFileSync(path.join(fixture.rootPath, CONFLICT_SPEC), 'utf8').includes("test('TC-021 @AC-003 sai mật khẩu'"));
    assert.ok(!(await conflictFindings()).some((f) => f.id === 'TC-021'));
  });

  test('POST /api/qa/conflict/resolve từ chối đầu vào xấu với mã lỗi đúng', async () => {
    const bad = async (body, status) => {
      const res = await post('/api/qa/conflict/resolve', body);
      assert.equal(res.status, status, JSON.stringify(body));
      assert.ok((await res.json()).error);
    };
    await bad({ resolutionType: 'xoa_het', tcId: 'TC-023', specFile: CONFLICT_SPEC }, 400);
    await bad({ resolutionType: 'sync_doc_to_spec', tcId: 'TC-023', specFile: '../../etc/passwd.spec.js' }, 400);
    await bad({ resolutionType: 'sync_doc_to_spec', tcId: 'TC-023', specFile: 'tests/e2e/khong-co.spec.js' }, 404);
    await bad({ resolutionType: 'sync_doc_to_spec', specFile: CONFLICT_SPEC }, 400);
    const broken = await fetch(`${harness.url}/api/qa/conflict/resolve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{hỏng' });
    assert.equal(broken.status, 400);
  });

  test('POST /api/qa/conflict/arbitrate trả phán quyết hợp lệ qua luật suy luận khi chưa có AI', async () => {
    const res = await post('/api/qa/conflict/arbitrate', { tcId: 'TC-023', specFile: CONFLICT_SPEC });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(['sync_doc_to_spec', 'sync_spec_to_doc'].includes(body.recommendation));
    assert.ok(Number.isInteger(body.confidence));
    assert.ok(body.reason);
    assert.ok(['ai', 'heuristic'].includes(body.engine));

    const synced = await post('/api/qa/conflict/arbitrate', { tcId: 'TC-022', specFile: CONFLICT_SPEC });
    assert.equal(synced.status, 409, 'TC đã khớp thì không còn gì để phân xử');
  });

  test('POST /api/qa/conflict/escalate ghi sổ kèm source, gọi lại không tạo trùng', async () => {
    const res = await post('/api/qa/conflict/escalate', { tcId: 'TC-023', specFile: CONFLICT_SPEC, reason: 'Cần PO chốt' });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.match(body.decisionId, /^D-\d{2,}$/);

    const decisions = await (await fetch(`${harness.url}/api/qa/decisions`)).json();
    const saved = decisions.decisions.find((d) => d.id === body.decisionId);
    assert.equal(saved.source.tcId, 'TC-023');
    assert.equal(saved.source.specFile, CONFLICT_SPEC);
    assert.equal(saved.recommendationReason, 'Cần PO chốt');

    const dup = await (await post('/api/qa/conflict/escalate', { tcId: 'TC-023', specFile: CONFLICT_SPEC })).json();
    assert.equal(dup.isDuplicate, true);
    assert.equal(dup.decisionId, body.decisionId);
  });
});
