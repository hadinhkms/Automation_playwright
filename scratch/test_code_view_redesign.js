const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  console.log('Navigating to dashboard...');
  await page.goto('http://127.0.0.1:4174/?tab=code', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  // 1. Verify old hero and old buttons are GONE
  const oldElements = await page.evaluate(() => {
    const oldHero = document.querySelector('.code-hero');
    const oldSwitchGroup = document.querySelector('.code-mode-switch-group');
    const oldOrientation = document.querySelector('.code-orientation');
    const newHeader = document.querySelector('.code-workspace-header');
    const newSegmented = document.querySelector('.code-segmented-control');
    const visualActive = document.getElementById('btn-switch-visual-mode')?.classList.contains('active');
    return {
      hasOldHero: Boolean(oldHero),
      hasOldSwitchGroup: Boolean(oldSwitchGroup),
      hasOldOrientation: Boolean(oldOrientation),
      hasNewHeader: Boolean(newHeader),
      hasNewSegmented: Boolean(newSegmented),
      visualActive
    };
  });
  console.log('DOM checks:', oldElements);

  if (oldElements.hasOldHero || oldElements.hasOldSwitchGroup || oldElements.hasOldOrientation) {
    throw new Error('Old clunky elements are still present in DOM!');
  }
  if (!oldElements.hasNewHeader || !oldElements.hasNewSegmented) {
    throw new Error('New header or segmented control not found!');
  }

  const screenshotDir = path.resolve(__dirname, '../artifacts');
  if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });

  // Capture screenshot of Visual Mode 1920 Light
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(screenshotDir, 'code_view_redesign_1920_visual.png'), fullPage: false });

  // 2. Test switching to Raw Mode via segmented control
  console.log('Switching to Raw Code mode...');
  await page.click('#btn-switch-raw-mode');
  await page.waitForTimeout(800);

  const rawCheck = await page.evaluate(() => {
    const rawVisible = !document.getElementById('code-raw-container')?.hidden;
    const visualHidden = document.getElementById('code-visual-container')?.hidden;
    const rawBtnActive = document.getElementById('btn-switch-raw-mode')?.classList.contains('active');
    const badgeText = document.getElementById('code-header-badge')?.textContent;
    return { rawVisible, visualHidden, rawBtnActive, badgeText };
  });
  console.log('Raw mode check:', rawCheck);

  // Capture screenshot of Raw Code mode
  await page.screenshot({ path: path.join(screenshotDir, 'code_view_redesign_1920_raw.png'), fullPage: false });

  // 3. Test returning to Visual mode via #btn-return-to-visual in toolbar
  console.log('Returning to Visual mode via button...');
  await page.click('#btn-return-to-visual');
  await page.waitForTimeout(500);

  const returnCheck = await page.evaluate(() => {
    const visualVisible = !document.getElementById('code-visual-container')?.hidden;
    const visualBtnActive = document.getElementById('btn-switch-visual-mode')?.classList.contains('active');
    return { visualVisible, visualBtnActive };
  });
  console.log('Return check:', returnCheck);

  // 4. Dark mode screenshot
  await page.click('#theme-button');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(screenshotDir, 'code_view_redesign_1920_dark.png'), fullPage: false });

  // 5. Laptop 1440x900
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(screenshotDir, 'code_view_redesign_1440.png'), fullPage: false });

  // 6. Laptop 1280x800
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(screenshotDir, 'code_view_redesign_1280.png'), fullPage: false });

  // 7. Mobile 375x812
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(screenshotDir, 'code_view_redesign_mobile.png'), fullPage: false });

  await browser.close();
  console.log('All code-view redesign tests passed successfully!');
})();
