/**
 * Bấm "Ứng tuyển ngay" và chờ modal chọn phương thức nộp hồ sơ. Được JobApplyPage sở hữu.
 */
class JobApplyStartHelper {
  /** @param {import('../JobApplyPage').JobApplyPage} owner */
  constructor(owner) {
    this.owner = owner;
  }

  /**
   * Trang chi tiết render SSR: bấm "Ứng tuyển ngay" trước khi hydrate xong thì click bị nuốt, modal không mở
   * → bấm lại khi sau lần bấm trước vẫn chưa thấy modal chọn phương thức (mặc định tối đa 3 lần).
   * @param {{ otpCode?: string, maxAttempts?: number }} [options]
   */
  async startApply(options = {}) {
    const owner = this.owner;
    const maxAttempts = options.maxAttempts ?? 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await owner.clickElement(owner.btnApplyNow);
      await owner.handlePhoneVerificationAfterApplyIfVisible(options.otpCode);
      const opened = await owner.optProfileMethod
        .waitFor({ state: 'visible', timeout: attempt < maxAttempts ? 8000 : 15000 })
        .then(() => true)
        .catch(() => false);
      if (opened) break;
      const modalOpening = await owner.applyModal.isVisible().catch(() => false);
      const canRetry = !modalOpening && (await owner.btnApplyNow.isVisible().catch(() => false));
      if (attempt === maxAttempts || !canRetry) {
        await owner.actions.waitForVisible(owner.optProfileMethod);
        break;
      }
    }
    await owner.waitForApplyModalStable();
  }
}

module.exports = { JobApplyStartHelper };
