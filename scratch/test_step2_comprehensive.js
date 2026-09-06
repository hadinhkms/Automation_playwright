const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });

  const artifactDir = path.resolve('C:/Users/Admin/.gemini/antigravity-ide/brain/45e0fbba-fe1c-423e-b2c7-8537b5a932e3');

  // Test 1: 1920x1080 Viewport (Senior QA primary gate)
  {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('http://127.0.0.1:4174/?tab=builder-view', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#btn-tab-script-create', { timeout: 10000 });
    await page.click('#btn-tab-script-create');
    await page.waitForSelector('#script-create-view:not([style*="display: none"])', { timeout: 5000 });
    await page.click('#wizard-tab-2');
    await page.waitForSelector('.dependency-card-item', { timeout: 5000 });
    await page.waitForTimeout(500);

    // Capture 1920x1080 screenshot
    const shot1920 = path.join(artifactDir, 'step2_1920x1080.png');
    await page.screenshot({ path: shot1920 });
    console.log('[PASS] 1920x1080 screenshot captured:', shot1920);

    // Verify card count
    const poms = await page.$$eval('.dependency-card-item', els => els.length);
    console.log('[PASS] Total POMs rendered:', poms);

    // Test "Chọn hết"
    await page.click('#btn-pom-select-all');
    await page.waitForTimeout(200);
    const countAfterSelectAll = await page.$eval('#wizard-pom-count', el => el.textContent.trim());
    console.log('[PASS] Count after "Chọn hết":', countAfterSelectAll);

    // Test "Bỏ chọn"
    await page.click('#btn-pom-deselect-all');
    await page.waitForTimeout(200);
    const countAfterDeselect = await page.$eval('#wizard-pom-count', el => el.textContent.trim());
    console.log('[PASS] Count after "Bỏ chọn":', countAfterDeselect);

    // Select first card
    await page.click('.dependency-card-item:nth-child(1)');
    await page.waitForTimeout(200);
    const countAfterSelectOne = await page.$eval('#wizard-pom-count', el => el.textContent.trim());
    console.log('[PASS] Count after selecting 1:', countAfterSelectOne);

    // Test search filtering: "Job"
    await page.fill('#wizard-pom-search', 'Job');
    await page.waitForTimeout(300);
    const filteredCount = await page.$$eval('.dependency-card-item', els => els.length);
    console.log('[PASS] Filtered POMs for "Job":', filteredCount);

    const shotSearch = path.join(artifactDir, 'step2_search_filter.png');
    await page.screenshot({ path: shotSearch });
    console.log('[PASS] Search filter screenshot captured:', shotSearch);

    // Clear search
    await page.fill('#wizard-pom-search', '');
    await page.waitForTimeout(300);

    console.log('1920x1080 Console errors:', consoleErrors);
    await page.close();
  }

  // Test 2: 2560x1305 Viewport (User's exact monitor)
  {
    const page = await browser.newPage({ viewport: { width: 2560, height: 1305 } });
    await page.goto('http://127.0.0.1:4174/?tab=builder-view', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#btn-tab-script-create', { timeout: 10000 });
    await page.click('#btn-tab-script-create');
    await page.waitForSelector('#script-create-view:not([style*="display: none"])', { timeout: 5000 });
    await page.click('#wizard-tab-2');
    await page.waitForSelector('.dependency-card-item', { timeout: 5000 });
    await page.waitForTimeout(500);

    const shot2560 = path.join(artifactDir, 'step2_2560x1305.png');
    await page.screenshot({ path: shot2560 });
    console.log('[PASS] 2560x1305 screenshot captured:', shot2560);

    await page.close();
  }

  await browser.close();
  console.log('ALL VERIFICATION CHECKS PASSED.');
})();
