# Dashboard AI Lessons

This file is the version-controlled memory for agents maintaining the Dashboard. Read it before modifying anything under `dashboard/`.

Only record a lesson after the defect is confirmed and its root cause is understood. Do not store chat transcripts, guesses, credentials, personal data, or duplicate lessons. Consolidate an existing entry when the same cause appears again.

## Required entry format

- Date
- Area
- Symptom
- Root cause
- Correct pattern
- Preventive rule
- Regression check
- Related files

## Confirmed lessons

### 2026-09-03 — Shared UI behavior must have one implementation

- Area: Dashboard layout and source-code editors.
- Symptom: Page Manager and BDD/Test areas use different header backgrounds, page padding, workspace gaps, responsive rules, and edit/view implementations for equivalent behavior.
- Root cause: Feature-specific CSS selectors and JavaScript event handlers independently redefine page structure and code editing instead of consuming shared primitives.
- Correct pattern: Centralize design tokens and shared page/header/workspace/panel classes; use one file-language registry and one reusable code-editor controller for every source-code surface.
- Preventive rule: Before adding a layout or editor, search for the existing shared primitive and extend it. Feature classes may define only behavior that is genuinely feature-specific.
- Regression check: Compare computed styles in light/dark mode and supported viewports; verify every code surface has consistent language highlighting, inline editing, dirty state, save, revert, copy, Tab, Ctrl/Cmd+S, and scroll synchronization without duplicate listeners.
- Related files: `dashboard/public/index.html`, `dashboard/public/styles.css`, `dashboard/public/app.js`.

### 2026-09-03 — AI rules need tool-native discovery entry points

- Area: Repository AI instructions.
- Symptom: A canonical Dashboard prompt exists, but some assistants do not automatically discover `AGENTS.md` or repository-local Codex skills.
- Root cause: Copilot and Gemini use their own repository instruction discovery conventions.
- Correct pattern: Keep one canonical Dashboard prompt and connect it through each supported tool's native entry point.
- Preventive rule: When the canonical prompt is moved or renamed, update Codex, Copilot, Gemini, Cursor, and Windsurf entry points in the same change; do not duplicate the full prompt in those entry points.
- Regression check: Confirm `.github/copilot-instructions.md` and the Dashboard path-specific Copilot instruction reference the canonical files; confirm root `GEMINI.md` imports the canonical prompt and lessons; confirm all referenced paths exist.
- Related files: `AGENTS.md`, `.github/copilot-instructions.md`, `.github/instructions/dashboard.instructions.md`, `GEMINI.md`, `.cursorrules`, `.windsurfrules`, `.agents/skills/dashboard-maintainer/SKILL.md`.

### 2026-09-04 — Wizard dependency states must match their controls

- Area: BDD Script Studio Wizard, Page Object dependency step.
- Symptom: The dependency list displayed “Chưa có Page Object sẵn sàng cho platform này” while the primary Page Object dropdown still offered a default `HomePage.js`; the message also used inconsistent typography and gave no next action.
- Root cause: The list and dropdown independently filtered Page Objects, and the empty state did not distinguish platform compatibility from readiness.
- Correct pattern: Share one compatibility filter and option renderer; when no ready Page Object exists, show the selected platform, explain whether files are missing or blocked, provide a create action, and disable the misleading default option.
- Preventive rule: Test Wizard dependency states for each platform with ready, blocked, empty, loading, and API-error data; verify list, dropdown, copy, and actions remain consistent.
- Regression check: Assert the ready-card count and dropdown options for Desktop/Mobile, then mock an empty or blocked repository and assert the contextual empty state, disabled primary option, create action, no horizontal overflow, and consistent font tokens.
- Related files: `dashboard/public/index.html`, `dashboard/public/styles.css`, `dashboard/public/app.js`.

### 2026-09-04 — Wizard actions need one entry point and explicit validation

- Area: BDD Script Studio Wizard navigation.
- Symptom: The sidebar repeated the primary create action; required scenario-name fields did not block “Tiếp theo”; the active navigation button looked disabled.
- Root cause: Duplicate controls were wired to the same workflow, the Wizard was not a form so native `required` validation never ran, and `.primary-button` had no shared active-state styling.
- Correct pattern: Keep one create entry point, validate each required Wizard step in the navigation handler, and define a shared primary button state with clear disabled styling.
- Preventive rule: Test duplicate-control count, empty required values, valid progression, active/disabled contrast, keyboard focus, and mobile wrapping for every Wizard step.
- Regression check: Assert one create action, empty scenario remains on Step 1 with a validation message, valid scenario advances to Step 2, and the active next button has full opacity and accent background.
- Related files: `dashboard/public/index.html`, `dashboard/public/styles.css`, `dashboard/public/app.js`.

### 2026-09-05 — Draft storage must be isolated outside framework source directories

- Area: Draft management for Test Scripts & Page Objects.
- Symptom: Saving in-progress drafts directly to `tests/` or `pages/` causes Playwright test runner (`npx playwright test`) and framework checker (`npm run check:framework`) to fail due to incomplete syntax or missing locators.
- Root cause: Temporary work-in-progress files reside within executable framework scan paths.
- Correct pattern: Store uncompleted drafts in a dedicated isolated directory (`.dashboard-drafts/` with `scripts/` and `pages/` subdirectories) ignored by git; only write to canonical directories (`tests/e2e/<platform>/` or `pages/<platform>/`) upon explicit, validated user creation, and automatically delete the corresponding draft upon success.
- Preventive rule: Never write uncompleted test scripts or Page Objects into executable test directories. Always verify `npm run check:framework` and Playwright suites remain completely unaffected by active drafts.
- Regression check: Save in-progress script and page drafts, verify `.dashboard-drafts/` stores them, verify `npm run check:framework` passes with 0 errors, finalize creation, verify files appear in canonical destination and draft files are deleted.
- Related files: `core/generator/draftManager.js`, `dashboard/server.js`, `dashboard/public/index.html`, `dashboard/public/app.js`, `.gitignore`.

### 2026-09-05 — Modal box width and body padding must strictly follow shared dialog primitives

- Area: Modal Dialogs (Delete Confirmation, Code Viewer, Action Linker).
- Symptom: Confirmation modal (`#modal-confirm-delete`) has a 40px empty column on the right, header/footer backgrounds cut off prematurely, content adheres to the left edge with 0px padding, and close button displays an unsightly thick black browser focus box.
- Root cause: Setting `max-width` on the inner `.app-modal-box` instead of outer `.app-modal`, leaving `.app-modal-box` without `width: 100%`, omitting class `.app-modal-body` in favor of inline `padding: 16px 0;`, and missing focus resets on `.btn-icon-subtle`.
- Correct pattern: Constrain width exclusively on `.app-modal` (e.g. `max-width: 480px; width: 92vw;`), enforce `width: 100%; max-width: 100%; box-sizing: border-box;` on `.app-modal-box`, wrap all modal content in `.app-modal-body` (`padding: 22px`), and apply `:focus:not(:focus-visible) { outline: none; }` with subtle accent outline for `:focus-visible`.
- Preventive rule: Never apply inline `max-width` or inline horizontal padding overrides to modal inner containers. Verify computed box bounds match dialog bounds exactly and test programmatic autofocus across both light and dark themes.
- Regression check: Measure `.app-modal` and `.app-modal-box` bounding rects in Chromium; verify `Math.abs(modalWidth - boxWidth) <= 2`, zero horizontal page overflow, symmetric 22px padding on all sides, and clean theme-aligned focus rings.
- Related files: `dashboard/public/index.html`, `dashboard/public/styles.css`, `dashboard/public/app.js`.


