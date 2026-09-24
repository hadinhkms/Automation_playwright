// master-process-disable-size-check: Traceability Conflict Studio end-to-end lifecycle suite
/**
 * tests/dashboard/qa-conflict-studio.spec.js
 * Traceability Conflict Studio chạy thật qua UI + server + file trên đĩa (LIFE-01).
 *
 * Phủ: hiển thị gom nhóm, ngữ cảnh BA, hai chiều đồng bộ, trọng tài, ghi sổ quyết định,
 * lỗi 409 không làm hỏng file, chống double-click (ASYNC-01), vòng đời listener (OWN),
 * và bố cục ở 4 viewport × 2 theme.
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { startDashboardHarness } = require('./support/dashboardHarness');
const { createFixtureWorkspace } = require('./support/fixtureWorkspace');

const NL = String.fromCharCode(10);
const SHOTS = process.env.CONFLICT_STUDIO_SHOTS || '';

const REQ_DOC = [
  '# REQ-001: Đăng nhập',
  '',
  '- AC-001: Given người dùng hợp lệ, When đăng nhập, Then vào trang chủ.',
  '- AC-002: Given sai mật khẩu, When đăng nhập, Then hiện lỗi chung.',
  '- AC-003: Given chưa đăng nhập, When mở trang riêng, Then bị chặn.',
  '',
].join(NL);

const TC_DOC = [
  '# Test Cases: REQ-001',
  '',
  '| Requirement | Acceptance criterion | Test case | Automation | Priority |',
  '|---|---|---|---|---|',
  '| REQ-001 | AC-003 | TC-011 | Yes | P1 |',
  '| REQ-001 | AC-001 | TC-012 | Yes | P1 |',
  '| REQ-001 | AC-003 | TC-013 | Yes | P1 |',
  '| REQ-001 | AC-001 | TC-021 | Yes | P1 |',
  '| REQ-001 | AC-003 | TC-031, TC-032 | Yes | P2 |',
  '',
  '### TC-011: Báo lỗi khi sai mật khẩu',
  '',
  '| Step | Action | Expected result |',
  '|---|---|---|',
  '| 1 | Nhập mật khẩu sai | Hiện lỗi chung |',
  '',
].join(NL);

const specOf = (lines) => ["const { test, expect } = require('@playwright/test');", ...lines, ''].join(NL);
const LOGIN_SPEC = specOf([
  "test('TC-011 @AC-002 báo lỗi sai mật khẩu', async ({ page }) => {",
  "  await expect(page.getByRole('alert')).toBeVisible();",
  '});',
  "test('TC-012 @AC-001 @AC-002 đăng nhập', async () => { expect(1).toBe(1); });",
  "test('TC-013 @AC-001 chặn trang riêng', async () => { expect(1).toBe(1); });",
]);
const ACCOUNT_SPEC = specOf(["test('TC-021 @AC-002 tài khoản', async () => { expect(1).toBe(1); });"]);
const GUARD_SPEC = specOf(["test('TC-031 @AC-001 bảo vệ', async () => { expect(1).toBe(1); });"]);

function seed(root) {
  const write = (rel, content) => {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf8');
  };
  write('requirements/REQ-001.md', REQ_DOC);
  write('test-cases/REQ-001.md', TC_DOC);
  write('tests/e2e/login.spec.js', LOGIN_SPEC);
  write('tests/e2e/account.spec.js', ACCOUNT_SPEC);
  write('tests/e2e/guard.spec.js', GUARD_SPEC);
  const dec = path.join(root, 'decisions.json');
  if (fs.existsSync(dec)) fs.unlinkSync(dec);
}

const read = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8');

async function openFindings(page, url, theme = 'dark') {
  await page.addInitScript((t) => {
    try { localStorage.setItem('playwright-dashboard-theme', t); } catch (_) { /* ignore */ }
  }, theme);
  await page.goto(url);
  await page.waitForSelector('.shell');
  await page.waitForFunction(() => Boolean(window.__STUDIO_CORE__));
  await page.evaluate(() => window.__STUDIO_CORE__.featureRegistry.switchView('qa-view'));
  await page.locator('[data-qa-tab="findings"]').click();
  await expect(page.locator('.qa-conflict-studio')).toBeVisible();
}

