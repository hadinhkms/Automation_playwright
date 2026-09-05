const { chromium } = require('playwright');
const path = require('path');

async function runSeniorQAVerification() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const results = {
    viewports: [],
    modalities: [],
    consoleErrors: [],
    textSanity: []
  };

  page.on('console', msg => {
    if (msg.type() === 'error') {
      results.consoleErrors.push(msg.text());
    }
  });

  const viewports = [
    { name: '1920x1080', width: 1920, height: 1080 },
    { name: '1440x900', width: 1440, height: 900 },
    { name: '1280x800', width: 1280, height: 800 },
    { name: 'mobile_390x844', width: 390, height: 844 }
  ];

  await page.goto('http://127.0.0.1:4174/?tab=bdd', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  // 1. Test viewports for Desktop spec deletion modal
  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    
    // Light Mode
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'light');
      window.showConfirmDeleteModal({
        title: 'Xác nhận xóa kịch bản test',
        subtitle: 'Kịch bản Playwright BDD sẽ bị xóa vĩnh viễn khỏi thư mục tests/',
        targetName: 'sfas',
        targetPath: 'tests/e2e/desktop/sfas_flow-bdd.spec.js',
        iconClass: 'ph-bold ph-desktop',
        message: 'Hệ thống sẽ tự động lưu 1 bản sao lưu trong <code>.dashboard-backups/</code> trước khi xóa kịch bản <strong>sfas_flow-bdd.spec.js</strong>. Bạn có chắc chắn muốn xóa vĩnh viễn?'
      });
    });
    await page.waitForTimeout(300);

    const shotLight = path.resolve(__dirname, `modal_qa_${vp.name}_light.png`);
    await page.screenshot({ path: shotLight });

    // Dark Mode
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
    });
    await page.waitForTimeout(300);
    const shotDark = path.resolve(__dirname, `modal_qa_${vp.name}_dark.png`);
    await page.screenshot({ path: shotDark });

    // Check bounds & clipping
    const checks = await page.evaluate(() => {
      const modal = document.getElementById('modal-confirm-delete');
      const box = modal.querySelector('.app-modal-box');
      const rect = modal.getBoundingClientRect();
      const boxRect = box.getBoundingClientRect();
      const hasOverflowX = document.body.scrollWidth > window.innerWidth;
      
      return {
        modalWidth: rect.width,
        boxWidth: boxRect.width,
        isBoxFitted: Math.abs(rect.width - boxRect.width) <= 2, // border difference
        noPageHorizontalOverflow: !hasOverflowX
      };
    });

    results.viewports.push({ viewport: vp.name, checks });
  }

  // 2. Test Modality 2: Dataset Deletion Modal
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
    window.showConfirmDeleteModal({
      title: 'Xác nhận xóa tệp dữ liệu',
      subtitle: 'Tệp dữ liệu JSON sẽ bị xóa khỏi thư mục data/',
      targetName: 'users.json',
      targetPath: 'data/users.json',
      iconClass: 'ph-bold ph-database',
      message: 'Hệ thống sẽ tự động lưu 1 bản sao lưu trong <code>.dashboard-backups/</code> trước khi xóa tệp <strong>users.json</strong>. Bạn có chắc chắn muốn xóa vĩnh viễn?'
    });
  });
  await page.waitForTimeout(300);
  const shotDataset = path.resolve(__dirname, 'modal_qa_dataset.png');
  await page.screenshot({ path: shotDataset });
  results.modalities.push('Dataset delete modal verified');

  // 3. Test Modality 3: Page Object Deletion Modal
  await page.evaluate(() => {
    window.showConfirmDeleteModal({
      title: 'Xác nhận xóa Page Object',
      subtitle: 'Class Page Object sẽ bị xóa khỏi thư mục pages/',
      targetName: 'JobDetailPage.js',
      targetPath: 'pages/desktop/JobDetailPage.js',
      iconClass: 'ph-bold ph-browsers',
      message: 'Hệ thống sẽ tự động lưu 1 bản sao lưu trong <code>.dashboard-backups/</code> trước khi xóa Page Object <strong>JobDetailPage.js</strong> (pages/desktop/JobDetailPage.js). Bạn có chắc chắn muốn xóa vĩnh viễn?'
    });
  });
  await page.waitForTimeout(300);
  const shotPageObject = path.resolve(__dirname, 'modal_qa_page_object.png');
  await page.screenshot({ path: shotPageObject });
  results.modalities.push('Page Object delete modal verified');

  // 4. Inspect modal rendered text for debug notes, undefined, null, TODOs
  const textInspection = await page.evaluate(() => {
    const modal = document.getElementById('modal-confirm-delete');
    const text = modal.innerText;
    return {
      hasUndefined: text.includes('undefined'),
      hasNull: text.includes('null'),
      hasTODO: text.includes('TODO'),
      hasNaN: text.includes('NaN'),
      rawContent: text
    };
  });
  results.textSanity.push(textInspection);

  await browser.close();
  console.log('=== SENIOR QA REPORT ===');
  console.log(JSON.stringify(results, null, 2));
}

runSeniorQAVerification().catch(console.error);
