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
  await page.goto('http://127.0.0.1:4174/?tab=builder-view', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  // 1. Check pills
  const pills = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('#script-sidebar .script-filter-btn'));
    return btns.map((b) => ({
      platform: b.dataset.platform,
      text: b.textContent.trim(),
      isActive: b.classList.contains('active'),
    }));
  });
  console.log('Filter pills found:', pills);

  // Verify 'Tất cả' is NOT present
  const hasAll = pills.some((p) => p.text.toLowerCase().includes('tất cả') || p.platform === 'all');
  if (hasAll) {
    throw new Error('FAIL: "Tất cả" filter button is still present!');
  }

  // Verify Desktop, Mobile, API, Setup
  const platforms = pills.map((p) => p.platform);
  const expected = ['desktop', 'mobile-web', 'api', 'setup'];
  for (const exp of expected) {
    if (!platforms.includes(exp)) {
      throw new Error(`FAIL: Missing filter pill for "${exp}"!`);
    }
  }

  // Verify Desktop is active by default
  const desktopPill = pills.find((p) => p.platform === 'desktop');
  if (!desktopPill || !desktopPill.isActive) {
    throw new Error('FAIL: Desktop is not active by default!');
  }

  const screenshotDir = path.resolve(__dirname, '../artifacts');
  if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });

  // Check Desktop count & screenshot
  const desktopCount = await page.evaluate(() => {
    return document.querySelectorAll('#script-files-list .script-card-item').length;
  });
  console.log(`Desktop tests rendered: ${desktopCount}`);
  await page.screenshot({ path: path.join(screenshotDir, 'script_filter_desktop.png'), fullPage: false });

  // 2. Click Mobile filter
  console.log('Clicking Mobile filter pill...');
  await page.click('#script-sidebar .script-filter-btn[data-platform="mobile-web"]');
  await page.waitForTimeout(400);

  const mobileCheck = await page.evaluate(() => {
    const activeBtn = document.querySelector('#script-sidebar .script-filter-btn.active')?.dataset.platform;
    const cards = Array.from(document.querySelectorAll('#script-files-list .script-card-item'));
    const badges = cards.map((c) => c.querySelector('.script-card-badge-platform')?.textContent.trim());
    return { activeBtn, count: cards.length, badges: badges.slice(0, 3) };
  });
  console.log('Mobile filter check:', mobileCheck);
  if (mobileCheck.activeBtn !== 'mobile-web' || mobileCheck.count === 0) {
    throw new Error('FAIL: Mobile filter did not work properly!');
  }
  await page.screenshot({ path: path.join(screenshotDir, 'script_filter_mobile.png'), fullPage: false });

  // 3. Click API filter
  console.log('Clicking API filter pill...');
  await page.click('#script-sidebar .script-filter-btn[data-platform="api"]');
  await page.waitForTimeout(400);

  const apiCheck = await page.evaluate(() => {
    const activeBtn = document.querySelector('#script-sidebar .script-filter-btn.active')?.dataset.platform;
    const cards = Array.from(document.querySelectorAll('#script-files-list .script-card-item'));
    const titles = cards.map((c) => c.querySelector('.script-card-title')?.textContent.trim());
    const badges = cards.map((c) => c.querySelector('.script-card-badge-platform')?.textContent.trim());
    const headerCount = document.getElementById('stat-scripts-sidebar-count')?.textContent;
    return { activeBtn, count: cards.length, titles, badges, headerCount };
  });
  console.log('API filter check:', apiCheck);
  if (apiCheck.activeBtn !== 'api' || apiCheck.count !== 1) {
    throw new Error(`FAIL: API filter expected 1 script, found ${apiCheck.count}!`);
  }
  await page.screenshot({ path: path.join(screenshotDir, 'script_filter_api.png'), fullPage: false });

  // 4. Click Setup filter
  console.log('Clicking Setup filter pill...');
  await page.click('#script-sidebar .script-filter-btn[data-platform="setup"]');
  await page.waitForTimeout(400);

  const setupCheck = await page.evaluate(() => {
    const activeBtn = document.querySelector('#script-sidebar .script-filter-btn.active')?.dataset.platform;
    const cards = Array.from(document.querySelectorAll('#script-files-list .script-card-item'));
    const titles = cards.map((c) => c.querySelector('.script-card-title')?.textContent.trim());
    const badges = cards.map((c) => c.querySelector('.script-card-badge-platform')?.textContent.trim());
    const headerCount = document.getElementById('stat-scripts-sidebar-count')?.textContent;
    return { activeBtn, count: cards.length, titles, badges, headerCount };
  });
  console.log('Setup filter check:', setupCheck);
  if (setupCheck.activeBtn !== 'setup' || setupCheck.count !== 1) {
    throw new Error(`FAIL: Setup filter expected 1 script, found ${setupCheck.count}!`);
  }
  await page.screenshot({ path: path.join(screenshotDir, 'script_filter_setup.png'), fullPage: false });

  // 5. Check console errors
  console.log('Console/Page errors:', errors);
  if (errors.length > 0) {
    throw new Error(`FAIL: Found unexpected console errors: ${JSON.stringify(errors)}`);
  }

  await browser.close();
  console.log('==================================================');
  console.log('ALL FILTER PILL TESTS (DESKTOP/MOBILE/API/SETUP) PASSED!');
  console.log('==================================================');
})();
