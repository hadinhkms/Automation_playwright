const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const viewports = [
    { name: '1440x900', width: 1440, height: 900 },
    { name: '1280px', width: 1280, height: 800 },
    { name: 'mobile_375px', width: 375, height: 667, isMobile: true },
  ];

  for (const vp of viewports) {
    console.log(`Kiểm tra viewport ${vp.name}...`);
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4174', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // BDD View
    await page.click('button[data-view="builder-view"]');
    await page.waitForTimeout(500);
    const firstScript = page.locator('.script-card-item').first();
    if (await firstScript.count() > 0) {
      await firstScript.click();
      await page.waitForTimeout(400);
    }
    await page.screenshot({ path: path.join(__dirname, `fixture_bdd_${vp.name}.png`) });

    // Page Manager View
    await page.click('button[data-view="page-manager-view"]');
    await page.waitForTimeout(500);
    await page.locator('.pm-filter-pill[data-platform="fixture"]').click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(__dirname, `fixture_pm_${vp.name}.png`) });

    await context.close();
  }

  await browser.close();
  console.log('=== MULTI-VIEWPORT VERIFICATION HOÀN TẤT ===');
})();
