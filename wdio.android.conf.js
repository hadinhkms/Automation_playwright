'use strict';

/**
 * WebdriverIO + Appium config for native Android (APK) tests on a real device or emulator.
 * Run: npm run test:android  (see docs/ANDROID_NATIVE_TESTING.md)
 */

const path = require('path');
const { buildAndroidCapabilities, appiumConnection } = require('./core/native/androidCapabilities');
const { mergeRunReports } = require('./core/native/junitReport');

const connection = appiumConnection();
const evidenceDir = path.join(__dirname, 'evidence', 'native', 'android');
const junitDir = path.join(__dirname, 'test-results', 'native', 'android');
// Set once in the launcher; workers inherit it, so every worker file of a run shares the id.
if (!/^[\w-]{1,40}$/.test(process.env.MOBILE_RUN_ID || '')) process.env.MOBILE_RUN_ID = `cli-${Date.now().toString(36)}`;
const runId = process.env.MOBILE_RUN_ID;

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
  reporters: ['spec', ['junit', {
    outputDir: junitDir,
    outputFileFormat: (opts) => `junit-${runId}-${opts.cid}.xml`,
    // Default strips everything but [A-Za-z0-9@]; keep titles readable (TC-AND-001, Vietnamese text), only fold whitespace.
    suiteNameFormat: /\s+/,
    // Stable test ID `classname.name` for Gate 4 receipts: no device or capability in the classname.
    classNameFormat: ({ suite }) => `native.android.${String(suite?.fullTitle || suite?.title || 'suite').replace(/\s+/g, '_')}`,
  }]],
  mochaOpts: { ui: 'bdd', timeout: 180000 },

  /** One JUnit file per run: test-results/native/android/junit-<runId>.xml (or MOBILE_JUNIT_FILE). */
  onComplete: function onComplete() {
    const target = process.env.MOBILE_JUNIT_FILE ? path.resolve(__dirname, process.env.MOBILE_JUNIT_FILE) : undefined;
    mergeRunReports(junitDir, runId, target);
  },

  afterTest: async function afterTest(test, _context, { passed }) {
    if (passed) return;
    const fs = require('fs');
    fs.mkdirSync(evidenceDir, { recursive: true });
    const safeName = `${test.parent}_${test.title}`.replace(/[^\w-]+/g, '_').slice(0, 120);
    await browser.saveScreenshot(path.join(evidenceDir, `FAIL_${safeName}_${Date.now()}.png`));
  },
};
