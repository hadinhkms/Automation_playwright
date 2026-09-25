# Test Automation Lessons

This file is the version-controlled memory for confirmed Playwright test automation failures. It complements `AI_PROMPTS.md`; it does not replace the stable rules there.

> **This file belongs to THIS project. The Hub never overwrites it.**
> `ai/shared/TEST_AUTOMATION_LESSONS.md` is excluded from Hub-to-Spoke sync, so every
> repository keeps its own lessons here and they survive every sync.
>
> What the Hub DOES own and will keep updating: `ai/shared/AI_PROMPTS.md` (how to write
> test cases) and everything under `dashboard/`, `core/`, `bin/`, `tools/`.
> A lesson that applies to EVERY project belongs in `AI_PROMPTS.md` via a PR to the Hub,
> not here.
>
> The same ownership split applies to CODE: `core/` is Hub-owned and overwritten — put
> project-specific helpers in `core/local/` (see `core/local/README.md`) and run
> `node scripts/pre-sync-drift.js` before a sync to catch anything left in the overwrite zone.

Only record a lesson after the issue is reproducible and its root cause is known. Do not store credentials, personal data, chat transcripts, guesses, or duplicate entries.

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

### 2026-09-04 — Brand logo locator resilience and post-login onboarding overlay

- Date: 2026-09-04
- Area: Precondition & Page Object Locators (`HomePage.js`)
- Symptom: Test fails in `Given Tiền điều kiện` with `TimeoutError: locator.waitFor: Timeout 20000ms exceeded. waiting for locator('a[href="/"] svg').first() to be visible`.
- Root cause:
  1. The target web application updated its header brand logo to render as `<img>` (`link "Brand logo" > img`) instead of inline `<svg>`, causing a selector targeting strictly `svg` to time out.
  2. Immediately following authentication, the Onboarding modal overlay appears on the screen and intercepts visibility/pointer events for underlying homepage elements.
- Correct pattern:
  1. Define logo with a resilient union selector in `HomePage.js`: `this.logo = page.locator('a[href="/"] img, a[href="/"] svg').first();`.
  2. Dismiss blocking overlays (`onboardingPopup.closeIfVisible()`) before asserting homepage element visibility in Precondition steps.
- Preventive rule: Always use resilient union selectors (`img, svg`) for site logos where CMS or framework updates can alter markup. Handle expected post-login onboarding modals before verifying base page layout.
- Regression check: `npx playwright test tests/e2e/desktop/complete_profile_setup-bdd.spec.js --project="Desktop Regression Tests"`.
- Related files: `pages/desktop/HomePage.js`, `tests/e2e/desktop/complete_profile_setup-bdd.spec.js`.

### 2026-09-05 — Post-apply recommendation dialog resilience in No-CV flows

- Date: 2026-09-05
- Area: Page Object Action & Synchronization (`JobApplyNoCVPage.js`)
- Symptom: Test fails in `bulkApply` with `TimeoutError: locator.waitFor: Timeout 15000ms exceeded. waiting for getByRole('button', { name: /Xem thêm việc gợi ý/i }).first() to be visible`.
- Root cause: After clicking bulk apply (`btnBulkApplyReady`), the application can finalize submission and directly close the application overlay or navigate back without showing the optional recommendation modal ("Xem thêm việc gợi ý"). Strictly waiting for `btnSeeMoreJobs` with an unhandled wait causes avoidable timeout failures.
- Correct pattern: Treat post-submission recommendation modal actions as optional with a finite timeout wrapped in `try/catch`, matching the pattern in `JobApplyPage.js`.
- Preventive rule: Never treat optional post-submission upsells/recommendations as mandatory blocking steps; use finite detection timeouts and continue test execution when the system directly closes or navigates to the next page.
- Regression check: `npx playwright test tests/e2e/desktop/apply_job_noCV_flow.spec.js --project="Desktop Regression Tests"`.
- Related files: `pages/desktop/JobApplyNoCVPage.js`, `tests/e2e/desktop/apply_job_noCV_flow.spec.js`, `tests/e2e/desktop/guest_apply_job_noCV_with_otp.spec.js`.

### 2026-09-05 — Strict mode violation on user account menu locator

