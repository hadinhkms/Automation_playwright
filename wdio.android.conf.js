'use strict';

/**
 * WebdriverIO + Appium config for native Android (APK) tests on a real device or emulator.
 * Run: npm run test:android  (see docs/ANDROID_NATIVE_TESTING.md)
 */

const path = require('path');
const { buildAndroidCapabilities, appiumConnection } = require('./core/native/androidCapabilities');

const connection = appiumConnection();
const evidenceDir = path.join(__dirname, 'evidence', 'native', 'android');

const services = connection.useExternalServer
  ? []
  : [['appium', {
    command: 'appium',
    args: { address: connection.hostname, port: connection.port, relaxedSecurity: true },
    logPath: path.join(__dirname, 'test-results', 'appium'),
  }]];

exports.config = {
  runner: 'local',
  hostname: connection.hostname,
  port: connection.port,
  specs: ['./tests/native/android/**/*.native.js'],
  maxInstances: 1,
  capabilities: [buildAndroidCapabilities()],
  logLevel: 'warn',
  outputDir: path.join(__dirname, 'test-results', 'wdio'),
  waitforTimeout: 15000,
  connectionRetryTimeout: 180000,
  connectionRetryCount: 1,
  services,
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: { ui: 'bdd', timeout: 180000 },

  afterTest: async function afterTest(test, _context, { passed }) {
    if (passed) return;
    const fs = require('fs');
    fs.mkdirSync(evidenceDir, { recursive: true });
    const safeName = `${test.parent}_${test.title}`.replace(/[^\w-]+/g, '_').slice(0, 120);
    await browser.saveScreenshot(path.join(evidenceDir, `FAIL_${safeName}_${Date.now()}.png`));
  },
};
