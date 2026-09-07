const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const {
  scanAllPageObjects,
  parsePageObject,
  updateLocatorSelector,
  getCoreCapabilities,
  inferElementCategory,
  inferHumanDescription,
  validateLocatorExpression,
  normalizePagePath,
} = require('./objectRepository');

test('inferElementCategory categorizes buttons, inputs, links and modals correctly', () => {
  const btn = inferElementCategory('btnApplyNow', "this.page.getByRole('button')");
  assert.equal(btn.type, 'button');

  const txt = inferElementCategory('txtFullName', "this.page.getByRole('textbox')");
  assert.equal(txt.type, 'input');

  const link = inferElementCategory('noCVJobLink', "this.page.getByRole('link')");
  assert.equal(link.type, 'link');

  const modal = inferElementCategory('mobileEntryPopup', "this.page.locator('.mbep-popup')");
  assert.equal(modal.type, 'modal');
});

test('inferHumanDescription extracts meaningful text or clean name', () => {
  const desc1 = inferHumanDescription('btnApplyNow', "this.page.getByRole('button', { name: 'Nộp hồ sơ ngay' })");
  assert.match(desc1, /Nộp hồ sơ ngay/i);

  const desc2 = inferHumanDescription('txtFullName', "this.page.getByRole('textbox')");
  assert.match(desc2, /Full Name/i);
});

test('scanAllPageObjects scans Page Objects and Fixtures', () => {
  const pages = scanAllPageObjects(process.cwd());
  assert.ok(pages.length >= 4);

  const sample = pages.find((p) => p.platform !== 'fixture' && p.className !== 'BasePage') || pages.find((p) => p.platform !== 'fixture');
  assert.ok(sample);
  assert.ok(sample.locatorCount >= 1 || sample.methodCount >= 1);

  const baseTestFixture = pages.find((p) => p.className === 'baseTest');
  assert.ok(baseTestFixture);
  assert.equal(baseTestFixture.platform, 'fixture');
  assert.ok(baseTestFixture.methodCount >= 1);
});

test('getCoreCapabilities returns 5 core pillars with tags and status', () => {
  const caps = getCoreCapabilities();
  assert.equal(caps.length, 5);
  assert.ok(caps.some((c) => c.id === 'core_smart_evidence'));
  assert.ok(caps.some((c) => c.id === 'core_anti_flaky'));
  assert.ok(caps.some((c) => c.id === 'core_data_manager'));
});

test('updateLocatorSelector updates expression safely with backup', () => {
  const tmpDir = path.join(process.cwd(), 'pages', 'desktop', '.repo_test');
  fs.mkdirSync(tmpDir, { recursive: true });
  const sampleFile = path.join(tmpDir, 'SamplePage.js');
  fs.writeFileSync(
    sampleFile,
    `class SamplePage {
  constructor(page) {
    this.page = page;
    this.btnTest = page.getByRole('button', { name: 'Old' });
  }
}
module.exports = { SamplePage };
`,
    'utf8'
  );

  const res = updateLocatorSelector({
    pageRelativePath: 'pages/desktop/.repo_test/SamplePage.js',
    locatorName: 'btnTest',
    newExpression: "page.getByRole('button', { name: 'New Updated' })",
    rootDir: process.cwd(),
  });

  assert.equal(res.success, true);
  const updatedContent = fs.readFileSync(sampleFile, 'utf8');
  assert.match(updatedContent, /New Updated/);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('Object Repository rejects unsafe paths and locator statements', () => {
  assert.throws(() => normalizePagePath('../pages/desktop/HomePage.js'), /thư mục pages/);
  assert.throws(() => validateLocatorExpression('page.locator("button"); process.exit()'), /locator Playwright/);
  assert.doesNotThrow(() => validateLocatorExpression("page.getByRole('button', { name: 'Nộp hồ sơ' })"));
});

test('parsed Page Objects expose backend readiness metadata', () => {
  const pages = scanAllPageObjects(process.cwd());
  const sample = pages.find((p) => p.platform !== 'fixture');
  assert.ok(sample);
  const page = parsePageObject(sample.relativePath, process.cwd());
  assert.ok(page.fixtureName);
  assert.equal(page.readiness.ready, true);
  assert.equal(page.readiness.status, 'ready');
  assert.equal(page.readiness.checks.export, true);
});
