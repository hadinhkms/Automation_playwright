/**
 * tests/dashboard/qa-view-design-parity.spec.js
 * Chốt chặn: mục QA phải nhìn như phần còn lại của dashboard, ở CẢ hai theme.
 *
 * Kiểm màu ĐÃ RENDER chứ không đọc file CSS. Một token không tồn tại (vd. --surface-1)
 * trông hoàn toàn bình thường trong source: `var(--surface-1, #fff)` vẫn là CSS hợp lệ.
 * Chỉ khi trình duyệt tính ra giá trị cuối cùng mới lộ ra nền trắng giữa trang tối.
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { startDashboardHarness } = require('./support/dashboardHarness');
const { createFixtureWorkspace } = require('./support/fixtureWorkspace');

const QA_CSS = path.join(__dirname, '..', '..', 'dashboard', 'public', 'styles', 'views', 'qa.css');

/** Bỏ comment CSS trước khi quét: chính phần ghi chú cảnh báo về `var(--x, #hex)`
 *  cũng khớp mẫu, và một test tự bắt lời cảnh báo của mình thì vô dụng. */
function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * Theme phải được gieo TRUOC khi tải trang: app.js đọc localStorage rồi tự gọi applyTheme,
 * nên gán data-theme sau khi boot có thể bị chính app ghi đè lại.
 */
async function openQaView(page, url, theme = 'dark') {
  await page.addInitScript((t) => {
    try { window.localStorage.setItem('playwright-dashboard-theme', t); } catch (_) { /* ignore */ }
  }, theme);
  await page.goto(url);
  await page.waitForSelector('.shell');
  await page.waitForFunction(() => Boolean(window.__STUDIO_CORE__));
  await page.waitForFunction((t) => document.documentElement.dataset.theme === t, theme);
  await page.evaluate(() => window.__STUDIO_CORE__.featureRegistry.switchView('qa-view'));
  await page.waitForFunction(() => {
    const el = document.getElementById('qa-view');
    return el && !el.hidden && el.childElementCount > 0;
  });
}

