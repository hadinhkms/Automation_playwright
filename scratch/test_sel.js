const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent('<div><h1>Thiết lập tìm kiếm hồ sơ</h1></div>');
  try {
    const loc = page.locator('text="Thiết lập tìm kiếm hồ sơ", button:has-text("Bước tiếp theo")');
    console.log('Count:', await loc.count());
  } catch (e) {
    console.log('Error caught:', e.message);
  }

  const loc2 = page.getByText('Thiết lập tìm kiếm hồ sơ').or(page.getByRole('button', { name: /Bước tiếp theo/i }));
  console.log('loc2 count:', await loc2.count());

  await browser.close();
})();
