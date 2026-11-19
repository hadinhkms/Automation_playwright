'use strict';

/**
 * WDIO config pieces shared by wdio.android.conf.js and wdio.ios.conf.js (PLAN-25 P3):
 * spec folders, run id, the JUnit reporter (one file per run) and the evidence hooks.
 */

const fs = require('fs');
const path = require('path');
const { mergeRunReports } = require('./junitReport');

const ROOT = path.resolve(__dirname, '..', '..');

/** Shared specs run on both platforms; each platform adds its own folder (S-01). */
function nativeSpecs(platform) {
  // Skip a platform folder that does not exist yet, so WDIO does not warn "pattern did not match any file".
  return ['shared', platform]
    .filter((dir) => fs.existsSync(path.join(ROOT, 'tests', 'native', dir)))
    .map((dir) => `./tests/native/${dir}/**/*.native.js`);
}

/** Set once in the launcher; workers inherit it, so every worker file of a run shares the id. */
function ensureRunId() {
  if (!/^[\w-]{1,40}$/.test(process.env.MOBILE_RUN_ID || '')) process.env.MOBILE_RUN_ID = `cli-${Date.now().toString(36)}`;
  return process.env.MOBILE_RUN_ID;
}

function junitDir(platform) {
  return path.join(ROOT, 'test-results', 'native', platform);
}

function reporters(platform, runId) {
  return ['spec', ['junit', {
    outputDir: junitDir(platform),
    outputFileFormat: (opts) => `junit-${runId}-${opts.cid}.xml`,
    // Default strips everything but [A-Za-z0-9@]; keep titles readable (TC-101, Vietnamese text), only fold whitespace.
    suiteNameFormat: /\s+/,
    // Stable test ID `classname.name` for Gate 4 receipts: no device or capability in the classname.
    classNameFormat: ({ suite }) => `native.${platform}.${String(suite?.fullTitle || suite?.title || 'suite').replace(/\s+/g, '_')}`,
  }]];
}

/** Hooks: one JUnit file per run, TC id for evidence names, screenshot on failure into the run folder. */
function hooks(platform, runId) {
  return {
    onComplete() {
      const target = process.env.MOBILE_JUNIT_FILE ? path.resolve(ROOT, process.env.MOBILE_JUNIT_FILE) : undefined;
      mergeRunReports(junitDir(platform), runId, target);
    },
    beforeTest(test) {
      process.env.MOBILE_CURRENT_TEST = String(test.title || '');
    },
    async afterTest(test, _context, { passed }) {
      if (passed) return;
      const dir = path.join(ROOT, 'evidence', 'native', platform, runId);
      fs.mkdirSync(dir, { recursive: true });
      const tc = (String(test.title).match(/\bTC-[A-Za-z0-9]+(?:-\d+)?/) || ['test'])[0];
      await browser.saveScreenshot(path.join(dir, `FAIL_${tc}_${Date.now()}.png`));
    },
  };
}

module.exports = { nativeSpecs, ensureRunId, reporters, hooks, junitDir };
