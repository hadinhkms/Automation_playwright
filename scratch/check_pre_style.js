const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://127.0.0.1:4174', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  await page.click('#docs-tab');
  await page.waitForTimeout(500);
  await page.click('button[data-docs-subtab="guides"]');
  await page.waitForTimeout(500);
  // Click on GIT_WORKFLOW.md
  await page.click('button[data-doc-path="GIT_WORKFLOW.md"]');
  await page.waitForTimeout(1000);

  const preInfo = await page.evaluate(() => {
    const firstPre = document.querySelector('.docs-markdown-body pre');
    if (!firstPre) return null;
    const computed = window.getComputedStyle(firstPre);
    const codeComputed = window.getComputedStyle(firstPre.querySelector('code') || firstPre);
    const btnComputed = firstPre.querySelector('.btn-copy-code') ? window.getComputedStyle(firstPre.querySelector('.btn-copy-code')) : null;
    return {
      outerHTML: firstPre.outerHTML.slice(0, 300),
      preWidth: computed.width,
      preHeight: computed.height,
      prePadding: computed.padding,
      preMinHeight: computed.minHeight,
      codeHeight: codeComputed.height,
      btnDisplay: btnComputed?.display,
      btnPosition: btnComputed?.position,
      btnHeight: btnComputed?.height,
    };
  });

  console.log('Pre Info:', JSON.stringify(preInfo, null, 2));
  await page.screenshot({ path: 'scratch/git_workflow_pre.png' });
  await browser.close();
})();
