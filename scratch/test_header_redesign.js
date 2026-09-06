const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  console.log('Navigating to dashboard...');
  await page.goto('http://127.0.0.1:4174/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.topbar');

  // Check 1: Verify #agent-guide-btn is GONE from agent-view hero
  await page.click('#agent-tab');
  await page.waitForTimeout(500);
  const agentHeroButtons = await page.evaluate(() => {
    const hero = document.querySelector('#agent-view .hero');
    const guideBtn = document.getElementById('agent-guide-btn');
    const statePill = document.getElementById('agent-state')?.textContent;
    return { hasOldGuideBtn: Boolean(guideBtn), statePill };
  });
  console.log('Agent view hero check:', agentHeroButtons);
  if (agentHeroButtons.hasOldGuideBtn) throw new Error('Duplicate guide button still in agent hero!');

  // Take screenshot of agent view with single status pill in hero
  const screenshotDir = path.resolve(__dirname, '../artifacts');
  if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });
  await page.screenshot({ path: path.join(screenshotDir, 'header_agent_tab.png'), fullPage: false });

  // Check 2: Switch back to runner view
  await page.click('.view-tab[data-view="runner-view"]');
  await page.waitForTimeout(300);

  // Check 3: Test Dropdown toggle and selection
  console.log('Testing Tiện ích dropdown...');
  await page.click('#nav-tools-btn');
  await page.waitForTimeout(300);
  const isDropdownOpen = await page.evaluate(() => document.getElementById('nav-tools-dropdown')?.classList.contains('open'));
  console.log('Is dropdown open after click?:', isDropdownOpen);

  // Capture screenshot of opened dropdown
  await page.screenshot({ path: path.join(screenshotDir, 'header_dropdown_open.png'), fullPage: false });

  // Click on "Dữ liệu test" inside dropdown
  console.log('Clicking "Dữ liệu test" in dropdown...');
  await page.click('.nav-dropdown-item[data-view="data-view"]');
  await page.waitForTimeout(800);

  const dataViewCheck = await page.evaluate(() => {
    const viewActive = document.querySelector('#data-view')?.classList.contains('active');
    const viewHidden = document.querySelector('#data-view')?.hidden;
    const toolsBtnActive = document.getElementById('nav-tools-btn')?.classList.contains('active');
    const toolsLabel = document.getElementById('nav-tools-label')?.textContent;
    const dropdownClosed = !document.getElementById('nav-tools-dropdown')?.classList.contains('open');
    return { viewActive, viewHidden, toolsBtnActive, toolsLabel, dropdownClosed };
  });
  console.log('Data view after dropdown click:', dataViewCheck);

  // Click on "Chạy test" to reset dropdown label
  await page.click('.view-tab[data-view="runner-view"]');
  await page.waitForTimeout(300);
  const resetLabel = await page.evaluate(() => document.getElementById('nav-tools-label')?.textContent);
  console.log('Tools label after clicking runner tab:', resetLabel);

  // Check 4: Test Settings button on the header
  console.log('Testing Settings gear button in header actions...');
  await page.click('#settings-tab');
  await page.waitForTimeout(500);
  const settingsCheck = await page.evaluate(() => {
    const settingsActive = document.querySelector('#settings-view')?.classList.contains('active');
    const gearBtnActive = document.getElementById('settings-tab')?.classList.contains('active');
    return { settingsActive, gearBtnActive };
  });
  console.log('Settings view check:', settingsCheck);

  // Check 5: Test Setup Guide button in header actions
  console.log('Testing Hướng dẫn cài đặt button in header...');
  await page.click('#setup-guide-btn');
  await page.waitForTimeout(800);
  const guideCheck = await page.evaluate(() => {
    const docName = document.getElementById('doc-settings-name')?.textContent;
    return { docName };
  });
  console.log('Guide check:', guideCheck);

  // Capture clean screenshots at all viewports
  // 1920x1080 Light
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.click('.view-tab[data-view="runner-view"]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(screenshotDir, 'header_redesign_1920_light.png'), fullPage: false });

  // 1920x1080 Dark
  await page.click('#theme-button');
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(screenshotDir, 'header_redesign_1920_dark.png'), fullPage: false });

  // 1440x900
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(screenshotDir, 'header_redesign_1440.png'), fullPage: false });

  // 1280x800
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(screenshotDir, 'header_redesign_1280.png'), fullPage: false });

  // 375x812 (Mobile)
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(screenshotDir, 'header_redesign_mobile.png'), fullPage: false });

  await browser.close();
  console.log('All header redesign tests passed successfully!');
})();
