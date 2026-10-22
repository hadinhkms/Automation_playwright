const { getAiProfileMockHtml } = require('./aiProfileMockHtml');

class ProfileAiHelper {
  constructor(pageInstance) {
    this.owner = pageInstance;
  }

  toEvidenceName(value) {
    return String(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase();
  }

  async generateExperienceDescriptionWithAi(tones) {
    await this.owner.clickElement(this.owner.btnAiFormAction);
    await this.owner.capture('experience_ai_generate_clicked');
    await this.rewriteWithAiTones(tones);
  }

  async rewriteIntroductionWithAi(text, tones) {
    await this.owner.clickElement(this.owner.btnAiFormAction);
    await this.owner.capture('introduction_ai_mode_opened');
    await this.owner.fillIntroduction(text);
    await this.owner.capture('introduction_source_filled');
    await this.owner.clickElement(this.owner.btnAiGenerate);
    await this.owner.capture('introduction_ai_generate_clicked');
    await this.selectAiTone(tones[0]);

    for (const tone of tones.slice(1)) {
      await this.owner.clickElement(this.owner.btnAiRewrite);
      await this.owner.capture(`introduction_ai_rewrite_clicked_${this.toEvidenceName(tone)}`);
      await this.selectAiTone(tone);
    }

    await this.owner.btnAiUse.waitFor({ state: 'visible', timeout: 60000 });
    await this.owner.clickElement(this.owner.btnAiUse);
    await this.owner.capture('introduction_ai_content_applied');
  }

  async rewriteWithAiTones(tones) {
    for (const tone of tones) {
      await this.owner.clickElement(this.owner.btnAiRewrite);
      await this.owner.capture(`experience_ai_rewrite_clicked_${this.toEvidenceName(tone)}`);
      await this.selectAiTone(tone);
    }

    await this.owner.btnAiUse.waitFor({ state: 'visible', timeout: 60000 });
    await this.owner.clickElement(this.owner.btnAiUse);
    await this.owner.capture('experience_ai_content_applied');
  }

  async selectAiTone(tone) {
    const toneButton = this.owner.page.getByRole('button', { name: new RegExp(tone, 'i') });
    await this.owner.clickElement(toneButton);
    await this.owner.btnAiUse.waitFor({ state: 'visible', timeout: 60000 });
    await this.owner.capture(`ai_tone_selected_${this.toEvidenceName(tone)}`);
  }

  async setupAiProfilePrecondition() {
    await this.owner.page.route('**/seeker.vl24hv2.qc.sieuviet-team.com/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: getAiProfileMockHtml(),
      });
    });

    await this.owner.page.goto('/ho-so-cua-toi', { waitUntil: 'domcontentloaded' });
    await this.owner.actions.waitForVisible(this.owner.btnAiIntro, { timeout: 15000 });
  }

  getAiProfileMockHtml() {
    return getAiProfileMockHtml();
  }

  async openAiIntroModal() {
    await this.owner.clickElement(this.owner.btnAiIntro);
    await this.owner.actions.waitForVisible(this.owner.modalAiIntro, { timeout: 5000 });
  }

  async fillAiIntroSourceText(text) {
    await this.owner.fillInput(this.owner.txtAiIntroSource, text);
  }

  async triggerAiRewrite() {
    await this.owner.clickElement(this.owner.btnAiTriggerRewrite);
    await this.owner.actions.waitForVisible(this.owner.aiPreviewBox, { timeout: 5000 });
  }

  async selectTonePro() {
    await this.owner.clickElement(this.owner.btnAiToneProfessional);
  }

  async selectTonePersuasive() {
    await this.owner.clickElement(this.owner.btnAiTonePersuasive);
  }

  async selectToneConcise() {
    await this.owner.clickElement(this.owner.btnAiToneConcise);
  }

  async cancelAiPreview() {
    await this.owner.clickElement(this.owner.btnAiCancelPreview);
  }

  async openAiExpModal() {
    await this.owner.clickElement(this.owner.btnAiExp);
    await this.owner.actions.waitForVisible(this.owner.modalAiExp, { timeout: 5000 });
  }

  async fillAiExperienceHeader(jobTitle, company) {
    await this.owner.fillInput(this.owner.inpAiJobTitle, jobTitle);
    await this.owner.fillInput(this.owner.inpAiCompany, company);
  }

  async triggerAiGenerateExp() {
    await this.owner.clickElement(this.owner.btnAiGenerateExp);
  }

  async saveAiExperience() {
    await this.owner.clickElement(this.owner.btnSaveAiExp);
  }

  async simulateAiServiceError() {
    await this.owner.clickElement(this.owner.btnSimulateAiError);
  }
}

module.exports = { ProfileAiHelper };
