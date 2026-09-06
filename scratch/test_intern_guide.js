const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  console.log('Navigating to dashboard...');
  await page.goto('http://127.0.0.1:4174/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#setup-guide-btn');

  console.log('Clicking #setup-guide-btn in topbar...');
  await page.click('#setup-guide-btn');
  await page.waitForTimeout(1000);

  const docState = await page.evaluate(() => {
    const activeView = document.querySelector('.dashboard-view.active')?.id;
    const activeSubtab = document.querySelector('.settings-subtab.active')?.dataset?.subtab;
    const docName = document.getElementById('doc-settings-name')?.textContent;
    const contentVisible = !document.getElementById('doc-settings-content')?.hidden;
    const contentSnippet = document.getElementById('doc-settings-content')?.textContent?.slice(0, 100);
    return { activeView, activeSubtab, docName, contentVisible, contentSnippet };
  });

  console.log('Document state after topbar click:', docState);

  const screenshotDir = path.resolve(__dirname, '../artifacts');
  if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });
  await page.screenshot({ path: path.join(screenshotDir, 'setup_guide_view.png'), fullPage: false });

  // Test agent guide button
  console.log('Switching to agent-view...');
  await page.click('#agent-tab');
  await page.waitForTimeout(500);

  console.log('Clicking #agent-guide-btn in agent hero...');
  await page.click('#agent-guide-btn');
  await page.waitForTimeout(1000);

  const docState2 = await page.evaluate(() => {
    const activeView = document.querySelector('.dashboard-view.active')?.id;
    const docName = document.getElementById('doc-settings-name')?.textContent;
    return { activeView, docName };
  });

  console.log('Document state after agent view click:', docState2);

  await browser.close();
  console.log('Test completed successfully!');
})();
