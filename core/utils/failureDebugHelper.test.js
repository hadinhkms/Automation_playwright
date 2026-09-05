const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const {
  dumpPageHtml,
  trackTestFailure,
  trackTestSuccess,
  readFailureTracker,
} = require('./failureDebugHelper');

test('dumpPageHtml creates html dump file on disk', async () => {
  const fakePage = {
    content: async () => '<html><body><h1>Mobile Test Page</h1></body></html>',
  };
  const fakeTestInfo = {
    title: 'test_mobile_spec_demo',
    retry: 0,
    attach: async (name, options) => {
      assert.equal(name, 'failure_dom.html');
      assert.match(options.body, /Mobile Test Page/);
    },
  };

  const dumpPath = await dumpPageHtml(fakePage, fakeTestInfo, 'unit_test');
  assert.ok(dumpPath, 'dumpPath should be returned');
  assert.ok(fs.existsSync(dumpPath), 'dump file should exist on disk');

  const content = fs.readFileSync(dumpPath, 'utf8');
  assert.match(content, /Mobile Test Page/);

  // Clean up
  if (fs.existsSync(dumpPath)) {
    fs.unlinkSync(dumpPath);
  }
});

test('trackTestFailure records failures and triggers alert at 3 consecutive fails', async () => {
  const fakeTestInfo = {
    file: 'd:/_Automation-Project/tests/e2e/mobile-web/mock_script.mobile.spec.js',
    title: 'mock mobile scenario',
    retry: 0,
  };

  // Run 1: fail
  await trackTestFailure(fakeTestInfo, new Error('Error attempt 1'));
  let tracker = readFailureTracker();
  assert.equal(tracker['mock_script.mobile.spec.js'].consecutiveFailures, 1);
  assert.equal(tracker['mock_script.mobile.spec.js'].status, 'FAILING');

  // Run 2: fail
  await trackTestFailure(fakeTestInfo, new Error('Error attempt 2'));
  tracker = readFailureTracker();
  assert.equal(tracker['mock_script.mobile.spec.js'].consecutiveFailures, 2);

  // Run 3: fail -> triggers alert!
  await trackTestFailure(fakeTestInfo, new Error('Error attempt 3'));
  tracker = readFailureTracker();
  assert.equal(tracker['mock_script.mobile.spec.js'].consecutiveFailures, 3);
  assert.equal(tracker['mock_script.mobile.spec.js'].status, 'CRITICAL_3_FAILURES');

  const alertMd = path.join(process.cwd(), 'evidence', 'reports', 'CONSECUTIVE_FAILURES_ALERT.md');
  assert.ok(fs.existsSync(alertMd), 'Alert markdown file should exist');
  const alertContent = fs.readFileSync(alertMd, 'utf8');
  assert.match(alertContent, /mock_script\.mobile\.spec\.js/);

  // Run 4: pass -> resets counter
  await trackTestSuccess(fakeTestInfo);
  tracker = readFailureTracker();
  assert.equal(tracker['mock_script.mobile.spec.js'].consecutiveFailures, 0);
  assert.equal(tracker['mock_script.mobile.spec.js'].status, 'HEALTHY');

  // Clean up mock entry
  delete tracker['mock_script.mobile.spec.js'];
  fs.writeFileSync(
    path.join(process.cwd(), 'evidence', 'reports', 'mobile_failure_tracker.json'),
    JSON.stringify(tracker, null, 2),
    'utf8'
  );
  if (fs.existsSync(alertMd)) {
    fs.unlinkSync(alertMd);
  }
});