const card = (page, tc) => page.locator('.qa-conflict-card', { has: page.locator('.qa-conflict-tc', { hasText: new RegExp(`^${tc}$`) }) });
const openGroup = async (page, file) => {
  const group = page.locator('details.qa-conflict-group', { hasText: file });
  if (!(await group.evaluate((d) => d.open))) await group.locator('summary').click();
};

test.describe('QA: Traceability Conflict Studio', () => {
  let fixture;
  let harness;
  let consoleErrors;

  test.beforeAll(async () => {
    fixture = createFixtureWorkspace();
    harness = await startDashboardHarness(fixture.rootPath);
  });

  test.afterAll(async () => {
    if (harness) await harness.stop();
    if (fixture) fixture.cleanup();
  });

  test.beforeEach(async ({ page }) => {
    seed(fixture.rootPath);
    consoleErrors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', (err) => consoleErrors.push(err.message));
    // Lỗi tải tài nguyên được kiểm theo URL ở đây, vì message console của Chromium không có URL.
    page.on('response', (res) => {
      if (res.status() < 400) return;
      // Fixture workspace không có tools/visual_compare.html (iframe của tab Compare) — không thuộc studio.
      if (res.url().endsWith('/tools/visual_compare.html')) return;
      // 409 là phản hồi hợp đồng mà test "không tự sửa được" cố ý gây ra.
      if (res.status() === 409 && res.url().includes('/api/qa/conflict/')) return;
      consoleErrors.push(`${res.status()} ${res.url()}`);
    });
  });

  test.afterEach(async () => {
    const unexpected = consoleErrors.filter((e) => !/^Failed to load resource/.test(e));
    expect(unexpected, unexpected.join('\n')).toEqual([]);
  });

  test('gom nhóm theo spec, nhóm đầu mở, đánh dấu đúng AC lệch, không rò chữ thô', async ({ page }) => {
    await openFindings(page, harness.url);
    const studio = page.locator('.qa-conflict-studio');
    await expect(studio.locator('.qa-conflict-count')).toHaveText('5 xung đột · 3 spec');
    const groups = studio.locator('details.qa-conflict-group');
    await expect(groups).toHaveCount(3);
    expect(await groups.evaluateAll((ds) => ds.map((d) => d.open))).toEqual([true, false, false]);

    await openGroup(page, 'tests/e2e/login.spec.js');
    const tc12 = card(page, 'TC-012');
    await expect(tc12.locator('.qa-conflict-pill.is-spec.is-diff')).toHaveText(['AC-002']);
    await expect(tc12.locator('.qa-conflict-pill.is-spec:not(.is-diff)')).toHaveText(['AC-001']);
    await expect(tc12.getByRole('button', { name: /Tài liệu theo Spec → AC-001, AC-002/ })).toBeVisible();

    // Nhóm này không còn hiện dạng bullet thô
    await expect(page.locator('.qa-finding-kind', { hasText: 'Tài liệu và spec nói khác nhau' })).toHaveCount(0);
    const text = await studio.innerText();
    expect(text).not.toMatch(/\bundefined\b|\bnull\b|TODO|\[object Object\]/);

    await studio.getByRole('button', { name: 'Mở tất cả' }).click();
    expect(await groups.evaluateAll((ds) => ds.every((d) => d.open))).toBe(true);
  });

  test('xem ngữ cảnh: code test, dòng tài liệu, bước và định nghĩa AC', async ({ page }) => {
    await openFindings(page, harness.url);
    await openGroup(page, 'tests/e2e/login.spec.js');
    const c = card(page, 'TC-011');
    const toggle = c.getByRole('button', { name: 'Xem ngữ cảnh' });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const ctx = c.locator('.qa-conflict-context');
    await expect(ctx.locator('.qa-conflict-code')).toContainText("toBeVisible()");
    await expect(ctx.locator('.qa-conflict-chip', { hasText: 'Có assertion' })).toBeVisible();
    await expect(ctx.locator('.qa-conflict-doc-line').first()).toContainText('test-cases/REQ-001.md:5');
    await expect(ctx.locator('.qa-conflict-steps')).toContainText('Nhập mật khẩu sai');
    await expect(ctx.locator('.qa-conflict-def', { hasText: 'AC-002 · chỉ spec' })).toContainText('sai mật khẩu');
    await toggle.click();
    await expect(ctx).toBeHidden();
  });

  test('tài liệu theo spec: ghi đủ tập AC, thẻ biến mất, có backup; khóa toàn studio khi đang ghi', async ({ page }) => {
    await openFindings(page, harness.url);
    let calls = 0;
    await page.route('**/api/qa/conflict/resolve', async (route) => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 600));
      await route.continue();
    });
    await openGroup(page, 'tests/e2e/login.spec.js');
    const btn = card(page, 'TC-012').getByRole('button', { name: /Tài liệu theo Spec/ });
    await btn.click();
    await btn.click({ force: true }).catch(() => {});
    // ASYNC-01: mọi nút hành động của studio đều bị khóa trong lúc chờ
    const enabled = await page.locator('.qa-conflict-studio [data-conflict-action]:not(:disabled)').count();
    expect(enabled).toBe(0);

    await expect(card(page, 'TC-012')).toHaveCount(0);
    expect(calls).toBe(1);
    expect(read(fixture.rootPath, 'test-cases/REQ-001.md')).toContain('| REQ-001 | AC-001, AC-002 | TC-012 |');
    expect(fs.existsSync(path.join(fixture.rootPath, '.dashboard-backups'))).toBe(true);
    await expect(page.locator('.qa-conflict-count')).toHaveText('4 xung đột · 3 spec');
  });

  test('spec theo tài liệu: sửa tag trong tiêu đề test', async ({ page }) => {
    await openFindings(page, harness.url);
    await openGroup(page, 'tests/e2e/account.spec.js');
    await card(page, 'TC-021').getByRole('button', { name: /Spec theo Tài liệu → AC-001/ }).click();
    await expect(card(page, 'TC-021')).toHaveCount(0);
    expect(read(fixture.rootPath, 'tests/e2e/account.spec.js')).toContain("test('TC-021 @AC-001 tài khoản'");
  });

  test('trọng tài: hiện phán quyết có căn cứ và áp dụng được', async ({ page }) => {
    await openFindings(page, harness.url);
    await openGroup(page, 'tests/e2e/login.spec.js');
    const c = card(page, 'TC-011');
    await c.getByRole('button', { name: 'Trọng tài AI' }).click();
    const verdict = c.locator('.qa-conflict-verdict');
    await expect(verdict).toContainText('Đề xuất:');
    await expect(verdict).toContainText(/Độ tin cậy \d+%/);
    await expect(verdict.locator('.qa-conflict-verdict-reason')).not.toBeEmpty();
    await verdict.getByRole('button', { name: 'Áp dụng đề xuất' }).click();
    await expect(card(page, 'TC-011')).toHaveCount(0);
  });

  test('ghi sổ quyết định: thẻ gắn nhãn, nút khóa, không tạo trùng', async ({ page }) => {
    await openFindings(page, harness.url);
    await openGroup(page, 'tests/e2e/login.spec.js');
    await card(page, 'TC-013').getByRole('button', { name: 'Ghi sổ quyết định' }).click();
    const c = card(page, 'TC-013');
    await expect(c.locator('.qa-conflict-chip', { hasText: /^Đã ghi sổ D-\d+$/ })).toBeVisible();
    await expect(c.getByRole('button', { name: /Đã ghi sổ D-/ })).toBeDisabled();
    // Gỡ busy ở thao tác khác không được mở khóa nút đã ghi sổ
    await c.getByRole('button', { name: 'Xem ngữ cảnh' }).click();
    await expect(c.getByRole('button', { name: /Đã ghi sổ D-/ })).toBeDisabled();
    const saved = JSON.parse(read(fixture.rootPath, 'decisions.json'));
    expect(saved.decisions.filter((d) => d.source && d.source.tcId === 'TC-013')).toHaveLength(1);
  });

  test('không tự sửa được thì báo lỗi ngay trên thẻ và file giữ nguyên', async ({ page }) => {
    await openFindings(page, harness.url);
    await openGroup(page, 'tests/e2e/guard.spec.js');
    const before = read(fixture.rootPath, 'test-cases/REQ-001.md');
    const c = card(page, 'TC-031');
    await c.getByRole('button', { name: /Tài liệu theo Spec/ }).click();
    await expect(c.locator('.qa-conflict-feedback.is-error')).toContainText('TC-032');
    expect(read(fixture.rootPath, 'test-cases/REQ-001.md')).toBe(before);
    await expect(c.getByRole('button', { name: /Tài liệu theo Spec/ })).toBeEnabled();
  });

  test('OWN: 20 lượt làm mới không nhân listener; hết xung đột thì xả sạch', async ({ page }) => {
    await openFindings(page, harness.url);
    const count = () => page.evaluate(async () => {
      const { qaSlice } = await import('/js/views/qa/qaSlice.js');
      return qaSlice.conflictStudio.disposers.length;
    });
    const baseline = await count();
    expect(baseline).toBeGreaterThan(0);
    for (let i = 0; i < 20; i += 1) {
      await page.evaluate(async () => {
        const { qaSlice } = await import('/js/views/qa/qaSlice.js');
        await qaSlice.reload();
      });
    }
    expect(await count()).toBe(baseline);

    // Xóa hết xung đột trên đĩa rồi làm mới: studio biến mất và không còn listener nào
    fs.writeFileSync(path.join(fixture.rootPath, 'tests/e2e/login.spec.js'), specOf([]), 'utf8');
    fs.writeFileSync(path.join(fixture.rootPath, 'tests/e2e/account.spec.js'), specOf([]), 'utf8');
    fs.writeFileSync(path.join(fixture.rootPath, 'tests/e2e/guard.spec.js'), specOf([]), 'utf8');
    await page.evaluate(async () => {
      const { qaSlice } = await import('/js/views/qa/qaSlice.js');
      await qaSlice.reload();
    });
    await expect(page.locator('.qa-conflict-studio')).toHaveCount(0);
    expect(await count()).toBe(0);
  });

  for (const theme of ['dark', 'light']) {
    for (const [w, h] of [[1920, 1080], [1440, 900], [1280, 800], [390, 844]]) {
      test(`bố cục ${w}x${h} ${theme}: không tràn ngang, chữ không bị cắt`, async ({ page }) => {
        await page.setViewportSize({ width: w, height: h });
        await openFindings(page, harness.url, theme);
        await page.locator('.qa-conflict-studio').getByRole('button', { name: 'Mở tất cả' }).click();
        await card(page, 'TC-011').getByRole('button', { name: 'Xem ngữ cảnh' }).click();
        await expect(card(page, 'TC-011').locator('.qa-conflict-code')).toBeVisible();

        const overflow = await page.evaluate(() => {
          const studio = document.querySelector('.qa-conflict-studio');
          const bad = [...studio.querySelectorAll('*')].filter((el) => {
            if (el.closest('.qa-conflict-code')) return false; // khối code được phép cuộn ngang
            return el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX === 'visible' && el.clientWidth > 0;
          }).map((el) => el.className);
          return { studio: studio.scrollWidth - studio.clientWidth, doc: document.documentElement.scrollWidth - window.innerWidth, bad };
        });
        expect(overflow.studio).toBeLessThanOrEqual(1);
        expect(overflow.doc).toBeLessThanOrEqual(1);
        expect(overflow.bad).toEqual([]);

        if (SHOTS) {
          await page.locator('.qa-conflict-studio').screenshot({ path: path.join(SHOTS, `studio-${w}-${theme}.png`) });
        }
      });
    }
  }
});
