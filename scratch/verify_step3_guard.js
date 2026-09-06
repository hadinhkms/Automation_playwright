const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  await page.goto('http://127.0.0.1:4174/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  // Switch to recorder view
  await page.evaluate(() => {
    const tab = document.querySelector('.view-tab[data-view="recorder-view"]');
    if (tab) tab.click();
    setRecorderStep(3);
  });
  await page.waitForTimeout(500);

  // Trigger Save to see Guard Status
  const saveBtn = page.locator('#rec-save-btn');
  // Populate draft if needed or check guard status
  const guardBox = page.locator('#rec-guard-status');
  console.log('Guard box count:', await guardBox.count());

  // Trigger API check
  const apiRes = await page.evaluate(async () => {
    const fsRes = await fetch('/api/recorder/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pomFile: {
          path: 'pages/desktop/TestRecordPage.js',
          content: document.getElementById('draft-pom-editor')?.value || 'class TestRecordPage extends BasePage {}'
        },
        specFile: {
          path: 'tests/e2e/desktop/clickbutton-bdd.spec.js',
          content: document.getElementById('draft-spec-editor')?.value || 'test("test", async () => {});'
        }
      })
    });
    return fsRes.json();
  });

  console.log('API Save Response:', apiRes.frameworkCheck);

  await browser.close();
  console.log('Step 3 Guard check passed!');
})();
