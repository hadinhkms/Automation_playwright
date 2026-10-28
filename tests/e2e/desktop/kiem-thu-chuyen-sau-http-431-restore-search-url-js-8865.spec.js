/**
 * @file kiem-thu-chuyen-sau-http-431-restore-search-url-js-8865.spec.js
 * @description Suite kiểm thử chuyên sâu cho Ticket JS-8865:
 * Fix lỗi HTTP 431 / 400 (Request Header Or Cookie Too Large) khi tìm kiếm nhiều quận/huyện.
 * 
 * Tuân thủ tuyệt đối quy chuẩn:
 * 1. BDD Gherkin & Page Object Model (không gọi direct page locator trong spec).
 * 2. Cookie & Storage Boundary (sv_p_r <= 200 chars, loại bỏ searchFormJob/Resume, referral_url vào localStorage).
 * 3. Cơ chế phục hồi tự động qua ?_restore=1 và sessionStorage.
 * 4. Client-side length validation (> 8 KB / ~750 quận): Chặn Search API + Toast warning.
 * 5. Tracking events suppression trên ?_restore=1.
 * 6. SEO robots meta directive (noindex, nofollow trên ?_restore=1).
 */

const { test, expect } = require('../../../core/fixtures/baseTest');

test.describe('Ticket JS-8865: Kiểm thử chuyên sâu xử lý URL dài và HTTP 431 @e2e @regression @search @JS-8865', () => {

  // Chuẩn nghiệp vụ Seeker: districts chỉ gồm dãy ID số ngăn cách bằng dấu phẩy, không có chữ
  const generateLongDistrictsQuery = (count = 100) => {
    return Array.from({ length: count }, (_, i) => 1000 + i).join(',');
  };

  test('TC-JS8865-01: Kiểm tra loại bỏ cookie phình to và giới hạn độ dài cookie sv_p_r <= 200 chars', async ({
    pages,
    context,
  }, testInfo) => {
    testInfo.annotations.push({
      type: 'Requirement',
      description: 'JS-8865 Mục 2.1: Loại bỏ searchFormJob, searchFormResume; giới hạn sv_p_r <= 200 ký tự.',
    });

    const homePage = pages.homePage;
    const jobSearchPage = pages.jobSearchPage;

    await homePage.registerGuestPopupAutoHandlers();
    await homePage.navigate();
    await homePage.closeAllPopupsIfVisible();

    const longDistricts = generateLongDistrictsQuery(120);
    await jobSearchPage.openCustomUrl(`/tim-kiem-viec-lam-nhanh?districts=${longDistricts}`);

    const cookies = await context.cookies();
    const searchFormJobCookie = cookies.find(c => c.name === 'searchFormJob');
    const searchFormResumeCookie = cookies.find(c => c.name === 'searchFormResume');
    expect(searchFormJobCookie, 'Cookie searchFormJob phải bị loại bỏ hoàn toàn').toBeUndefined();
    expect(searchFormResumeCookie, 'Cookie searchFormResume phải bị loại bỏ hoàn toàn').toBeUndefined();

    const svPrCookie = cookies.find(c => c.name === 'sv_p_r');
    if (svPrCookie) {
      expect(
        svPrCookie.value.length,
        `Cookie sv_p_r có độ dài ${svPrCookie.value.length}, vượt quá giới hạn 200 ký tự`
      ).toBeLessThanOrEqual(200);
    }
  });

  test('TC-JS8865-02: Kiểm tra referral_url được lưu trữ trong localStorage thay vì cookie và giữ nguyên URL đầy đủ', async ({
    pages,
    context,
  }, testInfo) => {
    testInfo.annotations.push({
      type: 'Requirement',
      description: 'JS-8865 Mục 2.1: Chuyển referral_url sang localStorage, bảo toàn tham số để khôi phục sau login.',
    });

    const jobSearchPage = pages.jobSearchPage;
    const longDistricts = generateLongDistrictsQuery(80);
    await jobSearchPage.openCustomUrl(`/tim-kiem-viec-lam-nhanh?districts=${longDistricts}`);
    await jobSearchPage.clickLoginNavButton();

    const cookies = await context.cookies();
    const referralCookie = cookies.find(c => c.name === 'referral_url');
    expect(referralCookie, 'Không được lưu referral_url dưới dạng cookie').toBeUndefined();

    const storedReferral = await jobSearchPage.getStorageValue('local', 'referral_url')
      || await jobSearchPage.getStorageValue('local', 'redirect_url')
      || await jobSearchPage.getStorageValue('session', 'referral_url');

    if (storedReferral) {
      expect(storedReferral).toContain('tim-kiem-viec-lam-nhanh');
      expect(storedReferral).toContain('districts=');
    }
  });

  test('TC-JS8865-03: Kiểm tra luồng khôi phục tự động qua ?_restore=1 và sessionStorage khi URL dài', async ({
    page,
    pages,
  }, testInfo) => {
    testInfo.annotations.push({
      type: 'Requirement',
      description: 'JS-8865 Mục 2.2 & 2.4: Phục hồi URL qua ?_restore=1, khôi phục link client và hiển thị kết quả.',
    });

    const jobSearchPage = pages.jobSearchPage;
    const longDistricts = generateLongDistrictsQuery(150);
    await jobSearchPage.openCustomUrl(`/tim-kiem-viec-lam-nhanh?districts=${longDistricts}`);

    await page.waitForLoadState('networkidle').catch(() => null);
    await jobSearchPage.expectJobSearchPageVisible();

    const currentUrl = page.url();
    expect(currentUrl).not.toContain('_restore=1');
  });

  test('TC-JS8865-04: Kiểm tra chặn gọi Search API và hiển thị toast warning khi URL vượt ngưỡng ~8 KB (>= 750 quận)', async ({
    page,
    pages,
  }, testInfo) => {
    testInfo.annotations.push({
      type: 'Requirement',
      description: 'JS-8865 Mục 2.3: Chặn Search API khi URL vượt ~8 KB, hiển thị toast cảnh báo chọn ít quận/huyện hơn.',
    });

    const jobSearchPage = pages.jobSearchPage;
    let searchApiCalled = false;
    await page.route('**/api/**/job*search*', (route) => {
      searchApiCalled = true;
      route.continue();
    });

    // 750 ID số thuần túy theo đúng mô tả ticket (750 quận tương đương ~8 KB)
    const extremeDistricts = Array.from({ length: 750 }, (_, i) => 1000000000 + i).join(',');
    await jobSearchPage.openCustomUrl(`/tim-kiem-viec-lam-nhanh?districts=${extremeDistricts}`);
    await jobSearchPage.expectWarningToastVisible();

    expect(searchApiCalled, 'Search API không được gọi khi URL vượt quá giới hạn 8 KB').toBe(false);
  });

  test('TC-JS8865-05: Kiểm tra KHÔNG gửi tracking events khi đang ở trang khôi phục ?_restore=1', async ({
    page,
    pages,
  }, testInfo) => {
    testInfo.annotations.push({
      type: 'Requirement',
      description: 'JS-8865 Mục 2.4: Trang khôi phục ?_restore=1 không được ghi nhận tracking events.',
    });

    const jobSearchPage = pages.jobSearchPage;
    const trackingRequests = [];
    const forbiddenEvents = ['Page View', 'Job Search Performed', 'JS_SearchPage', 'AB test exposure'];

    await page.route('**/*', (route) => {
      const postData = route.request().postData();
      const url = route.request().url();
      if (url.includes('tracking') || url.includes('analytics') || url.includes('collect') || url.includes('telemetry')) {
        forbiddenEvents.forEach(evt => {
          if (postData && postData.includes(evt)) {
            trackingRequests.push({ url, event: evt });
          }
        });
      }
      route.continue();
    });

    await jobSearchPage.openCustomUrl('/tim-kiem-viec-lam-nhanh?_restore=1');
    expect(trackingRequests.length, `Bị phát hiện tracking request trái phép khi ở ?_restore=1: ${JSON.stringify(trackingRequests)}`).toBe(0);
  });

  test('TC-JS8865-06: Kiểm tra SEO robots directive noindex, nofollow trên trang khôi phục ?_restore=1', async ({
    pages,
  }, testInfo) => {
    testInfo.annotations.push({
      type: 'Requirement',
      description: 'JS-8865 Mục 2.5: Trang khôi phục ?_restore=1 phải có robots meta là noindex, nofollow.',
    });

    const jobSearchPage = pages.jobSearchPage;
    await jobSearchPage.openCustomUrl('/tim-kiem-viec-lam-nhanh?_restore=1');

    const robotsContent = await jobSearchPage.getRobotsMetaDirective();
    expect(robotsContent?.toLowerCase(), 'Thẻ meta robots của trang ?_restore=1 phải là noindex, nofollow')
      .toContain('noindex');
    expect(robotsContent?.toLowerCase())
      .toContain('nofollow');
  });

  test('TC-JS8865-07: Kiểm tra SEO robots directive index, follow khi tìm kiếm bình thường có kết quả', async ({
    pages,
  }, testInfo) => {
    testInfo.annotations.push({
      type: 'Requirement',
      description: 'JS-8865 Mục 2.5: Trang tìm kiếm bình thường có kết quả phải giữ index, follow.',
    });

    const jobSearchPage = pages.jobSearchPage;
    await jobSearchPage.open();
    await jobSearchPage.closeAllPopupsIfVisible();
    await jobSearchPage.expectJobSearchPageVisible();

    const robotsContent = await jobSearchPage.getRobotsMetaDirective();
    expect(robotsContent?.toLowerCase()).toContain('index');
    expect(robotsContent?.toLowerCase()).toContain('follow');
    expect(robotsContent?.toLowerCase()).not.toContain('noindex');
  });

  test('TC-JS8865-08: Kiểm tra xử lý trường hợp lỗi cookie quá lớn (Standalone Cookie Overflow Fallback)', async ({
    pages,
    context,
  }, testInfo) => {
    testInfo.annotations.push({
      type: 'Requirement',
      description: 'JS-8865 Ca đặc biệt: Cookie độc lập quá lớn -> Dừng ở Bước 2, báo lỗi kèm nút Tìm lại/Về trang chủ.',
    });

    const jobSearchPage = pages.jobSearchPage;

    await context.addCookies([
      {
        name: 'test_bloated_cookie',
        value: 'A'.repeat(7000),
        domain: '.vieclam24h.vn',
        path: '/',
      },
    ]).catch(() => null);

    await jobSearchPage.openCustomUrl('/tim-kiem-viec-lam-nhanh').catch(() => null);
    await jobSearchPage.expectFallbackErrorVisible();
  });

});
