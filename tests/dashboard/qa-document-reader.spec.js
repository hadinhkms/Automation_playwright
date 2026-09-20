/**
 * tests/dashboard/qa-document-reader.spec.js
 * Trình đọc tài liệu của mục QA: mở được file .md, và KHÔNG mở đường cho script chạy.
 *
 * Tài liệu requirement do dự án tự viết, thường dán từ Confluence, nên hoàn toàn có thể
 * chứa thẻ HTML. Dashboard lại có endpoint ghi file, nên một lỗ XSS ở đây không dừng ở
 * "hiện sai": nó là đường chạy mã với toàn quyền của dashboard. Vì vậy phần lớn bài test
 * dưới đây là bài tấn công, không phải bài hiển thị.
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { startDashboardHarness } = require('./support/dashboardHarness');
const { createFixtureWorkspace } = require('./support/fixtureWorkspace');

const NL = String.fromCharCode(10);

const REQ_DOC = [
  '---',
  'id: REQ-001',
  'title: Đăng nhập hệ thống',
  'status: Draft',
  'risk: High',
  '---',
  '',
  '# REQ-001: Đăng nhập',
  '',
  'Người dùng đăng nhập bằng email. Xem thêm AC-001 và TC-001.',
  '',
  '## Acceptance criteria',
  '',
  '- AC-001: Given hợp lệ, Then vào được.',
  '- AC-002: Given sai mật khẩu, Then báo lỗi chung.',
  '',
  '## Open questions',
  '',
  '1. Số điện thoại có bắt buộc không? — cần PO xác nhận',
  '2. Quy tắc mật khẩu? — cần PO xác nhận',
  '',
  '| Mã | Mô tả | Ưu tiên |',
  '| --- | --- | --- |',
  '| AC-001 | đăng nhập đúng | P0 |',
  '| AC-002 | sai mật khẩu | P1 |',
  '',
  '```js',
  'const x = 1;',
  '```',
  '',
  '> Ghi chú: chưa chốt với PO.',
  '',
  'Đoạn có `mã nội dòng`, **đậm** và *nghiêng*.',
  '',
].join(NL);

const TC_DOC = [
  '# Test Cases: REQ-001',
  '',
  '| Requirement | Acceptance criterion | Test case | Automation | Spec | Priority |',
  '|---|---|---|---|---|---|',
  '| REQ-001 | AC-001 | TC-001 | Yes | x | P0 |',
  '| REQ-001 | AC-002 | TC-002 | Candidate | - | P1 |',
  '',
  '### TC-002: Báo lỗi chung khi sai mật khẩu',
  '',
  '- Priority: P1',
  '- Tags: `@p1`',
  '- Preconditions: Đang ở trang đăng nhập, chưa đăng nhập',
  '',
  '| Step | Action | Expected result |',
  '|---|---|---|',
  '| 1 | Nhập email đúng, mật khẩu sai | Form nhận được dữ liệu |',
  '| 2 | Bấm Đăng nhập | Hiện lỗi chung, không tiết lộ email có tồn tại hay không |',
  '',
].join(NL);

// Mọi cách nhét mã thực thi mà một tài liệu Markdown có thể mang theo.
const HOSTILE_DOC = [
  '# Tài liệu độc hại',
  '',
  '<script>window.__QA_XSS__ = true;</script>',
  '',
  '<img src=x onerror="window.__QA_XSS_IMG__ = true">',
  '',
  '<iframe src="javascript:window.__QA_XSS_FRAME__=true"></iframe>',
  '',
  '[bấm vào đây](javascript:window.__QA_XSS_LINK__=true)',
  '',
  '[liên kết thật](https://example.com/an-toan)',
  '',
  '<div onclick="window.__QA_XSS_DIV__=true">nội dung</div>',
  '',
].join(NL);

const SPEC = [
  "const { test, expect } = require('@playwright/test');",
  "test.describe('Đăng nhập @REQ-001', () => {",
  "  test('TC-001 - AC-001 ok @smoke', async () => { expect(1).toBe(1); });",
  '});',
  '',
].join(NL);

function seedDocs(root) {
  const write = (rel, content) => {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, 'utf8');
  };
  write('requirements/REQ-001-dang-nhap.md', REQ_DOC);
  write('requirements/REQ-999-doc-hai.md', HOSTILE_DOC);
  write('test-cases/REQ-001.md', TC_DOC);
  write('tests/e2e/login.spec.js', SPEC);
}

async function openQa(page, url) {
  await page.addInitScript(() => {
    try { localStorage.setItem('playwright-dashboard-theme', 'dark'); } catch (_) { /* ignore */ }
  });
  await page.goto(url);
  await page.waitForSelector('.shell');
  await page.waitForFunction(() => Boolean(window.__STUDIO_CORE__));
  await page.evaluate(() => window.__STUDIO_CORE__.featureRegistry.switchView('qa-view'));
  await page.waitForSelector('#qa-docs-list .qa-doc-item');
}

