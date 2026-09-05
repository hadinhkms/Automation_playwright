const { chromium } = require('playwright');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/Admin/.gemini/antigravity-ide/brain/ee56fcc5-6f39-485d-9b11-77f26fe61d72';

async function verifyQaGate() {
  const browser = await chromium.launch({ headless: true });
  const viewports = [
    { name: '1920x1080', width: 1920, height: 1080 },
    { name: '1440x900', width: 1440, height: 900 },
    { name: '1280x800', width: 1280, height: 800 },
    { name: 'mobile_390x844', width: 390, height: 844 },
  ];

  for (const vp of viewports) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();
    const errors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('http://127.0.0.1:4174/?tab=resources', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // Hover on first report folder
    const reportSummary = page.locator('.evidence-folder.report-folder > summary').first();
    if (await reportSummary.isVisible()) {
      await reportSummary.hover();
      await page.waitForTimeout(300);
      const deleteBtn = reportSummary.locator('.delete-folder-button');
      const isDeleteVisible = await deleteBtn.isVisible();
      console.log(`[${vp.name}] Report folder delete button visible on hover:`, isDeleteVisible);
    }

    // Check for 'undefined', 'null', 'TODO' in the tree
    const treeText = await page.locator('#resource-list').innerText();
    const hasUndefined = treeText.includes('undefined');
    const hasNull = treeText.includes('null');
    const hasTodo = treeText.includes('TODO');
    console.log(`[${vp.name}] UI text hygiene check:`, { hasUndefined, hasNull, hasTodo, errorsCount: errors.length });

    // Capture screenshot for 1920 and 1440
    if (vp.name === '1920x1080') {
      await page.screenshot({ path: `${ARTIFACT_DIR}/report_tree_qa_1920.png` });
    } else if (vp.name === '1440x900') {
      await page.screenshot({ path: `${ARTIFACT_DIR}/report_tree_qa_1440.png` });
    }

    await context.close();
  }

  await browser.close();
  console.log('✔ QA Gate multi-viewport checks completed.');
}

verifyQaGate().catch((err) => {
  console.error('QA Gate check error:', err);
  process.exit(1);
});
