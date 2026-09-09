const { test: base, expect } = require('../../../core/fixtures/baseTest');
const sampleData = require('../../../data/sampleData.json');
const { withMockSample } = require('../../../core/fixtures/mockSampleTest');
const SamplePage = require('../../../pages/desktop/SamplePage');
const test = withMockSample(base);

test('Desktop container and manual page agree on local mock @smoke @e2e', async ({ page, pages, featureName, mockSampleUrl }, testInfo) => {
  testInfo.annotations.push({ type: 'Precondition', description: "Isolated local mock server; no external website required." });
      await test.step('Given The local sample page is visible', async () => {
await pages.sample.open(mockSampleUrl);
    expect(await pages.sample.getHeadingText()).toBe('QA Automation Mock');
    });

    await test.step('When The page is accessed through aliases and manual construction', async () => {
expect(pages.samplePage).toBe(pages.sample);
    expect(pages.SamplePage).toBe(pages.sample);
    const manual = new SamplePage(page, featureName);
    expect(await manual.getHeadingText()).toBe(await pages.sample.getHeadingText());
    });

    await test.step('Then The page retains its test context', async () => {
expect(pages.sample.page).toBe(page);
    expect(pages.sample.featureName).toBe(featureName);
    });

});
