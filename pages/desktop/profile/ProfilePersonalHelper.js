class ProfilePersonalHelper {
  constructor(pageInstance) {
    this.owner = pageInstance;
  }

  escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  async closeSelectModalMenuIfVisible() {
    const selectModalContainer = this.owner.page.locator('[data-test-id="select__modal-menu__container"]');
    if (await selectModalContainer.isVisible({ timeout: 1500 }).catch(() => false)) {
      const viewport = this.owner.page.viewportSize() || { width: 390, height: 844 };
      await this.owner.page.mouse.click(Math.round(viewport.width / 2), Math.min(600, viewport.height - 100));
      try {
        await selectModalContainer.waitFor({ state: 'hidden', timeout: 3000 });
      } catch (_e) {
        // ignore
      }
    }
  }

  async clickEditPersonalInfo() {
    await this.owner.page.waitForLoadState('domcontentloaded');
    await this.owner.waitForGlobalLoadingHidden(10000).catch(() => null);

    const editBtn = this.owner.page.locator(
      '[data-test-id="user-profile__personal-info"] [data-test-id="user-profile__edit-button"]:visible, ' +
      '[data-test-id="user-profile__edit-button"]:visible, ' +
      '.svicon-edit-alt:visible, ' +
      'button:has(.svicon-edit-alt):visible'
    ).first();

    await this.owner.clickElement(editBtn, { force: true });

    const modal = this.owner.page.locator(
      '[data-test-id="user-profile__personal-info-modal"]:visible, ' +
      '[data-test-id="common__form-modal"]:visible, ' +
      '[data-test-id="common__dialog"]:visible'
    ).first();

    try {
      await modal.waitFor({ state: 'visible', timeout: 15000 });
    } catch (_e) {
      const addAddressBtn = this.owner.page.getByText('Thêm địa chỉ hiện tại').first();
      if (await addAddressBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await this.owner.clickElement(addAddressBtn, { force: true });
        await modal.waitFor({ state: 'visible', timeout: 15000 });
      } else {
        throw _e;
      }
    }
    await this.owner.waitForGlobalLoadingHidden(10000).catch(() => null);
  }

  async fillPersonalInfo(data) {
    const modal = this.owner.page.locator(
      '[data-test-id="user-profile__personal-info-modal"]:visible, ' +
      '[data-test-id="common__form-modal"]:visible, ' +
      '[data-test-id="common__dialog"]:visible'
    ).first();
    const scope = (await modal.isVisible({ timeout: 3000 }).catch(() => false)) ? modal : this.owner.page;

    const provinceBtn = scope.getByText('Chọn tỉnh thành').first();
    await this.owner.clickElement(provinceBtn, { force: true });

    const provinceEscaped = this.escapeRegExp(data.province);
    const provinceOption = this.owner.page
      .locator('[data-test-id="common__select-menu"]:visible, [data-test-id="select__modal-menu__container"]:visible')
      .getByRole('heading', { name: new RegExp(provinceEscaped, 'i') })
      .or(this.owner.page.locator('[data-test-id="common__select-menu"]:visible, [data-test-id="select__modal-menu__container"]:visible').getByText(data.province, { exact: true }))
      .or(this.owner.page.locator('[data-test-id="common__select-menu"]:visible, [data-test-id="select__modal-menu__container"]:visible').getByRole('button', { name: new RegExp(provinceEscaped, 'i') }))
      .or(this.owner.page.locator('[data-test-id="common__select-menu"]:visible, [data-test-id="select__modal-menu__container"]:visible').locator('li, [role="option"]').filter({ hasText: new RegExp(provinceEscaped, 'i') }))
      .first();

    await provinceOption.waitFor({ state: 'visible', timeout: 15000 });
    await this.owner.clickElement(provinceOption, { force: true });
    await this.closeSelectModalMenuIfVisible();

    const districtBtn = scope.getByText('Chọn quận huyện').first();
    await this.owner.clickElement(districtBtn, { force: true });

    const districtName = data.district.split('(')[0].trim();
    const districtEscaped = this.escapeRegExp(districtName);
    const districtOption = this.owner.page
      .locator('[data-test-id="common__select-menu"]:visible, [data-test-id="select__modal-menu__container"]:visible')
      .getByRole('heading')
      .filter({ hasText: districtName })
      .or(this.owner.page.locator('[data-test-id="common__select-menu"]:visible, [data-test-id="select__modal-menu__container"]:visible').getByText(districtName, { exact: true }))
      .or(this.owner.page.locator('[data-test-id="common__select-menu"]:visible, [data-test-id="select__modal-menu__container"]:visible').getByRole('button').filter({ hasText: new RegExp(districtEscaped, 'i') }))
      .or(this.owner.page.locator('[data-test-id="common__select-menu"]:visible, [data-test-id="select__modal-menu__container"]:visible').locator('li, [role="option"]').filter({ hasText: new RegExp(districtEscaped, 'i') }))
      .first();

    await districtOption.waitFor({ state: 'visible', timeout: 35000 });
    await this.owner.clickElement(districtOption, { force: true });
    await this.closeSelectModalMenuIfVisible();

    const inpDateOfBirth = scope.getByRole('textbox', { name: 'DD/MM/YYYY' }).first();
    await this.owner.clickElement(inpDateOfBirth, { force: true });
    await this.owner.clickElement(this.owner.page.getByRole('button', { name: new RegExp('^Tháng \\d+', 'i') }).first(), { force: true });
    await this.owner.clickElement(this.owner.page.getByText(data.birthMonth).first(), { force: true });
    await this.owner.clickElement(this.owner.page.getByRole('button', { name: new RegExp('^\\d{4}', 'i') }).first(), { force: true });
    await this.owner.clickElement(this.owner.page.getByText(data.birthYear).first(), { force: true });
    await this.owner.clickElement(this.owner.page.getByRole('button', { name: new RegExp(`Choose.*${data.birthDay}.*tháng`) }).first(), { force: true });
    await this.owner.clickElement(scope.getByRole('button', { name: data.gender }).first(), { force: true });
  }

  async savePersonalInfo() {
    const btnSave = this.owner.page
      .getByRole('button', { name: /Lưu thông tin|Lưu thay đổi|^Lưu$/i })
      .or(this.owner.page.locator('button:has-text("Lưu thông tin"), button:text-is("Lưu")'))
      .first();

    await btnSave.scrollIntoViewIfNeeded().catch(() => null);
    await this.owner.clickElement(btnSave, { force: true });
    const modal = this.owner.page.locator('[data-test-id="user-profile__personal-info-modal"]');
    await modal.waitFor({ state: 'hidden', timeout: 30000 }).catch(() => null);
    await this.owner.waitForGlobalLoadingHidden(15000).catch(() => null);
  }
}

module.exports = { ProfilePersonalHelper };
