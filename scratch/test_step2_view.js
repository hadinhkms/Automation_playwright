const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // Collect console errors
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  await page.goto('http://127.0.0.1:4174/?tab=builder-view', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#btn-tab-script-create', { timeout: 10000 });

  // Click on "Tạo kịch bản BDD mới" subtab
  await page.click('#btn-tab-script-create');
  await page.waitForSelector('#script-create-view:not([style*="display: none"])', { timeout: 5000 });

  // Go to Step 2
  await page.click('#wizard-tab-2');
  await page.waitForSelector('.dependency-card-item', { timeout: 5000 });
  await page.waitForTimeout(500);

  // Take screenshot of step 2
  const screenshotPath = path.resolve(__dirname, 'step2_current_view.png');
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log('Screenshot saved to:', screenshotPath);
  console.log('Console errors:', consoleErrors);

  // Check element states
  const poms = await page.$$eval('.dependency-card-item', els => els.map(el => el.textContent.trim().replace(/\s+/g, ' ')));
  console.log('POM count rendered:', poms.length);
  poms.forEach(p => console.log('  -', p));

  const boxHeight = await page.$eval('#wizard-pom-list', el => ({
    clientHeight: el.clientHeight,
    scrollHeight: el.scrollHeight,
    offsetHeight: el.offsetHeight,
  }));
  console.log('Box dimensions:', boxHeight);

  await browser.close();
})();
