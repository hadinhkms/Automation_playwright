const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  console.log('[Test] Launching Chromium browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log('[Browser Error]', msg.text());
  });

  console.log('[Test] Navigating to http://127.0.0.1:4174 ...');
  await page.goto('http://127.0.0.1:4174', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  console.log('[Test] Opening Docs Tab...');
  await page.click('#docs-tab');
  await page.waitForTimeout(1000);

  // 1. Verify Prompts subpanel is active by default
  const isPromptVisible = await page.isVisible('#docs-subpanel-prompts');
  console.log('[Test] Prompt Subpanel Visible:', isPromptVisible);

  // 2. Test interactive builder
  console.log('[Test] Testing Interactive Prompt Builder...');
  await page.click('button[data-type="page_object"]');
  await page.waitForTimeout(400);
  const previewText = await page.textContent('#prompt-preview-box');
  console.log('[Test] Preview text contains Page Object:', previewText.includes('Page Object Model'));

  // Click Copy Builder Prompt
  await page.click('#btn-copy-builder-prompt');
  await page.waitForTimeout(400);

  // Capture Prompt Hub Light
  await page.screenshot({ path: 'scratch/docs_prompts_light.png', fullPage: false });
  console.log('[Test] Saved scratch/docs_prompts_light.png');

  // 3. Switch to CLI Cheat Sheet
  console.log('[Test] Switching to CLI Cheat Sheet...');
  await page.click('button[data-docs-subtab="cli"]');
  await page.waitForTimeout(500);
  const isCliVisible = await page.isVisible('#docs-subpanel-cli');
  console.log('[Test] CLI Subpanel Visible:', isCliVisible);

  // Test CLI filter
  await page.click('#cli-filter-tags button[data-filter="suite"]');
  await page.waitForTimeout(300);
  const suiteRows = await page.$$eval('#cli-cheatsheet-tbody tr', (rows) => rows.length);
  console.log('[Test] CLI Suite Rows filtered count:', suiteRows);

  // Reset filter
  await page.click('#cli-filter-tags button[data-filter="all"]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'scratch/docs_cli_light.png', fullPage: false });
  console.log('[Test] Saved scratch/docs_cli_light.png');

  // 4. Switch to Cẩm nang tài liệu (Guides & TOC)
  console.log('[Test] Switching to Guides Subpanel...');
  await page.click('button[data-docs-subtab="guides"]');
  await page.waitForTimeout(1000);

  const isTocVisible = await page.isVisible('#docs-toc-pane');
  const tocLinksCount = await page.$$eval('#docs-toc-list .docs-toc-link', (links) => links.length);
  console.log('[Test] TOC Visible:', isTocVisible, 'Links count:', tocLinksCount);

  await page.screenshot({ path: 'scratch/docs_guides_light.png', fullPage: false });
  console.log('[Test] Saved scratch/docs_guides_light.png');

  // 5. Test Dark Theme
  console.log('[Test] Toggling to Dark Theme...');
  await page.click('#theme-button');
  await page.waitForTimeout(600);

  // Return to Prompts tab for dark screenshot
  await page.click('button[data-docs-subtab="prompts"]');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'scratch/docs_prompts_dark.png', fullPage: false });
  console.log('[Test] Saved scratch/docs_prompts_dark.png');

  // Also capture Guides in dark theme
  await page.click('button[data-docs-subtab="guides"]');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'scratch/docs_guides_dark.png', fullPage: false });
  console.log('[Test] Saved scratch/docs_guides_dark.png');

  // Toggle back to light theme
  await page.click('#theme-button');

  await browser.close();
  console.log('[Test] All verification tests finished successfully!');
})();
