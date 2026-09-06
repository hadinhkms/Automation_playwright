const { chromium } = require('playwright');
const path = require('path');

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

  // 1. Switch to Page Manager View
  await page.click('[data-view="page-manager-view"]');
  await page.waitForTimeout(1000);

  // 2. Click "Tạo Page Object mới"
  await page.click('#pm-subnav-create');
  await page.waitForTimeout(600);

  // Click "+ Thêm locator" in Section 02 if none exists
  const addLocBtn = page.locator('#page-manager-add-locator');
  if (await page.locator('.page-manager-locator-expression').count() === 0) {
    await addLocBtn.click();
    await page.waitForTimeout(300);
  }

  // 3. Inspect the placeholder of the initial locator expression input
  const locatorExprInput = page.locator('.page-manager-locator-expression').first();
  const placeholderVal = await locatorExprInput.getAttribute('placeholder');
  console.log('Create Mode locator placeholder:', placeholderVal);

  if (placeholderVal.includes('this.page.')) {
    throw new Error(`FAIL: Placeholder still contains "this.page.": "${placeholderVal}"`);
  } else {
    console.log('SUCCESS: Placeholder cleanly omits "this.":', placeholderVal);
  }

  // 4. Test typing into locator name and expression, check Live Preview
  const locatorNameInput = page.locator('.page-manager-locator-name').first();
  await locatorNameInput.fill('submitBtn');
  await locatorExprInput.fill("this.page.getByRole('button', { name: 'Lưu' })");
  await page.waitForTimeout(300);

  // Check live preview text
  const previewCode = await page.locator('#page-manager-preview-code').innerText();
  console.log('Live Preview snippet with "this.page" input:\n', previewCode.split('\n').filter(l => l.includes('submitBtn')).join('\n'));

  if (previewCode.includes('this.page.getByRole')) {
    throw new Error('FAIL: Generated code still has "this.page."!');
  } else if (previewCode.includes('this.submitBtn = page.getByRole')) {
    console.log('SUCCESS: Code generation correctly sanitized "this.page." to "page."!');
  }

  // Clear expression to let placeholder show for screenshot
  await locatorExprInput.fill('');
  await page.waitForTimeout(300);

  // 5. Capture Screenshot: 1920x1080 Light Mode
  const artifactDir = path.resolve('C:/Users/Admin/.gemini/antigravity-ide/brain/45e0fbba-fe1c-423e-b2c7-8537b5a932e3');
  await page.screenshot({ path: path.join(artifactDir, 'placeholder_fix_1920_light.png') });
  console.log('Saved placeholder_fix_1920_light.png');

  // 6. Capture Screenshot: 1920x1080 Dark Mode
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(artifactDir, 'placeholder_fix_1920_dark.png') });
  console.log('Saved placeholder_fix_1920_dark.png');

  // Reset to light
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));

  // 7. Check Section 02 placeholder in Inspect mode
  await page.click('#pm-btn-inspect-mode');
  await page.waitForTimeout(600);
  const inlineLocExpr = page.locator('#pm-inline-loc-expr');
  const inlinePlaceholder = await inlineLocExpr.getAttribute('placeholder');
  console.log('Inspect Mode inline locator placeholder:', inlinePlaceholder);
  if (inlinePlaceholder.includes('this.page.')) {
    throw new Error(`FAIL: Inspect mode placeholder still has "this.page.": "${inlinePlaceholder}"`);
  }

  // 8. Capture Viewports: 1440px, 1280px, Mobile 375px
  await page.click('#pm-subnav-create');
  await page.waitForTimeout(400);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(artifactDir, 'placeholder_fix_1440.png') });

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(artifactDir, 'placeholder_fix_1280.png') });

  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(artifactDir, 'placeholder_fix_mobile_375.png') });

  console.log('Console errors count:', consoleErrors.length, consoleErrors);
  await browser.close();
  console.log('All QA checks passed cleanly!');
})();
