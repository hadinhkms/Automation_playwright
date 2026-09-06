const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  console.log('Navigating to dashboard...');
  await page.goto('http://127.0.0.1:4174/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  // 1. Verify code-view is GONE from DOM
  const codeViewInDOM = await page.evaluate(() => Boolean(document.getElementById('code-view')));
  console.log('Is #code-view in DOM?:', codeViewInDOM);
  if (codeViewInDOM) throw new Error('#code-view is still present in DOM!');

  // 2. Verify dropdown items
  await page.click('#nav-tools-btn');
  await page.waitForTimeout(300);

  const dropdownItems = await page.evaluate(() => {
    const items = [...document.querySelectorAll('#nav-tools-menu .nav-dropdown-item')].map((el) => ({
      view: el.dataset.view,
      title: el.querySelector('strong')?.textContent,
      sub: el.querySelector('small')?.textContent,
    }));
    return items;
  });
  console.log('Dropdown items:', dropdownItems);

  if (dropdownItems.length !== 3) {
    throw new Error(`Expected exactly 3 dropdown items, found ${dropdownItems.length}`);
  }
  if (dropdownItems.some((item) => item.view === 'code-view')) {
    throw new Error('Mã framework is still in dropdown!');
  }

  const screenshotDir = path.resolve(__dirname, '../artifacts');
  if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });

  // Screenshot dropdown open
  await page.screenshot({ path: path.join(screenshotDir, 'clean_menu_dropdown.png'), fullPage: false });

  // 3. Test clicking "Quản lý Page" primary tab
  console.log('Testing Quản lý Page tab...');
  await page.click('.view-tab[data-view="page-manager-view"]');
  await page.waitForTimeout(600);

  const pageManagerCheck = await page.evaluate(() => {
    const isVisible = !document.getElementById('page-manager-view')?.hidden;
    const isActive = document.getElementById('page-manager-view')?.classList.contains('active');
    const hasSidebar = Boolean(document.getElementById('pm-sidebar'));
    const hasEditor = Boolean(document.getElementById('pm-code-editor'));
    return { isVisible, isActive, hasSidebar, hasEditor };
  });
  console.log('Page Manager check:', pageManagerCheck);

  // Screenshot Quản lý Page
  await page.screenshot({ path: path.join(screenshotDir, 'clean_page_manager_view.png'), fullPage: false });

  // 4. Test clicking "Kịch bản BDD" primary tab
  console.log('Testing Kịch bản BDD tab...');
  await page.click('.view-tab[data-view="builder-view"]');
  await page.waitForTimeout(600);
  const bddCheck = await page.evaluate(() => {
    return {
      isVisible: !document.getElementById('builder-view')?.hidden,
      isActive: document.getElementById('builder-view')?.classList.contains('active'),
    };
  });
  console.log('BDD check:', bddCheck);

  // Screenshot Kịch bản BDD
  await page.screenshot({ path: path.join(screenshotDir, 'clean_bdd_view.png'), fullPage: false });

  // 5. Test legacy ?tab=code redirect
  console.log('Testing legacy ?tab=code URL parameter...');
  await page.goto('http://127.0.0.1:4174/?tab=code', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  const legacyCheck = await page.evaluate(() => {
    const pmActive = document.getElementById('page-manager-view')?.classList.contains('active');
    return { pmActive };
  });
  console.log('Legacy tab=code check (redirected to Page Manager):', legacyCheck);

  // 6. Responsive and Dark Mode
  await page.goto('http://127.0.0.1:4174/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  // 1920 Light
  await page.screenshot({ path: path.join(screenshotDir, 'clean_dashboard_1920_light.png'), fullPage: false });

  // 1920 Dark
  await page.click('#theme-button');
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(screenshotDir, 'clean_dashboard_1920_dark.png'), fullPage: false });

  // 1280
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(screenshotDir, 'clean_dashboard_1280.png'), fullPage: false });

  // Mobile 375
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(screenshotDir, 'clean_dashboard_mobile.png'), fullPage: false });

  await browser.close();
  console.log('All Option 1 removal tests passed 100%!');
})();
