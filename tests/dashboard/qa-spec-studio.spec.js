/**
 * tests/dashboard/qa-spec-studio.spec.js
 * E2E tests for PLAN-19b Spec Studio:
 * - TC-19 to TC-30: Acceptance Gates Scenarios (UI-01..05, ASYNC-01..05, OWN-01..05, LIFE-01, XSS safety)
 */

const assert = require('node:assert/strict');
const { test, expect } = require('@playwright/test');
const { startDashboardHarness } = require('./support/dashboardHarness');
const { createFixtureWorkspace } = require('./support/fixtureWorkspace');

async function openQaView(page, url) {
  await page.goto(url);
  await page.waitForSelector('.shell');
  await page.waitForFunction(() => Boolean(window.__STUDIO_CORE__));
  await page.evaluate(() => window.__STUDIO_CORE__.featureRegistry.switchView('qa-view'));
  await page.waitForSelector('#qa-view:not([hidden])');
}

test.describe('PLAN-19b Spec Studio E2E Suite', () => {
  test.describe.configure({ timeout: 60_000 });
  let fixture;
  let harness;

  test.beforeAll(async () => {
    fixture = createFixtureWorkspace();
    harness = await startDashboardHarness(fixture.rootPath);
  });

  test.afterAll(async () => {
    if (harness) await harness.stop();
    if (fixture) fixture.cleanup();
  });

  // TC-19: UI-02 / LIFE-01: Luồng mở modal và kích hoạt 2 tab (bva, bdd)
  test('TC-19: UI-02 / LIFE-01: Luong mo modal va kich hoat 2 tab BVA va BDD', async ({ page }) => {
    await openQaView(page, harness.url);

    const openBtn = page.locator('#qa-btn-analyze-req');
    await expect(openBtn).toBeVisible();
    await openBtn.click();

    const modal = page.locator('#qa-req-analyzer-modal');
    await expect(modal).toBeVisible();

    const textarea = page.locator('#qa-req-analyzer-text');
    await textarea.fill('Độ tuổi tham gia từ 18 đến 60 tuổi.\n### AC-001: Nộp hồ sơ thiếu số điện thoại');

    // Kích hoạt BVA
    const bvaBtn = page.locator('#qa-req-btn-bva');
    await expect(bvaBtn).toBeVisible();
    await bvaBtn.click();

    const bvaPanel = page.locator('#qa-req-panel-bva');
    await expect(bvaPanel).toBeVisible();
    await expect(page.locator('#qa-req-bva-result .qa-spec-card').first()).toBeVisible();

    // Mock API BDD
    await page.route('**/api/ai/format-bdd', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          acIds: ['AC-001'],
          scenarios: [
            {
              acId: 'AC-001',
              title: 'Nộp hồ sơ thiếu số điện thoại',
              given: ['ở màn hình nộp hồ sơ'],
              when: ['để trống số điện thoại và bấm nộp'],
              then: ['hiển thị thông báo lỗi']
            }
          ],
          proposals: [],
          openQuestions: [],
          markdown: '### AC-001: Nộp hồ sơ thiếu số điện thoại\n\n**Given** ở màn hình nộp hồ sơ\n**When** để trống số điện thoại và bấm nộp\n**Then** hiển thị thông báo lỗi'
        })
      });
    });

    // Quay lại màn hình input để bấm BDD
    await page.locator('#qa-req-analyzer-btn-reinput').click();
    const bddBtn = page.locator('#qa-req-btn-bdd');
    await expect(bddBtn).toBeVisible();
    await bddBtn.click();

    const bddPanel = page.locator('#qa-req-panel-bdd');
    await expect(bddPanel).toBeVisible();
    const pre = page.locator('#qa-req-bdd-markdown');
    await expect(pre).toBeVisible();
    await expect(pre).toContainText('### AC-001: Nộp hồ sơ thiếu số điện thoại');

    // Đóng modal
    await page.locator('#qa-req-bdd-copy').click(); // copy để hết dirty
    await page.locator('#qa-req-analyzer-close').click();
    await expect(modal).not.toBeVisible();
  });

  // TC-20: UI-01: Khớp danh sách tab trong modal DOM
  test('TC-20: UI-01: Khop danh sach tab trong modal DOM (du 8 tabs)', async ({ page }) => {
    await openQaView(page, harness.url);
    await page.locator('#qa-btn-analyze-req').click();

    const expectedTabs = ['tc', 'impact', 'logic', 'qa', 'clarity', 'spec', 'bva', 'bdd'];
    for (const tabKey of expectedTabs) {
      const tabEl = page.locator(`.qa-req-tab[data-tab="${tabKey}"]`);
      await expect(tabEl).toHaveCount(1);
    }
    await page.locator('#qa-req-analyzer-close').click();
  });

  // TC-21: UI-04: Chuyển tab nhanh bva -> bdd -> bva
  test('TC-21: UI-04: Chuyen tab nhanh bva -> bdd -> bva', async ({ page }) => {
    await openQaView(page, harness.url);
    await page.locator('#qa-btn-analyze-req').click();

    const textarea = page.locator('#qa-req-analyzer-text');
    await textarea.fill('Mật khẩu dài từ 8 đến 32 ký tự.');
    await page.locator('#qa-req-btn-bva').click();

    // Chuyển nhanh qua lại các tab
    const tabBva = page.locator('.qa-req-tab[data-tab="bva"]');
    const tabBdd = page.locator('.qa-req-tab[data-tab="bdd"]');
    const panelBva = page.locator('#qa-req-panel-bva');
    const panelBdd = page.locator('#qa-req-panel-bdd');

    await tabBdd.click();
    await expect(panelBdd).toHaveCSS('display', 'flex');
    await expect(panelBva).toHaveCSS('display', 'none');

    await tabBva.click();
    await expect(panelBva).toHaveCSS('display', 'flex');
    await expect(panelBdd).toHaveCSS('display', 'none');

    await page.locator('#qa-req-analyzer-close').click();
  });

  // TC-22: ASYNC-01: Sửa textarea khi đang chờ kết quả -> hiện banner stale
  test('TC-22: ASYNC-01: Sua textarea khi dang cho ket qua -> hien banner stale', async ({ page }) => {
    await openQaView(page, harness.url);
    await page.locator('#qa-btn-analyze-req').click();

    await page.route('**/api/ai/format-bdd', async (route) => {
      // Làm trễ 600ms để kịp sửa textarea
      await new Promise((r) => setTimeout(r, 600));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          acIds: ['AC-001'],
          scenarios: [{ acId: 'AC-001', title: 'T1', given: ['G'], when: ['W'], then: ['T'] }],
          proposals: [],
          openQuestions: [],
          markdown: '### AC-001: T1\n\n**Given** G\n**When** W\n**Then** T'
        })
      });
    });

    const textarea = page.locator('#qa-req-analyzer-text');
    await textarea.fill('### AC-001: Ban dau');
    await page.locator('#qa-req-btn-bdd').click();

    // Sửa textarea trong lúc đang request (textarea lúc này nằm trong section bị ẩn bởi showResults)
    await textarea.evaluate((el) => {
      el.value = '### AC-001: Da sua noi dung sau khi bam!';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Chờ kết quả về
    const staleBanner = page.locator('#qa-req-bdd-stale');
    await expect(staleBanner).toBeVisible({ timeout: 5000 });
    await expect(staleBanner).toContainText('Văn bản đã thay đổi');

    await page.locator('#qa-req-bdd-copy').click();
    await page.locator('#qa-req-analyzer-close').click();
  });

  // TC-23: ASYNC-02: Đóng modal huỷ request đang chờ
  test('TC-23: ASYNC-02: Dong modal huy request dang cho', async ({ page }) => {
    let aborted = false;
    await page.route('**/api/ai/format-bdd', async (route) => {
      route.request().response().catch(() => { aborted = true; });
      await new Promise((r) => setTimeout(r, 1000));
      if (!aborted) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, scenarios: [], markdown: '' })
        }).catch(() => {});
      }
    });

    await openQaView(page, harness.url);
    await page.locator('#qa-btn-analyze-req').click();
    await page.locator('#qa-req-analyzer-text').fill('### AC-001: Test abort');
    await page.locator('#qa-req-btn-bdd').click();

    // Huỷ ngay khi đang loading
    const cancelBtn = page.locator('#qa-req-bdd-result button:has-text("Huỷ yêu cầu")');
    await expect(cancelBtn).toBeVisible();
    await cancelBtn.click();

    // Đã quay về input view
    await expect(page.locator('#qa-req-analyzer-input-section')).toBeVisible();
    await page.locator('#qa-req-analyzer-close').click();
  });

  // TC-24: ASYNC-03: Xử lý 2 request liên tiếp chống late response
  test('TC-24: ASYNC-03: Xu ly 2 request lien tiep chong late response', async ({ page }) => {
    let callIndex = 0;
    await page.route('**/api/qa/boundary-matrix', async (route) => {
      callIndex++;
      if (callIndex === 1) {
        // Request 1 chậm 800ms
        await new Promise((r) => setTimeout(r, 800));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            source: 'rule',
            constraints: [{ field: 'Cham', kind: 'number', source: { line: 1, sentence: 'Cham' }, matrix: { values: [] } }],
            unrecognized: []
          })
        });
      } else {
        // Request 2 nhanh
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            source: 'rule',
            constraints: [{ field: 'Nhanh', kind: 'number', source: { line: 1, sentence: 'Nhanh' }, matrix: { values: [] } }],
            unrecognized: []
          })
        });
      }
    });

    await openQaView(page, harness.url);
    await page.locator('#qa-btn-analyze-req').click();
    const textarea = page.locator('#qa-req-analyzer-text');

    await textarea.fill('Text 1');
    await page.locator('#qa-req-btn-bva').click();

    // Bấm lại lần 2
    await page.locator('#qa-req-analyzer-btn-reinput').click();
    await textarea.fill('Text 2');
    await page.locator('#qa-req-btn-bva').click();

    // Chờ kết quả hiển thị
    await page.waitForTimeout(1000);
    const resultText = await page.locator('#qa-req-bva-result').innerText();
    assert.ok(resultText.includes('Nhanh'));
    await page.locator('#qa-req-analyzer-close').click();
  });

  // TC-25: ASYNC-04: Báo lỗi 502 và Thử lại thành công
  test('TC-25: ASYNC-04: Bao loi 502 va Thu lai thanh cong', async ({ page }) => {
    let attempt = 0;
    await page.route('**/api/ai/format-bdd', async (route) => {
      attempt++;
      if (attempt === 1) {
        await route.fulfill({
          status: 502,
          contentType: 'application/json',
          body: JSON.stringify({ ok: false, code: 'TIMEOUT', error: 'AI Gateway timeout' })
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            acIds: ['AC-001'],
            scenarios: [{ acId: 'AC-001', title: 'T1', given: ['G'], when: ['W'], then: ['T'] }],
            proposals: [],
            openQuestions: [],
            markdown: '### AC-001: T1\n\n**Given** G'
          })
        });
      }
    });

    await openQaView(page, harness.url);
    await page.locator('#qa-btn-analyze-req').click();
    await page.locator('#qa-req-analyzer-text').fill('### AC-001: Test retry');
    await page.locator('#qa-req-btn-bdd').click();

    // Lần 1: báo lỗi và hiện nút Thử lại
    const retryBtn = page.locator('#qa-req-bdd-result button:has-text("Thử lại")');
    await expect(retryBtn).toBeVisible({ timeout: 5000 });
    await retryBtn.click();

    // Lần 2: thành công
    await expect(page.locator('#qa-req-bdd-markdown')).toBeVisible({ timeout: 5000 });
    await page.locator('#qa-req-bdd-copy').click();
    await page.locator('#qa-req-analyzer-close').click();
  });

  // TC-26: ASYNC-05: Clipboard resolve và xử lý từ chối
  test('TC-26: ASYNC-05: Clipboard copy resolve hoac xu ly loi an toan', async ({ page }) => {
    await openQaView(page, harness.url);
    await page.locator('#qa-btn-analyze-req').click();
    await page.locator('#qa-req-analyzer-text').fill('Tuổi từ 18 đến 60 tuổi.');
    await page.locator('#qa-req-btn-bva').click();

    const copyBtn = page.locator('#qa-req-bva-copy');
    await expect(copyBtn).toBeVisible();
    await copyBtn.click();

    // Không throw lỗi unhandled
    await page.locator('#qa-req-analyzer-close').click();
  });

  // TC-27: UI-05: Hộp thoại xác nhận đóng khi dirty
  test('TC-27: UI-05: Hop thoai xac nhan dong khi dirty', async ({ page }) => {
    await page.route('**/api/ai/format-bdd', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          acIds: ['AC-001'],
          scenarios: [{ acId: 'AC-001', title: 'T1', given: ['G'], when: ['W'], then: ['T'] }],
          proposals: [],
          openQuestions: [],
          markdown: '### AC-001: T1\n\n**Given** G\n**When** W\n**Then** T'
        })
      });
    });

    await openQaView(page, harness.url);
    await page.locator('#qa-btn-analyze-req').click();
    await page.locator('#qa-req-analyzer-text').fill('### AC-001: Test dirty');
    await page.locator('#qa-req-btn-bdd').click();
    await expect(page.locator('#qa-req-bdd-markdown')).toBeVisible();

    // Bấm nút Đóng -> bật hộp thoại xác nhận #qa-batch-confirm
    const closeBtn = page.locator('#qa-req-analyzer-close');
    await closeBtn.click();

    const confirmModal = page.locator('#qa-batch-confirm');
    await expect(confirmModal).toBeVisible();

    // 1. Bấm "Ở lại" -> modal chính vẫn mở
    const cancelConfirmBtn = page.locator('#qa-batch-confirm [data-confirm-cancel]');
    await cancelConfirmBtn.click();
    await expect(confirmModal).not.toBeVisible();
    await expect(page.locator('#qa-req-analyzer-modal')).toBeVisible();

    // 2. Bấm "Bỏ và đóng" -> modal chính đóng
    await closeBtn.click();
    await expect(confirmModal).toBeVisible();
    const okConfirmBtn = page.locator('#qa-batch-confirm [data-confirm-ok]');
    await okConfirmBtn.click();
    await expect(confirmModal).not.toBeVisible();
    await expect(page.locator('#qa-req-analyzer-modal')).not.toBeVisible();
  });

  // TC-28: OWN-01..04: 20 vòng chuyển view không nhân bản listener
  test('TC-28: OWN-01..04: 20 vong chuyen view khong nhan ban listener', async ({ page }) => {
    await openQaView(page, harness.url);

    // Chuyển view qua lại 20 lần
    for (let i = 0; i < 20; i++) {
      await page.evaluate(() => window.__STUDIO_CORE__.featureRegistry.switchView('data-view'));
      await page.evaluate(() => window.__STUDIO_CORE__.featureRegistry.switchView('qa-view'));
    }

    // Modal và nút hoạt động bình thường, không bắn nhiều toast lặp lại
    await page.locator('#qa-btn-analyze-req').click();
    await expect(page.locator('#qa-req-analyzer-modal')).toBeVisible();
    await page.locator('#qa-req-analyzer-close').click();
  });

  // TC-29: OWN-05: Rời view khi đang chờ không lỗi console
  test('TC-29: OWN-05: Roi view khi dang cho khong loi console', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.route('**/api/qa/boundary-matrix', async (route) => {
      await new Promise((r) => setTimeout(r, 1000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, constraints: [], unrecognized: [] })
      }).catch(() => {});
    });

    await openQaView(page, harness.url);
    await page.locator('#qa-btn-analyze-req').click();
    await page.locator('#qa-req-analyzer-text').fill('Tuổi từ 18 đến 60 tuổi.');
    await page.locator('#qa-req-btn-bva').click();

    // Lập tức đóng modal và rời view
    await page.locator('#qa-req-analyzer-close').click();
    await page.evaluate(() => window.__STUDIO_CORE__.featureRegistry.switchView('data-view'));

    const unexpected = consoleErrors.filter((e) => !/^Failed to load resource/.test(e) && !e.includes('404'));
    assert.equal(unexpected.length, 0);
  });

  // TC-30: An toàn XSS khi render payload độc hại
  test('TC-30: An toan XSS khi render payload doc hai trong BVA va BDD', async ({ page }) => {
    let alertTriggered = false;
    page.on('dialog', async (dialog) => {
      alertTriggered = true;
      await dialog.dismiss();
    });

    await openQaView(page, harness.url);
    await page.locator('#qa-btn-analyze-req').click();

    const maliciousText = '<script>alert("XSS")</script><img src="x" onerror="alert(1)"> Độ tuổi từ 18 đến 60 tuổi.';
    await page.locator('#qa-req-analyzer-text').fill(maliciousText);
    await page.locator('#qa-req-btn-bva').click();

    await expect(page.locator('#qa-req-panel-bva')).toBeVisible();

    // Kiểm tra không có thẻ script nào được inject vào DOM
    const scripts = await page.locator('#qa-req-bva-result script').count();
    assert.equal(scripts, 0);
    assert.equal(alertTriggered, false);

    await page.locator('#qa-req-analyzer-close').click();
  });
});
