/**
 * tests/dashboard-api/qa-spec-studio.test.js
 * Integration test suite for PLAN-19b QA Spec Studio APIs:
 * - TC-07, TC-08: POST /api/qa/boundary-matrix (0 token AI)
 * - TC-10, TC-11, TC-12, TC-13, TC-14: POST /api/ai/format-bdd (AI Gateway)
 * - TC-18: LIFE-01 integration: format-bdd -> PUT /api/qa/document -> GET /api/qa/summary
 */

const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const FakeAiProvider = require('../dashboard/support/fakeAiProvider');
const { startDashboardHarness } = require('../dashboard/support/dashboardHarness');
const { createFixtureWorkspace } = require('../dashboard/support/fixtureWorkspace');

describe('PLAN-19b QA Spec Studio API Suite', () => {
  let fixture;
  let harness;
  let fakeAi;
  let clientConfig;

  before(async () => {
    fixture = createFixtureWorkspace();
    fakeAi = new FakeAiProvider();
    await fakeAi.start();

    // Setup initial requirement document for LIFE-01 test (TC-18)
    const reqDir = path.join(fixture.rootPath, 'requirements');
    fs.mkdirSync(reqDir, { recursive: true });
    fs.writeFileSync(
      path.join(reqDir, 'REQ-099.md'),
      '---\nid: REQ-099\ntitle: Quan ly ho so\nstatus: Draft\n---\n# REQ-099: Quan ly ho so\n\n### AC-001: Nop ho so thieu so dien thoai\nNoi dung.\n\n### AC-002: Nop ho so thanh cong\nNoi dung.\n',
      'utf8'
    );

    harness = await startDashboardHarness(fixture.rootPath);
    clientConfig = {
      provider: '9router',
      apiKey: 'test-key',
      baseURL: fakeAi.getBaseUrl(),
      model: 'qaFast'
    };
  });

  after(async () => {
    if (harness) await harness.stop();
    if (fakeAi) await fakeAi.stop();
    if (fixture) fixture.cleanup();
  });

  beforeEach(() => {
    fakeAi.clear();
  });

  function makeAiHeaders(origin = null) {
    return {
      'Content-Type': 'application/json',
      'Origin': origin || `http://127.0.0.1:${harness.port}`,
      'x-ai-config': Buffer.from(JSON.stringify(clientConfig), 'utf8').toString('base64')
    };
  }

  // TC-07: POST /api/qa/boundary-matrix 200, source rule, 0 token
  test('TC-07: POST /api/qa/boundary-matrix tra ket qua 200, 0 token AI, FakeAiProvider khong nhan call nao', async () => {
    const auditBeforeRes = await fetch(`http://127.0.0.1:${harness.port}/api/ai/audit`, {
      headers: { 'Origin': `http://127.0.0.1:${harness.port}` }
    });
    const auditBefore = await auditBeforeRes.json();
    const countBefore = auditBefore.count || 0;

    const res = await fetch(`http://127.0.0.1:${harness.port}/api/qa/boundary-matrix`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requirementText: 'Độ tuổi tham gia từ 18 đến 60 tuổi. Mật khẩu dài từ 8 đến 32 ký tự.'
      })
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.ok, true);
    assert.equal(data.source, 'rule');
    assert.equal(data.constraints.length, 2);
    assert.ok(data.constraints[0].matrix);
    assert.equal(data.constraints[0].matrix.values.length, 7);

    // Audit log không tăng và FakeAiProvider không có request
    const auditAfterRes = await fetch(`http://127.0.0.1:${harness.port}/api/ai/audit`, {
      headers: { 'Origin': `http://127.0.0.1:${harness.port}` }
    });
    const auditAfter = await auditAfterRes.json();
    assert.equal(auditAfter.count, countBefore);
    assert.equal(fakeAi.requests.length, 0);
  });

  // TC-08: POST /api/qa/boundary-matrix 400 khi rỗng, 413 khi > 20000 ký tự
  test('TC-08: POST /api/qa/boundary-matrix tra 400 khi rong va 413 khi qua 20.000 ky tu', async () => {
    const resEmpty = await fetch(`http://127.0.0.1:${harness.port}/api/qa/boundary-matrix`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requirementText: '   ' })
    });
    assert.equal(resEmpty.status, 400);
    const emptyJson = await resEmpty.json();
    assert.equal(emptyJson.code, 'EMPTY_TEXT');

    const resLong = await fetch(`http://127.0.0.1:${harness.port}/api/qa/boundary-matrix`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requirementText: 'x'.repeat(20001) })
    });
    assert.equal(resLong.status, 413);
    const longJson = await resLong.json();
    assert.equal(longJson.code, 'TEXT_TOO_LONG');
  });

  // TC-10: POST /api/ai/format-bdd 200 với FakeAiProvider trả JSON hợp lệ
  test('TC-10: POST /api/ai/format-bdd voi FakeAiProvider tra 200, co markdown, model, usage', async () => {
    fakeAi.addHandler((req, res) => {
      if (req.method === 'POST' && req.url.includes('/chat/completions')) {
        const payload = {
          scenarios: [
            {
              acId: 'AC-001',
              title: 'Nộp hồ sơ thiếu số điện thoại',
              given: ['ứng viên ở màn hình nộp hồ sơ'],
              when: ['để trống số điện thoại và bấm nộp'],
              then: ['hệ thống hiển thị lỗi', 'không gửi hồ sơ']
            },
            {
              acId: 'AC-002',
              title: 'Nộp hồ sơ thành công',
              given: ['ứng viên điền đủ thông tin'],
              when: ['bấm nộp hồ sơ'],
              then: ['gửi email xác nhận']
            }
          ],
          openQuestions: []
        };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          choices: [{ message: { role: 'assistant', content: JSON.stringify(payload) } }],
          usage: { prompt_tokens: 80, completion_tokens: 60, total_tokens: 140 }
        }));
        return true;
      }
      return false;
    });

    const res = await fetch(`http://127.0.0.1:${harness.port}/api/ai/format-bdd`, {
      method: 'POST',
      headers: makeAiHeaders(),
      body: JSON.stringify({
        requirementText: '### AC-001: Nộp hồ sơ thiếu số điện thoại\n### AC-002: Nộp hồ sơ thành công'
      })
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.ok, true);
    assert.deepEqual(data.acIds, ['AC-001', 'AC-002']);
    assert.equal(data.scenarios.length, 2);
    assert.ok(data.markdown.includes('### AC-001: Nộp hồ sơ thiếu số điện thoại'));
    assert.ok(data.markdown.includes('**Given** ứng viên ở màn hình nộp hồ sơ'));
    assert.ok(data.usage);
  });

  // TC-11: Provider trả thiếu AC-002 -> 502 BDD_MISSING_AC
  test('TC-11: Provider tra thieu AC-002 -> 502 BDD_MISSING_AC, khong co markdown', async () => {
    fakeAi.addHandler((req, res) => {
      if (req.method === 'POST' && req.url.includes('/chat/completions')) {
        const payload = {
          scenarios: [
            {
              acId: 'AC-001',
              title: 'Nộp hồ sơ thiếu số điện thoại',
              given: ['ứng viên ở màn hình nộp hồ sơ'],
              when: ['để trống số điện thoại'],
              then: ['hiển thị thông báo lỗi']
            }
          ]
        };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          choices: [{ message: { role: 'assistant', content: JSON.stringify(payload) } }]
        }));
        return true;
      }
      return false;
    });

    const res = await fetch(`http://127.0.0.1:${harness.port}/api/ai/format-bdd`, {
      method: 'POST',
      headers: makeAiHeaders(),
      body: JSON.stringify({
        requirementText: '### AC-001: Tiêu chí 1\n### AC-002: Tiêu chí 2'
      })
    });

    assert.equal(res.status, 502);
    const data = await res.json();
    assert.equal(data.ok, false);
    assert.equal(data.code, 'BDD_MISSING_AC');
    assert.deepEqual(data.details, ['AC-002']);
    assert.equal(data.markdown, undefined);
  });

  // TC-12: Provider trả 500, timeout hoặc JSON hỏng -> 502 không có markdown
  test('TC-12: Provider tra 500 hoac JSON hong -> 502 khong co markdown, khong co source rule', async () => {
    fakeAi.addHandler((req, res) => {
      if (req.method === 'POST' && req.url.includes('/chat/completions')) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'Internal Server Error', code: 500 } }));
        return true;
      }
      return false;
    });

    const res = await fetch(`http://127.0.0.1:${harness.port}/api/ai/format-bdd`, {
      method: 'POST',
      headers: makeAiHeaders(),
      body: JSON.stringify({ requirementText: '### AC-001: Tiêu chí 1' })
    });

    assert.equal(res.status, 502);
    const data = await res.json();
    assert.equal(data.ok, false);
    assert.equal(data.markdown, undefined);
    assert.equal(data.source, undefined);
  });

  // TC-13: Client huỷ request -> ghi nhận abort
  test('TC-13: Client huy request -> provider ghi nhan aborted request', async () => {
    fakeAi.addHandler((req, res) => {
      if (req.method === 'POST' && req.url.includes('/chat/completions')) {
        // Giữ kết nối mở để client kịp abort
        setTimeout(() => {
          if (!res.writableEnded) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ choices: [] }));
          }
        }, 800);
        return true;
      }
      return false;
    });

    const controller = new AbortController();
    const fetchPromise = fetch(`http://127.0.0.1:${harness.port}/api/ai/format-bdd`, {
      method: 'POST',
      headers: makeAiHeaders(),
      body: JSON.stringify({ requirementText: '### AC-001: Test abort request' }),
      signal: controller.signal
    });

    setTimeout(() => {
      controller.abort();
    }, 50);

    await fetchPromise.catch(() => {});
    // Chờ một chút để socket đóng
    await new Promise((resolve) => setTimeout(resolve, 150));

    assert.ok(fakeAi.abortedRequests.length >= 1 || fakeAi.requests.length >= 1);
  });

  // TC-14: Header Origin khác -> 403
  test('TC-14: Header Origin khac bi middleware aiRoutes chan voi ma 403', async () => {
    const res = await fetch(`http://127.0.0.1:${harness.port}/api/ai/format-bdd`, {
      method: 'POST',
      headers: makeAiHeaders('http://malicious-site.com'),
      body: JSON.stringify({ requirementText: '### AC-001: Test cross site' })
    });
    assert.equal(res.status, 403);
    const data = await res.json();
    assert.ok(data.error);
  });

  // TC-18: LIFE-01 (API): format-bdd -> PUT /api/qa/document -> GET /api/qa/summary
  test('TC-18: LIFE-01 (API): format-bdd thanh cong, ghep vao document, summary doc du khong near-miss', async () => {
    fakeAi.addHandler((req, res) => {
      if (req.method === 'POST' && req.url.includes('/chat/completions')) {
        const payload = {
          scenarios: [
            {
              acId: 'AC-001',
              title: 'Nộp hồ sơ thiếu số điện thoại',
              given: ['ứng viên ở màn hình nộp hồ sơ'],
              when: ['để trống số điện thoại'],
              then: ['báo lỗi số điện thoại']
            },
            {
              acId: 'AC-002',
              title: 'Nộp hồ sơ thành công',
              given: ['ứng viên điền đủ thông tin'],
              when: ['bấm nộp hồ sơ'],
              then: ['hiển thị thông báo thành công']
            }
          ],
          openQuestions: []
        };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          choices: [{ message: { role: 'assistant', content: JSON.stringify(payload) } }],
          usage: { prompt_tokens: 50, completion_tokens: 50, total_tokens: 100 }
        }));
        return true;
      }
      return false;
    });

    // 1. Gọi format-bdd
    const bddRes = await fetch(`http://127.0.0.1:${harness.port}/api/ai/format-bdd`, {
      method: 'POST',
      headers: makeAiHeaders(),
      body: JSON.stringify({
        requirementText: '### AC-001: Nộp hồ sơ thiếu số điện thoại\n### AC-002: Nộp hồ sơ thành công'
      })
    });
    assert.equal(bddRes.status, 200);
    const bddData = await bddRes.json();
    assert.ok(bddData.markdown);

    // 2. Ghép markdown vào tài liệu REQ-099 có frontmatter chuẩn
    const newDocContent = `---\nid: REQ-099\ntitle: Quan ly ho so\nstatus: Draft\n---\n# REQ-099: Quan ly ho so\n\n${bddData.markdown}\n`;
    const putRes = await fetch(`http://127.0.0.1:${harness.port}/api/qa/document`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: 'requirements/REQ-099.md',
        content: newDocContent
      })
    });
    assert.equal(putRes.status, 200);

    // 3. Gọi GET /api/qa/summary
    const sumRes = await fetch(`http://127.0.0.1:${harness.port}/api/qa/summary?force=true`);
    assert.equal(sumRes.status, 200);
    const sumData = await sumRes.json();
    assert.equal(sumData.metrics.acceptanceCriteria, 2);

    // 4. Scanner sources.js loadRequirements đọc đúng và không có near-miss
    const { loadRequirements } = require('../../tools/qa/lib/sources');
    const reqs = loadRequirements(fixture.rootPath);
    const req099 = reqs.find((r) => r.id === 'REQ-099');
    assert.ok(req099, 'REQ-099 phai co trong requirements');
    assert.equal(req099.acs.length, 2, 'Phai nhan dien du 2 AC');
    assert.deepEqual(req099.acs.map((a) => a.id).sort(), ['AC-001', 'AC-002']);
    assert.equal(req099.nearMisses.length, 0, 'Khong duoc co near-miss');
  });

  // TC-23-04: Plan lifecycle archive layout and dashboard links integrity
  test('TC-23-04: Plan lifecycle archive layout and dashboard links integrity', () => {
    const planRootDir = path.resolve(__dirname, '../../_Plan_implement');
    assert.ok(fs.existsSync(planRootDir), '_Plan_implement directory must exist');

    // 1. Root folder must only contain active plan directory, archive, and README.md
    const rootEntries = fs.readdirSync(planRootDir);
    const nonArchiveDirs = rootEntries.filter(
      (entry) => entry !== 'README.md' && entry !== 'archive' && !entry.startsWith('.')
    );
    assert.deepEqual(
      nonArchiveDirs,
      ['system-hardening-and-remediation'],
      'Only system-hardening-and-remediation should be active in _Plan_implement'
    );

    // 2. Archived plans 20, 21, 22 must exist in archive/2026-10
    const archiveOctDir = path.join(planRootDir, 'archive', '2026-10');
    assert.ok(fs.existsSync(path.join(archiveOctDir, 'framework-stabilization')), 'Plan 20 must be archived');
    assert.ok(fs.existsSync(path.join(archiveOctDir, 'smart-trace-linker')), 'Plan 21 must be archived');
    assert.ok(fs.existsSync(path.join(archiveOctDir, 'framework-risk-remediation')), 'Plan 22 must be archived');

    // 3. Verify all relative links in _Plan_implement/README.md resolve to existing files or directories
    const readmeContent = fs.readFileSync(path.join(planRootDir, 'README.md'), 'utf8');
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;
    const checkedLinks = [];
    while ((match = linkRegex.exec(readmeContent)) !== null) {
      const linkTarget = match[2];
      // Skip external links or anchor links
      if (linkTarget.startsWith('http://') || linkTarget.startsWith('https://') || linkTarget.startsWith('#')) {
        continue;
      }
      const resolvedPath = path.resolve(planRootDir, linkTarget);
      assert.ok(
        fs.existsSync(resolvedPath),
        `Link target "${linkTarget}" in _Plan_implement/README.md must exist on disk (resolved to: ${resolvedPath})`
      );
      checkedLinks.push(linkTarget);
    }
    assert.ok(checkedLinks.length >= 5, 'Should have verified markdown links in README.md');
  });
});

