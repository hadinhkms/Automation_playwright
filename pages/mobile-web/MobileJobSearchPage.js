const { expect } = require('@playwright/test');
const { JobSearchPage } = require('../desktop/JobSearchPage');

class MobileJobSearchPage extends JobSearchPage {
  constructor(page, featureName) {
    super(page, featureName);
    this.firstJobLink = page.getByRole('link').filter({ has: page.getByRole('heading', { level: 3 }) }).first();
    this.firstUnappliedJobLink = page.getByRole('link').filter({ has: page.getByRole('heading', { level: 3 }) }).filter({ hasNotText: /Đã ứng tuyển|Bạn vừa ứng tuyển/i }).first();
  }

  async expectJobsVisible() {
    await this.closeBlockingDialogsIfVisible();
    await this.waitForElement(this.firstJobLink);
  }

  /**
   * Đóng dialog chặn màn hình như "Khám phá việc quanh tôi" trên Mobile Web
   */
  async closeBlockingDialogsIfVisible() {
    const dialog = this.page.locator('[data-test-id="common__dialog"]');
    if (await dialog.isVisible({ timeout: 3000 }).catch(() => false)) {
      const closeBtn = dialog.locator('button:has(.svicon-close), button:has(.svicon-x), i.svicon-close, button:has-text("Bỏ lọc vị trí"), button:has-text("Đóng")').first();
      if (await closeBtn.isVisible().catch(() => false)) {
        await this.clickElement(closeBtn);
      } else {
        try {
          await this.page.locator('body').click({ position: { x: 10, y: 10 }, force: true });
        } catch (_e) {
          // ignore
        }
      }
      try {
        await dialog.waitFor({ state: 'hidden', timeout: 5000 });
      } catch (_e) {
        // ignore
      }
    }
  }

  /**
   * Mobile Web mở chi tiết tin dạng lớp phủ trên trang tìm kiếm (URL không đổi, không có H1):
   * kiểm tra tiêu đề tin vừa bấm và nút "Ứng tuyển" trong lớp phủ. Nếu app điều hướng sang trang chi tiết thì kiểm tra trên trang đó.
   * @param {import('@playwright/test').Page} [detailPage]
   */
  async expectJobDetailOpened(detailPage = this.page) {
    const title = this.lastOpenedJobTitle;
    if (!title) throw new Error('Chưa mở tin tuyển dụng nào qua clickFirstJob()');
    const detailTitle = detailPage.locator('.fixed').getByRole('heading', { name: title, exact: true })
      .or(detailPage.getByRole('heading', { level: 1, name: title }))
      .first();
    await expect(detailTitle, `Chi tiết tin "${title}" phải hiển thị`).toBeVisible({ timeout: 20000 });
    await expect(
      detailPage.getByRole('button', { name: /^\s*(Ứng tuyển( ngay)?|Nộp lại hồ sơ)\s*$/i }).first(),
      'Chi tiết tin phải có nút Ứng tuyển'
    ).toBeVisible({ timeout: 15000 });
  }

  /**
   * Click vào công việc đầu tiên trên mobile:
   * Tự động đóng popup cản trở, hỗ trợ cả trường hợp mở tab mới (popup) hoặc điều hướng tại chỗ (in-tab/SPA)
   */
  async clickFirstJob() {
    await this.closeBlockingDialogsIfVisible();

    const targetJob = await this.firstUnappliedJobLink.isVisible({ timeout: 5000 })
      ? this.firstUnappliedJobLink
      : this.firstJobLink;

    const href = await targetJob.getAttribute('href').catch(() => null);
    // Dùng để đối chiếu tin vừa mở với danh sách Việc làm đã ứng tuyển (URL trang có thể chưa kịp đổi)
    this.lastOpenedJobHref = href;
    this.lastOpenedJobTitle = (await targetJob.getByRole('heading', { level: 3 }).first().innerText().catch(() => '')).trim();

    let popup = null;
    const popupPromise = this.page.waitForEvent('popup', { timeout: 15000 }).catch((_err) => null);
    // Dialog "Khám phá việc làm gần tôi" có thể bật muộn và chặn click → đóng rồi bấm lại
    await expect(async () => {
      await this.closeBlockingDialogsIfVisible();
      await targetJob.click({ timeout: 5000 });
    }).toPass({ timeout: 40000 });
    popup = await Promise.race([
      popupPromise,
      this.page.waitForURL(/id\d+\.html/, { timeout: 15000 }).then(() => null, () => null),
    ]);

    if (popup) {
      await popup.waitForLoadState('domcontentloaded');
      return popup;
    }

    // Nếu không mở popup, đợi trang hiện tại chuyển sang trang chi tiết việc làm
    try {
      await this.page.waitForURL(/(?:id\d+\.html|\/viec-lam\/|\/tin-tuyen-dung\/)/, { timeout: 10000 });
    } catch (_e) {
      if (href && !this.page.url().includes(href)) {
        await this.navigate(href);
      }
    }

    await this.page.waitForLoadState('domcontentloaded');
    return this.page;
  }
}

module.exports = { MobileJobSearchPage };
