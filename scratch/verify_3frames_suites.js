const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function runVerification() {
  const browser = await chromium.launch({ headless: true });
  const errors = [];

  const artifactsDir = 'C:/Users/Admin/.gemini/antigravity-ide/brain/45e0fbba-fe1c-423e-b2c7-8537b5a932e3';
  const outDir = path.join(artifactsDir, '.tempmediaStorage');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  try {
    // 1. Desktop 1920x1080 Dark Theme
    console.log('--- Checking Desktop 1920x1080 Dark Theme ---');
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 }
    });
    const page = await context.newPage();

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.error('Browser Console Error:', msg.text());
        errors.push(msg.text());
      }
    });

    await page.goto('http://127.0.0.1:4174/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // Open Tiện ích dropdown
    console.log('Clicking Tiện ích menu...');
    await page.click('#nav-tools-btn');
    await page.waitForTimeout(300);

    // Click Kịch bản Test Suite
    console.log('Navigating to suites-view...');
    await page.click('.nav-dropdown-item[data-view="suites-view"]');
    await page.waitForTimeout(500);

    // Verify 3 panels exist and are visible
    const sidebarVisible = await page.isVisible('#suites-sidebar');
    const middleVisible = await page.isVisible('#suites-middle-panel');
    const rightVisible = await page.isVisible('#suites-right-panel');
    console.log('Panels visible:', { sidebarVisible, middleVisible, rightVisible });

    if (!sidebarVisible || !middleVisible || !rightVisible) {
      throw new Error('Not all 3 panels are visible in suites-view!');
    }

    // Check stats and list
    const sidebarItems = await page.$$('.suite-nav-item');
    console.log(`Found ${sidebarItems.length} suite items in sidebar.`);

    // Take screenshot 1920 dark
    const dark1920Path = path.join(artifactsDir, 'suites_view_1920_dark.png');
    await page.screenshot({ path: dark1920Path, fullPage: false });
    console.log('Saved:', dark1920Path);

    // 2. Test interactive selection
    if (sidebarItems.length > 1) {
      console.log('Selecting second suite item...');
      await sidebarItems[1].click();
      await page.waitForTimeout(300);
      const activeTitle = await page.textContent('#suite-active-title');
      console.log('Active suite title in Khung 2:', activeTitle);
    }

    // 3. Test tag chip suggestion click
    const tagChips = await page.$$('#suite-tag-suggestions .btn-tag-chip');
    if (tagChips.length > 0) {
      console.log('Clicking first tag chip...');
      // Ensure scope mode is grep
      await page.click('#scope-opt-grep');
      await page.waitForTimeout(200);
      await tagChips[0].click();
      await page.waitForTimeout(200);
      const grepVal = await page.inputValue('#suite-field-grep');
      console.log('Grep value after chip click:', grepVal);
    }

    // 4. Test sidebar collapse and expand
    console.log('Testing sidebar collapse...');
    await page.click('#btn-collapse-suites-sidebar');
    await page.waitForTimeout(300);
    const isCollapsed = await page.evaluate(() => {
      return document.getElementById('suites-workspace')?.classList.contains('sidebar-collapsed');
    });
    console.log('Sidebar collapsed state:', isCollapsed);

    console.log('Testing sidebar expand...');
    await page.click('#btn-expand-suites-sidebar');
    await page.waitForTimeout(300);
    const isExpanded = await page.evaluate(() => {
      return !document.getElementById('suites-workspace')?.classList.contains('sidebar-collapsed');
    });
    console.log('Sidebar expanded state:', isExpanded);

    // 5. Light Theme 1920x1080
    console.log('--- Checking Light Theme 1920x1080 ---');
    await page.click('#theme-button');
    await page.waitForTimeout(400);
    const light1920Path = path.join(artifactsDir, 'suites_view_1920_light.png');
    await page.screenshot({ path: light1920Path, fullPage: false });
    console.log('Saved:', light1920Path);
    // Switch back to dark theme
    await page.click('#theme-button');
    await page.waitForTimeout(300);

    // 6. Viewport 2560x1305 (User screen)
    console.log('--- Checking 2560x1305 Desktop ---');
    await page.setViewportSize({ width: 2560, height: 1305 });
    await page.waitForTimeout(400);
    const widePath = path.join(artifactsDir, 'suites_view_2560x1305.png');
    await page.screenshot({ path: widePath, fullPage: false });
    console.log('Saved:', widePath);

    // 7. Viewport 1280x800
    console.log('--- Checking 1280x800 ---');
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(400);
    const path1280 = path.join(artifactsDir, 'suites_view_1280.png');
    await page.screenshot({ path: path1280, fullPage: false });
    console.log('Saved:', path1280);

    // 8. Mobile 375x812
    console.log('--- Checking Mobile 375x812 ---');
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(400);
    const mobilePath = path.join(artifactsDir, 'suites_view_mobile_375.png');
    await page.screenshot({ path: mobilePath, fullPage: false });
    console.log('Saved:', mobilePath);

    // 9. Inspect DOM for forbidden strings
    const content = await page.evaluate(() => {
      const el = document.getElementById('suites-view');
      return el ? el.innerText : '';
    });

    const forbidden = ['undefined', 'null', 'NaN', 'TODO', '[object Object]'];
    forbidden.forEach((f) => {
      if (content.includes(f)) {
        console.warn(`Warning: Found forbidden string "${f}" in suites-view!`);
      }
    });

    // 10. Test Quick Run Suite now
    console.log('Testing "Chạy suite này ngay"...');
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(200);
    await page.click('#suite-run-now-btn');
    await page.waitForTimeout(500);

    const activeView = await page.evaluate(() => {
      const active = document.querySelector('.dashboard-view:not([hidden])');
      return active ? active.id : null;
    });
    console.log('Active view after Run Suite click:', activeView);
    if (activeView !== 'runner-view') {
      throw new Error(`Expected runner-view to be active, got ${activeView}`);
    }

    console.log('--- ALL CHECKS PASSED SUCCESSFULLY! ---');
  } finally {
    await browser.close();
  }
}

runVerification().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
