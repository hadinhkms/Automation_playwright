const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://127.0.0.1:4174/?tab=bdd', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);

  // 1. Light Mode Verification
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'light');
    window.showConfirmDeleteModal({
      title: 'Xác nhận xóa kịch bản test',
      subtitle: 'Kịch bản Playwright BDD sẽ bị xóa vĩnh viễn khỏi thư mục tests/',
      targetName: 'sfas',
      targetPath: 'tests/e2e/desktop/sfas_flow-bdd.spec.js',
      iconClass: 'ph-bold ph-desktop',
      message: 'Hệ thống sẽ tự động lưu 1 bản sao lưu trong <code>.dashboard-backups/</code> trước khi xóa kịch bản <strong>sfas_flow-bdd.spec.js</strong>. Bạn có chắc chắn muốn xóa vĩnh viễn?'
    });
  });

  await page.waitForTimeout(500);
  await page.screenshot({ path: path.resolve(__dirname, 'modal_after_fix_light.png') });
  console.log('Saved modal_after_fix_light.png');

  const lightMetrics = await page.evaluate(() => {
    const modal = document.getElementById('modal-confirm-delete');
    const head = modal.querySelector('.app-modal-head');
    const body = document.getElementById('modal-confirm-delete-body');
    const actions = modal.querySelector('.app-modal-actions');
    const box = modal.querySelector('.app-modal-box');
    const targetCard = body.querySelector('.modal-delete-preview-card');
    const msg = document.getElementById('modal-confirm-delete-message');
    const closeBtn = modal.querySelector('.btn-icon-subtle');

    function getMetrics(el) {
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return {
        tag: el.tagName,
        class: el.className,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        padding: { left: style.paddingLeft, right: style.paddingRight, top: style.paddingTop, bottom: style.paddingBottom },
        margin: { left: style.marginLeft, right: style.marginRight, top: style.marginTop, bottom: style.marginBottom },
        bg: style.backgroundColor,
        border: style.border
      };
    }

    return {
      modal: getMetrics(modal),
      box: getMetrics(box),
      head: getMetrics(head),
      body: getMetrics(body),
      targetCard: getMetrics(targetCard),
      msg: getMetrics(msg),
      actions: getMetrics(actions),
      focused: document.activeElement ? {
        tag: document.activeElement.tagName,
        class: document.activeElement.className,
        outline: window.getComputedStyle(document.activeElement).outline
      } : null
    };
  });

  console.log('LIGHT METRICS:', JSON.stringify(lightMetrics, null, 2));

  // 2. Dark Mode Verification
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.resolve(__dirname, 'modal_after_fix_dark.png') });
  console.log('Saved modal_after_fix_dark.png');

  // 3. Mobile Viewport Verification (390x844)
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.resolve(__dirname, 'modal_after_fix_mobile.png') });
  console.log('Saved modal_after_fix_mobile.png');

  await browser.close();
})();
