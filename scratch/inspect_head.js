const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://127.0.0.1:4174/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  await page.locator('.view-tab[data-view="builder-view"]').click();
  await page.waitForTimeout(600);
  await page.locator('#btn-tab-script-create').click();
  await page.waitForTimeout(600);

  const headInfo = await page.evaluate(() => {
    const head = document.querySelector('#script-create-view .script-panel-head');
    const actions = document.querySelector('#script-create-view .script-panel-head-actions');
    const save = document.getElementById('btn-save-draft-script');
    const reset = document.getElementById('btn-reset-create-script');
    const cancel = document.getElementById('btn-cancel-create-script');
    
    const resetRect = reset.getBoundingClientRect();
    const cancelRect = cancel.getBoundingClientRect();
    const elAtReset = document.elementFromPoint(resetRect.x + 5, resetRect.y + 5);
    const elAtCancel = document.elementFromPoint(cancelRect.x + 5, cancelRect.y + 5);

    return {
      headRect: head.getBoundingClientRect(),
      actionsRect: actions.getBoundingClientRect(),
      saveRect: save.getBoundingClientRect(),
      resetRect,
      cancelRect,
      elAtReset: elAtReset ? elAtReset.outerHTML.substring(0, 100) : null,
      elAtCancel: elAtCancel ? elAtCancel.outerHTML.substring(0, 100) : null,
      parentWidth: head.parentElement.getBoundingClientRect().width,
      actionsHTML: actions.outerHTML
    };
  });

  console.log(JSON.stringify(headInfo, null, 2));
  await browser.close();
})();
