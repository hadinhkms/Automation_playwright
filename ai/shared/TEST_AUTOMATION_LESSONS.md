# Test Automation Lessons

This file is the version-controlled memory for confirmed Playwright test automation failures. It complements `AI_PROMPTS.md`; it does not replace the stable rules there.

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
