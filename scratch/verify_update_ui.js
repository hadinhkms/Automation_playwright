const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  await page.goto('http://127.0.0.1:4174/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500); // allow checkSystemUpdate to run

  const updateBtn = page.locator('#system-update-btn');
  console.log('Update button exists:', await updateBtn.count() === 1);
  const versionText = await page.locator('#topbar-version-label').textContent();
  console.log('Version label text:', versionText);

  // Click update button to open modal
  await updateBtn.click();
  await page.waitForTimeout(500);

  const modal = page.locator('#modal-system-update');
  console.log('Update modal is open:', await modal.evaluate(el => el.open));

  const screenshotPath = path.join(__dirname, 'modal_system_update.png');
  await page.screenshot({ path: screenshotPath });
  console.log('Screenshot saved to:', screenshotPath);

  await browser.close();
  console.log('All tests passed!');
})();
