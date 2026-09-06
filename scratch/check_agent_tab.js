const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto('http://127.0.0.1:4174', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  // Switch to AI tab
  await page.click('#agent-tab');
  await page.waitForTimeout(800);

  await page.screenshot({ path: path.join(__dirname, 'agent_tab_current.png') });
  console.log('Saved agent_tab_current.png');
  await browser.close();
})();
