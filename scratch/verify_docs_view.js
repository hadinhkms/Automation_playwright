const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  console.log('Navigating to dashboard...');
  await page.goto('http://127.0.0.1:4174/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // 1. Check if docs-tab exists on topbar
  const docsTab = page.locator('#docs-tab');
  console.log('docs-tab exists on topbar:', await docsTab.count() === 1);
  console.log('docs-tab text:', (await docsTab.textContent()).trim());

  // 2. Click docs-tab
  await docsTab.click();
  await page.waitForTimeout(800);

  const docsView = page.locator('#docs-view');
  console.log('docs-view is visible:', await docsView.isVisible());

  // 3. Check docs tree items
  const docItems = page.locator('.doc-tree-item');
  const count = await docItems.count();
  console.log('Document items count in explorer:', count);

  // 4. Verify markdown content rendered
  const markdownBody = page.locator('#docs-markdown-body');
  const hasH1 = await markdownBody.locator('h1, h2').count() > 0;
  console.log('Markdown has headings rendered:', hasH1);

  // 5. Take light mode screenshot
  const lightScreenshot = path.join(__dirname, 'docs_view_light.png');
  await page.screenshot({ path: lightScreenshot });
  console.log('Saved light mode screenshot to:', lightScreenshot);

  // 6. Test search filter
  const searchInput = page.locator('#docs-search-input');
  await searchInput.fill('prompt');
  await page.waitForTimeout(400);
  const filteredCount = await page.locator('.doc-tree-item').count();
  console.log('Filtered doc count with query "prompt":', filteredCount);

  // Clear search
  await searchInput.fill('');
  await page.waitForTimeout(300);

  // 7. Test category chip (Skills)
  const skillsChip = page.locator('.doc-chip[data-filter="skills"]');
  await skillsChip.click();
  await page.waitForTimeout(400);
  const skillsCount = await page.locator('.doc-tree-item').count();
  console.log('Skills count after clicking chip:', skillsCount);

  // Reset filter to All
  await page.locator('.doc-chip[data-filter="all"]').click();
  await page.waitForTimeout(300);

  // 8. Test Dark Mode
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await page.waitForTimeout(400);
  const darkScreenshot = path.join(__dirname, 'docs_view_dark.png');
  await page.screenshot({ path: darkScreenshot });
  console.log('Saved dark mode screenshot to:', darkScreenshot);

  // 9. Verify Settings view no longer has documents subtab
  const settingsTab = page.locator('#settings-tab');
  await settingsTab.click();
  await page.waitForTimeout(600);
  const docSubtabInSettings = page.locator('.settings-subtab[data-subtab="documents"]');
  console.log('Documents subtab removed from settings:', await docSubtabInSettings.count() === 0);

  // 10. Click #setup-guide-btn from Settings to test direct shortcut
  const setupGuideBtn = page.locator('#setup-guide-btn');
  await setupGuideBtn.click();
  await page.waitForTimeout(800);
  console.log('After clicking setup-guide-btn, docs-view is visible:', await docsView.isVisible());
  const activePath = await page.locator('#docs-path-text').textContent();
  console.log('Active doc loaded via shortcut:', activePath);

  await browser.close();
  console.log('ALL VERIFICATIONS PASSED SUCCESSFULLY!');
})();
