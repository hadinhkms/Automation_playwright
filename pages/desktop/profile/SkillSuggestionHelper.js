const { expect } = require('@playwright/test');

const SUGGEST_PATH = '/skill/ai-suggest';
const IMPRESSION_PATH = '/skill/ai-suggest/impression';
const SELECTED_PATH = '/skill/ai-suggest/selected';
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const pathOf = (url) => new URL(url).pathname;

/**
 * Khu vực "Chớp gợi ý kỹ năng cho vị trí công việc" trong modal/trang Kỹ năng (JS-8837).
 * Dùng chung cho Desktop (modal) và Mobile Web (trang Kỹ năng): khu vực gợi ý, danh sách đã chọn và bộ đếm
 * đều nằm trong cùng container `user-profile__skills-v2-modal`.
 */
class SkillSuggestionHelper {
  /** @param {import('./ProfileSkillPage').ProfileSkillPage} owner */
  constructor(owner) {
    this.owner = owner;
    this.page = owner.page;
    this.editor = owner.skillsEditor;
    this.card = this.editor.getByRole('region', { name: 'Gợi ý kỹ năng' });
    this.cardToggle = this.card.locator('button[aria-expanded]');
    this.chips = this.card.locator('[id^="skill-suggestions-"]').getByRole('button');
    this.selectedSkills = this.editor.locator('[data-test-id="common__chip"]');
    this.counter = this.editor.getByText(/^Đã chọn \d+\/20$/);
    this.editorSearchInput = this.editor.getByPlaceholder('Nhập kỹ năng');
    this.editorTitle = this.editor.getByRole('heading', { name: 'Kỹ năng', exact: true });
    // Desktop: "Lưu thông tin"; Mobile Web (trang Kỹ năng): "Lưu thay đổi"
    this.btnSaveEditor = this.editor.getByRole('button', { name: /^Lưu (thông tin|thay đổi)$/ });
    this.suggestRequests = [];
  }

  /** Ghi nhận mọi request gợi ý kỹ năng kể từ lúc gọi (để khẳng định KHÔNG gọi API khi thiếu job title). */
  startSuggestRequestLog() {
    this.page.on('request', (req) => {
      if (req.method() === 'GET' && pathOf(req.url()).endsWith(SUGGEST_PATH)) this.suggestRequests.push(req.url());
    });
  }

  chip(skillName) {
    return this.chips.filter({ hasText: new RegExp(`^\\s*${escapeRegExp(skillName)}\\s*$`) });
  }

  selectedSkill(skillName) {
    return this.selectedSkills.filter({ hasText: new RegExp(`^\\s*${escapeRegExp(skillName)}\\s*$`) });
  }

  /** Mở modal/trang Kỹ năng (không chạm ô tìm kiếm để khu vực gợi ý giữ trạng thái mở rộng). */
  async openEditor() {
    await this.owner.actions.click(this.owner.btnOpenSkillsEditor, { timeout: 20000 });
    await this.owner.actions.waitForVisible(this.editorSearchInput, { timeout: 15000 });
    await expect(this.counter).toBeVisible({ timeout: 15000 });
  }

  /**
   * Mở modal/trang Kỹ năng và chờ API gợi ý + API impression của chính lần mở này.
   * @returns {Promise<{ jobTitle: string, sessionId: string, skillNames: string[], skillIds: number[], impression: object }>}
   */
  async openEditorWithSuggestions() {
    const suggestDone = this.page.waitForResponse(
      (res) => res.request().method() === 'GET' && pathOf(res.url()).endsWith(SUGGEST_PATH),
      { timeout: 30000 }
    );
    const impressionSent = this.page.waitForRequest(
      (req) => req.method() === 'POST' && pathOf(req.url()).endsWith(IMPRESSION_PATH),
      { timeout: 30000 }
    );
    await this.openEditor();
    const response = await suggestDone;
    expect(response.ok(), `API gợi ý kỹ năng trả HTTP ${response.status()}`).toBeTruthy();
    const body = await response.json();
    const query = new URL(response.url()).searchParams;
    const items = body?.data?.items || [];
    const impression = (await impressionSent).postDataJSON();
    return {
      jobTitle: query.get('name'),
      sessionId: query.get('session_id'),
      skillNames: items.map((item) => item.name),
      skillIds: items.map((item) => item.id),
      impression,
    };
  }