const openDoc = async (page, name) => {
  await page.locator('#qa-docs-list .qa-doc-item', { hasText: name }).first().click();
  await page.waitForFunction(() => {
    const b = document.querySelector('#qa-reader-body');
    return b && b.children.length > 0 && !b.querySelector('.qa-reader-loading');
  });
};

test.describe('QA: đọc tài liệu requirement/test-case', () => {
  let fixture;
  let harness;

  test.beforeAll(async () => {
    fixture = createFixtureWorkspace();
    seedDocs(fixture.rootPath);
    harness = await startDashboardHarness(fixture.rootPath);
  });

  test.afterAll(async () => {
    if (harness) await harness.stop();
    if (fixture) fixture.cleanup();
  });

  test('danh sách bên trái gom đúng nhóm và hiện mã của từng file', async ({ page }) => {
    await openQa(page, harness.url);

    const shape = await page.evaluate(() => ({
      groups: [...document.querySelectorAll('#qa-docs-group, .qa-docs-group')].map((g) => g.textContent),
      items: [...document.querySelectorAll('#qa-docs-list .qa-doc-item')].map((b) => ({
        name: b.querySelector('.qa-doc-item-name').textContent,
        ids: (b.querySelector('.qa-doc-item-ids') || {}).textContent || '',
      })),
    }));

    expect(shape.groups.join(' ')).toContain('Requirement');
    expect(shape.groups.join(' ')).toContain('Test case');
    expect(shape.items.length).toBe(3);
    expect(shape.items.find((i) => i.name.includes('REQ-001-dang-nhap')).ids).toContain('REQ-001');
  });

  test('mở tài liệu: frontmatter thành dải thông tin, thân bài dựng đúng khối', async ({ page }) => {
    await openQa(page, harness.url);
    await openDoc(page, 'REQ-001-dang-nhap.md');

    const state = await page.evaluate(() => {
      const body = document.querySelector('#qa-reader-body');
      const meta = document.querySelector('#qa-reader-meta');
      const metaText = [...meta.children].map((c) => c.textContent);
      return {
        title: document.querySelector('#qa-reader-title').textContent,
        path: document.querySelector('#qa-reader-path').textContent,
        metaText,
        headings: body.querySelectorAll('.qa-md-h').length,
        lists: body.querySelectorAll('.qa-md-list').length,
        tables: body.querySelectorAll('.qa-md-table').length,
        tableHeaders: [...body.querySelectorAll('.qa-md-table th')].map((t) => t.textContent),
        pre: body.querySelectorAll('.qa-md-pre').length,
        quote: body.querySelectorAll('.qa-md-quote').length,
        code: body.querySelectorAll('.qa-md-code').length,
        strong: body.querySelectorAll('strong').length,
        em: body.querySelectorAll('em').length,
        traces: [...body.querySelectorAll('.qa-md-trace')].map((t) => t.textContent),
        // Frontmatter KHÔNG được lọt xuống thân bài.
        bodyText: body.textContent,
      };
    });

    expect(state.title, 'tiêu đề lấy từ frontmatter, không phải tên file').toBe('Đăng nhập hệ thống');
    expect(state.path).toContain('requirements/REQ-001-dang-nhap.md');
    expect(state.metaText).toContain('status');
    expect(state.metaText).toContain('Draft');
    expect(state.metaText, 'title đã lên tiêu đề nên không lặp ở dải meta').not.toContain('title');

    expect(state.headings).toBeGreaterThanOrEqual(2);
    expect(state.lists).toBeGreaterThanOrEqual(1);
    expect(state.tables).toBe(1);
    expect(state.tableHeaders).toEqual(['Mã', 'Mô tả', 'Ưu tiên']);
    expect(state.pre).toBe(1);
    expect(state.quote).toBe(1);
    expect(state.code).toBeGreaterThanOrEqual(1);
    expect(state.strong).toBeGreaterThanOrEqual(1);
    expect(state.em).toBeGreaterThanOrEqual(1);
    expect(state.traces).toContain('AC-001');
    expect(state.bodyText, 'frontmatter phải bị cắt khỏi thân bài').not.toContain('risk: High');
  });

  test('chip AC cho biết tiêu chí nào đã có test case', async ({ page }) => {
    await openQa(page, harness.url);
    await openDoc(page, 'REQ-001-dang-nhap.md');

    const chips = await page.evaluate(() => [...document.querySelectorAll('#qa-reader-chips .qa-chip')]
      .map((c) => ({ text: c.textContent, covered: c.classList.contains('qa-chip-covered') })));

    expect(chips.length).toBe(2);
    expect(chips.every((c) => c.covered), 'cả AC-001 và AC-002 đều có TC trong tài liệu').toBe(true);
  });

  test('TÀI LIỆU ĐỘC HẠI: không thẻ script/iframe nào được tạo, không biến toàn cục nào bị đặt', async ({ page }) => {
    await openQa(page, harness.url);
    await openDoc(page, 'REQ-999-doc-hai.md');

    const probe = await page.evaluate(() => {
      const body = document.querySelector('#qa-reader-body');
      return {
        scripts: body.querySelectorAll('script').length,
        iframes: body.querySelectorAll('iframe').length,
        imgs: body.querySelectorAll('img').length,
        divs: body.querySelectorAll('div').length,
        // Thẻ nguyên văn phải nằm trong text, không phải trong cây DOM.
        textHasScriptTag: body.textContent.includes('<script>'),
        anchors: [...body.querySelectorAll('a')].map((a) => a.getAttribute('href')),
        globals: {
          xss: window.__QA_XSS__,
          img: window.__QA_XSS_IMG__,
          frame: window.__QA_XSS_FRAME__,
          link: window.__QA_XSS_LINK__,
          div: window.__QA_XSS_DIV__,
        },
      };
    });

    expect(probe.scripts, '<script> trong tài liệu không được thành thẻ thật').toBe(0);
    expect(probe.iframes).toBe(0);
    expect(probe.imgs).toBe(0);
    expect(probe.divs, 'không thẻ HTML thô nào được dựng từ nội dung').toBe(0);
    expect(probe.textHasScriptTag, 'phải hiện nguyên văn để người đọc thấy').toBe(true);
    expect(Object.values(probe.globals).every((v) => v === undefined)).toBe(true);
  });

  test('liên kết javascript: bị khử, liên kết https vẫn dùng được', async ({ page }) => {
    await openQa(page, harness.url);
    await openDoc(page, 'REQ-999-doc-hai.md');

    const anchors = await page.evaluate(() => [...document.querySelectorAll('#qa-reader-body a')]
      .map((a) => ({ href: a.getAttribute('href'), rel: a.getAttribute('rel'), target: a.getAttribute('target') })));

    expect(anchors.length, 'chỉ liên kết https được dựng thành <a>').toBe(1);
    expect(anchors[0].href).toBe('https://example.com/an-toan');
    expect(anchors[0].rel, 'chống tabnabbing').toContain('noopener');
    expect(anchors[0].target).toBe('_blank');

    const bodyText = await page.evaluate(() => document.querySelector('#qa-reader-body').textContent);
    expect(bodyText, 'liên kết javascript: vẫn hiện nguyên văn, chỉ không bấm được')
      .toContain('javascript:window.__QA_XSS_LINK__');
  });

  test('API từ chối mọi đường dẫn ngoài danh sách tài liệu', async ({ page }) => {
    await page.goto(harness.url);
    const results = await page.evaluate(async () => {
      const paths = [
        '../../../../Windows/win.ini',
        'requirements/../../package.json',
        'tests/e2e/login.spec.js',
        'core/config/dashboardConfig.json',
        '',
      ];
      const out = [];
      for (const p of paths) {
        const res = await fetch(`/api/qa/document?path=${encodeURIComponent(p)}`);
        out.push({ p, status: res.status });
      }
      return out;
    });

    for (const r of results) {
      expect(r.status, `${r.p} phải bị từ chối`).toBeGreaterThanOrEqual(400);
    }
  });

  test('quay lại Tổng quan và mở file từ bảng', async ({ page }) => {
    await openQa(page, harness.url);
    await openDoc(page, 'REQ-001-dang-nhap.md');

    await page.click('#qa-reader-back');
    await expect(page.locator('#qa-reader-overview')).toBeVisible();
    await expect(page.locator('#qa-reader-doc')).toBeHidden();

    // Ô "File" trong bảng tổng quan cũng phải mở được tài liệu.
    await page.locator('#qa-docs-tbody .qa-file-link').first().click();
    await page.waitForFunction(() => !document.querySelector('#qa-reader-doc').hidden);
    await expect(page.locator('#qa-reader-title')).toHaveText('Đăng nhập hệ thống');
  });

  test('trả lời câu hỏi treo: ghi thật vào tài liệu, chỉ đụng đúng dòng đó', async ({ page }) => {
    const docPath = path.join(fixture.rootPath, 'requirements', 'REQ-001-dang-nhap.md');
    const before = fs.readFileSync(docPath, 'utf8').split(NL);

    await openQa(page, harness.url);
    await openDoc(page, 'REQ-001-dang-nhap.md');

    await expect(page.locator('#qa-reader-answer-label')).toHaveText('Trả lời câu hỏi (2)');
    await page.click('#qa-reader-answer');
    await page.waitForSelector('#qa-reader-form .qa-question');

    await page.locator('#qa-reader-form textarea').first().fill('Bắt buộc.');
    await page.locator('#qa-reader-form .qa-form-by input').fill('Hà');
    await page.click('#qa-reader-form .btn-primary-sm');
    await page.waitForSelector('#qa-reader-form', { state: 'hidden' });

    const after = fs.readFileSync(docPath, 'utf8').split(NL);
    const changed = after.map((l, i) => (l === before[i] ? null : i)).filter((i) => i !== null);
    expect(changed.length, 'chỉ được sửa đúng một dòng').toBe(1);
    expect(after[changed[0]]).toContain('**Đã chốt (Hà');
    expect(after[changed[0]]).toContain('Bắt buộc.');
    expect(after[changed[0]], 'đuôi "cần PO xác nhận" phải được THAY, không phải nối thêm')
      .not.toContain('cần PO xác nhận');
    expect(after.length).toBe(before.length);

    // Đã tạo bản sao lưu trước khi ghi.
    const backups = fs.existsSync(path.join(fixture.rootPath, '.dashboard-backups'));
    expect(backups, 'phải sao lưu trước khi ghi đè').toBe(true);

    // Sau khi lưu, số câu hỏi treo giảm còn 1.
    await openDoc(page, 'REQ-001-dang-nhap.md');
    await expect(page.locator('#qa-reader-answer-label')).toHaveText('Trả lời câu hỏi (1)');
  });

  test('tài liệu test-case KHÔNG cho sửa — nút ẩn và API từ chối', async ({ page }) => {
    await openQa(page, harness.url);
    await page.locator('#qa-docs-list .qa-doc-item', { hasText: 'REQ-001.md' }).last().click();
    await page.waitForFunction(() => document.querySelector('#qa-reader-body').children.length > 0);

    await expect(page.locator('#qa-reader-edit')).toBeHidden();
    await expect(page.locator('#qa-reader-answer')).toBeHidden();

    const res = await page.evaluate(async () => {
      const r = await fetch('/api/qa/document', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: 'test-cases/REQ-001.md', content: '# bị ghi đè' }),
      });
      return { status: r.status, body: await r.json() };
    });
    expect(res.status, 'test-cases/ phải là chỉ đọc').toBe(403);
    expect(res.body.error).toContain('chỉ đọc');
  });

  test('tài liệu đã đổi trên đĩa thì từ chối ghi đè', async ({ page }) => {
    await page.goto(harness.url);
    const res = await page.evaluate(async () => {
      const r = await fetch('/api/qa/document', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: 'requirements/REQ-999-doc-hai.md',
          content: '# nội dung mới',
          expectedBytes: 999999,
        }),
      });
      return { status: r.status, body: await r.json() };
    });
    expect(res.status).toBe(409);
    expect(res.body.error).toContain('đã thay đổi');
  });

  test('mục lục dựng từ tiêu đề thật và nhảy được', async ({ page }) => {
    // Mục lục chỉ hiện từ 1400px trở lên; hẹp hơn thì bề ngang dành cho thân bài.
    await page.setViewportSize({ width: 1600, height: 1000 });
    await openQa(page, harness.url);
    await openDoc(page, 'REQ-001-dang-nhap.md');

    const links = page.locator('#qa-reader-outline .qa-outline-link');
    const count = await links.count();
    expect(count, 'phải có mục lục khi tài liệu đủ dài').toBeGreaterThanOrEqual(3);

    const headings = await page.evaluate(() => [...document.querySelectorAll('#qa-reader-body .qa-md-h')].map((h) => h.textContent));
    const outline = await links.allTextContents();
    expect(outline, 'mục lục phải trùng khớp tiêu đề đang hiển thị').toEqual(headings);

    await links.last().click();
    const jump = await page.evaluate(() => {
      const b = document.querySelector('#qa-reader-body');
      return { scrollTop: b.scrollTop, scrollable: b.scrollHeight > b.clientHeight + 1 };
    });
    // Tài liệu ngắn thì không có gì để cuộn — không phải lỗi.
    if (jump.scrollable) expect(jump.scrollTop, 'bấm mục lục phải cuộn tới nơi').toBeGreaterThan(0);

    // Dưới 1400px mục lục phải nhường chỗ cho nội dung.
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.locator('#qa-reader-outline')).toBeHidden();
  });

  test('server cũ thiếu /api/qa/documents: vẫn hiển thị, và chỉ đúng cách sửa', async ({ page }) => {
    // Tình huống thật: tiến trình dashboard khởi động trước khi endpoint ra đời vẫn phục vụ
    // file JS MỚI đọc thẳng từ đĩa, trong khi bảng route của nó là bảng CŨ. Một endpoint
    // thiếu không được làm trắng cả màn hình.
    await page.route('**/api/qa/documents', (route) => route.fulfill({
      status: 404, contentType: 'application/json', body: '{"error":"Endpoint không tồn tại."}',
    }));
    // KHÔNG dùng openQa(): nó chờ danh sách tài liệu, thứ chắc chắn không xuất hiện ở ca này.
    await page.goto(harness.url);
    await page.waitForSelector('.shell');
    await page.waitForFunction(() => Boolean(window.__STUDIO_CORE__));
    await page.evaluate(() => window.__STUDIO_CORE__.featureRegistry.switchView('qa-view'));
    await page.waitForFunction(() => !document.querySelector('#qa-alert').hidden, null, { timeout: 8000 });

    const state = await page.evaluate(() => ({
      alertShown: !document.querySelector('#qa-alert').hidden,
      alertText: (document.querySelector('#qa-alert-text') || {}).textContent,
      isDanger: document.querySelector('#qa-alert').classList.contains('qa-alert-danger'),
      statsShown: !document.querySelector('#qa-stats').hidden,
      overviewRows: document.querySelectorAll('#qa-docs-tbody tr').length,
    }));

    expect(state.alertShown).toBe(true);
    expect(state.isDanger, 'thiếu API là hỏng thật, không phải nhắc mềm').toBe(true);
    expect(state.alertText, 'phải nói rõ cách sửa chứ không chỉ báo lỗi').toContain('khởi động lại dashboard');
    expect(state.statsShown, 'phần lấy được vẫn phải hiển thị').toBe(true);
    expect(state.overviewRows, 'bảng tổng quan vẫn dựng từ /api/qa/trace').toBeGreaterThan(0);
  });

  test('server đủ endpoint thì không hề có cảnh báo suy giảm', async ({ page }) => {
    await openQa(page, harness.url);
    const shown = await page.evaluate(() => ({
      alertShown: !document.querySelector('#qa-alert').hidden,
      text: (document.querySelector('#qa-alert-text') || {}).textContent,
    }));
    expect(shown.text || '').not.toContain('bản cũ hơn giao diện');
  });

  test('không để hố trống giữa thân bài và mục lục ở mọi bề rộng', async ({ page }) => {
    // Cạm bẫy: cho cột là 1fr rồi chặn chữ bằng max-width bên trong. Khi đó phần thừa nằm
    // GIỮA hai cột — từng lên tới 382px — kèm thanh cuộn trôi lơ lửng trong khoảng trống.
    for (const width of [1440, 1900, 2400]) {
      await page.setViewportSize({ width, height: 1000 });
      await openQa(page, harness.url);
      await openDoc(page, 'REQ-001-dang-nhap.md');
      await page.waitForSelector('#qa-reader-body .qa-md-h');

      const box = await page.evaluate(() => {
        const outline = document.querySelector('.qa-reader-outline');
        const heading = document.querySelector('#qa-reader-body .qa-md-h');
        if (!outline || getComputedStyle(outline).display === 'none') return null;
        const main = document.querySelector('.qa-reader-main').getBoundingClientRect();
        return {
          gap: Math.round(outline.getBoundingClientRect().left - heading.getBoundingClientRect().right),
          rightMargin: Math.round(main.right - outline.getBoundingClientRect().right),
        };
      });

      if (!box) continue; // dưới 1400px mục lục ẩn — không có gì để đo
      expect(box.gap, `hố giữa quá rộng ở ${width}px`).toBeLessThan(80);
      // Chốt phụ, ngưỡng thô: chỉ để bắt trường hợp cột bị đặt sai hẳn khiến panel hở
      // cả mảng bên phải. Con số chính xác phụ thuộc độ dài tài liệu (có thanh cuộn hay không).
      expect(box.rightMargin, `viền phải quá rộng ở ${width}px`).toBeLessThan(200);
    }
  });

  test('chọn ứng viên rồi sinh bản thảo BDD', async ({ page }) => {
    await openQa(page, harness.url);
    await page.click('[data-qa-tab="candidates"]');
    await page.waitForSelector('#qa-candidates-tbody tr');

    // Chưa chọn gì thì không cho bấm — tránh gọi API vô nghĩa.
    await expect(page.locator('#qa-btn-draft')).toBeDisabled();

    await page.locator('#qa-candidates-tbody .qa-pick-col input').first().check();
    await expect(page.locator('#qa-btn-draft')).toBeEnabled();
    await expect(page.locator('#qa-btn-draft-label')).toHaveText('Sinh bản thảo BDD (1)');

    await page.click('#qa-btn-draft');
    await page.waitForFunction(() => {
      const b = document.querySelector('#qa-draft-body');
      return b && b.textContent.includes('Kịch bản BDD');
    });

    const draft = await page.evaluate(() => document.querySelector('#qa-draft-body').textContent);
    expect(draft).toContain('Given Tiền điều kiện');
    expect(draft).toContain('When  [1]');
    expect(draft).toContain('Then  [1]');
    expect(draft, 'phải nhắc bản thảo không được lưu').toContain('KHÔNG được lưu lại');
    expect(draft, 'không được bịa locator').not.toContain('getByRole');

    // Bỏ chọn thì đóng bản thảo và về trạng thái ban đầu.
    await page.click('#qa-btn-draft-clear');
    await expect(page.locator('#qa-draft')).toBeHidden();
    await expect(page.locator('#qa-btn-draft')).toBeDisabled();
  });

  test('sinh bản thảo KHÔNG ghi gì vào test-cases/', async ({ page }) => {
    const tcDir = path.join(fixture.rootPath, 'test-cases');
    const snap = () => fs.readdirSync(tcDir)
      .map((f) => `${f}:${fs.readFileSync(path.join(tcDir, f), 'utf8').length}`).sort();
    const before = snap();

    await openQa(page, harness.url);
    await page.click('[data-qa-tab="candidates"]');
    await page.waitForSelector('#qa-candidates-tbody tr');
    await page.locator('#qa-candidates-tbody .qa-pick-col input').first().check();
    await page.click('#qa-btn-draft');
    await page.waitForFunction(() => {
      const b = document.querySelector('#qa-draft-body');
      return b && b.textContent.includes('Kịch bản BDD');
    });

    expect(snap(), 'bản thảo là chỉ đọc').toEqual(before);
  });

  test('ô lọc thu hẹp danh sách theo mã lẫn tên file', async ({ page }) => {
    await openQa(page, harness.url);
    const count = () => page.locator('#qa-docs-list .qa-doc-item').count();
    expect(await count()).toBe(3);

    await page.fill('#qa-docs-filter', 'TC-002');
    expect(await count(), 'lọc theo mã test case').toBe(1);

    await page.fill('#qa-docs-filter', 'doc-hai');
    expect(await count(), 'lọc theo tên file').toBe(1);

    await page.fill('#qa-docs-filter', 'khong-ton-tai-gi-ca');
    expect(await count()).toBe(0);
    await expect(page.locator('#qa-docs-list-empty')).toBeVisible();
  });
});
