'use strict';

/**
 * WebdriverIO + Appium config for native Android (APK) tests on a real device or emulator.
 * Specs: tests/native/shared/** (both platforms) + tests/native/android/** (Android only).
 * Run: npm run test:android  (see docs/ANDROID_NATIVE_TESTING.md)
 */

const path = require('path');
const { buildAndroidCapabilities, appiumConnection } = require('./core/native/androidCapabilities');
const { nativeSpecs, ensureRunId, reporters, hooks } = require('./core/native/wdioShared');

const connection = appiumConnection();
const runId = ensureRunId();

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
  specs: nativeSpecs('android'),
  maxInstances: 1,
  capabilities: [buildAndroidCapabilities()],
  logLevel: 'warn',
  outputDir: path.join(__dirname, 'test-results', 'wdio'),
  waitforTimeout: 15000,
  connectionRetryTimeout: 180000,
  connectionRetryCount: 1,
  services,
  framework: 'mocha',
  reporters: reporters('android', runId),
  mochaOpts: { ui: 'bdd', timeout: 180000 },
  ...hooks('android', runId),
};