  /** Chọn 1 chip gợi ý và trả về body của request `selected` do chính thao tác này gửi đi. */
  async selectChip(skillName) {
    const selectedSent = this.page.waitForRequest(
      (req) => req.method() === 'POST' && pathOf(req.url()).endsWith(SELECTED_PATH),
      { timeout: 15000 }
    );
    await this.owner.actions.click(this.chip(skillName), { timeout: 10000 });
    return (await selectedSent).postDataJSON();
  }

  /** Bấm 1 chip khi đã đủ 20/20: hệ thống không thêm nên không chờ request `selected`. */
  async clickChipAtLimit(skillName) {
    await this.owner.actions.click(this.chip(skillName), { timeout: 10000 });
  }

  /** Ô tìm kiếm nhận focus sẽ tự thu gọn khu vực gợi ý → mở lại trước khi thao tác với chip. */
  async expandCard() {
    // Desktop: bấm tiêu đề modal để đóng dropdown tìm kiếm đang che khu vực gợi ý
    await this.owner.actions.click(this.editorTitle, { timeout: 10000 });
    if ((await this.cardToggle.getAttribute('aria-expanded')) !== 'true') {
      await this.owner.actions.click(this.cardToggle, { timeout: 10000 });
    }
    await expect(this.cardToggle).toHaveAttribute('aria-expanded', 'true');
  }

  async saveEditor() {
    const saved = this.page.waitForResponse(
      (res) => /\/user-profile$/.test(pathOf(res.url())) && res.request().method() === 'POST',
      { timeout: 20000 }
    );
    await this.owner.actions.click(this.btnSaveEditor, { timeout: 10000 });
    const response = await saved;
    expect(response.ok(), `Lưu kỹ năng trả HTTP ${response.status()}`).toBeTruthy();
    await expect(this.editor).toBeHidden({ timeout: 15000 });
  }

  async expectCardVisibleForJobTitle(jobTitle) {
    await expect(this.card).toBeVisible({ timeout: 15000 });
    await expect(this.card).toContainText('Chớp gợi ý kỹ năng cho vị trí công việc');
    await expect(this.cardToggle).toContainText(jobTitle);
    await expect(this.cardToggle).toHaveAttribute('aria-expanded', 'true');
  }

  async expectCardHidden() {
    await expect(this.card).toBeHidden();
  }

  /** Chip hiển thị đúng danh sách và đúng thứ tự mong đợi. */
  async expectChips(skillNames) {
    await expect(this.chips).toHaveText(skillNames.map((name) => new RegExp(`^\\s*${escapeRegExp(name)}\\s*$`)));
  }

  async expectSelectedCount(count) {
    await expect(this.counter).toHaveText(`Đã chọn ${count}/20`);
    await expect(this.selectedSkills).toHaveCount(count);
  }

  /** Skill vừa chọn (hoặc skill trùng) phải đứng đầu danh sách đã chọn và chỉ xuất hiện 1 lần. */
  async expectSelectedOnTop(skillName) {
    await expect(this.selectedSkills.first()).toHaveText(new RegExp(`^\\s*${escapeRegExp(skillName)}\\s*$`));
    await expect(this.selectedSkill(skillName)).toHaveCount(1);
  }

  /** Khu vực gợi ý nằm tách riêng, phía trên ô tìm kiếm và danh sách kỹ năng đã chọn. */
  async expectCardAboveSearchInput() {
    await expect(async () => {
      const cardBox = await this.card.boundingBox();
      const inputBox = await this.editorSearchInput.boundingBox();
      expect(cardBox && inputBox, 'Không đo được vị trí khu vực gợi ý / ô tìm kiếm').toBeTruthy();
      expect(cardBox.y + cardBox.height).toBeLessThanOrEqual(inputBox.y);
    }).toPass({ timeout: 10000 });
  }
}

module.exports = { SkillSuggestionHelper };
