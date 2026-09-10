/**
 * tests/dashboard/foundation-parity.spec.js
 * Verification test suite for Phase 3 Frontend Foundations:
 * - FeatureRegistry (13 views catalog & router)
 * - StateStore (single ownership & mutation locks)
 * - EventBus (cross-slice decoupling)
 * - EditorSession (buffer, dirty state, keybindings)
 * - WindowBridge (coexistence with global window)
 */
const { test, expect } = require('@playwright/test');
const { startDashboardHarness } = require('./support/dashboardHarness');
const { createFixtureWorkspace } = require('./support/fixtureWorkspace');

test.describe('Phase 3: Frontend Architecture & Foundation Verification', () => {
  let fixture;
  let harness;

  test.beforeAll(async () => {
    fixture = createFixtureWorkspace();
    harness = await startDashboardHarness(fixture.rootPath);
  });

  test.afterAll(async () => {
    if (harness) await harness.stop();
    if (fixture) fixture.cleanup();
  });

  test('TC-04: Studio Core initializes on window.__STUDIO_CORE__ with all 13 views cataloged', async ({ page }) => {
    await page.goto(harness.url);
    await page.waitForSelector('.shell');

    // Wait for ESM main.js to bootstrap
    await page.waitForFunction(() => Boolean(window.__STUDIO_CORE__));

    const views = await page.evaluate(() => {
      const core = window.__STUDIO_CORE__;
      return core.featureRegistry.listViews().map((v) => v.id);
    });

    const expectedViews = [
      'runner-view', 'builder-view', 'page-manager-view', 'resources-view',
      'docs-view', 'agent-view', 'suites-view', 'recorder-view',
      'data-view', 'git-view', 'fixtures-view', 'settings-view', 'suites-quick',
    ];

    expect(views.length).toBe(13);
    for (const exp of expectedViews) {
      expect(views).toContain(exp);
    }
  });

  test('TC-05: Single Ownership & Mutation Lock prevents concurrent duplicate state mutation', async ({ page }) => {
    await page.goto(harness.url);
    await page.waitForFunction(() => Boolean(window.__STUDIO_CORE__));

    const result = await page.evaluate(async () => {
      const { stateStore } = window.__STUDIO_CORE__;
      let executedCount = 0;
      let conflictDetected = false;

      // Lock the mutation key "saveDataset"
      const acquiredFirst = stateStore.acquireLock('saveDataset');

      // Attempt to acquire second lock concurrently
      const acquiredSecond = stateStore.acquireLock('saveDataset');
      if (!acquiredSecond) conflictDetected = true;

      // Run exclusive task
      stateStore.releaseLock('saveDataset');
      await stateStore.runExclusive('saveDataset', async () => {
        executedCount++;
      });

      return { acquiredFirst, conflictDetected, executedCount };
    });

    expect(result.acquiredFirst).toBe(true);
    expect(result.conflictDetected).toBe(true);
    expect(result.executedCount).toBe(1);
  });

  test('TC-06: EventBus decouples cross-slice events and handles unsubscribing cleanly', async ({ page }) => {
    await page.goto(harness.url);
    await page.waitForFunction(() => Boolean(window.__STUDIO_CORE__));

    const result = await page.evaluate(() => {
      const { eventBus } = window.__STUDIO_CORE__;
      const eventsReceived = [];

      const unsub = eventBus.on('test:lifecycle', (payload) => {
        eventsReceived.push(payload);
      });

      eventBus.emit('test:lifecycle', { step: 1 });
      eventBus.emit('test:lifecycle', { step: 2 });
      unsub();
      eventBus.emit('test:lifecycle', { step: 3 }); // should not be received

      return eventsReceived;
    });

    expect(result).toEqual([{ step: 1 }, { step: 2 }]);
  });

  test('TC-07: EditorSession manages buffer, tracks dirty state and triggers keybindings', async ({ page }) => {
    await page.goto(harness.url);
    await page.waitForFunction(() => Boolean(window.__STUDIO_CORE__));

    const result = await page.evaluate(async () => {
      const { editorSession } = window.__STUDIO_CORE__;

      // 1. Open file clean
      editorSession.openFile('data/sample.json', '{"initial":true}');
      const initialDirty = editorSession.isDirty();

      // 2. Modify buffer
      editorSession.updateBuffer('{"initial":false}');
      const dirtyAfterEdit = editorSession.isDirty();

      // 3. Discard
      editorSession.discard();
      const dirtyAfterDiscard = editorSession.isDirty();
      const contentAfterDiscard = editorSession.getBuffer();

      // 4. Save simulation
      editorSession.updateBuffer('{"saved":true}');
      let savedToFile = '';
      await editorSession.save(async (file, content) => {
        savedToFile = file;
      });
      const dirtyAfterSave = editorSession.isDirty();

      return {
        initialDirty,
        dirtyAfterEdit,
        dirtyAfterDiscard,
        contentAfterDiscard,
        dirtyAfterSave,
        savedToFile,
      };
    });

    expect(result.initialDirty).toBe(false);
    expect(result.dirtyAfterEdit).toBe(true);
    expect(result.dirtyAfterDiscard).toBe(false);
    expect(result.contentAfterDiscard).toBe('{"initial":true}');
    expect(result.dirtyAfterSave).toBe(false);
    expect(result.savedToFile).toBe('data/sample.json');
  });

  test('TC-08: WindowBridge exposes module action to window without ReferenceError', async ({ page }) => {
    await page.goto(harness.url);
    await page.waitForFunction(() => Boolean(window.__STUDIO_CORE__));

    const result = await page.evaluate(() => {
      const { windowBridge } = window.__STUDIO_CORE__;

      // Expose an action through bridge
      windowBridge.exposeAction('phase3DemoAction', (multiplier) => {
        return 42 * multiplier;
      });

      // Call it directly from window (simulating inline onclick="phase3DemoAction(2)")
      const output = window.phase3DemoAction(2);
      const isRegistered = windowBridge.hasAction('phase3DemoAction');

      return { output, isRegistered };
    });

    expect(result.output).toBe(84);
    expect(result.isRegistered).toBe(true);
  });
});