- Date: 2026-09-05
- Area: Page Object Base Locators (`BasePage.js`)
- Symptom: `Error: locator.waitFor: Error: strict mode violation: getByRole('button', { name: /avt_invalid|tài khoản|hồ sơ/i }) resolved to 2 elements: 1) getByRole('button', { name: 'avt_invalid Js ' }), 2) button with text 'Tạo hồ sơ ngay'`.
- Root cause: The regex included generic keyword `hồ sơ`, which matched marketing or sub-header buttons such as "Tạo hồ sơ ngay" on search and listing pages.
- Correct pattern: Define `accountMenuButton` with `/avt_invalid|tài khoản/i` and append `.first()`: `page.getByRole('button', { name: /avt_invalid|tài khoản/i }).first()`.
- Preventive rule: Avoid overbroad regex keywords in shared base locators that can match context-specific page CTAs. Always anchor or scope user-level nav buttons.
- Regression check: `npx playwright test tests/e2e/desktop/apply_job_noCV_flow.spec.js --project="Desktop Regression Tests"`.
- Related files: `pages/BasePage.js`.

### 2026-09-05 — Platform isolation in evidence directory and separate mobile duplication

- Date: 2026-09-05
- Area: Evidence & Report Routing (`core/utils/commonUtils.js`, `playwright.config.js`)
- Symptom: Mobile test screenshots were saved inside `evidence/<date>/desktop/apply_job_noCV_flow-mobile/` instead of `evidence/<date>/mobile-web/`, causing evidence to be mixed up ("evidence lung tung") and misleading verification that desktop tests were run on mobile.
- Root cause: `ScreenshotHelper.getEvidenceDir()` used `const platformStr = process.env.QA_PLATFORM || 'desktop';` without inspecting the actual test spec path or project name from `test.info()`. When executed via CLI or default runner, `QA_PLATFORM` was not passed, forcing all mobile runs into the `desktop` directory.
- Correct pattern: 
  1. Inspect `test.info().file` and `test.info().project?.name` first: if the path/project contains `mobile-web` or `.mobile.`, route to `mobile-web`; if `desktop`, route to `desktop`; if `api`, route to `api`.
  2. Maintain strict separation between desktop and mobile suites: desktop scripts stay in `tests/e2e/desktop/*.spec.js` using `baseTest.js` and desktop POMs, while mobile scripts are duplicated with adjustments into `tests/e2e/mobile-web/*.mobile.spec.js` using `mobileWebTest.js` and `pages/mobile-web/` POMs. Never override desktop scripts.
- Preventive rule: Never rely solely on optional environment variables for artifact and evidence partitioning when test execution context (`test.info()`) provides canonical spec paths. Keep desktop and mobile automation codebases strictly separated by directory and naming conventions.
- Regression check: `npx playwright test tests/e2e/mobile-web/apply_job_noCV_flow.mobile.spec.js --project="Mobile Chrome Regression Tests"`.
- Related files: `core/utils/commonUtils.js`, `playwright.config.js`, `dashboard/server.js`.

### 2026-09-25 — Circular require between baseTest and the custom fixture loader drops every custom fixture

- Date: 2026-09-25
- Area: Core fixtures (`core/fixtures/baseTest.js`, `core/fixtures/custom/index.js`)
- Symptom: `npx playwright test --list` fails with `Test has unknown parameter "ephemeralUser"` and logs `[CustomFixtures Warning] Không thể nạp custom fixture ... Cannot read properties of undefined (reading 'has')`. The QA scanner then reads 0 tests and reports only `khong-doc-duoc-playwright`.
- Root cause:
  1. `custom/index.js` required `../baseTest` for `RESERVED_FIXTURE_NAMES`, while `baseTest.js` requires `./custom` before defining that set. Playwright loads `baseTest.js` first, so the loader ran against a partial export (`undefined`) and every custom fixture failed to register. Unit tests that require `./custom` first load in the opposite order and still passed.
  2. With the cycle removed, the loader's default call also scanned the project root and required `playwright.config.js` as a fixture file, registering bogus fixtures such as `projects`.
  3. `core/generator/objectRepository.js` kept its own copy of the reserved list without `circuitBreakerGuard`, so Fixtures Studio accepted a name the runner silently skips.
- Correct pattern: Keep shared constants in a leaf module with no requires back into its consumers (`core/fixtures/reservedFixtureNames.js`), imported by `baseTest.js`, `custom/index.js` and `objectRepository.js`. For a project root the loader scans only `fixtures/custom` and `core/fixtures/custom`; it scans the given directory itself only when that directory is a standalone fixture folder.
- Preventive rule: Never import a constant from a module that imports you, especially when either side does work at require time. Test module wiring in the production load order, in a fresh process.
- Regression check: `node --test core/fixtures/*.test.js` (includes `fixtureLoadOrder.test.js`), then `npx playwright test --list` shows no `[CustomFixtures ...]` warnings.
- Related files: `core/fixtures/reservedFixtureNames.js`, `core/fixtures/baseTest.js`, `core/fixtures/custom/index.js`, `core/generator/objectRepository.js`, `core/fixtures/fixtureLoadOrder.test.js`, `core/fixtures/comprehensiveDataLifecycle.test.js`.
