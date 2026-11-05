const { expect } = require('@playwright/test');
const { BasePage } = require('../BasePage');

const DIALOG_TITLE = 'Khám phá việc làm gần tôi';

/**
 * Pop-up "Khám phá việc làm gần tôi" (Job Near Me – lọc việc làm theo bán kính) trên Desktop.
 * Lưu ý: không dùng registerGuestPopupAutoHandlers()/closeAllPopupsIfVisible() trong luồng này —
 * chúng đóng mọi modal có nút close (kể cả pop-up này) và xoá node DOM của React modal làm pop-up tự đóng.
 */
class JobNearMePage extends BasePage {
  constructor(page, featureName) {
    super(page, featureName);
    // Điểm vào ở Home: dropdown "Địa điểm" trong form tìm kiếm
    this.homeSearchForm = page.locator('form').filter({ has: page.getByPlaceholder('Nhập vị trí muốn ứng tuyển') });
    this.homeLocationDropdown = this.homeSearchForm.getByText('Địa điểm', { exact: true });
    this.homeJobNearMeOption = page.getByText(DIALOG_TITLE, { exact: true });
    // Điểm vào ở Search page khi chưa áp dụng bán kính
    this.searchBarEntry = page.getByText('Tìm việc làm gần tôi', { exact: true });
    this.searchBarRadiusChip = page.getByText(/^\(\d+km\)$/);

    this.dialog = page.locator('[data-test-id="common__dialog"]').filter({ hasText: DIALOG_TITLE });
    this.closeBtn = this.dialog.locator('[data-test-id="common__close-button"]');
    this.locationInput = this.dialog.getByRole('textbox', { name: 'Vị trí tìm kiếm' });
    this.currentLocationBtn = this.dialog.getByRole('button', { name: 'Vị trí hiện tại' });
    this.customRadiusInput = this.dialog.getByRole('textbox', { name: 'Bán kính tìm kiếm (km)' });
    this.historyLabel = this.dialog.getByText('Lịch sử tìm kiếm', { exact: true });
    this.applyBtn = this.dialog.getByRole('button', { name: 'Áp dụng', exact: true });
    this.clearLocationFilterBtn = this.dialog.getByRole('button', { name: 'Bỏ lọc vị trí', exact: true });
    // Danh sách gợi ý autocomplete render qua portal, nằm ngoài dialog
    this.suggestionDropdown = page.locator('[data-test-id="common__select-dropdown"]');
    this.jobCards = page.locator('a[data-job-id]');
    this.jobDistanceTexts = this.jobCards.getByText(/^\d+(\.\d+)?km$/);
  }

  presetRadiusBtn(km) {
    return this.dialog.getByRole('button', { name: `${km}km`, exact: true });
  }

  historyItem(locationText) {
    return this.dialog.getByRole('button', { name: locationText, exact: true });
  }

  async isVisibleWithin(locator, timeout) {
    return locator.waitFor({ state: 'visible', timeout }).then(() => true, () => false);
  }

  /**
   * Tự đóng mọi dialog khác đè lên luồng (nhắc đăng nhập "Khoan đã" của guest, banner chiến dịch,
   * thông báo tính năng) bằng chính nút đóng của dialog đó; luôn loại trừ pop-up Job Near Me.
   */
  async registerOverlayHandlersKeepingJobNearMe() {
    // Chỉ modal chặn thao tác (aria-modal); bỏ qua panel nổi không chặn như "Hỏi Chớp".
    // .first(): có thể có nhiều modal marketing cùng lúc, handler xử lý từng cái một
    const otherDialog = this.page.locator('[role="dialog"][aria-modal="true"]').filter({ hasNotText: DIALOG_TITLE }).first();
    await this.page.addLocatorHandler(otherDialog, async (overlay) => {
      await overlay.locator('.svicon-close, [data-test-id="common__close-button"]').first().click({ force: true });
      await overlay.waitFor({ state: 'hidden', timeout: 5000 });
    });
    // Popup mời tải app không phải role=dialog
    const appInstallPopup = this.page.locator('.mbep-popup.mbep-popup-show');
    await this.page.addLocatorHandler(appInstallPopup, async (overlay) => {
      await overlay.locator('button:has(.svicon-close)').click({ force: true });
      await overlay.waitFor({ state: 'hidden', timeout: 5000 });
    });
  }

