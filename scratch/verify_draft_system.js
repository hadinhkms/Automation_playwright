const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
const DASHBOARD_URL = 'http://127.0.0.1:4174';
const ARTIFACT_DIR = 'C:/Users/Admin/.gemini/antigravity-ide/brain/ee56fcc5-6f39-485d-9b11-77f26fe61d72';

async function runVerification() {
  console.log('=== SENIOR QA VERIFICATION GATE: DRAFT SYSTEM ===');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  try {
    // ----------------------------------------------------
    // TEST 1: Script Wizard Draft Save, Persist & Finalize
    // ----------------------------------------------------
    console.log('\n--- TEST 1: BDD Script Wizard Draft Lifecycle ---');
    await page.goto(`${DASHBOARD_URL}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);

    // Switch to BDD tab
    await page.locator('.view-tab[data-view="builder-view"]').click();
    await page.waitForTimeout(600);

    // Click "Tạo kịch bản mới"
    const createBtn = page.locator('#btn-tab-script-create');
    await createBtn.click();
    await page.waitForTimeout(600);

    // Fill Step 1
    const testScenario = 'Kịch bản kiểm thử quy trình nháp auto QA';
    const testFeature = 'Tính năng bản nháp độc lập';
    const testFile = 'draft_qa_workflow-bdd.spec.js';

    await page.locator('#create-script-title').fill(testScenario);
    await page.locator('#create-script-feature').fill(testFeature);
    await page.locator('#create-script-filename').fill(testFile);
    await page.locator('#create-script-platform').selectOption('desktop');

    // Click "Lưu bản nháp"
    console.log('Clicking "Lưu bản nháp" button in Script Wizard...');
    const btnSaveDraft = page.locator('#btn-save-draft-script');
    await assert.ok(await btnSaveDraft.isVisible(), 'Nút Lưu bản nháp kịch bản phải hiển thị');
    await btnSaveDraft.click();
    await page.waitForTimeout(1200);

    // Check disk storage for draft
    const scriptDraftFile = path.join(ROOT, '.dashboard-drafts', 'scripts', 'draft_script_active.json');
    assert.ok(fs.existsSync(scriptDraftFile), 'File draft_script_active.json phải tồn tại trên ổ đĩa (.dashboard-drafts/scripts/)');
    const savedDraftContent = JSON.parse(fs.readFileSync(scriptDraftFile, 'utf8'));
    assert.equal(savedDraftContent.data.scenarioName, testScenario, 'Nội dung draft lưu trên disk phải đúng scenarioName');
    console.log('✔ Script draft verified on disk:', scriptDraftFile);

    // Check UI badge
    const scriptBadge = page.locator('#script-wizard-draft-badge');
    await assert.ok(await scriptBadge.isVisible(), 'Huy hiệu draft phải hiển thị');
    const badgeText = await scriptBadge.textContent();
    console.log('✔ Script draft status badge:', badgeText.trim());

    // Advance through Wizard to Step 6
    for (let step = 1; step <= 5; step++) {
      const nextBtn = page.locator('#btn-wizard-next');
      await nextBtn.click();
      await page.waitForTimeout(500);
    }

    // Now on Step 6, verify finish button
    const finishBtn = page.locator('#btn-wizard-next');
    const finishText = await finishBtn.textContent();
    console.log('On Step 6, button text is:', finishText.trim());

    // Click "Lưu kịch bản BDD"
    await finishBtn.click();
    await page.waitForTimeout(2500);

    // Verify file created in tests/e2e/desktop/
    const targetSpecPath = path.join(ROOT, 'tests', 'e2e', 'desktop', testFile);
    assert.ok(fs.existsSync(targetSpecPath), `File kịch bản ${testFile} phải được tạo trong tests/e2e/desktop/`);
    console.log('✔ Final spec file created at:', targetSpecPath);

    // Verify draft file cleaned up
    assert.ok(!fs.existsSync(scriptDraftFile), 'File draft_script_active.json phải được tự động dọn dẹp sau khi tạo thành công');
    console.log('✔ Script draft cleaned up from disk successfully.');

    // Clean up created test spec
    if (fs.existsSync(targetSpecPath)) {
      fs.unlinkSync(targetSpecPath);
      console.log('✔ Cleaned up temporary test spec.');
    }

    // ----------------------------------------------------
    // TEST 2: Page Manager Draft Save, Restore & Finalize
    // ----------------------------------------------------
    console.log('\n--- TEST 2: Page Manager Draft Lifecycle ---');
    await page.goto(`${DASHBOARD_URL}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);

    // Switch to Page Manager tab
    await page.locator('.view-tab[data-view="page-manager-view"]').click();
    await page.waitForTimeout(600);

    // Switch to create mode
    const pmCreateModeBtn = page.locator('#pm-btn-create-mode');
    await pmCreateModeBtn.click();
    await page.waitForTimeout(600);

    const testPageTitle = 'Màn hình kiểm thử nháp QA';
    const testPageClass = 'QaDraftSamplePage';
    const testPageDesc = 'Mô tả trang kiểm thử nháp';

    await page.locator('#page-manager-title').fill(testPageTitle);
    await page.locator('#page-manager-class').fill(testPageClass);
    await page.locator('#page-manager-description').fill(testPageDesc);
    await page.locator('#page-manager-platform').selectOption('desktop');

    // Add a locator
    await page.locator('#page-manager-add-locator').click();
    await page.waitForTimeout(300);
    const locatorRow = page.locator('#page-manager-locators .page-manager-row').first();
    await locatorRow.locator('.page-manager-locator-name').fill('btnDraftSample');
    await locatorRow.locator('.page-manager-locator-expression').fill("this.page.locator('#btn-sample')");

    // Add an action
    await page.locator('#page-manager-add-action').click();
    await page.waitForTimeout(300);
    const actionRow = page.locator('#page-manager-actions .page-manager-row').first();
    await actionRow.locator('.page-manager-action-name').fill('clickDraftSample');

    // Click "Lưu nháp"
    console.log('Clicking "Lưu nháp" button in Page Manager...');
    const pmBtnSaveDraft = page.locator('#pm-btn-save-draft');
    await assert.ok(await pmBtnSaveDraft.isVisible(), 'Nút Lưu nháp Page Object phải hiển thị');
    await pmBtnSaveDraft.click();
    await page.waitForTimeout(1200);

    // Check disk storage for page draft
    const pageDraftFile = path.join(ROOT, '.dashboard-drafts', 'pages', 'draft_page_active.json');
    assert.ok(fs.existsSync(pageDraftFile), 'File draft_page_active.json phải tồn tại trên ổ đĩa (.dashboard-drafts/pages/)');
    const savedPageDraftContent = JSON.parse(fs.readFileSync(pageDraftFile, 'utf8'));
    assert.equal(savedPageDraftContent.data.className, testPageClass, 'Nội dung page draft lưu trên disk phải đúng className');
    console.log('✔ Page draft verified on disk:', pageDraftFile);

    // Check UI badge
    const pmBadge = page.locator('#pm-draft-status-badge');
    await assert.ok(await pmBadge.isVisible(), 'Huy hiệu draft Page Manager phải hiển thị');
    const pmBadgeText = await pmBadge.textContent();
    console.log('✔ Page draft status badge:', pmBadgeText.trim());

    // Switch to inspect mode then back to create mode to test recovery banner
    console.log('Testing recovery banner...');
    await page.locator('#pm-btn-inspect-mode').click();
    await page.waitForTimeout(500);
    await pmCreateModeBtn.click();
    await page.waitForTimeout(800);

    const pmRecoveryBanner = page.locator('#pm-draft-recovery-banner');
    await assert.ok(await pmRecoveryBanner.isVisible(), 'Banner khôi phục bản nháp phải hiển thị');
    console.log('✔ Recovery banner visible:', (await page.locator('#pm-draft-recovery-text').textContent()).trim());

    // Click "Khôi phục"
    await page.locator('#pm-btn-restore-draft').click();
    await page.waitForTimeout(500);

    // Verify restored values
    assert.equal(await page.locator('#page-manager-class').inputValue(), testPageClass, 'ClassName phải được khôi phục chính xác');
    console.log('✔ Restored values verified successfully.');

    // Click "Tạo file Page Object"
    console.log('Finalizing Page Object creation...');
    await page.locator('#page-manager-create').click();
    await page.waitForTimeout(2000);

    // Verify file created in pages/desktop/
    const targetPagePath = path.join(ROOT, 'pages', 'desktop', `${testPageClass}.js`);
    assert.ok(fs.existsSync(targetPagePath), `File Page Object ${testPageClass}.js phải được tạo trong pages/desktop/`);
    console.log('✔ Final Page Object file created at:', targetPagePath);

    // Verify draft file cleaned up
    assert.ok(!fs.existsSync(pageDraftFile), 'File draft_page_active.json phải được tự động dọn dẹp sau khi tạo thành công');
    console.log('✔ Page draft cleaned up from disk successfully.');

    // Clean up created Page Object
    if (fs.existsSync(targetPagePath)) {
      fs.unlinkSync(targetPagePath);
      console.log('✔ Cleaned up temporary Page Object.');
    }

    // ----------------------------------------------------
    // TEST 3: Visual & Responsive Multi-Viewport Inspection
    // ----------------------------------------------------
    console.log('\n--- TEST 3: Responsive & Theme Visual Verification ---');

    // 1920x1080 Desktop Light
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.locator('.view-tab[data-view="builder-view"]').click();
    await page.waitForTimeout(500);
    await page.locator('#btn-tab-script-create').click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'qa_draft_1920x1080_bdd_light.png') });

    // 1440x900 Desktop
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'qa_draft_1440x900_bdd.png') });

    // Page Manager 1920x1080 Light
    await page.locator('.view-tab[data-view="page-manager-view"]').click();
    await page.waitForTimeout(500);
    await page.locator('#pm-btn-create-mode').click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'qa_draft_1920x1080_page_manager.png') });

    // Dark Theme Check
    const themeBtn = page.locator('#theme-button');
    if (await themeBtn.isVisible()) {
      await themeBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'qa_draft_dark_theme_page_manager.png') });
      console.log('✔ Dark theme screenshot captured.');
      // Switch back to light
      await themeBtn.click();
    }

    // Mobile Viewport 375x812
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'qa_draft_mobile_375x812.png') });
    console.log('✔ Mobile 375x812 screenshot captured.');

    console.log('\nConsole error count:', consoleErrors.length);
    if (consoleErrors.length > 0) {
      console.log('Console errors:', consoleErrors);
    }
    assert.equal(consoleErrors.length, 0, 'Không được có bất kỳ console error nào!');

    console.log('\n=========================================');
    console.log('ALL SENIOR QA CHECKS PASSED WITH 100% SUCCESS!');
    console.log('=========================================');
  } finally {
    await browser.close();
  }
}

runVerification().catch((err) => {
  console.error('\n❌ VERIFICATION FAILED:', err);
  process.exit(1);
});
