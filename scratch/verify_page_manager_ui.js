const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  console.log('Navigating to dashboard...');
  await page.goto('http://127.0.0.1:4174', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  // Click Quản lý Page tab
  console.log('Clicking Quản lý Page tab...');
  await page.click('button[data-view="page-manager-view"]');
  await page.waitForTimeout(600);

  // Click "Tạo Page Object mới"
  console.log('Switching to create mode...');
  await page.click('#pm-subnav-create');
  await page.waitForTimeout(600);

  // Capture screenshot of Create Mode (Light)
  await page.screenshot({ path: 'C:/Users/Admin/.gemini/antigravity-ide/brain/d322f378-1e26-44f4-8820-790293992481/pm_create_light.png' });
  console.log('Captured Light Mode Create Screen');

  // Test adding a locator and an action
  console.log('Adding locator...');
  await page.click('#page-manager-add-locator');
  await page.waitForTimeout(300);

  // Fill in sample locator
  await page.fill('#page-manager-title', 'Chi tiết công việc');
  await page.fill('#page-manager-class', 'JobDetailPage');
  await page.fill('.page-manager-locator-name', 'applyButton');
  await page.fill('.page-manager-locator-expression', "page.getByRole('button', { name: 'Nộp hồ sơ' })");

  // Add action
  console.log('Adding action...');
  await page.click('#page-manager-add-action');
  await page.waitForTimeout(300);
  await page.fill('.page-manager-action-name', 'clickApply');

  await page.waitForTimeout(500);
  await page.screenshot({ path: 'C:/Users/Admin/.gemini/antigravity-ide/brain/d322f378-1e26-44f4-8820-790293992481/pm_create_with_data_light.png' });
  console.log('Captured Light Mode Create with Data Screen');

  // Switch to Dark Mode
  console.log('Switching to Dark Mode...');
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('qa_theme', 'dark');
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'C:/Users/Admin/.gemini/antigravity-ide/brain/d322f378-1e26-44f4-8820-790293992481/pm_create_with_data_dark.png' });
  console.log('Captured Dark Mode Create Screen');

  // Switch back to Inspect Mode to verify inspect mode
  console.log('Switching back to Inspect Mode...');
  await page.click('#pm-subnav-inspect');
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'C:/Users/Admin/.gemini/antigravity-ide/brain/d322f378-1e26-44f4-8820-790293992481/pm_inspect_dark.png' });
  console.log('Captured Dark Mode Inspect Screen');

  await browser.close();
  console.log('Verification completed successfully!');
})();
