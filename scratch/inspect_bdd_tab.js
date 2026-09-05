const { chromium } = require('playwright');

async function inspectBdd() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:4174/?tab=bdd', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  // Click on apply_job_noCV_flow in the script list
  const scriptItem = page.locator('.script-item').filter({ hasText: 'apply_job_noCV_flow' }).first();
  if (await scriptItem.isVisible()) {
    await scriptItem.click();
    await page.waitForTimeout(1000);
    console.log('Clicked apply_job_noCV_flow');

    // Get steps listed in the UI
    const stepCards = page.locator('.step-card, .script-step-row, .bdd-step-item, .spec-step-card');
    const count = await stepCards.count();
    console.log('Step cards count:', count);
    for (let i = 0; i < count; i++) {
      console.log(`Step ${i + 1}:`, (await stepCards.nth(i).innerText()).replace(/\n+/g, ' | '));
    }

    // Get code in the editor/preview
    const editorCode = await page.locator('#script-spec-code, #script-spec-editor, .code-editor, pre code').first().innerText().catch(() => '');
    console.log('Editor code length:', editorCode.length);
    console.log('Does editor code have bulkApply?', editorCode.includes('bulkApply'));
    console.log('Does editor code have "apply tất cả các công việc"?', editorCode.includes('apply tất cả các công việc'));
  } else {
    console.log('Script item not found');
  }

  await browser.close();
}

inspectBdd().catch(console.error);
