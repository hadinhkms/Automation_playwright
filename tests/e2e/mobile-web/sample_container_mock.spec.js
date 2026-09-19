const { test: base, expect } = require('../../../core/fixtures/mobileWebTest');
const { withMockSample } = require('../../../core/fixtures/mockSampleTest');
const SampleMobilePage = require('../../../pages/mobile/SampleMobilePage');
const test = withMockSample(base);

test('Mobile container and manual page agree on local mock @smoke @mobile', async ({ page, pages, featureName, mockSampleUrl }, testInfo) => {
  testInfo.annotations.push({ type: 'Precondition', description: 'Isolated local mock server with mobile fixture and device context.' });
  await test.step('Given The mobile sample page is visible', async () => {
    await pages.sampleMobile.open(mockSampleUrl);
    expect(await pages.sampleMobile.getHeadingText()).toBe('QA Automation Mock');
  });
  await test.step('When The mobile page is accessed through aliases and manual construction', async () => {
    expect(pages.sampleMobilePage).toBe(pages.sampleMobile);
    const manual = new SampleMobilePage(page, featureName);
    expect(await manual.getHeadingText()).toBe(await pages.sampleMobile.getHeadingText());
  });
  await test.step('Then The mobile page retains its test context', async () => {
    expect(pages.sampleMobile.page).toBe(page);
    expect(pages.sampleMobile.featureName).toBe(featureName);
  });
});
