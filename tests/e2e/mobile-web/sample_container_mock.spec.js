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
    await test.step('When Tôi thực hiện getHeadingText', async () => {
      await sampleMobilePage.getHeadingText();
      await sampleMobilePage.capture('when_getHeadingText_completed');
    });

    await test.step('When Tôi thực hiện open', async () => {
      await sampleMobilePage.open();
      await sampleMobilePage.capture('when_open_completed');
    });

    await test.step('Given Tôi thực hiện openerwe', async () => {
      await sampleMobilePage.open();
      await sampleMobilePage.capture('given_open_completed');
    });

    await test.step('Then Tôi thực hiện opensdfsdfsdfsdczxczxc', async () => {
      await sampleMobilePage.open();
      await sampleMobilePage.capture('then_open_completed');
    });

});
