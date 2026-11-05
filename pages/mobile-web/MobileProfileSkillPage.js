const { expect } = require('@playwright/test');
const { ProfileSkillPage } = require('../desktop/profile/ProfileSkillPage');

/**
 * Trang Kỹ năng + bottom sheet "Thêm kỹ năng" trên Mobile Web — Skill Normalization v1.1 (JS-8828).
 * Chạm ô tìm kiếm ở trang Kỹ năng sẽ mở bottom sheet; tìm, chọn, thêm và lưu đều diễn ra trong sheet.
 */
class MobileProfileSkillPage extends ProfileSkillPage {
  constructor(page, featureName) {
    super(page, featureName);
    this.skillsPageSearchInput = this.skillsEditor.getByPlaceholder('Nhập kỹ năng');
    // Bottom sheet render ở body, không có data-test-id riêng: scope theo tiêu đề sheet
    this.skillsSheet = page.locator('div.fixed.inset-0').filter({ hasText: 'Thêm kỹ năng' });
    this.searchInput = this.skillsSheet.getByPlaceholder('Nhập kỹ năng');
    this.selectedCounter = this.skillsSheet.getByText(/^Đã chọn \d+\/20$/);
    this.suggestionPanel = this.skillsSheet;
    this.btnSave = this.skillsSheet.getByRole('button', { name: 'Lưu kỹ năng' });
  }

  selectedChip(skillName) {
    return this.skillsSheet.getByText(skillName, { exact: true });
  }

  async openSkillsEditor() {
    await this.actions.click(this.btnOpenSkillsEditor, { timeout: 20000 });
    await this.actions.click(this.skillsPageSearchInput, { timeout: 15000 });
    await this.actions.waitForVisible(this.searchInput, { timeout: 15000 });
  }

  async saveSkills() {
    const saved = this.page.waitForResponse(
      (res) => /\/user-profile$/.test(new URL(res.url()).pathname) && res.request().method() === 'POST',
      { timeout: 20000 }
    );
    await this.actions.click(this.btnSave);
    const response = await saved;
    expect(response.ok(), `Lưu kỹ năng trả HTTP ${response.status()}`).toBeTruthy();
    await expect(this.skillsSheet).toBeHidden({ timeout: 15000 });
  }

  async reloadProfile() {
    await this.navigate('/ho-so-cua-toi.html', { waitUntil: 'domcontentloaded' });
    await this.expectSkillsSectionVisible();
  }
}

module.exports = { MobileProfileSkillPage };
