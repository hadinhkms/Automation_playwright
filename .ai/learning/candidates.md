# Learning Candidates (Pending Gate 0.5 Review)

### [LEARN-SYNC-001] Hub-owned `core/` needs one stable seam, not a growing exclude list
- Source: Hub-to-Spoke sync audit, 2026-09-19.
- Confirmed: satellites wrote project code INSIDE the Hub-owned overwrite zone; sync deleted it. Measured drift: CarThings `core/utils/commonUtils.js` 178 satellite-only lines, `core/utils/commonUtils.test.js` 11, `core/config/dashboardConfig.js` 6 (Hub hard-coded `carthingsURL`/`companyURL` in the reserved-key list, forcing a per-project `.js` fork). Vieclam24h: 9 `dashboard/` files diverged, all stale Hub versions, zero project customisation.
- Evidence: commit `7ad6984` @ hadinhkms/Automation_Carthings (2026-09-16, github-actions[bot], "fix(core): restore commonUtils generators and environment URL mappings") restored 179+4+11 lines by hand; no guard was added, so it would have recurred every sync.
- Proposed rule: keep exactly ONE stable exclude (`core/local/`) as the project seam and load it optionally from Hub files; never enumerate individual files in `excludes` (that freezes Hub updates for those files). Hub code must never name a project-specific field — read unknown keys through from the excluded `dashboardConfig.json`. Run `node scripts/pre-sync-drift.js --strict` (shares `MODULES_TO_SYNC`/`isExcluded` with the real sync via `scripts/lib/sync-manifest.js`) as a CI gate before any write, and fail it when a satellite cannot be inspected.
- Scope: PROJECT. Owner: Technical Lead / Release Owner. Status: PENDING.

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

### [LEARN-PLAN09-006] Dynamic DOM templates require lifecycle-aware binding & null guards
- Source: Phase 5 delivery & UI audit, 2026-09-10; full probe PASS.
- Confirmed: Extracting views to on-demand templates leaves startup `addEventListener` bound to null, rendering buttons dead. Unguarded DOM mutations halt JS thread.
- Evidence: dashboard/public/app.js, templateLoader.js, ai/dashboard/AI_LESSONS.md.
- Proposed rule: Bind template events inside slice `mount()` or use event delegation; null-guard all shared DOM mutations; run `npm run sync:satellites` after Hub updates.
- Scope: PROJECT. Owner: Technical Lead / QA. Status: PENDING.

### [LEARN-REC-001] Hide Node.exe console window on Windows GUI tool spawn
- Confirmed: Spawning `node.exe` with `windowsHide: true` hides console while GUI child windows remain visible. Scope: PROJECT. Owner: Fullstack Dev.

### [LEARN-SUITE-001] Suites view: delegate creation/selection & dynamically populate child suites
- Confirmed: Avoid browser `prompt()` on suite creation; delegate to `createNewSuite` inline editor. Toggling to Suite Cha (`composite`) must immediately invoke `renderCompositeChildrenList` and update type badge. Scope: PROJECT. Owner: Technical Lead / QA.

### [LEARN-QA-001] Pre-check document conflict and post-run requirement synchronization loop
- Source: User operational guideline, 2026-09-20.
- Confirmed: Prior to writing test cases, always read requirements/test-cases and check for conflicts or discrepancies against real UI/code to resolve early. After script passes verification, any changes or newly discovered business rules must be synchronized back into requirements/REQ-xxx.md immediately.
- Scope: PROJECT. Owner: Automation QA Lead. Status: CONFIRMED.
### [LEARN-GIT-001] Do not auto-commit or auto-push before user verification
- Source: User directive, 2026-09-20.
- Confirmed: Never automatically git commit or git push changes after code edits. Changes must remain in the local working directory for the user to test and verify first. Premature commits pollute Git history with redundant, unverified, or incomplete iterations. Only commit/push when the user explicitly instructs or approves.
- Scope: WORKSPACE. Owner: Agent Assistant / Developer. Status: CONFIRMED.
