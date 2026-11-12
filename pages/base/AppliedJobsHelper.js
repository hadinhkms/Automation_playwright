const { expect } = require('@playwright/test');

/**
 * Mở trang "Việc làm đã ứng tuyển" từ menu tài khoản và kiểm tra danh sách.
 * Được BasePage sở hữu; dùng page/actions/screenshotHelper của owner (giữ nguyên API public của BasePage).
 */
class AppliedJobsHelper {
  /** @param {import('../BasePage').BasePage} owner */
  constructor(owner) {
    this.owner = owner;
  }

  async openAppliedJobs() {
    try {
      const applyModal = this.owner.page.locator('#apply-job-modal');
      if (await applyModal.isVisible({ timeout: 2000 }).catch(() => false)) {
        // First check if modal has a direct link/button to applied jobs
        const directAppliedLink = applyModal.locator('button, a').filter({ hasText: /Xem việc làm đã ứng tuyển|Việc làm đã ứng tuyển/i }).first();
        if (await directAppliedLink.isVisible({ timeout: 1000 }).catch(() => false)) {
          await Promise.all([
            this.owner.page.waitForURL(/\/ntv-trang-quan-tri-viec-lam-da-ung-tuyen\.html(?:[?#]|$)/i, { timeout: 30000 }),
            this.owner.clickElement(directAppliedLink),
          ]);
          return;
        }

        // Otherwise close or dismiss modal
        const modalCloseBtn = applyModal.locator('[data-test-id="common__close-button"], button:has(.svicon-close), .svicon-close, button:has-text("Đóng"), button:has-text("Xong")').first();
        if (await modalCloseBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await modalCloseBtn.click({ force: true }).catch(() => null);
        } else {
          await this.owner.page.keyboard.press('Escape');
        }

        try {
          await applyModal.waitFor({ state: 'hidden', timeout: 5000 });
        } catch (hideErr) {
          await this.owner.page.evaluate(() => {
            const el = document.getElementById('apply-job-modal');
            if (el) el.style.display = 'none';
          }).catch(() => null);
        }
      }
    } catch (err) {
      console.log('Notice while handling apply modal in openAppliedJobs:', err.message);
    }

    await this.owner.clickElement(this.owner.accountMenuButton);
    // Viewport: ảnh fullPage làm modal onboarding (tài khoản chưa onboarding) mở lại và chặn click menu
    await this.owner.capture('account_menu_opened', false);

    // On mobile web, "Quản lý việc làm" is an accordion menu that needs to be expanded first
    const jobManagementAccordion = this.owner.page.getByRole('button', { name: /Quản lý việc làm/i })
      .or(this.owner.page.getByText('Quản lý việc làm', { exact: true }))
      .first();
    if (await jobManagementAccordion.isVisible({ timeout: 2000 }).catch(() => false)) {
      const isExpanded = (await jobManagementAccordion.getAttribute('aria-expanded').catch(() => 'false')) === 'true';
      if (!isExpanded) {
        await this.owner.clickElement(jobManagementAccordion);
      }
    }

    const targetUrlPattern = /\/ntv-trang-quan-tri-viec-lam-da-ung-tuyen\.html(?:[?#]|$)/i;
    try {
      const appliedLink = this.owner.page.locator('a[href*="ntv-trang-quan-tri-viec-lam-da-ung-tuyen"]')
        .or(this.owner.appliedJobsButton)
        .first();

      if (await appliedLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await Promise.all([
          this.owner.page.waitForURL(targetUrlPattern, { timeout: 10000 }),
          this.owner.clickElement(appliedLink, { timeout: 10000 }),
        ]);
      } else {
        await this.owner.page.goto('/ntv-trang-quan-tri-viec-lam-da-ung-tuyen.html', { waitUntil: 'domcontentloaded' }); // HomePage.navigate() bỏ qua path
      }
    } catch (_err) {
      if (!targetUrlPattern.test(this.owner.page.url())) {
        await this.owner.page.goto('/ntv-trang-quan-tri-viec-lam-da-ung-tuyen.html', { waitUntil: 'domcontentloaded' }); // HomePage.navigate() bỏ qua path
      }
    }
  }

  async expectAppliedJobsVisible() {
    await expect(this.owner.appliedJobsList).toBeVisible({ timeout: 30000 });
  }

  /**
   * Kiểm tra đúng việc vừa nộp có trong danh sách, nộp hôm nay, và đọc trạng thái hồ sơ.
   * - "Hồ sơ đã đến nhà tuyển dụng": hồ sơ đã đến NTD.
   * - "Ứng tuyển thành công": hồ sơ đang chờ Admin duyệt (chưa đến NTD).
   * @param {string} jobUrl URL trang chi tiết việc làm đã nộp (chứa `id<số>.html`).
   * @param {{ requireDelivered?: boolean, timeout?: number, jobTitle?: string }} [options]
   *   requireDelivered=true: chỉ chấp nhận trạng thái đã đến NTD (tải lại trang để chờ duyệt).
   *   jobTitle: tiêu đề tin, dùng khi danh sách không có link tin (thẻ trên Mobile Web).
   * @returns {Promise<'delivered'|'pending'>}
   */
  async expectAppliedJobStatus(jobUrl, options = {}) {
    const { requireDelivered = false, timeout = 60000, jobTitle = '' } = options;
    const jobId = (String(jobUrl).match(/id(\d+)\.html/i) || [])[1];
    if (!jobId && !jobTitle) {
      throw new Error(`Không lấy được id tin tuyển dụng từ URL: ${jobUrl}`);
    }
    const jobLabel = jobId ? `id${jobId}` : `"${jobTitle}"`;

    const page = this.owner.page;
    // Desktop: mỗi đơn là một <tr> có link tin. Mobile Web: mỗi đơn là một thẻ <div>, có thể không có link.
    let jobMarker = jobId ? page.locator(`a[href*="id${jobId}.html"]`) : page.getByText(jobTitle, { exact: true });
    if (jobId && jobTitle) jobMarker = jobMarker.or(page.getByText(jobTitle, { exact: true }));
    const jobBlocks = this.owner.appliedJobsList.locator('tbody tr, div').filter({ has: jobMarker });
    const expectedStatus = requireDelivered ? APPLIED_STATUS.delivered : APPLIED_STATUS.any;
    const today = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
    const datedBlocks = jobBlocks.filter({ hasText: today });
    // Khối sâu nhất chứa đủ tin + ngày nộp + trạng thái chính là dòng/thẻ của đơn đó
    const entry = datedBlocks.filter({ hasText: expectedStatus }).last();

    let firstAttempt = true;
    let entryText = '';
    await expect(async () => {
      if (!firstAttempt) {
        await page.reload({ waitUntil: 'domcontentloaded' });
      }
      firstAttempt = false;
      await expect(this.owner.appliedJobsList).toBeVisible({ timeout: 15000 });
      await expect(jobBlocks.last(), `Tin ${jobLabel} phải có trong danh sách Việc làm đã ứng tuyển`).toBeVisible({ timeout: 10000 });
      await expect(datedBlocks.last(), `Tin ${jobLabel} phải có ngày nộp ${today}`).toBeVisible({ timeout: 5000 });
      await expect(entry, `Trạng thái hồ sơ của tin ${jobLabel} phải khớp ${expectedStatus}`).toBeVisible({ timeout: 5000 });
      entryText = await entry.innerText();
      // Chặn trường hợp khớp nhầm khối bao nhiều đơn (ngày/trạng thái lấy từ đơn khác)
      expect((entryText.match(/\d{2}\/\d{2}\/\d{4}/g) || []).length, `Khối khớp tin ${jobLabel} chỉ được chứa một đơn`).toBeLessThanOrEqual(2);
      expect((entryText.match(APPLIED_STATUS.anyGlobal) || []).length, `Khối khớp tin ${jobLabel} chỉ được chứa một trạng thái`).toBe(1);
    }).toPass({ timeout, intervals: [3000, 5000, 10000] });

    return APPLIED_STATUS.delivered.test(entryText) ? 'delivered' : 'pending';
  }
}

const APPLIED_STATUS = {
  delivered: /Hồ sơ đã đến nhà tuyển dụng/i,
  any: /Hồ sơ đã đến nhà tuyển dụng|Ứng tuyển thành công/i,
  anyGlobal: /Hồ sơ đã đến nhà tuyển dụng|Ứng tuyển thành công/gi,
};

module.exports = { AppliedJobsHelper };
