const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('=== STARTING SENIOR QA VERIFICATION FOR AI SETTINGS ===');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  const artifactDir = 'C:\\Users\\Admin\\.gemini\\antigravity-ide\\brain\\45e0fbba-fe1c-423e-b2c7-8537b5a932e3';

  // 1. Navigate
  await page.goto('http://127.0.0.1:4174/', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForSelector('#settings-tab', { timeout: 10000 });
  console.log('Navigated to dashboard.');

  // 2. Click Settings Tab
  await page.click('#settings-tab');
  await page.waitForTimeout(500);

  // 3. Click AI subtab
  await page.click('.settings-subtab[data-subtab="ai"]');
  await page.waitForTimeout(800);

  // Screenshot 1920x1080 Dark Theme
  const shot1 = path.join(artifactDir, 'ai_settings_1920_dark.png');
  await page.screenshot({ path: shot1, fullPage: false });
  console.log('Screenshot saved: ai_settings_1920_dark.png');

  // Check Provider Select and Key Badge
  const providerVal = await page.$eval('#settings-ai-provider', el => el.value);
  console.log('Provider selected:', providerVal);

  const badgeText = await page.$eval('#settings-ai-key-badge', el => el.textContent.trim());
  console.log('Key badge text:', badgeText);

  // 4. Click Test Connection
  console.log('Clicking Test Connection button...');
  await page.click('#test-ai-button');
  await page.waitForSelector('#settings-ai-status-alert:not([hidden])', { timeout: 10000 });
  await page.waitForTimeout(600);

  const alertMsg = await page.$eval('#settings-ai-alert-msg', el => el.textContent.trim());
  console.log('Test Connection alert message:', alertMsg);

  const shotTest = path.join(artifactDir, 'ai_settings_test_success.png');
  await page.screenshot({ path: shotTest, fullPage: false });
  console.log('Screenshot saved: ai_settings_test_success.png');

  // 5. Test Light Theme
  await page.click('#theme-button');
  await page.waitForTimeout(400);
  const shotLight = path.join(artifactDir, 'ai_settings_1920_light.png');
  await page.screenshot({ path: shotLight, fullPage: false });
  console.log('Screenshot saved: ai_settings_1920_light.png');

  // Switch back to Dark Theme
  await page.click('#theme-button');
  await page.waitForTimeout(300);

  // 6. Test 1440x900
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(300);
  const shot1440 = path.join(artifactDir, 'ai_settings_1440.png');
  await page.screenshot({ path: shot1440, fullPage: false });
  console.log('Screenshot saved: ai_settings_1440.png');

  // 7. Test 1280px
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(300);
  const shot1280 = path.join(artifactDir, 'ai_settings_1280.png');
  await page.screenshot({ path: shot1280, fullPage: false });
  console.log('Screenshot saved: ai_settings_1280.png');

  // 8. Test Mobile 375px
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(300);
  const shotMobile = path.join(artifactDir, 'ai_settings_mobile_375.png');
  await page.screenshot({ path: shotMobile, fullPage: false });
  console.log('Screenshot saved: ai_settings_mobile_375.png');

  // Check console errors
  console.log('Total console errors:', consoleErrors.length);
  if (consoleErrors.length > 0) {
    console.error('Console errors detected:', consoleErrors);
  }

  await browser.close();
  console.log('=== VERIFICATION SCRIPT COMPLETED ===');
})();
