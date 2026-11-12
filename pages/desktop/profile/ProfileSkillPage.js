const { expect } = require('@playwright/test');
const { BasePage } = require('../../BasePage');
const { SkillSuggestionHelper } = require('./SkillSuggestionHelper');

const AUTOCOMPLETE_PATH = '/skill/autocomplete';
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Modal Kỹ năng trên trang Hồ sơ của tôi (Desktop) — Skill Normalization v1.1 (JS-8828).
 * Nút "Thêm mới: <keyword>" chỉ hiển thị khi keyword (sau trim, gộp khoảng trắng, không phân biệt
 * hoa/thường) không khớp chính xác skill nào trong thư viện.
 */
class ProfileSkillPage extends BasePage {
  constructor(page, featureName) {
    super(page, featureName);
    this.skillsSection = page.locator('[data-test-id="user-profile__skills"]');
    this.btnOpenSkillsEditor = this.skillsSection.locator(
      '[data-test-id="user-profile__edit-button"], [data-test-id="user-profile__add-button"]'
    );
    this.skillsEditor = page.locator('[data-test-id="user-profile__skills-v2-modal"]');
    this.searchInput = this.skillsEditor.getByPlaceholder('Nhập kỹ năng');
    this.selectedCounter = this.skillsEditor.getByText(/^Đã chọn \d+\/20$/);
    // Dropdown gợi ý được render qua portal ngoài modal
    this.suggestionPanel = page.locator('[data-test-id="common__select-dropdown"]');
    this.btnSave = this.skillsEditor.getByRole('button', { name: 'Lưu thông tin' });
    // Khu vực AI gợi ý kỹ năng theo job title (JS-8837)
    this.suggestions = new SkillSuggestionHelper(this);
  }

  get btnAddNewSkill() {
    return this.suggestionPanel.getByText('Thêm mới:');
  }

  libraryOption(skillName) {
    return this.suggestionPanel
      .locator('div', { has: this.page.locator('[data-test-id="common__checkbox"]') })
      .filter({ hasText: new RegExp(`^\\s*${escapeRegExp(skillName)}\\s*$`) });
  }

  selectedChip(skillName) {
    return this.skillsEditor.getByText(skillName, { exact: true });
  }

  profileSkill(skillName) {
    return this.skillsSection.getByText(skillName, { exact: true });
  }

  async openSkillsEditor() {
    await this.actions.click(this.btnOpenSkillsEditor, { timeout: 20000 });
    await this.actions.waitForVisible(this.searchInput, { timeout: 15000 });
  }

  async getSelectedCount() {
    const text = await this.selectedCounter.innerText();
    return Number(text.match(/Đã chọn (\d+)\/20/)[1]);
  }

  /** Nhập keyword và chờ đúng response autocomplete của keyword đó (tránh đọc kết quả cũ). */
  async searchSkill(keyword) {
    const searchDone = this.page.waitForResponse(
      (res) => res.url().includes(AUTOCOMPLETE_PATH) && new URL(res.url()).searchParams.get('name') === keyword,
      { timeout: 20000 }
    );
    await this.actions.fill(this.searchInput, keyword);
    const response = await searchDone;
    expect(response.ok(), `Autocomplete "${keyword}" trả HTTP ${response.status()}`).toBeTruthy();
  }

  async selectLibrarySkill(canonicalName) {
    const before = await this.getSelectedCount();
    await this.actions.click(this.libraryOption(canonicalName));
    await expect(this.selectedCounter).toHaveText(`Đã chọn ${before + 1}/20`);
  }

  async addNewSkill(savedName) {
    const before = await this.getSelectedCount();
    await this.actions.click(this.btnAddNewSkill);
    await expect(this.selectedCounter).toHaveText(`Đã chọn ${before + 1}/20`);
    await expect(this.selectedChip(savedName)).toBeVisible();
  }

  async saveSkills() {
    const saved = this.page.waitForResponse(
      (res) => /\/user-profile$/.test(new URL(res.url()).pathname) && res.request().method() === 'POST',
      { timeout: 20000 }
    );
    await this.actions.click(this.btnSave);
    const response = await saved;
    expect(response.ok(), `Lưu kỹ năng trả HTTP ${response.status()}`).toBeTruthy();
    await expect(this.skillsEditor).toBeHidden({ timeout: 15000 });
  }

  async expectSkillsSectionVisible() {
    await this.actions.waitForVisible(this.skillsSection, { timeout: 30000 });
  }

  async reloadProfile() {
    await this.page.reload({ waitUntil: 'domcontentloaded' });
    await this.expectSkillsSectionVisible();
  }
}

module.exports = { ProfileSkillPage };
