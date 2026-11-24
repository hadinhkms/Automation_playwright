/**
 * tests/dashboard-api/settings-partial.test.js
 * B-1: a partial PUT /api/settings (the script picker saves a suite with {suites, baseRevision}) must keep every
 * other setting. Whole-config before/after comparison, plus full-form saves still change/clear values.
 */
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { startDashboardHarness } = require('../dashboard/support/dashboardHarness');
const { createFixtureWorkspace } = require('../dashboard/support/fixtureWorkspace');

const CUSTOM = {
  branding: { projectName: 'My QA', projectSubtitle: 'Sub', pageTitle: 'Title', logoUrl: 'https://x.example/logo.png', primaryColor: '#123456', backgroundColor: '#fafafa', fontSize: '14px' },
  discord: { webhookUrl: 'https://discord.com/api/webhooks/' + '1/abcdef', channelName: 'qa-alerts', notifyOnFinish: true, notifyOnlyOnFailure: true },
  api: { registrationBearerToken: 'tok-12345678', branch: 'dev', lang: 'en-US', registerRetries: 3, registerTimeout: 9000, consentRetries: 2, consentTimeout: 7000 },
  runtime: { workers: 3, trace: 'on', screenshot: 'on', viewport: { preset: '1440x900', width: 1440, height: 900 }, showEnvBanner: true, debugOptionalPopups: true },
  artifacts: { retentionDays: 30, maxReportsPerDay: 20, autoCleanupEvidence: false, autoCleanupReports: false },
  qa: { requirements: 'req', testCases: 'tc', specs: 'specs', decisionsFile: 'd.json' },
  docs: { dir: 'mydocs' },
  environments: { qc: { label: 'QC', baseURL: 'https://qc.example.com', apiBaseURL: 'https://api.qc.example.com', adminURL: 'https://admin.qc.example.com' } },
  suites: { smoke: { label: 'Smoke', specs: 'all', grep: '@smoke', workers: 2 } },
};

describe('PUT /api/settings keeps everything that was not sent', () => {
  let fixture; let harness; let cfgFile;
  const get = async () => (await fetch(`${harness.url}/api/settings`)).json();
  const put = (body) => fetch(`${harness.url}/api/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const strip = (cfg, ...drop) => { const c = JSON.parse(JSON.stringify(cfg)); delete c.revision; drop.forEach((k) => delete c[k]); return c; };

  before(async () => {
    fixture = createFixtureWorkspace();
    cfgFile = path.join(fixture.rootPath, 'dashboardConfig.json');
    fs.writeFileSync(cfgFile, JSON.stringify(CUSTOM));
    harness = await startDashboardHarness(fixture.rootPath);
  });
  after(async () => { if (harness) await harness.stop(); if (fixture) fixture.cleanup(); });

  test('{suites, baseRevision} only: every other section is identical before and after (whole config, not just fontSize)', async () => {
    const before0 = await get();
    assert.equal(before0.branding.fontSize, '14px');
    const newSuites = { ...before0.suites, picked: { label: 'Picked', type: 'single', specs: ['tests/e2e/a.spec.js'], spec: 'tests/e2e/a.spec.js', grep: '', project: 'all', platform: 'desktop', workers: 2 } };
    const res = await put({ suites: newSuites, baseRevision: before0.revision });
    assert.equal(res.status, 200);
    const after0 = await get();
    assert.deepEqual(strip(after0, 'suites'), strip(before0, 'suites'));
    assert.ok(after0.suites.picked, 'the new suite is saved');
    assert.ok(after0.suites.smoke, 'the existing suite is kept');
    const onDisk = JSON.parse(fs.readFileSync(cfgFile, 'utf8'));
    assert.equal(onDisk.branding.fontSize, '14px');
    assert.equal(onDisk.discord.webhookUrl, CUSTOM.discord.webhookUrl);
    assert.equal(onDisk.api.registrationBearerToken, 'tok-12345678', 'the secret token is not lost either');
    assert.equal(onDisk.environments.qc.adminURL, 'https://admin.qc.example.com', 'custom environment keys survive');
  });

  test('{branding:{projectName}} alone keeps the rest of branding including fontSize', async () => {
    const cur = await get();
    assert.equal((await put({ branding: { projectName: 'Renamed' }, baseRevision: cur.revision })).status, 200);
    const next = await get();
    assert.equal(next.branding.projectName, 'Renamed');
    assert.equal(next.branding.fontSize, '14px');
    assert.equal(next.branding.logoUrl, CUSTOM.branding.logoUrl);
    assert.deepEqual(strip(next, 'branding'), strip(cur, 'branding'));
  });

  test('a full-form save still changes fontSize and can clear it on purpose', async () => {
    let cur = await get();
    assert.equal((await put({ ...cur, branding: { ...cur.branding, fontSize: '16px' }, baseRevision: cur.revision })).status, 200);
    cur = await get();
    assert.equal(cur.branding.fontSize, '16px');
    assert.equal((await put({ ...cur, branding: { ...cur.branding, fontSize: '' }, baseRevision: cur.revision })).status, 200);
    assert.equal((await get()).branding.fontSize, '');
  });

  test('suites and environments are replaced as a whole: a suite can still be deleted', async () => {
    const cur = await get();
    const { smoke, ...rest } = cur.suites;
    assert.ok(smoke);
    assert.equal((await put({ suites: rest, baseRevision: cur.revision })).status, 200);
    const next = await get();
    assert.ok(!('smoke' in next.suites), 'the removed suite is gone');
    assert.equal(next.branding.fontSize, '', 'and nothing else changed');
  });

  test('nested partial objects merge: {runtime:{viewport:{width}}} keeps height and the other runtime fields', async () => {
    const cur = await get();
    assert.equal((await put({ runtime: { viewport: { width: 1600 } }, baseRevision: cur.revision })).status, 200);
    const next = await get();
    assert.equal(next.runtime.viewport.width, 1600);
    assert.equal(next.runtime.viewport.height, 900);
    assert.equal(next.runtime.workers, 3);
    assert.equal(next.runtime.trace, 'on');
  });
});
