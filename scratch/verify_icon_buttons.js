const { chromium } = require('playwright');
const path = require('path');

async function testIconButtons() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  await page.goto('http://127.0.0.1:4174/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);

  // Switch to BDD tab
  await page.locator('.view-tab[data-view="builder-view"]').click();
  await page.waitForTimeout(600);

  // Click "Tạo kịch bản mới"
  await page.locator('#btn-tab-script-create').click();
  await page.waitForTimeout(600);

  // 1. Capture Normal State (Light Theme)
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.resolve(__dirname, 'wizard_icon_buttons_normal_light.png') });
  console.log('✔ Captured wizard_icon_buttons_normal_light.png');

  // 2. Hover over Save Draft Button & Capture Tooltip
  const saveBtn = page.locator('#btn-save-draft-script');
  await saveBtn.hover();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.resolve(__dirname, 'wizard_icon_btn_hover_save_light.png') });
  console.log('✔ Captured wizard_icon_btn_hover_save_light.png');

  // 3. Hover over Reset Button & Capture Tooltip
  const resetBtn = page.locator('#btn-reset-create-script');
  await resetBtn.hover();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.resolve(__dirname, 'wizard_icon_btn_hover_reset_light.png') });
  console.log('✔ Captured wizard_icon_btn_hover_reset_light.png');

  // 4. Hover over Cancel Button & Capture Tooltip
  const cancelBtn = page.locator('#btn-cancel-create-script');
  await cancelBtn.hover();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.resolve(__dirname, 'wizard_icon_btn_hover_cancel_light.png') });
  console.log('✔ Captured wizard_icon_btn_hover_cancel_light.png');

  // 5. Dark Theme Verification
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await page.waitForTimeout(200);
  await saveBtn.hover();
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.resolve(__dirname, 'wizard_icon_buttons_dark.png') });
  console.log('✔ Captured wizard_icon_buttons_dark.png');

  // 6. Mobile Viewport (390x844)
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.resolve(__dirname, 'wizard_icon_buttons_mobile.png') });
  console.log('✔ Captured wizard_icon_buttons_mobile.png');

  // 7. Measure Button Metrics
  const metrics = await page.evaluate(() => {
    const save = document.getElementById('btn-save-draft-script');
    const reset = document.getElementById('btn-reset-create-script');
    const cancel = document.getElementById('btn-cancel-create-script');
    const h2 = document.querySelector('#script-create-view .script-panel-head h2');

    function getMetrics(el) {
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return {
        width: rect.width,
        height: rect.height,
        tooltip: el.getAttribute('data-tooltip'),
        title: el.getAttribute('title'),
        ariaLabel: el.getAttribute('aria-label'),
        bg: style.backgroundColor,
        border: style.border
      };
    }

    return {
      h2: {
        text: h2 ? h2.textContent.trim() : null,
        width: h2 ? h2.getBoundingClientRect().width : null
      },
      saveBtn: getMetrics(save),
      resetBtn: getMetrics(reset),
      cancelBtn: getMetrics(cancel)
    };
  });

  console.log('BUTTON METRICS:', JSON.stringify(metrics, null, 2));
  await browser.close();
}

testIconButtons().catch(console.error);
