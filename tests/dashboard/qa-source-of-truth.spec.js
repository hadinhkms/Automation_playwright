/**
 * tests/dashboard/qa-source-of-truth.spec.js
 * BUG-02: UI (tiles + health card), GET /api/qa/summary and `node tools/qa summary --json`
 * must report the same numbers (QA Core summary is the single source of truth).
 * Fixture has REQ/TC files WITHOUT front-matter, the exact state that used to split the numbers.
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { startDashboardHarness } = require('./support/dashboardHarness');
const { createFixtureWorkspace } = require('./support/fixtureWorkspace');
const { seedBatchFixture } = require('./support/batchFixtureSeed');

const ENGINE = path.resolve(__dirname, '..', '..');

test.describe('QA view: một nguồn sự thật cho số liệu (UI = API = CLI)', () => {
  let fixture;
  let harness;

  test.beforeAll(async () => {
    fixture = createFixtureWorkspace();
    const req = '# REQ-901: Demo\n\n## Acceptance Criteria\n\n### AC-901: Chạy được\nGiven a When b Then c\n';
    for (const dir of ['requirements', 'test-cases']) {
      fs.mkdirSync(path.join(fixture.rootPath, dir), { recursive: true });
      fs.writeFileSync(path.join(fixture.rootPath, dir, 'REQ-901-demo.md'), req, 'utf8');
    }
    harness = await startDashboardHarness(fixture.rootPath);
  });

  test.afterAll(async () => {
    if (harness) await harness.stop();
    if (fixture) fixture.cleanup();
  });

  test('tiles, health card, API và CLI cùng số', async ({ page }) => {
    const api = await (await fetch(`${harness.url}/api/qa/summary?force=true`)).json();
    // Gọi đúng entry của CLI (`main`) với root là fixture: CLI không có cờ --root.
    const script = "require(process.argv[1]).main({ root: process.argv[2], argv: ['summary', '--json'] })";
    const cli = JSON.parse(execFileSync(process.execPath, ['-e', script, path.join(ENGINE, 'tools/qa/index.js'), fixture.rootPath], {
      cwd: ENGINE, encoding: 'utf8',
    }));

    // API == CLI (cùng engine; finding trùng giữa các Playwright project đã gộp ở nguồn).
    expect(api.metrics).toEqual(cli.metrics);
    expect(api.health).toEqual(cli.health);
    expect(api.boundary.status).toBe(cli.boundary.status);
    expect(api.findings.length).toBe(cli.health.totalFindings);

    await page.goto(harness.url);
    await page.waitForSelector('.shell');
    await page.waitForFunction(() => Boolean(window.__STUDIO_CORE__));
    await page.evaluate(() => window.__STUDIO_CORE__.featureRegistry.switchView('qa-view'));
    await expect(page.locator('#qa-stat-req')).toHaveText(String(api.metrics.requirements));
    await expect(page.locator('#qa-stat-ac')).toHaveText(String(api.metrics.acceptanceCriteria));
    await expect(page.locator('#qa-stat-tc')).toHaveText(String(api.metrics.testCases));
    await expect(page.locator('#qa-stat-auto')).toHaveText(String(api.metrics.automatedTests));
    await expect(page.locator('#qa-stat-major')).toHaveText(String(api.health.blockers + api.health.majors));
    await expect(page.locator('#qa-health-findings-text')).toHaveText(`${api.health.totalFindings} phát hiện`);
    await expect(page.locator('#qa-health-status')).toHaveText(api.systemHealth);
    await expect(page.locator('#qa-shield-status')).toHaveText(api.boundary.status);
  });

  test('finding lặp giữa các Playwright project được gộp giống nhau ở UI, API và CLI (Gate 3 F3)', async ({ page }) => {
    const dupFixture = createFixtureWorkspace();
    seedBatchFixture(dupFixture.rootPath);
    const dupHarness = await startDashboardHarness(dupFixture.rootPath);
    try {
      const script = "require(process.argv[1]).main({ root: process.argv[2], argv: ['summary', '--json'] })";
      const cli = JSON.parse(execFileSync(process.execPath, ['-e', script, path.join(ENGINE, 'tools/qa/index.js'), dupFixture.rootPath], { cwd: ENGINE, encoding: 'utf8' }));
      const api = await (await fetch(`${dupHarness.url}/api/qa/summary?force=true`)).json();
      // Fixture thật sự có lặp (nếu không thì test này vô nghĩa): CLI gộp xuống ít hơn số finding thô.
      const raw = require(path.join(ENGINE, 'tools/qa/lib/commands')).summary(dupFixture.rootPath, { json: true });
      expect(raw.findings.length).toBeGreaterThan(cli.findings.length);
      expect(cli.findings.some((f) => f.occurrences > 1)).toBe(true);

      expect(api.health).toEqual(cli.health);
      expect(api.findings.length).toBe(cli.findings.length);
      expect(api.findings.map((f) => f.occurrences).sort()).toEqual(cli.findings.map((f) => f.occurrences).sort());

      await page.goto(dupHarness.url);
      await page.waitForSelector('.shell');
      await page.waitForFunction(() => Boolean(window.__STUDIO_CORE__));
      await page.evaluate(() => window.__STUDIO_CORE__.featureRegistry.switchView('qa-view'));
      await expect(page.locator('#qa-health-findings-text')).toHaveText(`${cli.health.totalFindings} phát hiện`);
      await expect(page.locator('#qa-stat-major')).toHaveText(String(cli.health.blockers + cli.health.majors));
    } finally {
      await dupHarness.stop();
      dupFixture.cleanup();
    }
  });
});
