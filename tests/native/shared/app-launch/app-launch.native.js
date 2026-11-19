'use strict';

const { AppLaunchScreen } = require('../../../../pages/native/screens/AppLaunchScreen');

// Shared spec: runs on Android (wdio.android.conf.js) and iOS (wdio.ios.conf.js). Traceability: test-cases/REQ-101-app-launch.md
describe('App launch - Smoke @native @app-launch @REQ-101', () => {
  const launch = new AppLaunchScreen();

  it('TC-101 - App opens in the foreground @smoke', async () => {
    const expected = await launch.waitUntilForeground();
    await expect(await launch.currentAppId()).toBe(expected);
    await launch.capture('foreground');
  });

  it('TC-102 - First screen renders a UI hierarchy @smoke', async () => {
    await expect(await launch.hasRenderedUi()).toBe(true);
  });

  it('TC-103 - App returns to the foreground after background @smoke', async () => {
    await driver.execute('mobile: backgroundApp', { seconds: 3 });
    const expected = await launch.waitUntilForeground();
    await expect(await launch.currentAppId()).toBe(expected);
  });
});
