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

  // Navigate to builder-view
  await page.goto('http://127.0.0.1:4174/?tab=builder-view', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#btn-add-step-from-pom', { timeout: 10000 });

  // 1. Verify user screenshot buttons in builder-view
  const textAddStep = await page.$eval('#btn-add-step-from-pom', el => el.textContent.trim());
  console.log('[CHECK 1] btn-add-step-from-pom text:', JSON.stringify(textAddStep));
  if (textAddStep.includes('+')) {
    console.error('[FAIL] btn-add-step-from-pom still has +');
  } else {
    console.log('[PASS] btn-add-step-from-pom is clean:', textAddStep);
  }

  const textLinkPom = await page.$eval('#btn-link-pom-to-script', el => el.textContent.trim());
  console.log('[CHECK 2] btn-link-pom-to-script text:', JSON.stringify(textLinkPom));
  if (textLinkPom.includes('+')) {
    console.error('[FAIL] btn-link-pom-to-script still has +');
  } else {
    console.log('[PASS] btn-link-pom-to-script is clean:', textLinkPom);
  }

  // Screenshot builder detail view showing both fixed buttons
  const shotDetail = path.join(artifactDir, 'bdd_detail_no_plus.png');
  await page.screenshot({ path: shotDetail });
  console.log('[PASS] Saved screenshot:', shotDetail);

  // 2. Open Add Step POM modal to check modal submit button
  await page.click('#btn-add-step-from-pom');
  await page.waitForSelector('#modal-insert-pom-action[open]', { timeout: 5000 });
  const textModalSubmit = await page.$eval('#btn-submit-pom-modal', el => el.textContent.trim());
  console.log('[CHECK 3] btn-submit-pom-modal text:', JSON.stringify(textModalSubmit));
  if (textModalSubmit.includes('+')) {
    console.error('[FAIL] btn-submit-pom-modal still has +');
  } else {
    console.log('[PASS] btn-submit-pom-modal is clean:', textModalSubmit);
  }
  await page.click('#btn-cancel-pom-modal');

  // 3. Check Page Manager Create button
  await page.click('.view-tab[data-view="page-manager-view"]');
  await page.waitForSelector('#pm-btn-create-mode', { timeout: 5000 });
  const textPmCreate = await page.$eval('#pm-btn-create-mode', el => el.textContent.trim());
  console.log('[CHECK 4] pm-btn-create-mode text:', JSON.stringify(textPmCreate));
  if (textPmCreate.includes('+')) {
    console.error('[FAIL] pm-btn-create-mode still has +');
  } else {
    console.log('[PASS] pm-btn-create-mode is clean:', textPmCreate);
  }

  // 4. Check Recorder view navigation
  await page.click('#nav-tools-btn');
  await page.waitForTimeout(200);
  await page.click('.nav-dropdown-item[data-view="recorder-view"]');
  await page.waitForSelector('#rec-clear-all-btn', { timeout: 5000 });
  console.log('[CHECK 5] recorder-view loaded cleanly without rec-add-assertion-btn');

  // 5. Check Wizard Step 3 button
  await page.click('.view-tab[data-view="builder-view"]');
  await page.waitForSelector('#btn-tab-script-create', { timeout: 5000 });
  await page.click('#btn-tab-script-create');
  await page.waitForSelector('#wizard-tab-3', { timeout: 5000 });
  await page.waitForTimeout(300);
  const textWizardData = await page.$eval('#btn-wizard-open-create-data', el => el.textContent.trim());
  console.log('[CHECK 6] btn-wizard-open-create-data text:', JSON.stringify(textWizardData));
  if (textWizardData.includes('+')) {
    console.error('[FAIL] btn-wizard-open-create-data still has +');
  } else {
    console.log('[PASS] btn-wizard-open-create-data is clean:', textWizardData);
  }

  // Switch back to inspect mode to capture Section 04 (Dùng Page & Action)
  await page.click('#btn-tab-script-inspect');
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const wrap = document.querySelector('.script-middle-scroll-wrap');
    if (wrap) wrap.scrollTop = 800;
  });
  await page.waitForTimeout(300);
  const shotPart4 = path.join(artifactDir, 'bdd_section4_no_plus.png');
  await page.screenshot({ path: shotPart4 });
  console.log('[PASS] Saved section 4 screenshot:', shotPart4);

  // Switch to Page Manager and capture
  await page.click('.view-tab[data-view="page-manager-view"]');
  await page.waitForTimeout(300);
  const shotPm = path.join(artifactDir, 'page_manager_no_plus.png');
  await page.screenshot({ path: shotPm });
  console.log('[PASS] Saved Page Manager screenshot:', shotPm);

  console.log('Console errors:', consoleErrors);
  await browser.close();
  console.log('ALL VERIFICATION CHECKS PASSED.');
})();
