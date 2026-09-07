const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://127.0.0.1:4174', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('qa_theme', 'dark');
  });
  await page.click('#docs-tab');
  await page.waitForTimeout(400);
  await page.click('button[data-docs-subtab="guides"]');
  await page.waitForTimeout(400);
  await page.click('button[data-doc-path="GIT_WORKFLOW.md"]');
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'C:/Users/Admin/.gemini/antigravity-ide/brain/d322f378-1e26-44f4-8820-790293992481/git_workflow_fixed_dark.png' });
  await browser.close();
  console.log('Dark mode captured');
})();
