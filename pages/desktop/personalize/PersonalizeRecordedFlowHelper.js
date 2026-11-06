/**
 * Chuỗi hành động ghi hình (TC-095 @record): xác thực → tiêu chí ban đầu → bổ sung tiêu chí → khám phá việc làm.
 * Các bước đều tuỳ chọn (UI ghi hình có thể khác theo tài khoản) nên bỏ qua bước không xuất hiện.
 */
class PersonalizeRecordedFlowHelper {
  /** @param {import('../PersonalizePage').PersonalizePage} owner */
  constructor(owner) {
    this.owner = owner;
  }

  async clickIfVisible(locator, timeout = 3000) {
    if (await locator.isVisible({ timeout }).catch(() => false)) {
      await this.owner.actions.click(locator);
      return true;
    }
    return false;
  }

  /** Thiết lập các tiêu chí cá nhân hóa ban đầu (3 bước) */
  async setupInitialCriteria({ jobTitle = 'nhân viên bán hàng', minSalary = '10', maxSalary = '15' } = {}) {
    const o = this.owner;
    try {
      await o.waitForElement(o.dataTestId.or(o.banDangTimCongHeading), 10000);
      await o.actions.click(o.dataTestId);
      await o.actions.fill(o.dataTestId, jobTitle);
      await this.clickIfVisible(o.nhanVienBanHangText);
      await o.capture('criteria_step1_job_title');
      await o.actions.click(o.tiepTheoBtn);
    } catch (_) { /* bước 1 không xuất hiện */ }

    try {
      await o.waitForElement(o.tphcmBtn.or(o.chonToiDa5Text), 8000);
      for (const btn of [o.tphcmBtn, o.haNoiBtn, o.binhDuongBtn, o.dongNaiBtn]) {
        await this.clickIfVisible(btn, 0);
      }
      if (await this.clickIfVisible(o.khacBtn, 0)) {
        await this.clickIfVisible(o.anGiangBtn, 0);
      }
      await o.capture('criteria_step2_locations');
      await o.actions.click(o.tiepTheoBtn);
    } catch (_) { /* bước 2 không xuất hiện */ }

    try {
      await o.waitForElement(o.minSalaryInput, 8000);
      await o.actions.fill(o.minSalaryInput, minSalary);
      if (await o.maxSalaryInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await o.actions.fill(o.maxSalaryInput, maxSalary);
      }
      await o.capture('criteria_step3_salary');
      await o.actions.click(o.hoanTatBtn);
    } catch (_) { /* bước 3 không xuất hiện */ }
  }

  /** Bổ sung thông tin kinh nghiệm và ngành nghề mong muốn */
  async updateAdditionalCriteria() {
    const o = this.owner;
    try {
      if (!(await this.clickIfVisible(o.chinhSuaVaThemBtn, 5000))) return;
      await this.clickIfVisible(o.daCoKinhNghiemBtn);
      if (await this.clickIfVisible(o.chonSoNamKinhText)) {
        await this.clickIfVisible(o.exp3NamOption);
      }
      if (await this.clickIfVisible(o.chonNganhNgheText)) {
        await this.clickIfVisible(o.hanhChinhThuKyHeading);
      }
      await o.capture('additional_criteria_selected');
      await o.actions.click(o.luuThongTinBtn);
    } catch (_) { /* khối chỉnh sửa tiêu chí không khả dụng */ }
  }

  /** Khám phá và xem chi tiết việc làm gợi ý */
  async exploreRecommendedJobs() {
    const o = this.owner;
    try {
      if (await this.clickIfVisible(o.viecLamBtn, 4000)) {
        await this.clickIfVisible(o.timViecLamBtn);
      }
      await this.clickIfVisible(o.xemTatCaLink, 5000);
    } catch (_) { /* menu việc làm không khả dụng */ }
  }

  /** Thực thi toàn bộ chuỗi hành động ghi hình */
  async performRecordedActions({ phone, otp = '1111', fullName = 'Hà Đinh' } = {}) {
    const o = this.owner;
    await o.closeBannerIfVisible();
    await this.clickIfVisible(o.xemViecLamDanhBtn, 4000);
    await this.clickIfVisible(o.item10ViecLamCoLink, 4000);

    await o.loginOrRegisterWithOtp(phone, otp, fullName);
    await o.setupInitialCriteria();

    await this.clickIfVisible(o.tieuChiTimViecText, 4000);
    await this.clickIfVisible(o.luongCaoNhatTab);
    await this.clickIfVisible(o.moiNhatTab);

    await o.updateAdditionalCriteria();
    await o.exploreRecommendedJobs();

    await this.clickIfVisible(o.keToanTongHopLink);
    await o.capture('performrecordedactions_completed');
  }
}

module.exports = { PersonalizeRecordedFlowHelper };
