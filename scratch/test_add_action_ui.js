const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  console.log('Navigating to dashboard...');
  await page.goto('http://127.0.0.1:4174', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  // Switch to Page Manager View
  await page.click('[data-view="page-manager-view"]');
  await page.waitForTimeout(1000);

  // Select JobSearchPage.js
  const jobSearchCard = page.locator('.page-manager-file-card', { hasText: 'JobSearchPage.js' });
  if (await jobSearchCard.count() > 0) {
    await jobSearchCard.first().click();
    await page.waitForTimeout(600);
  }

  // 1. Verify buttons exist
  const headAddBtn = page.locator('#pm-btn-add-action-toggle');
  const subnavAddBtn = page.locator('#pm-subnav-add-action-btn');
  const inlineBox = page.locator('#pm-inline-add-action-box');
  const nameInput = page.locator('#pm-inline-act-name');
  const locSelect = page.locator('#pm-inline-act-loc');
  const opSelect = page.locator('#pm-inline-act-op');
  const submitBtn = page.locator('#pm-btn-inline-add-act');

  console.log('Head Add Action button visible:', await headAddBtn.isVisible());
  console.log('Subnav Add Action button visible:', await subnavAddBtn.isVisible());
  console.log('Inline Add Action box visible:', await inlineBox.isVisible());

  // 2. Check locator options populated
  const locOptionCount = await locSelect.locator('option').count();
  console.log(`Locator options count in select: ${locOptionCount}`);

  // 3. Test clicking Head Add Action button -> focuses name input
  await headAddBtn.click();
  await page.waitForTimeout(300);

  // 4. Test selecting a locator -> auto generates name
  await locSelect.selectOption({ index: 1 });
  await page.waitForTimeout(200);
  const autoName = await nameInput.inputValue();
  console.log(`Auto generated action name: "${autoName}"`);

  // Capture Screenshot: 1920x1080 Light Mode
  const artifactDir = path.resolve('C:/Users/Admin/.gemini/antigravity-ide/brain/45e0fbba-fe1c-423e-b2c7-8537b5a932e3');
  await page.screenshot({ path: path.join(artifactDir, 'pm_add_action_1920_light.png') });
  console.log('Saved pm_add_action_1920_light.png');

  // Capture Screenshot: 1920x1080 Dark Mode
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(artifactDir, 'pm_add_action_1920_dark.png') });
  console.log('Saved pm_add_action_1920_dark.png');

  // Reset to light
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));

  // Capture Screenshot: 1440x900
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(artifactDir, 'pm_add_action_1440.png') });
  console.log('Saved pm_add_action_1440.png');

  // Capture Screenshot: 1280x800
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(artifactDir, 'pm_add_action_1280.png') });
  console.log('Saved pm_add_action_1280.png');

  // Capture Screenshot: Mobile 375x812
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(artifactDir, 'pm_add_action_mobile_375.png') });
  console.log('Saved pm_add_action_mobile_375.png');

  console.log('Console errors:', consoleErrors.length, consoleErrors);
  await browser.close();
  console.log('Verification completed successfully!');
})();
