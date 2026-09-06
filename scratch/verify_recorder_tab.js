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

  console.log('Navigating to http://127.0.0.1:4174/ ...');
  await page.goto('http://127.0.0.1:4174/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  // Open Recorder view
  console.log('Opening Recorder view...');
  const recTab = page.locator('.view-tab[data-view="recorder-view"]');
  if (await recTab.count() > 0 && await recTab.isVisible()) {
    await recTab.click();
  } else {
    // Check dropdown
    const navTools = page.locator('#nav-tools-btn');
    if (await navTools.count() > 0) {
      await navTools.click();
      await page.locator('.nav-dropdown-item[data-view="recorder-view"]').click();
    }
  }

  await page.waitForSelector('#recorder-view', { state: 'visible', timeout: 5000 });
  console.log('Recorder view is visible!');

  // Check Step 1 essential elements
  const recUrl = await page.locator('#rec-url').count();
  const recPlatform = await page.locator('#rec-platform').count();
  const recStartBtn = await page.locator('#rec-start-btn').count();
  const recStopBtn = await page.locator('#rec-stop-btn').count();
  const recClearAllBtn = await page.locator('#rec-clear-all-btn').count();
  const recRefreshListBtn = await page.locator('#rec-refresh-list-btn').count();
  const recentList = await page.locator('#recent-recordings-list').count();

  console.log('Step 1 essentials:');
  console.log('  #rec-url:', recUrl === 1 ? 'PASS' : 'FAIL');
  console.log('  #rec-platform:', recPlatform === 1 ? 'PASS' : 'FAIL');
  console.log('  #rec-start-btn:', recStartBtn === 1 ? 'PASS' : 'FAIL');
  console.log('  #rec-stop-btn:', recStopBtn === 1 ? 'PASS' : 'FAIL');
  console.log('  #rec-clear-all-btn:', recClearAllBtn === 1 ? 'PASS' : 'FAIL');
  console.log('  #rec-refresh-list-btn:', recRefreshListBtn === 1 ? 'PASS' : 'FAIL');
  console.log('  #recent-recordings-list:', recentList === 1 ? 'PASS' : 'FAIL');

  // Verify removed misplaced / duplicate elements
  const recAddAssertionBtn = await page.locator('#rec-add-assertion-btn').count();
  const modalAddAssertion = await page.locator('#modal-add-assertion').count();
  const recStep3AutoCaptureBtn = await page.locator('#rec-step3-auto-capture-btn').count();
  const draftAutoCaptureBtn = await page.locator('#draft-auto-capture-btn').count();

  console.log('Removed duplicate / misplaced elements:');
  console.log('  #rec-add-assertion-btn count (expected 0):', recAddAssertionBtn, recAddAssertionBtn === 0 ? 'PASS' : 'FAIL');
  console.log('  #modal-add-assertion count (expected 0):', modalAddAssertion, modalAddAssertion === 0 ? 'PASS' : 'FAIL');
  console.log('  #rec-step3-auto-capture-btn count (expected 0):', recStep3AutoCaptureBtn, recStep3AutoCaptureBtn === 0 ? 'PASS' : 'FAIL');
  console.log('  #draft-auto-capture-btn count (expected 1):', draftAutoCaptureBtn, draftAutoCaptureBtn === 1 ? 'PASS' : 'FAIL');

  // Take screenshot of Step 1
  const screenshotPath = path.join(__dirname, 'recorder_clean_step1.png');
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log('Screenshot saved to:', screenshotPath);

  // Check console errors
  console.log('Browser console errors:', consoleErrors.length === 0 ? 'None (PASS)' : consoleErrors);

  await browser.close();
  console.log('Verification completed successfully!');
})();