test.describe('QA view: đồng bộ thiết kế với framework dashboard', () => {
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

  test('qa.css không tham chiếu token nào không tồn tại', () => {
    const css = stripComments(fs.readFileSync(QA_CSS, 'utf8'));
    const used = new Set([...css.matchAll(/var\(\s*(--[a-z0-9-]+)/gi)].map((m) => m[1]));

    const tokensCss = fs.readFileSync(
      path.join(__dirname, '..', '..', 'dashboard', 'public', 'styles', 'tokens.css'),
      'utf8',
    );
    const defined = new Set([...tokensCss.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gim)].map((m) => m[1]));

    const ghosts = [...used].filter((t) => !defined.has(t));
    expect(ghosts, `token không có trong tokens.css: ${ghosts.join(', ')}`).toEqual([]);
  });

  test('qa.css không viết fallback màu — fallback chỉ che giấu token thiếu', () => {
    const css = stripComments(fs.readFileSync(QA_CSS, 'utf8'));
    const withFallback = [...css.matchAll(/var\(\s*--[a-z0-9-]+\s*,[^)]*#[0-9a-f]{3,8}/gi)].map((m) => m[0]);
    expect(withFallback, `còn fallback màu: ${withFallback.join(' | ')}`).toEqual([]);
  });

  test('theme tối: không mảng nào của mục QA vẽ nền sáng', async ({ page }) => {
    await openQaView(page, harness.url, 'dark');

    const bright = await page.evaluate(() => {
      const lum = (rgb) => {
        const m = String(rgb).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/);
        if (!m) return null;
        if (m[4] !== undefined && Number(m[4]) === 0) return null; // trong suốt: bỏ qua
        return 0.2126 * Number(m[1]) + 0.7152 * Number(m[2]) + 0.0722 * Number(m[3]);
      };
      const out = [];
      for (const el of document.querySelectorAll('#qa-view, #qa-view *')) {
        const v = lum(getComputedStyle(el).backgroundColor);
        if (v !== null && v > 140) {
          out.push(`${el.tagName.toLowerCase()}.${el.className || '(no class)'} -> ${getComputedStyle(el).backgroundColor}`);
        }
      }
      return out;
    });

    expect(bright, `nền sáng giữa theme tối: ${bright.join(' | ')}`).toEqual([]);
  });

  test('viền dùng --line thật, không phải hairline trắng', async ({ page }) => {
    await openQaView(page, harness.url, 'dark');

    const pale = await page.evaluate(() => {
      const lum = (rgb) => {
        const m = String(rgb).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/);
        if (!m) return null;
        if (m[4] !== undefined && Number(m[4]) === 0) return null;
        return 0.2126 * Number(m[1]) + 0.7152 * Number(m[2]) + 0.0722 * Number(m[3]);
      };
      const out = [];
      for (const el of document.querySelectorAll('#qa-view, #qa-view *')) {
        const cs = getComputedStyle(el);
        // Cạnh rộng 0 không vẽ gì; màu của nó mặc định là currentColor nên luôn "sáng".
        for (const side of ['Top', 'Bottom', 'Left', 'Right']) {
          if (parseFloat(cs[`border${side}Width`]) === 0) continue;
          if (cs[`border${side}Style`] === 'none') continue;
          const color = cs[`border${side}Color`];
          const v = lum(color);
          if (v !== null && v > 150) out.push(`${el.tagName.toLowerCase()}.${el.className} border${side}=${color}`);
        }
      }
      return out;
    });

    expect(pale, `viền quá sáng: ${pale.join(' | ')}`).toEqual([]);
  });

  test('đổi sang theme sáng thì màu đổi theo, không đứng yên', async ({ page }) => {
    const sample = () => {
      const el = document.querySelector('#qa-view .qa-empty, #qa-view .qa-table-wrap, #qa-view .qa-panel');
      if (!el) return null;
      const cs = getComputedStyle(el);
      return `${cs.backgroundColor}|${cs.borderTopColor}`;
    };

    await openQaView(page, harness.url, 'dark');
    const dark = await page.evaluate(sample);
    await openQaView(page, harness.url, 'light');
    const light = await page.evaluate(sample);

    expect(dark).not.toBeNull();
    expect(light, 'màu không đổi theo theme = đang hardcode').not.toBe(dark);
  });

  test('dùng lại primitive chung: hero, panel, subnav đều có mặt', async ({ page }) => {
    await openQaView(page, harness.url);

    const shape = await page.evaluate(() => ({
      hero: document.querySelectorAll('#qa-view header.hero').length,
      h1: document.querySelectorAll('#qa-view header.hero h1').length,
      eyebrow: document.querySelectorAll('#qa-view .eyebrow').length,
      subtitle: document.querySelectorAll('#qa-view .subtitle').length,
      statCards: document.querySelectorAll('#qa-view .hero-stat-card').length,
      panels: document.querySelectorAll('#qa-view section.panel.qa-panel').length,
      subnav: document.querySelectorAll('#qa-view .view-subnav .view-subtab').length,
      strayH2: document.querySelectorAll('#qa-view h2.view-title').length,
    }));

    expect(shape.hero).toBe(1);
    expect(shape.h1).toBe(1);
    expect(shape.eyebrow).toBe(1);
    expect(shape.statCards).toBe(5);
    expect(shape.panels).toBe(4);
    expect(shape.subnav).toBe(4);
    expect(shape.strayH2, 'view-title là kiểu cũ, không có trong template chuẩn').toBe(0);
  });

  test('thuộc tính hidden vẫn có tác dụng — không rule nào ghi đè mất', async ({ page }) => {
    await openQaView(page, harness.url);

    const leaked = await page.evaluate(() => [...document.querySelectorAll('#qa-view [hidden]')]
      .filter((el) => getComputedStyle(el).display !== 'none')
      .map((el) => `${el.id || el.tagName.toLowerCase()}.${el.className}`));

    expect(leaked, `hidden bị vô hiệu: ${leaked.join(' | ')}`).toEqual([]);
  });

  test('view vẫn ẩn đúng khi chuyển sang màn hình khác', async ({ page }) => {
    await openQaView(page, harness.url);
    await page.evaluate(() => window.__STUDIO_CORE__.featureRegistry.switchView('data-view'));
    await page.waitForFunction(() => document.getElementById('qa-view').hidden);

    const display = await page.evaluate(() => getComputedStyle(document.getElementById('qa-view')).display);
    expect(display, '.qa-view { display: flex } không được thắng .dashboard-view[hidden]').toBe('none');
  });

  test('tab con vẫn hiện sau khi chuyển view — featureRegistry không được ẩn ruột view', async ({ page }) => {
    await openQaView(page, harness.url, 'dark');

    const state = await page.evaluate(() => {
      const view = document.getElementById('qa-view');
      const panel = view.querySelector('#qa-panel-docs');
      const empty = view.querySelector('#qa-docs-empty');
      return {
        panelHidden: panel.hidden,
        panelDisplay: getComputedStyle(panel).display,
        panelHeight: panel.getBoundingClientRect().height,
        emptyHeight: empty.getBoundingClientRect().height,
      };
    });

    expect(state.panelHidden, 'panel của tab đang mở không được mang hidden').toBe(false);
    expect(state.panelDisplay).not.toBe('none');
    expect(state.panelHeight, 'panel cao 0 nghĩa là người dùng thấy màn hình trắng').toBeGreaterThan(30);
    expect(state.emptyHeight, 'trạng thái rỗng phải nhìn thấy được').toBeGreaterThan(20);
  });

  test('chuyển view qua lại rồi quay về, tab con vẫn còn nội dung', async ({ page }) => {
    await openQaView(page, harness.url, 'dark');
    for (const id of ['data-view', 'qa-view', 'docs-view', 'qa-view']) {
      await page.evaluate((v) => window.__STUDIO_CORE__.featureRegistry.switchView(v), id);
    }
    await page.waitForFunction(() => {
      const e = document.getElementById('qa-view');
      return e && !e.hidden;
    });

    const height = await page.evaluate(() => document
      .getElementById('qa-view').querySelector('#qa-panel-docs').getBoundingClientRect().height);
    expect(height, 'quay lại view thì tab con bị ẩn mất').toBeGreaterThan(30);
  });

  test('tải lỗi thì vẫn còn nút Làm mới để thử lại', async ({ page }) => {
    await page.route('**/api/qa/trace', (route) => route.fulfill({
      status: 500, contentType: 'application/json', body: '{"error":"sap server"}',
    }));
    await openQaView(page, harness.url, 'dark');

    const state = await page.evaluate(() => {
      const btn = document.getElementById('qa-view').querySelector('#qa-btn-refresh');
      const alert = document.getElementById('qa-view').querySelector('#qa-alert');
      return {
        btnVisible: Boolean(btn) && btn.getBoundingClientRect().height > 0,
        alertVisible: Boolean(alert) && !alert.hidden,
        alertIsDanger: Boolean(alert) && alert.classList.contains('qa-alert-danger'),
      };
    });

    expect(state.btnVisible, 'mất nút Làm mới khi tải lỗi thì người dùng kẹt luôn').toBe(true);
    expect(state.alertVisible).toBe(true);
    expect(state.alertIsDanger, 'lỗi thật phải khác cảnh báo mềm').toBe(true);
  });

  test('bố cục không tràn ngang ở 1440x900 và 390x844', async ({ page }) => {
    for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(size);
      await openQaView(page, harness.url);
      const overflow = await page.evaluate(() => ({
        doc: document.documentElement.scrollWidth,
        win: window.innerWidth,
      }));
      expect(overflow.doc, `tràn ngang ở ${size.width}px`).toBeLessThanOrEqual(overflow.win + 1);
    }
  });
});
