# Learning Candidates (Pending Gate 0.5 Review)

### [LEARN-PLAN09-004] Save completion must belong to the originating file/session
- Source: Phase 3 follow-up browser probe, 2026-09-10; foundation suite 6/6 PASS.
- Confirmed: saving A then opening B lets A completion overwrite B clean buffer; discard on B returns A content. Registry selects .view (0 matches) and leaves target hidden. Re-registering the same handler lets old bridge disposer delete new registration.
- Evidence: editorSession.js save/openFile/discard; featureRegistry.js _updateDomTabsAndPanels; windowBridge.js expectedHandler guard; isolated Chromium runtime.
- Proposed rule: Guard async completion with session identity; use per-registration tokens; verify router against actual panel DOM.
- Scope: FEATURE-LOCAL. Owner: Technical Lead / QA. Status: PENDING.

### [LEARN-PLAN09-003] Foundation gates need failure-path checks on real modules
- Source: Phase 3 browser probe, 2026-09-10; existing foundation suite 5/5 PASS.
- Confirmed: registry misses compare-view; edit during pending save clears dirty incorrectly; stale bridge disposer deletes replacement; state snapshots expose mutable nested state; API ignores caller abort signal.
- Evidence: dashboard/public/js/{main.js,core/windowBridge.js,core/stateStore.js,core/apiClient.js,components/editor/editorSession.js}; isolated Chromium probe reproduced all five.
- Proposed rule: Compare registry with DOM inventory and test save races, owner disposal, snapshot isolation and cancellation before foundation sign-off.
- Scope: FEATURE-LOCAL. Owner: Technical Lead / QA. Status: PENDING.

### [LEARN-PLAN09-001] Verify migration gates against actual audit and test discovery
- Source: Plan 09 v3 review, 2026-09-10.
- Observation: audit dashboard reports 4 JS violations; CSS/HTML are outside policy extensions.
- Evidence: D:/_Master_Process/config/quality-policy.json; master.ps1 audit dashboard (exit 1).
- Proposed rule: Capture the actual audit baseline, define per-phase scope, and verify test discovery before declaring migration acceptance runnable.
- Scope: FEATURE-LOCAL. Owner: Technical Lead / QA. Status: PENDING.

### [LEARN-PLAN09-002] Passing smoke tests do not close migration acceptance
- Source: Phase 0–2 review, 2026-09-10; Dashboard suite rerun: 7 passed (18.6s).
- Confirmed mismatch: styles.css imports resources after toggle-switch/common-scale although extracted original ranges place resources first (1801–2362 before 2363–3408).
- Proposed rule: Preserve AC/TC meanings across reports; verify source-order ledger against imports and require actual contract/visual evidence before phase sign-off.
- Scope: FEATURE-LOCAL. Owner: Technical Lead / QA. Status: PENDING.

### [LEARN-PLAN09-005] Isolate Hub test data from Satellite repository synchronization
- Source: Satellite sync review, 2026-09-10.
- Observation: Satellite repositories (Vieclam24h, CarThings) have independent domain business data; syncing Hub's demo test data (data/, tests/, pages/) will overwrite satellite domain assets.
- Evidence: scripts/sync-satellites.js; .github/workflows/sync-satellites.yml; GIT_WORKFLOW.md.
- Proposed rule: Strictly exclude data/, tests/, pages/ from MODULES_TO_SYNC; enforce code-level assertion in sync scripts preventing Hub data from propagating to satellites.
- Scope: PROJECT. Owner: Technical Lead / Release Owner. Status: PENDING.

### [LEARN-PLAN09-006] Lazy DOM templates and safe idempotent script bindings
- Source: Phase 5-6 delivery, 2026-09-10; full regressions 32/32 PASS, Gate 4 PASS.
- Confirmed: Extracting non-default HTML templates to on-demand `/templates/*.html` dropped initial DOM tags from 3453 to 463 (<1500). Unmounted views require safe lazy event binding (`bind()`) to prevent startup crashes. Lossless XML merging on Windows requires Python ElementTree.
- Evidence: dashboard/public/templates/, templateLoader.js, agent.js, run-regressions.ps1.
- Proposed rule: Decouple non-default view DOM via on-demand templates; make script event binders idempotent/lazy; use Python ElementTree for XML reports on Windows.
- Scope: PROJECT. Owner: Technical Lead / QA. Status: PENDING.

### [LEARN-REC-001] Hide Node.exe console window on Windows GUI tool spawn
- Confirmed: Spawning `node.exe` with `windowsHide: false` forces a black CUI console window; `windowsHide: true` hides console while GUI child windows (Chromium, Inspector) remain visible.
- Scope: PROJECT. Owner: Fullstack Dev. Status: PENDING.
