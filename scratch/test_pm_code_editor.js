const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  console.log('Navigating to http://127.0.0.1:4174...');
  await page.goto('http://127.0.0.1:4174', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  // Switch to Page Manager View
  console.log('Switching to Page Manager View...');
  await page.click('[data-view="page-manager-view"]');
  await page.waitForTimeout(1000);

  // Select JobSearchPage.js
  const jobSearchCard = page.locator('.page-manager-file-card', { hasText: 'JobSearchPage.js' });
  if (await jobSearchCard.count() > 0) {
    await jobSearchCard.first().click();
    await page.waitForTimeout(500);
  }

  // 1. Check View Mode
  const stage = page.locator('#pm-code-stage');
  const previewCode = page.locator('#page-manager-preview-code');
  const editor = page.locator('#page-manager-code-editor');
  const toggleBtn = page.locator('#pm-btn-toggle-edit');
  const inspectEditBtn = page.locator('#pm-inspect-edit-btn');
  const subnavEdit = page.locator('#pm-subnav-edit');

  const initialSyntaxTokens = await previewCode.locator('.syntax-keyword, .syntax-string').count();
  console.log(`[View Mode] Syntax highlighted tokens count: ${initialSyntaxTokens}`);
  const isReadonly = await editor.getAttribute('readonly');
  console.log(`[View Mode] Editor readonly: ${isReadonly !== null}`);

  // 2. Click "Chỉnh sửa mã" (inspectEditBtn or subnavEdit or toggleBtn)
  console.log('Clicking Chỉnh sửa mã...');
  if (await inspectEditBtn.isVisible()) {
    await inspectEditBtn.click();
  } else if (await toggleBtn.isVisible()) {
    await toggleBtn.click();
  }
  await page.waitForTimeout(500);

  const isEditingClass = await stage.evaluate((el) => el.classList.contains('editing'));
  console.log(`[Edit Mode] Stage has .editing class: ${isEditingClass}`);
  const isEditableNow = await editor.getAttribute('readonly');
  console.log(`[Edit Mode] Editor readonly removed: ${isEditableNow === null}`);

  const editSyntaxTokens = await previewCode.locator('.syntax-keyword, .syntax-string').count();
  console.log(`[Edit Mode] Syntax highlighted tokens count: ${editSyntaxTokens}`);

  // Check visibility of code preview in edit mode
  const previewComputedStyle = await previewCode.evaluate((el) => {
    const s = window.getComputedStyle(el);
    return {
      display: s.display,
      visibility: s.visibility,
      fontFamily: s.fontFamily,
      fontSize: s.fontSize,
      color: s.color,
    };
  });
  console.log('[Edit Mode] Preview Code Computed Style:', JSON.stringify(previewComputedStyle));

  const editorComputedStyle = await editor.evaluate((el) => {
    const s = window.getComputedStyle(el);
    return {
      display: s.display,
      caretColor: s.caretColor,
      webkitTextFillColor: s.webkitTextFillColor,
      backgroundColor: s.backgroundColor,
      fontSize: s.fontSize,
    };
  });
  console.log('[Edit Mode] Editor Textarea Computed Style:', JSON.stringify(editorComputedStyle));

  // 3. Test typing and live syntax highlight update
  console.log('Testing live typing in editor...');
  await editor.focus();
  // Scroll down a bit to inspect
  await editor.evaluate((el) => {
    el.value = el.value + '\n  async testNewAction() {\n    return "hello world";\n  }\n';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(300);

  const updatedTokens = await previewCode.locator('.syntax-keyword, .syntax-string').count();
  console.log(`[Live Edit] Tokens count after typing: ${updatedTokens}`);

  // Check dirty status badge & revert button
  const statusPillText = await page.locator('#pm-code-status').innerText();
  console.log(`[Live Edit] Status pill text: "${statusPillText.trim()}"`);
  const revertBtnVisible = await page.locator('#pm-btn-revert-code').isVisible();
  console.log(`[Live Edit] Revert button visible: ${revertBtnVisible}`);

  // Capture Screenshot: 1920x1080 Light Mode
  const artifactDir = path.resolve('C:/Users/Admin/.gemini/antigravity-ide/brain/45e0fbba-fe1c-423e-b2c7-8537b5a932e3');
  await page.screenshot({ path: path.join(artifactDir, 'pm_edit_mode_1920_light.png') });
  console.log('Saved pm_edit_mode_1920_light.png');

  // Test Revert
  console.log('Testing revert button...');
  await page.click('#pm-btn-revert-code');
  await page.waitForTimeout(400);
  const revertedTokens = await previewCode.locator('.syntax-keyword, .syntax-string').count();
  console.log(`[After Revert] Tokens count: ${revertedTokens}`);

  // Capture Screenshot: Dark Theme 1920x1080
  console.log('Switching to Dark Theme...');
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
  });
  // Click edit again to capture in dark theme edit mode
  await toggleBtn.click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(artifactDir, 'pm_edit_mode_1920_dark.png') });
  console.log('Saved pm_edit_mode_1920_dark.png');

  // Reset to light theme
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'light');
  });

  // Test 1440x900
  console.log('Testing 1440x900 viewport...');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(artifactDir, 'pm_edit_mode_1440.png') });
  console.log('Saved pm_edit_mode_1440.png');

  // Test 1280x800
  console.log('Testing 1280x800 viewport...');
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(artifactDir, 'pm_edit_mode_1280.png') });
  console.log('Saved pm_edit_mode_1280.png');

  // Test Mobile 375x812
  console.log('Testing Mobile 375x812 viewport...');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(artifactDir, 'pm_edit_mode_mobile_375.png') });
  console.log('Saved pm_edit_mode_mobile_375.png');

  // Check for any raw errors or undefined in page
  const pageText = await page.locator('#pm-code-stage').innerText();
  const hasUndefined = pageText.includes('undefined') || pageText.includes('null');
  console.log(`Has undefined or null in code stage: ${hasUndefined}`);
  console.log(`Console errors during test: ${consoleErrors.length}`, consoleErrors);

  await browser.close();
  console.log('All QA verification checks finished successfully!');
})();
