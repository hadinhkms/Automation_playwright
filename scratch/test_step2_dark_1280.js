const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const artifactDir = path.resolve('C:/Users/Admin/.gemini/antigravity-ide/brain/45e0fbba-fe1c-423e-b2c7-8537b5a932e3');

  // Dark mode test
  {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await page.goto('http://127.0.0.1:4174/?tab=builder-view', { waitUntil: 'domcontentloaded' });
    
    // Toggle dark theme
    await page.evaluate(() => {
      document.body.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    });
    await page.waitForTimeout(200);

    await page.waitForSelector('#btn-tab-script-create', { timeout: 10000 });
    await page.click('#btn-tab-script-create');
    await page.waitForSelector('#script-create-view:not([style*="display: none"])', { timeout: 5000 });
    await page.click('#wizard-tab-2');
    await page.waitForSelector('.dependency-card-item', { timeout: 5000 });
    await page.waitForTimeout(500);

    const shotDark = path.join(artifactDir, 'step2_dark_theme.png');
    await page.screenshot({ path: shotDark });
    console.log('[PASS] Dark theme screenshot captured:', shotDark);
    await page.close();
  }

  // 1280px viewport test
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto('http://127.0.0.1:4174/?tab=builder-view', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#btn-tab-script-create', { timeout: 10000 });
    await page.click('#btn-tab-script-create');
    await page.waitForSelector('#script-create-view:not([style*="display: none"])', { timeout: 5000 });
    await page.click('#wizard-tab-2');
    await page.waitForSelector('.dependency-card-item', { timeout: 5000 });
    await page.waitForTimeout(500);

    const shot1280 = path.join(artifactDir, 'step2_1280px.png');
    await page.screenshot({ path: shot1280 });
    console.log('[PASS] 1280px screenshot captured:', shot1280);
    await page.close();
  }

  await browser.close();
})();
