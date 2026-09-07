const BasePage = require('../BasePage');

/**
 * Page Object Mẫu cho giao diện Mobile Web (SampleMobilePage)
 * Quản lý tương tác và định vị phần tử trên thiết bị di động
 */
class SampleMobilePage extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    super(page, 'sample_mobile_page');
    this.heading = page.locator('h1');
    this.description = page.locator('p');
    this.moreInfoLink = page.locator('a');
  }

  async open(url = 'https://example.com') {
    await this.navigate(url);
    await this.capture('open_mobile_sample_page');
  }

  async getHeadingText() {
    return this.heading.textContent();
  }
}

SampleMobilePage.SampleMobilePage = SampleMobilePage;
module.exports = SampleMobilePage;
