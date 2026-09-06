const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  console.log('Navigating to dashboard...');
  await page.goto('http://127.0.0.1:4174/?tab=page-manager-view', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  // 1. Open Page Code Modal
  console.log('Opening Page Code Modal for OnboardingPopup.js...');
  await page.evaluate(() => {
    window.openPageCodeModal('pages/desktop/OnboardingPopup.js', 'OnboardingPopup.js');
  });
  await page.waitForTimeout(1000);

  const initial = await page.evaluate(() => {
    const editor = document.getElementById('modal-page-editor');
    const previewPre = document.getElementById('modal-page-preview');
    return {
      editorScrollTop: editor?.scrollTop,
      previewScrollTop: previewPre?.scrollTop,
      editorScrollHeight: editor?.scrollHeight,
      previewScrollHeight: previewPre?.scrollHeight,
    };
  });
  console.log('Initial state:', initial);

  // 2. Perform mouse wheel scroll over modal editor
  console.log('Performing mouse wheel down (deltaY = 600)...');
  await page.hover('#modal-page-editor');
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(500);

  const scrolled = await page.evaluate(() => {
    const editor = document.getElementById('modal-page-editor');
    const previewPre = document.getElementById('modal-page-preview');
    return {
      editorScrollTop: editor?.scrollTop,
      previewScrollTop: previewPre?.scrollTop,
      diff: Math.abs((editor?.scrollTop || 0) - (previewPre?.scrollTop || 0)),
    };
  });
  console.log('Scrolled down state:', scrolled);

  if (scrolled.editorScrollTop === 0) {
    throw new Error('Editor did not scroll at all!');
  }
  if (scrolled.previewScrollTop === 0) {
    throw new Error('BUG STILL PRESENT: Preview did not scroll along with editor!');
  }
  if (scrolled.diff > 2) {
    throw new Error(`Editor and Preview are out of sync! Diff: ${scrolled.diff}px`);
  }

  const screenshotDir = path.resolve(__dirname, '../artifacts');
  if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });

  // Screenshot scrolled down
  await page.screenshot({ path: path.join(screenshotDir, 'modal_scrolled_down_fixed.png'), fullPage: false });
  console.log('Captured modal_scrolled_down_fixed.png');

  // 3. Scroll back up
  console.log('Performing mouse wheel up (deltaY = -400)...');
  await page.mouse.wheel(0, -400);
  await page.waitForTimeout(500);

  const scrolledUp = await page.evaluate(() => {
    const editor = document.getElementById('modal-page-editor');
    const previewPre = document.getElementById('modal-page-preview');
    return {
      editorScrollTop: editor?.scrollTop,
      previewScrollTop: previewPre?.scrollTop,
      diff: Math.abs((editor?.scrollTop || 0) - (previewPre?.scrollTop || 0)),
    };
  });
  console.log('Scrolled up state:', scrolledUp);

  if (scrolledUp.diff > 2) {
    throw new Error(`Editor and Preview are out of sync after scrolling up! Diff: ${scrolledUp.diff}px`);
  }

  // Screenshot scrolled up
  await page.screenshot({ path: path.join(screenshotDir, 'modal_scrolled_up_fixed.png'), fullPage: false });
  console.log('Captured modal_scrolled_up_fixed.png');

  // 4. Test horizontal scroll
  console.log('Testing horizontal scroll...');
  await page.evaluate(() => {
    const editor = document.getElementById('modal-page-editor');
    editor.scrollLeft = 120;
    editor.dispatchEvent(new Event('scroll'));
  });
  await page.waitForTimeout(300);

  const horizontalScroll = await page.evaluate(() => {
    const editor = document.getElementById('modal-page-editor');
    const previewPre = document.getElementById('modal-page-preview');
    return {
      editorScrollLeft: editor?.scrollLeft,
      previewScrollLeft: previewPre?.scrollLeft,
      diff: Math.abs((editor?.scrollLeft || 0) - (previewPre?.scrollLeft || 0)),
    };
  });
  console.log('Horizontal scroll state:', horizontalScroll);
  if (horizontalScroll.diff > 2) {
    throw new Error(`Horizontal scroll out of sync! Diff: ${horizontalScroll.diff}px`);
  }

  // 5. Close modal
  await page.evaluate(() => document.getElementById('modal-view-page-code')?.close());
  await page.waitForTimeout(300);

  // 6. Test specCodeEditor in BDD View
  console.log('Navigating to BDD View to test spec editor scroll sync...');
  await page.click('.view-tab[data-view="builder-view"]');
  await page.waitForTimeout(600);

  // Select first script
  const hasScript = await page.evaluate(() => {
    const firstItem = document.querySelector('.script-tree-file');
    if (firstItem) {
      firstItem.click();
      return true;
    }
    return false;
  });

  if (hasScript) {
    await page.waitForTimeout(800);
    const specScroll = await page.evaluate(() => {
      const editor = document.getElementById('script-spec-editor');
      const wrap = document.getElementById('script-code-view-wrap');
      if (!editor || !wrap) return { skipped: true };
      editor.scrollTop = 250;
      editor.dispatchEvent(new Event('scroll'));
      return {
        editorScrollTop: editor.scrollTop,
        wrapScrollTop: wrap.scrollTop,
        diff: Math.abs(editor.scrollTop - wrap.scrollTop),
      };
    });
    console.log('Spec editor scroll sync test:', specScroll);
    if (!specScroll.skipped && specScroll.diff > 2) {
      throw new Error(`Spec editor scroll out of sync! Diff: ${specScroll.diff}px`);
    }
  }

  console.log('Checking console errors...');
  console.log('Console/Page errors:', errors);
  if (errors.length > 0) {
    throw new Error(`Found unexpected errors: ${JSON.stringify(errors)}`);
  }

  await browser.close();
  console.log('=========================================');
  console.log('ALL SCROLL SYNCHRONIZATION TESTS PASSED!');
  console.log('=========================================');
})();
