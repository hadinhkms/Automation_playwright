/**
 * tests/dashboard/foundation-parity.spec.js
 * Verification test suite for Phase 3 Frontend Foundations (Limit <= 250 lines)
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

  test('TC-04: Studio Core initializes on window.__STUDIO_CORE__ with all 13 views cataloged matching DOM', async ({ page }) => {
    await page.goto(harness.url);
    await page.waitForSelector('.shell');
    await page.waitForFunction(() => Boolean(window.__STUDIO_CORE__));

    const views = await page.evaluate(() => window.__STUDIO_CORE__.featureRegistry.listViews().map((v) => v.id));
    const expectedViews = [
      'runner-view', 'builder-view', 'page-manager-view', 'resources-view',
      'docs-view', 'agent-view', 'suites-view', 'recorder-view',
      'data-view', 'git-view', 'fixtures-view', 'settings-view', 'compare-view',
    ];
    expect(views.length).toBe(13);
    for (const exp of expectedViews) expect(views).toContain(exp);
    expect(views).not.toContain('suites-quick');
  });

  test('TC-05: Single Ownership, Mutation Lock and Immutable Snapshot Isolation', async ({ page }) => {
    await page.goto(harness.url);
    await page.waitForFunction(() => Boolean(window.__STUDIO_CORE__));

    const result = await page.evaluate(async () => {
      const { stateStore, featureRegistry, eventBus } = window.__STUDIO_CORE__;
      let executedCount = 0;
      const acquiredFirst = stateStore.acquireLock('saveDataset');
      const conflictDetected = !stateStore.acquireLock('saveDataset');
      stateStore.releaseLock('saveDataset');
      await stateStore.runExclusive('saveDataset', async () => { executedCount++; });

      const snapshot = stateStore.getState();
      const originalStatus = snapshot.runner.status;
      snapshot.runner.status = 'corrupted_externally';
      const isCorrupted = stateStore.getState().runner.status === 'corrupted_externally';

      // OWN-04: 20 view transitions must not multiply listeners or leak handlers
      const initialListeners = eventBus.listenerCount('view:changed');
      for (let i = 0; i < 20; i++) {
        await featureRegistry.switchView(i % 2 === 0 ? 'data-view' : 'runner-view');
      }
      const finalListeners = eventBus.listenerCount('view:changed');

      return { acquiredFirst, conflictDetected, executedCount, originalStatus, isCorrupted, initialListeners, finalListeners };
    });

    expect(result.acquiredFirst).toBe(true);
    expect(result.conflictDetected).toBe(true);
    expect(result.executedCount).toBe(1);
    expect(result.originalStatus).toBe('idle');
    expect(result.isCorrupted).toBe(false);
    expect(result.initialListeners).toBe(result.finalListeners);
  });

  test('TC-06: EventBus decouples events and Rapid A-B-A navigation applies only latest', async ({ page }) => {
    await page.goto(harness.url);
    await page.waitForFunction(() => Boolean(window.__STUDIO_CORE__));

    // 1. EventBus lifecycle and clean unsubscription
    const events = await page.evaluate(() => {
      const { eventBus } = window.__STUDIO_CORE__;
      const list = [];
      const unsub = eventBus.on('test:lifecycle', (p) => list.push(p));
      eventBus.emit('test:lifecycle', { step: 1 });
      unsub();
      eventBus.emit('test:lifecycle', { step: 2 });
      return list;
    });
    expect(events).toEqual([{ step: 1 }]);

    // 2. UI-02 & UI-04: DOM click and rapid A-B-A navigation resolution
    await page.click('.view-tab[data-view="builder-view"]');
    const rapidResult = await page.evaluate(async () => {
      const { featureRegistry } = window.__STUDIO_CORE__;
      const p1 = featureRegistry.switchView('runner-view');
      const p2 = featureRegistry.switchView('page-manager-view');
      const p3 = featureRegistry.switchView('builder-view');
      await Promise.all([p1, p2, p3]);
      return featureRegistry.getActiveViewId();
    });
    expect(rapidResult).toBe('builder-view');
    const activePanelHidden = await page.$eval('#builder-view', (el) => el.hasAttribute('hidden'));
    expect(activePanelHidden).toBe(false);
  });

  test('TC-07: EditorSession manages buffer, dirty state, save races and session isolation', async ({ page }) => {
    await page.goto(harness.url);
    await page.waitForFunction(() => Boolean(window.__STUDIO_CORE__));

    const result = await page.evaluate(async () => {
      const { editorSession } = window.__STUDIO_CORE__;

      // 1. Basic open & edit & discard & save
      editorSession.openFile('data/sample.json', '{"initial":true}');
      const initialDirty = editorSession.isDirty();
      editorSession.updateBuffer('{"initial":false}');
      const dirtyAfterEdit = editorSession.isDirty();
      editorSession.discard();
      const contentAfterDiscard = editorSession.getBuffer();
      editorSession.updateBuffer('{"saved":true}');
      await editorSession.save(async () => {});
      const dirtyAfterSave = editorSession.isDirty();

      // 2. Race condition: User edits buffer during async save
      editorSession.updateBuffer('{"step":1}');
      const savePromise = editorSession.save(() => new Promise((r) => setTimeout(r, 50)));
      editorSession.updateBuffer('{"step":2}');
      await savePromise;
      const dirtyAfterConcurrentEdit = editorSession.isDirty();

      // 3. Multi-file switch: Save A then switch to B; A completion must not corrupt B clean buffer
      editorSession.openFile('data/fileA.json', '{"file":"A"}');
      editorSession.updateBuffer('{"file":"A_dirty"}');
      const saveAPromise = editorSession.save(() => new Promise((r) => setTimeout(r, 60)));
      editorSession.openFile('data/fileB.json', '{"file":"B_clean"}');
      await saveAPromise;
      const discardedB = editorSession.discard();
      const isBDirty = editorSession.isDirty();

      return {
        initialDirty, dirtyAfterEdit, contentAfterDiscard, dirtyAfterSave,
        dirtyAfterConcurrentEdit, discardedB, isBDirty,
      };
    });

    expect(result.initialDirty).toBe(false);
    expect(result.dirtyAfterEdit).toBe(true);
    expect(result.contentAfterDiscard).toBe('{"initial":true}');
    expect(result.dirtyAfterSave).toBe(false);
    expect(result.dirtyAfterConcurrentEdit).toBe(true);
    expect(result.discardedB).toBe('{"file":"B_clean"}');
    expect(result.isBDirty).toBe(false);
  });

  test('TC-08: WindowBridge exposes module actions and protects replacement with token guard', async ({ page }) => {
    await page.goto(harness.url);
    await page.waitForFunction(() => Boolean(window.__STUDIO_CORE__));

    const result = await page.evaluate(() => {
      const { windowBridge } = window.__STUDIO_CORE__;
      const fn = () => 'same_handler_func';
      const dispose1 = windowBridge.exposeAction('sameHandlerAction', fn);
      const dispose2 = windowBridge.exposeAction('sameHandlerAction', fn);

      // Stale dispose1 with same handler function must NOT delete dispose2
      dispose1();
      const activeAfterStale = windowBridge.hasAction('sameHandlerAction');
      const output = window.sameHandlerAction();
      dispose2();
      // OWN-03: Double disposal must be safe and idempotent
      dispose2();
      const activeAfterActive = windowBridge.hasAction('sameHandlerAction');
      return { activeAfterStale, output, activeAfterActive };
    });

    expect(result.activeAfterStale).toBe(true);
    expect(result.output).toBe('same_handler_func');
    expect(result.activeAfterActive).toBe(false);
  });

  test('TC-09: ApiClient honors caller AbortSignal and cancels request mid-flight', async ({ page }) => {
    await page.goto(harness.url);
    await page.waitForFunction(() => Boolean(window.__STUDIO_CORE__));

    const result = await page.evaluate(async () => {
      const { apiClient } = window.__STUDIO_CORE__;
      const preAborted = new AbortController();
      preAborted.abort('Cancelled immediately');
      let preAbortedCaught = false;
      try {
        await apiClient.get('/api/state', {}, { signal: preAborted.signal });
      } catch (err) { preAbortedCaught = true; }

      const liveAbort = new AbortController();
      let liveAbortedCaught = false;
      const reqPromise = apiClient.get('/api/state', {}, { signal: liveAbort.signal });
      liveAbort.abort('User navigated away');
      try { await reqPromise; } catch (err) { liveAbortedCaught = true; }

      return { preAbortedCaught, liveAbortedCaught };
    });

    expect(result.preAbortedCaught).toBe(true);
    expect(result.liveAbortedCaught).toBe(true);
  });
});
