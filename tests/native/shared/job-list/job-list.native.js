'use strict';

const { JobListScreen } = require('../../../../pages/native/screens/JobListScreen');

// Read-only checks of the Vieclam24h.QA home screen. JobListScreen was captured with the Dashboard Inspector (PLAN-25 P4).
// Traceability: test-cases/REQ-102-vieclam24h-job-list.md
const APP_ID = 'com.vieclam24h.qa';

describe('Job list - Read only @native @job-list @REQ-102', () => {
  const jobs = new JobListScreen();

  before(async function () {
    // Another app profile under test (Calculator, iOS Settings...): skip instead of failing.
    const onApp = await driver.waitUntil(async () => (await jobs.currentAppId()) === APP_ID, { timeout: 15000, interval: 1000 }).catch(() => false);
    if (!onApp) this.skip();
  });

  it('TC-104 - Home shows the job list, search bar and notifications @sanity', async () => {
    await jobs.dismissErrorDialogIfShown();
    await jobs.waitUntilLoaded();
    await expect(await jobs.isJobListVisible()).toBe(true);
    await expect(await jobs.searchPlaceholderText()).toBe('Tìm công việc tại đây...');
    await expect(await jobs.isNotificationIconVisible()).toBe(true);
    await jobs.capture('job_list');
  });

  it('TC-105 - Nearby jobs section is listed @sanity', async () => {
    await expect(await jobs.nearbyJobsTitleText()).toBe('Khám phá việc làm gần tôi');
  });
});
