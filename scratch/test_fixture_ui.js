const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  console.log('--- BẮT ĐẦU TEST TOÀN DIỆN FIXTURE UI (OPTION C) ---');

  try {
    await page.goto('http://127.0.0.1:4174', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // 1. TEST BDD BUILDER VIEW
    console.log('[1/4] Chuyển sang tab Kịch bản BDD (builder-view)...');
    await page.click('button[data-view="builder-view"]');
    await page.waitForTimeout(600);

    // Chờ danh sách kịch bản load
    await page.waitForSelector('.script-card-item');
    const firstScript = page.locator('.script-card-item').first();
    await firstScript.click();
    await page.waitForTimeout(600);

    // Kiểm tra Section 04 title
    const section04Title = await page.locator('#script-inspect-view .pm-section-part3 .pm-section-tag').innerText();
    console.log('Section 04 Tag:', section04Title);
    if (!section04Title.includes('FIXTURE, PAGES & DATA')) {
      throw new Error(`Section 04 tag không đúng: ${section04Title}`);
    }

    // Kiểm tra Fixture Nền Tảng Card
    const fixtureName = await page.locator('#pillar-fixture-name').innerText();
    const fixtureScope = await page.locator('#pillar-fixture-scope').innerText();
    console.log(`Fixture Desktop: ${fixtureName} | Scope: ${fixtureScope}`);
    if (!fixtureName.includes('baseTest.js') && !fixtureName.includes('mobileWebTest.js')) {
      throw new Error(`Tên fixture không hợp lệ: ${fixtureName}`);
    }

    // Kiểm tra capabilities tags
    const capPills = await page.locator('#pillar-fixture-caps .fixture-cap-pill').count();
    console.log(`Số lượng capability pills hiển thị trong BDD: ${capPills}`);
    if (capPills === 0) {
      throw new Error('Chưa hiển thị capability pills trong BDD detail!');
    }

    // Test bấm "Xem mã Fixture"
    console.log('Click nút [Xem mã Fixture]...');
    await page.click('#btn-view-fixture-code');
    await page.waitForTimeout(500);

    const modalTitle = await page.locator('#modal-page-title').innerText();
    console.log('Modal Code Title:', modalTitle);
    if (!modalTitle.includes('Fixture Nền Tảng')) {
      throw new Error(`Modal title không phản ánh Fixture: ${modalTitle}`);
    }

    // Chụp ảnh modal code fixture
    await page.screenshot({ path: path.join(__dirname, 'modal_fixture_code.png') });
    console.log('Đã chụp ảnh modal_fixture_code.png');

    // Đóng modal
    await page.locator('#modal-view-page-code button:has-text("Đóng")').click();
    await page.waitForTimeout(300);

    // Tìm và chọn một mobile script nếu có
    const mobileScriptCard = page.locator('.script-card-item:has-text("mobile")').first();
    if (await mobileScriptCard.count() > 0) {
      console.log('Kiểm tra chuyển sang kịch bản Mobile Web...');
      await mobileScriptCard.click();
      await page.waitForTimeout(600);

      const mobFixtureName = await page.locator('#pillar-fixture-name').innerText();
      const mobFixtureScope = await page.locator('#pillar-fixture-scope').innerText();
      console.log(`Fixture Mobile: ${mobFixtureName} | Scope: ${mobFixtureScope}`);
      if (!mobFixtureName.includes('mobileWebTest.js')) {
        throw new Error(`Mobile script không trỏ tới mobileWebTest.js: ${mobFixtureName}`);
      }
    }

    // Chụp ảnh BDD Section 04 với Fixture card
    await page.screenshot({ path: path.join(__dirname, 'bdd_section04_fixture.png') });
    console.log('Đã chụp ảnh bdd_section04_fixture.png');

    // 2. TEST PAGE MANAGER VIEW
    console.log('[2/4] Chuyển sang tab Quản lý Page (page-manager-view)...');
    await page.click('button[data-view="page-manager-view"]');
    await page.waitForTimeout(600);

    // Kiểm tra nút lọc Fixture
    const fixturePill = page.locator('.pm-filter-pill[data-platform="fixture"]');
    if (await fixturePill.count() === 0) {
      throw new Error('Không tìm thấy filter pill data-platform="fixture"!');
    }

    console.log('Bấm vào pill filter [Fixture]...');
    await fixturePill.click();
    await page.waitForTimeout(500);

    // Đếm số lượng files trong danh sách
    const fileCards = page.locator('#page-manager-existing-list .page-manager-file-card');
    const fileCount = await fileCards.count();
    console.log(`Số lượng file hiển thị khi chọn filter Fixture: ${fileCount}`);
    if (fileCount !== 2) {
      throw new Error(`Kỳ vọng hiển thị đúng 2 files fixture, nhưng thực tế hiển thị ${fileCount}`);
    }

    // Kiểm tra không có nút xóa (delete button) cho fixture
    const deleteBtns = page.locator('#page-manager-existing-list .pm-page-delete-btn');
    const delCount = await deleteBtns.count();
    console.log(`Số nút xóa xuất hiện trên card fixture: ${delCount}`);
    if (delCount !== 0) {
      throw new Error('Nút xóa không được phép xuất hiện trên các file fixture nền tảng!');
    }

    // Click vào file baseTest.js
    console.log('Chọn baseTest.js để inspect...');
    await page.locator('.page-manager-file-card:has-text("baseTest.js")').click();
    await page.waitForTimeout(600);

    // Kiểm tra thông tin cột giữa
    const inspPlatform = await page.locator('#pm-inspect-platform').innerText();
    const inspClass = await page.locator('#pm-inspect-class').innerText();
    console.log(`Inspect Platform: ${inspPlatform} | Class: ${inspClass}`);
    if (!inspPlatform.includes('Fixture Nền Tảng')) {
      throw new Error(`Platform không hiển thị Fixture Nền Tảng: ${inspPlatform}`);
    }

    // Kiểm tra form thêm locator đã được ẩn đối với fixture
    const inlineBoxVisible = await page.locator('.pm-inline-add-box').isVisible();
    console.log(`Form thêm locator hiển thị: ${inlineBoxVisible} (Kỳ vọng: false)`);
    if (inlineBoxVisible) {
      throw new Error('Form thêm nhanh locator phải ẩn khi đang xem Fixture!');
    }

    // Kiểm tra nút Copy fixture
    const copyFixBtns = await page.locator('.pm-btn-copy-fixture').count();
    console.log(`Số nút Copy fixture xuất hiện trong danh sách capabilities: ${copyFixBtns}`);
    if (copyFixBtns === 0) {
      throw new Error('Không thấy nút Copy fixture trong danh sách actions/capabilities!');
    }

    // Kiểm tra code editor cột 3
    const codeTitle = await page.locator('#pm-code-title').innerText();
    console.log(`Code Panel Title: ${codeTitle}`);
    if (!codeTitle.includes('baseTest.js')) {
      throw new Error(`Code panel không hiển thị file baseTest.js: ${codeTitle}`);
    }

    // Chụp ảnh Page Manager view với Fixture
    await page.screenshot({ path: path.join(__dirname, 'pm_fixture_view.png') });
    console.log('Đã chụp ảnh pm_fixture_view.png');

    // 3. TEST GIAO DIỆN TỐI (DARK THEME)
    console.log('[3/4] Kiểm tra dark theme...');
    await page.click('#theme-button');
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(__dirname, 'pm_fixture_dark.png') });
    console.log('Đã chụp ảnh pm_fixture_dark.png');

    // 4. KIỂM TRA CONSOLE ERRORS
    console.log('[4/4] Kiểm tra Console Errors...');
    console.log('Danh sách console errors:', consoleErrors);
    if (consoleErrors.length > 0) {
      throw new Error(`Có ${consoleErrors.length} lỗi console trong quá trình test: ${consoleErrors.join(' | ')}`);
    }

    console.log('=== TẤT CẢ CÁC KIỂM THỬ GIAO DIỆN & FIXTURE ĐỀU THÀNH CÔNG 100% ===');
  } catch (err) {
    console.error('LỖI TEST:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
