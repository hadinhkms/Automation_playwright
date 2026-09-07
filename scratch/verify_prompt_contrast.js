const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://127.0.0.1:4174', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);

  // Set Light mode explicitly
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'light');
    localStorage.setItem('qa_theme', 'light');
  });

  await page.click('#docs-tab');
  await page.waitForTimeout(500);

  const lightStyles = await page.evaluate(() => {
    const box = document.getElementById('prompt-preview-box');
    const comp = window.getComputedStyle(box);
    return {
      bg: comp.backgroundColor,
      color: comp.color,
      font: comp.fontFamily,
      height: comp.height
    };
  });
  console.log('Light Mode Styles:', lightStyles);

  await page.screenshot({ path: 'C:/Users/Admin/.gemini/antigravity-ide/brain/d322f378-1e26-44f4-8820-790293992481/prompt_contrast_light.png' });

  // Set Dark mode
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('qa_theme', 'dark');
  });
  await page.waitForTimeout(400);

  const darkStyles = await page.evaluate(() => {
    const box = document.getElementById('prompt-preview-box');
    const comp = window.getComputedStyle(box);
    return {
      bg: comp.backgroundColor,
      color: comp.color
    };
  });
  console.log('Dark Mode Styles:', darkStyles);

  await page.screenshot({ path: 'C:/Users/Admin/.gemini/antigravity-ide/brain/d322f378-1e26-44f4-8820-790293992481/prompt_contrast_dark.png' });

  await browser.close();
  console.log('Done verification!');
})();
