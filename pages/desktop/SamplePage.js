const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const BasePage = require('../BasePage');

const FIXTURE_PATH = path.resolve(__dirname, '../../data/fixtures/sample-app.html');
const FALLBACK_DATA_URI = 'data:text/html;charset=utf-8,' + encodeURIComponent(
  '<!DOCTYPE html><html><head><title>Sample App</title></head><body><h1>Sample Application</h1><p>Local offline fallback fixture</p><a href="#more">More info</a></body></html>'
);

function resolveSampleUrl(url) {
  if (!url || url === 'https://example.com' || url === 'https://example.com/') {
    return fs.existsSync(FIXTURE_PATH) ? pathToFileURL(FIXTURE_PATH).href : FALLBACK_DATA_URI;
  }
  return url;
}

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
    const targetUrl = resolveSampleUrl(url);
    await this.navigate(targetUrl);
    await this.capture('open_sample_page');
  }

  async getHeadingText() {
    return this.heading.textContent();
  }
}

SamplePage.SamplePage = SamplePage;
module.exports = SamplePage;
