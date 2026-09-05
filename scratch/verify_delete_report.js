const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REPORT_DIR = path.join(ROOT, 'playwright-report');
const TEST_DATE_FOLDER = '99-99-99';
const TEST_REPORT_REL = `${TEST_DATE_FOLDER}/desktop/dummy_spec/[99-99-99 12-00-00-000 mock] report`;
const TEST_REPORT_ABS = path.join(REPORT_DIR, TEST_REPORT_REL);

function setupMockReport() {
  fs.mkdirSync(TEST_REPORT_ABS, { recursive: true });
  fs.writeFileSync(path.join(TEST_REPORT_ABS, 'index.html'), '<!DOCTYPE html><html><body>Mock Report</body></html>', 'utf8');
  fs.writeFileSync(path.join(TEST_REPORT_ABS, 'trace.zip'), 'mock trace', 'utf8');
}

function cleanupMockReport() {
  const topMockDir = path.join(REPORT_DIR, TEST_DATE_FOLDER);
  if (fs.existsSync(topMockDir)) {
    fs.rmSync(topMockDir, { recursive: true, force: true });
  }
}

async function testBackendApi() {
  console.log('--- Testing Backend API: DELETE /api/artifact ---');
  setupMockReport();

  // Test 1: Invalid folder (empty or traversal)
  const res1 = await fetch('http://127.0.0.1:4174/api/artifact', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'report-folder', path: '../invalid' }),
  });
  const data1 = await res1.json();
  console.log('Test 1 (Traversal rejection):', res1.status === 400 && !!data1.error ? 'PASS' : 'FAIL', data1);

  // Test 2: Non-existent folder
  const res2 = await fetch('http://127.0.0.1:4174/api/artifact', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'report-folder', path: 'non_existent_folder_xyz' }),
  });
  const data2 = await res2.json();
  console.log('Test 2 (Non-existent folder rejection):', res2.status === 400 && !!data2.error ? 'PASS' : 'FAIL', data2);

  // Test 3: Delete valid mock report folder
  const res3 = await fetch('http://127.0.0.1:4174/api/artifact', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'report-folder', path: TEST_REPORT_REL }),
  });
  const data3 = await res3.json();
  const deletedOnDisk = !fs.existsSync(TEST_REPORT_ABS);
  const parentCleaned = !fs.existsSync(path.join(REPORT_DIR, TEST_DATE_FOLDER));
  console.log('Test 3 (Valid report folder delete & parent cleanup):',
    res3.status === 200 && deletedOnDisk && parentCleaned ? 'PASS' : 'FAIL',
    { message: data3.message, deletedOnDisk, parentCleaned }
  );

  cleanupMockReport();
}

async function testUi() {
  console.log('\n--- Testing UI & Explorer Report Tree ---');
  setupMockReport();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  try {
    await page.goto('http://127.0.0.1:4174/?tab=resources', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // Switch to resources-view if not already
    const resTabBtn = page.locator('button[data-view="resources-view"]');
    if (await resTabBtn.isVisible() && !await resTabBtn.evaluate(el => el.classList.contains('active'))) {
      await resTabBtn.click();
      await page.waitForTimeout(1000);
    }

    // Filter or locate the mock report folder
    const mockFolderSummary = page.locator(`.evidence-folder.report-folder[data-report-folder="${TEST_DATE_FOLDER}"] > summary`);
    await mockFolderSummary.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✔ Found mock report folder in explorer tree:', TEST_DATE_FOLDER);

    // Hover over the summary to reveal delete button
    await mockFolderSummary.hover();
    const deleteBtn = mockFolderSummary.locator('button.delete-folder-button[data-type="report-folder"]');
    await deleteBtn.waitFor({ state: 'visible', timeout: 2000 });
    console.log('✔ Delete folder button is rendered and visible on hover!');

    // Screenshot light theme hover
    await page.screenshot({ path: 'C:/Users/Admin/.gemini/antigravity-ide/brain/ee56fcc5-6f39-485d-9b11-77f26fe61d72/report_delete_btn_hover.png' });

    // Setup dialog listener to accept confirm
    let dialogMessage = '';
    page.once('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      console.log('✔ Confirmation dialog triggered:', dialogMessage);
      await dialog.accept();
    });

    // Click the delete button
    await deleteBtn.click();
    await page.waitForTimeout(1500);

    // Check if the mock folder is removed from DOM and disk
    const mockFolderStillInDom = await page.locator(`.evidence-folder.report-folder[data-report-folder="${TEST_DATE_FOLDER}"]`).count();
    const mockFolderStillOnDisk = fs.existsSync(path.join(REPORT_DIR, TEST_DATE_FOLDER));

    console.log('Test 4 (UI click delete & auto refresh):',
      mockFolderStillInDom === 0 && !mockFolderStillOnDisk ? 'PASS' : 'FAIL',
      { mockFolderStillInDom, mockFolderStillOnDisk }
    );

    // Check console errors
    console.log('Test 5 (Zero console errors):', consoleErrors.length === 0 ? 'PASS' : 'FAIL', consoleErrors);

    // Test dark mode on an existing report folder
    const themeToggle = page.locator('#theme-button');
    if (await themeToggle.isVisible()) {
      await themeToggle.click();
      await page.waitForTimeout(500);
    }
    const anyReportFolder = page.locator('.evidence-folder.report-folder > summary').first();
    if (await anyReportFolder.isVisible()) {
      await anyReportFolder.hover();
      await page.screenshot({ path: 'C:/Users/Admin/.gemini/antigravity-ide/brain/ee56fcc5-6f39-485d-9b11-77f26fe61d72/report_delete_btn_dark.png' });
      console.log('✔ Captured dark theme hover screenshot');
    }

    // Toggle back to light theme
    if (await themeToggle.isVisible()) {
      await themeToggle.click();
      await page.waitForTimeout(300);
    }

  } finally {
    await browser.close();
    cleanupMockReport();
  }
}

async function run() {
  await testBackendApi();
  await testUi();
}

run().catch((err) => {
  console.error('Test script failed:', err);
  cleanupMockReport();
  process.exit(1);
});
