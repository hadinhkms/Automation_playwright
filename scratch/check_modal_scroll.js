const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  await page.goto('http://127.0.0.1:4174/?tab=page-manager-view', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  // Open the page code modal
  console.log('Opening page code modal...');
  await page.evaluate(() => {
    window.openPageCodeModal('pages/desktop/OnboardingPopup.js', 'OnboardingPopup.js');
  });
  await page.waitForTimeout(1500);

  const modalInfo = await page.evaluate(() => {
    const modal = document.getElementById('modal-view-page-code');
    const editor = document.getElementById('modal-page-editor');
    const previewPre = document.getElementById('modal-page-preview');
    const previewCode = document.getElementById('modal-page-code');

    return {
      modalOpen: modal?.open,
      editor: {
        scrollHeight: editor?.scrollHeight,
        clientHeight: editor?.clientHeight,
        scrollTop: editor?.scrollTop,
        valueLength: editor?.value?.length,
      },
      previewPre: {
        scrollHeight: previewPre?.scrollHeight,
        clientHeight: previewPre?.clientHeight,
        scrollTop: previewPre?.scrollTop,
        overflow: window.getComputedStyle(previewPre).overflow,
        pointerEvents: window.getComputedStyle(previewPre).pointerEvents,
      },
      previewCode: {
        scrollHeight: previewCode?.scrollHeight,
        clientHeight: previewCode?.clientHeight,
        scrollTop: previewCode?.scrollTop,
      },
    };
  });
  console.log('Initial modal info:', JSON.stringify(modalInfo, null, 2));

  // Now simulate scrolling the editor textarea
  console.log('Scrolling editor textarea...');
  const scrollResult = await page.evaluate(() => {
    const editor = document.getElementById('modal-page-editor');
    const previewPre = document.getElementById('modal-page-preview');
    const previewCode = document.getElementById('modal-page-code');

    editor.scrollTop = 300;
    // Dispatch scroll event as user would
    editor.dispatchEvent(new Event('scroll'));

    return {
      editorScrollTop: editor.scrollTop,
      previewPreScrollTop: previewPre.scrollTop,
      previewCodeScrollTop: previewCode.scrollTop,
    };
  });

  console.log('After editor.scrollTop = 300:', JSON.stringify(scrollResult, null, 2));

  await browser.close();
})();
