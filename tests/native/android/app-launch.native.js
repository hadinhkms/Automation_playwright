'use strict';

const { AppLaunchPage } = require('../../../pages/native/android/AppLaunchPage');

describe('@android @smoke App launch', () => {
  const launch = new AppLaunchPage();

  it('TC-AND-001 - APK installs and opens in the foreground', async () => {
    const expected = await launch.waitUntilForeground();
    await expect(await launch.currentPackage()).toBe(expected);
    await launch.capture('foreground');
  });

  it('TC-AND-002 - First screen renders a UI hierarchy', async () => {
    await expect(await launch.hasRenderedUi()).toBe(true);
    await expect(await launch.currentActivity()).toBeTruthy();
  });

  it('TC-AND-003 - App returns to foreground after background', async () => {
    await driver.execute('mobile: backgroundApp', { seconds: 3 });
    const expected = await launch.waitUntilForeground();
    await expect(await launch.currentPackage()).toBe(expected);
  });
});
