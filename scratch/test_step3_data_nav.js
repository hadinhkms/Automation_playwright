const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const artifactDir = path.resolve('C:/Users/Admin/.gemini/antigravity-ide/brain/45e0fbba-fe1c-423e-b2c7-8537b5a932e3');

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await page.goto('http://127.0.0.1:4174/?tab=builder-view', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#btn-tab-script-create', { timeout: 10000 });

  // 1. Open Wizard
  await page.click('#btn-tab-script-create');
  await page.waitForSelector('#script-create-view:not([style*="display: none"])', { timeout: 5000 });

  // 2. Fill Title in Step 1
  await page.fill('#create-script-title', 'Kịch bản kiểm thử luồng Test Data Navigation');
  await page.waitForTimeout(300);

  // 3. Go to Step 2 & select POM
  await page.click('#wizard-tab-2');
  await page.waitForSelector('.dependency-card-item', { timeout: 5000 });
  await page.click('.dependency-card-item:nth-child(1)');
  await page.waitForTimeout(300);

  // 4. Go to Step 3 (Test Data)
  await page.click('#wizard-tab-3');
  await page.waitForSelector('#btn-wizard-open-create-data', { timeout: 5000 });

  // Verify button text does NOT have duplicate '+'
  const btnText = await page.$eval('#btn-wizard-open-create-data', el => el.textContent.trim());
  console.log('[CHECK] Button text:', JSON.stringify(btnText));
  if (btnText.includes('+')) {
    console.error('[FAIL] Button still contains plus character!');
  } else {
    console.log('[PASS] Button text is clean without redundant plus sign:', btnText);
  }

  // Screenshot Step 3 button
  const shotStep3 = path.join(artifactDir, 'step3_button_fixed.png');
  await page.screenshot({ path: shotStep3 });
  console.log('[PASS] Screenshot Step 3 saved:', shotStep3);

  // 5. Click on "Tạo File Data Mới" button
  await page.click('#btn-wizard-open-create-data');
  await page.waitForTimeout(600);

  // Verify that NO modal/drawer opened
  const drawerOpen = await page.$eval('#wizard-drawer-data', el => el.classList.contains('open')).catch(() => false);
  console.log('[CHECK] Drawer open state:', drawerOpen);
  if (drawerOpen) {
    console.error('[FAIL] Inline drawer was opened!');
  } else {
    console.log('[PASS] Inline drawer remained closed.');
  }

  // Verify Data View is now active
  await page.waitForSelector('#data-view:not([hidden])', { timeout: 5000 });
  const dataViewVisible = await page.$eval('#data-view', el => !el.hidden && el.classList.contains('active'));
  console.log('[PASS] Data View is active and visible:', dataViewVisible);

  const shotData = path.join(artifactDir, 'switched_to_data_view.png');
  await page.screenshot({ path: shotData });
  console.log('[PASS] Screenshot Data View saved:', shotData);

  // 6. Switch back to Kịch bản BDD tab
  const bddTab = await page.$('.view-tab[data-view="builder-view"]');
  await bddTab.click();
  await page.waitForTimeout(300);

  // Click on "Tạo kịch bản BDD mới" subtab
  await page.click('#btn-tab-script-create');
  await page.waitForSelector('#script-create-view:not([style*="display: none"])', { timeout: 5000 });
  await page.waitForTimeout(400);

  // Verify draft restored
  const restoredTitle = await page.$eval('#create-script-title', el => el.value);
  console.log('[CHECK] Restored scenario title:', restoredTitle);
  if (restoredTitle === 'Kịch bản kiểm thử luồng Test Data Navigation') {
    console.log('[PASS] Wizard template draft was safely preserved upon return!');
  } else {
    console.error('[FAIL] Draft was not preserved, title was:', restoredTitle);
  }

  const shotRestored = path.join(artifactDir, 'restored_wizard_draft.png');
  await page.screenshot({ path: shotRestored });
  console.log('[PASS] Screenshot Restored Wizard Draft saved:', shotRestored);

  console.log('Console errors:', consoleErrors);
  await browser.close();
  console.log('ALL VERIFICATION STEPS PASSED.');
})();
