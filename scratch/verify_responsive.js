const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });

  // 1. Check 1440x900
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4174/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    const recTab = page.locator('.view-tab[data-view="recorder-view"]');
    if (await recTab.count() > 0 && await recTab.isVisible()) {
      await recTab.click();
    } else {
      await page.locator('#nav-tools-btn').click();
      await page.locator('.nav-dropdown-item[data-view="recorder-view"]').click();
    }
    await page.waitForSelector('#recorder-view', { state: 'visible', timeout: 5000 });
    await page.screenshot({ path: path.join(__dirname, 'recorder_1440x900.png') });
    await context.close();
  }

  // 2. Check Dark Mode at 1920x1080
  {
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4174/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    // Toggle dark theme
    const themeBtn = page.locator('#theme-button');
    if (await themeBtn.count() > 0) {
      await themeBtn.click();
      await page.waitForTimeout(300);
    }

    const recTab = page.locator('.view-tab[data-view="recorder-view"]');
    if (await recTab.count() > 0 && await recTab.isVisible()) {
      await recTab.click();
    } else {
      await page.locator('#nav-tools-btn').click();
      await page.locator('.nav-dropdown-item[data-view="recorder-view"]').click();
    }
    await page.waitForSelector('#recorder-view', { state: 'visible', timeout: 5000 });
    await page.screenshot({ path: path.join(__dirname, 'recorder_dark_mode.png') });
    await context.close();
  }

  await browser.close();
  console.log('Responsive and Dark Mode checks completed successfully!');
})();
