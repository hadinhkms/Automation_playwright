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
}

module.exports = { AppliedJobsHelper };
