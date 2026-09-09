const BasePage = require('../BasePage');

class SamplePage extends BasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page, featureName) {
    super(page, featureName || 'sample_page');
    this.heading = page.locator('h1');
    this.description = page.locator('p');
    this.moreInfoLink = page.locator('a');
  }

  async open(url = 'https://example.com') {
    await this.navigate(url);
    await this.capture('open_sample_page');
  }

  async getHeadingText() {
    return this.heading.textContent();
  }
}

SamplePage.SamplePage = SamplePage;
module.exports = SamplePage;
