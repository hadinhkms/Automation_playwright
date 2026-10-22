class JobApplyBulkApplyHelper {
  constructor(pageInstance) {
    this.owner = pageInstance;
  }

  async uncheckAllBulkApplyJobs() {
    await this.owner.clickElement(this.owner.chkConfirmAll);
    await this.owner.waitForPageReady();
  }

  async checkAllBulkApplyJobs() {
    await this.owner.clickElement(this.owner.chkConfirmAll);
    await this.owner.waitForPageReady();
  }

  async clickBulkApplySubmit() {
    await this.owner.clickElement(this.owner.btnApplyAll);
    await this.owner.waitForPageReady();
  }

  async confirmAndFinishApplication() {
    await this.owner.actions.waitForVisible(this.owner.btnConfirmPopup, { timeout: 15000 });
    const box = await this.owner.btnConfirmPopup.boundingBox();
    if (box) {
      await this.owner.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    } else {
      await this.owner.btnConfirmPopup.click({ force: true });
    }

    await this.owner.actions.waitForVisible(this.owner.msgSuccess, { timeout: 15000 });
  }

  async confirmBulkApplySubmission() {
    await this.owner.actions.waitForVisible(this.owner.btnConfirmPopup, { timeout: 15000 });
    const box = await this.owner.btnConfirmPopup.boundingBox();
    if (box) {
      await this.owner.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    } else {
      await this.owner.btnConfirmPopup.click({ force: true });
    }

    await this.owner.waitForGlobalLoadingHidden(15000);
    await this.owner.actions.waitForVisible(this.owner.msgBulkApplySuccess, { timeout: 15000 });
  }

  async bulkApply() {
    const target = this.owner.chkConfirmAll.or(this.owner.btnSeeMoreJobs).or(this.owner.msgNoSimilarJobs).or(this.owner.btnBulkApplyZero);
    try {
      await target.first().waitFor({ state: 'visible', timeout: 15000 });
    } catch {
      console.log('Không tìm thấy danh sách Bulk Apply, kết thúc kịch bản.');
      await this.owner.capture('after_no_bulk_apply_list');
      return;
    }

    const hasBulkApplyJobs = await this.waitForBulkApplyListReady();
    if (!hasBulkApplyJobs) {
      console.log('Khong co job trong danh sach Bulk Apply sau khi cho danh sach render xong.');
      await this.owner.capture('after_no_similar_jobs');
      return;
    }

    if (await this.owner.btnSeeMoreJobs.isVisible()) {
      console.log('Không có job nào gợi ý để Bulk Apply, kết thúc kịch bản.');
      await this.owner.capture('after_click_submit_all');
      await this.owner.clickElement(this.owner.btnSeeMoreJobs);
      return;
    }

    await this.owner.actions.waitForVisible(this.owner.chkConfirmAll, { timeout: 15000 });
    await this.owner.capture('before_bulk_apply');
    await this.owner.clickElement(this.owner.chkConfirmAll);
    await this.owner.capture('after_bulk_apply');

    await this.owner.actions.waitForVisible(this.owner.btnBulkApplyReady.or(this.owner.btnApplyAll).first(), { timeout: 15000 });
    await this.owner.clickElement(this.owner.btnBulkApplyReady.or(this.owner.btnApplyAll).first());
    await this.owner.capture('after_click_apply_all');

    await this.confirmBulkApplySubmission();

    try {
      await this.owner.actions.waitForVisible(this.owner.btnSeeMoreJobs, { timeout: 15000 });
      await this.owner.capture('after_click_submit_all');
      await this.owner.clickElement(this.owner.btnSeeMoreJobs);
    } catch {
      console.log('Khong thay nut Xem them viec goi y sau khi Bulk Apply thanh cong.');
    }
  }

  async hasNoBulkApplyJobs() {
    try {
      await this.owner.confirmCheckboxes.first().waitFor({ state: 'visible', timeout: 500 });
      return false;
    } catch {
      // Continue checking explicit empty-state signals.
    }

    try {
      await this.owner.msgNoSimilarJobs.or(this.owner.btnBulkApplyZeroStable).first().waitFor({ state: 'visible', timeout: 1000 });
      return true;
    } catch {
      // Fall back to legacy locator below.
    }

    try {
      await this.owner.msgNoSimilarJobs.or(this.owner.btnBulkApplyZero).first().waitFor({ state: 'visible', timeout: 3000 });
      return true;
    } catch {
      let bulkApplyText = '';
      try {
        bulkApplyText = await this.owner.btnApplyAll.or(this.owner.btnBulkApplyZero).first().textContent();
      } catch (error) {
        console.log('Bulk Apply button text was not available while checking empty state.');
      }
      return /Ứng tuyển\s*0\s*vị trí/i.test(bulkApplyText || '');
    }
  }

  async waitForBulkApplyListReady(timeout = 20000) {
    try {
      await this.owner.waitForGlobalLoadingHidden(15000);
    } catch (error) {
      console.log('Bulk Apply loading indicator was not present or did not settle before list wait.');
    }

    try {
      const result = await this.owner.page.waitForFunction(
        () => {
          const isVisible = (element) => {
            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            return (
              style.visibility !== 'hidden' &&
              style.display !== 'none' &&
              Number(style.opacity) !== 0 &&
              rect.width > 1 &&
              rect.height > 1
            );
          };

          const jobCheckboxes = Array.from(document.querySelectorAll('[data-test-id="common__checkbox"]'))
            .filter((element) => isVisible(element) && !element.closest('[data-test-id="common__checkall"]'));

          if (jobCheckboxes.length > 0) return 'has-jobs';

          const hasEmptyState = Array.from(document.querySelectorAll('body *')).some((element) =>
            isVisible(element) &&
            /Hiện chưa tìm thấy việc làm phù hợp|Không có.*(?:job|việc làm).*gợi ý|Không tìm thấy.*việc làm phù hợp/i.test(element.textContent || '')
          );

          if (hasEmptyState) return 'empty';
          return null;
        },
        null,
        { timeout, polling: 'raf' }
      );
      return (await result.jsonValue()) === 'has-jobs';
    } catch {
      return false;
    }
  }
}

module.exports = { JobApplyBulkApplyHelper };