  async openFromHomeLocationDropdown() {
    // Lần bấm đầu có thể bị thông báo tính năng chặn; handler đóng nó rồi bấm lại dropdown
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await this.clickElement(this.homeLocationDropdown);
      if (await this.isVisibleWithin(this.homeJobNearMeOption, 3000)) break;
    }
    await expect(this.homeJobNearMeOption).toBeVisible({ timeout: 5000 });
    await Promise.all([
      this.page.waitForURL(/\/tim-kiem-viec-lam/, { timeout: 30000 }),
      this.clickElement(this.homeJobNearMeOption),
    ]);
    await this.expectDialogOpen();
  }

  async openFromSearchBar(appliedLocationText) {
    const trigger = appliedLocationText
      ? this.page.getByText(appliedLocationText, { exact: true })
      : this.searchBarEntry;
    await this.clickElement(trigger);
    await this.expectDialogOpen();
  }

  async expectDialogOpen() {
    await expect(this.dialog).toBeVisible({ timeout: 15000 });
    await expect(this.locationInput).toBeVisible();
  }

  async searchAndSelectLocation(query, suggestionText) {
    await this.actions.fillAutocomplete(this.locationInput, query);
    const option = this.suggestionDropdown.getByText(suggestionText, { exact: true });
    await this.clickElement(option);
    await expect(this.locationInput).toHaveValue(suggestionText);
  }

  async useCurrentLocation() {
    await this.clickElement(this.currentLocationBtn);
    await expect(this.locationInput).not.toHaveValue('', { timeout: 20000 });
    return this.locationInput.inputValue();
  }

  async selectPresetRadius(km) {
    await this.clickElement(this.presetRadiusBtn(km));
    await expect(this.presetRadiusBtn(km)).toHaveAttribute('aria-pressed', 'true');
  }

  async enterCustomRadius(km) {
    await this.actions.fill(this.customRadiusInput, String(km));
    await expect(this.customRadiusInput).toHaveValue(String(km));
  }

  async applyFilter(expectedKm) {
    await expect(this.applyBtn).toBeEnabled();
    await Promise.all([
      this.page.waitForURL((url) => url.searchParams.get('radius') === String(expectedKm), { timeout: 30000 }),
      this.clickElement(this.applyBtn),
    ]);
    await expect(this.dialog).toBeHidden();
  }

  async clearLocationFilter() {
    await Promise.all([
      this.page.waitForURL((url) => !url.searchParams.has('radius'), { timeout: 30000 }),
      this.clickElement(this.clearLocationFilterBtn),
    ]);
    await expect(this.dialog).toBeHidden();
  }

  async expectPopupSelection({ location, presetKm, customKm }) {
    if (location !== undefined) await expect(this.locationInput).toHaveValue(location);
    for (const km of [5, 10, 15]) {
      await expect(this.presetRadiusBtn(km)).toHaveAttribute('aria-pressed', String(km === presetKm));
    }
    await expect(this.customRadiusInput).toHaveValue(customKm === undefined ? '' : String(customKm));
  }

  async expectHistoryContains(locationText) {
    await expect(this.historyLabel).toBeVisible();
    await expect(this.historyItem(locationText)).toBeVisible();
  }

  async getVisibleJobDistancesKm() {
    await expect(this.jobDistanceTexts.first()).toBeVisible({ timeout: 20000 });
    const texts = await this.jobDistanceTexts.allInnerTexts();
    return texts.map((text) => parseFloat(text));
  }

  async expectRadiusFilterApplied(km) {
    await expect(this.page).toHaveURL(/[?&]lat=-?\d+(\.\d+)?/);
    await expect(this.page).toHaveURL(/[?&]lng=-?\d+(\.\d+)?/);
    await expect(this.page).toHaveURL(new RegExp(`[?&]radius=${km}(&|$)`));
    await expect(this.searchBarRadiusChip).toHaveText(`(${km}km)`);
  }

  async expectRadiusFilterCleared() {
    await expect(this.page).not.toHaveURL(/[?&](radius|lat|lng)=/);
    await expect(this.searchBarRadiusChip).toBeHidden();
  }
}

module.exports = { JobNearMePage, DIALOG_TITLE };
