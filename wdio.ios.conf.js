'use strict';

/**
 * WebdriverIO config for native iOS tests through Appium 2 + XCUITest running on a remote Mac.
 * No Appium service here: Appium for iOS only runs on macOS, so WDIO connects to IOS_APPIUM_HOST (TECH-301).
 * Specs: tests/native/shared/** (both platforms) + tests/native/ios/** (iOS only).
 * Run: npm run test:ios  (see docs/IOS_NATIVE_TESTING.md)
 */

const path = require('path');
const { buildIosCapabilities, iosAppiumConnection } = require('./core/native/iosCapabilities');
const { nativeSpecs, ensureRunId, reporters, hooks } = require('./core/native/wdioShared');

const connection = iosAppiumConnection();
const runId = ensureRunId();

exports.config = {
  runner: 'local',
  ...connection,
  specs: nativeSpecs('ios'),
  maxInstances: 1,
  capabilities: [buildIosCapabilities()],
  logLevel: 'warn',
  outputDir: path.join(__dirname, 'test-results', 'wdio'),
  waitforTimeout: 15000,
  // The first session on a Mac builds WebDriverAgent (several minutes).
  connectionRetryTimeout: 300000,
  connectionRetryCount: 1,
  services: [],
  framework: 'mocha',
  reporters: reporters('ios', runId),
  mochaOpts: { ui: 'bdd', timeout: 300000 },
  ...hooks('ios', runId),
};
