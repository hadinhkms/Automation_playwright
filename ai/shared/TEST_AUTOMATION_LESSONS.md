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

### 2026-11-05 — Shared popup helpers close or corrupt feature modals (Job Near Me)

- Date: 2026-11-05
- Area: Popup handling (`pages/BasePage.js`, `pages/desktop/JobNearMePage.js`)
- Symptom: The "Khám phá việc làm gần tôi" pop-up closed by itself 2–6 s after opening (reported as a product bug, later retracted), or never appeared after navigating from Home; clicks inside it were intercepted by "Khoan đã… chưa đăng nhập?" and `.mbep-popup`.
- Root cause:
  1. `registerGuestPopupAutoHandlers()` registers a campaign-banner handler matching `.ReactModalPortal:has(.svicon-close)`, which matches every React modal with a close icon, including feature pop-ups under test.
  2. `closeAllPopupsIfVisible()` removed `.ReactModalPortal` nodes from the DOM and cleared `ReactModal__Body--open`, breaking react-modal bookkeeping so the next modal opens and immediately disappears. The same corruption also broke the Next.js router (2026-11-06, TC-094): the next client-side navigation rendered the 404 page "Không tìm thấy trang mà bạn yêu cầu" for ~6 s, then redirected to `/tim-kiem-viec-lam-nhanh`, dropping the category/province filter — easy to misreport as a product bug. Since 2026-11-06 the shared helpers (`BasePage`, `HomePage`, `JobSearchPage`) hide nodes with `display:none` instead of removing them, and handler locators use `.filter({ visible: true })` because hidden portals stay in the DOM.
- Correct pattern: For flows whose subject is a modal, do not call either helper. Register a scoped `addLocatorHandler` for `[role="dialog"][aria-modal="true"]` filtered with `hasNotText: <feature title>` that clicks the overlay's own close control, plus one for `.mbep-popup.mbep-popup-show`. Non-blocking floating panels (Hỏi Chớp, no `aria-modal`) must not be handled. On mobile, register it after `MobileHomePage.navigate()` so it does not race `closeNavigationPopups()`.
- Preventive rule: Never remove DOM nodes owned by React to dismiss popups; always close via the popup's own control (hide with `display:none` only as a last resort). Popup handlers must exclude the modal under test. Before reporting a navigation/404 "product bug", reproduce it without any DOM manipulation. (`pages/desktop/JobApplyNoCVPage.js` still removes portals — known exception, not yet migrated.)
- Regression check: `npx playwright test tests/e2e/desktop/job_near_me_radius_filter-bdd.spec.js --project="Desktop Regression Tests"`.
- Related files: `pages/BasePage.js`, `pages/desktop/JobNearMePage.js`, `pages/mobile-web/MobileJobNearMePage.js`.

### 2026-11-05 — Shared login precondition broke after the Zalo-OTP login popup became default

- Date: 2026-11-05
- Area: Auth precondition (`core/local/authSetup.local.js`, `pages/desktop/LoginPopup.js`)
- Symptom: Every spec using `authenticatedUser` failed in setup with `waiting for locator('button:has-text("Tiếp tục")') to be visible` (desktop) or `Test timeout of 60000ms exceeded while setting up "authenticatedUser"` (mobile).
- Root cause:
  1. The login popup now shows "Nhận OTP qua Zalo" by default; the "Tiếp tục" button only exists when the Zalo build flag is off, while `authSetup.local.js` still waited for it.
  2. `LoginPopup.zaloOtpBtn` / `smsOtpBtn` / `otherMethodsBtn` used `getByRole(..., { exact: true })`, but the accessible names include an icon-font glyph (`" Nhận OTP qua Zalo"`, `"Phương thức khác "`), so `isZaloOtpEnabled()` always returned false.
  3. `test.setTimeout()` inside the test body does not extend fixture setup, so slow WebKit logins hit the default 60 s.
- Correct pattern: Phone login calls `loginPopup.requestSmsOtp()` (Zalo on → "Phương thức khác" → "Nhận OTP qua SMS"; Zalo off → "Tiếp tục"); the QC fixed OTP `1111` applies to SMS only. Match icon buttons with an anchored regex (`/Nhận OTP qua Zalo\s*$/`). Long E2E specs set `test.describe.configure({ timeout })` so the login fixture gets the same budget.
- Preventive rule: Never key the shared login precondition on a single CTA label; go through the `LoginPopup` channel method. Do not use `exact: true` for buttons that render icon-font glyphs.
- Regression check: `npx playwright test tests/e2e/desktop/chuan-hoa-ky-nang-ho-so-js-8828.spec.js --project="Desktop Regression Tests"`.
- Related files: `core/local/authSetup.local.js`, `pages/desktop/LoginPopup.js`, `tests/e2e/*/chuan-hoa-ky-nang-ho-so-js-8828*.spec.js`.

### 2026-11-05 — Chớp Web entry points: test id attribute, popup helpers and timed remind popup

- Date: 2026-11-05
- Area: Page Object locators & preconditions (`ChopWebEntryPage.js`)
- Symptom: `getByTestId('ai-chatbot__chop-ask-panel')` found nothing although the panel was on screen; the floating panel disappeared after `HomePage.closeAdsIfVisible()`; the search dropdown and floating panel closed at random points (about 30s after load), failing reads with "element(s) not found".
- Root cause:
  1. The app uses the `data-test-id` attribute, while Playwright `getByTestId` defaults to `data-testid` (the config does not set `testIdAttribute`).
  2. `closeBlockingModalIfVisible()` (used by `closeAdsIfVisible()`) clicks generic close buttons and can remove `.ReactModalPortal`, which closes the Chớp floating panel and breaks later React modals such as the "Hỏi Chớp" dialog.
  3. A guest "Khoan đã, hình như bạn chưa đăng nhập?" popup opens on a timer once per session and replaces the floating panel or dropdown.
- Correct pattern: use `locator('[data-test-id="…"]')`; suppress the daily home popup with a route on `banner/list?position_key=HOME_POPUP_DAILY`; pre-seed `sessionStorage.remind_login_banner_session` and `localStorage.remind_login_banner_day` via `addInitScript` so the remind popup does not open; read prompt chips inside `expect(...).toPass()` so an opening animation does not yield empty text.
- Preventive rule: Do not call `closeAdsIfVisible()` on pages whose own floating panels or dialogs are under test. Prefer deterministic suppression of timed popups over closing them after they appear.
- Regression check: `npx playwright test tests/e2e/desktop/chop-web-cau-mau-theo-config-bdd.spec.js tests/e2e/mobile-web/chop-web-cau-mau-theo-config-bdd.mobile.spec.js --project="Desktop Regression Tests" --project="Mobile Chrome Regression Tests"`.
- Related files: `pages/desktop/ChopWebEntryPage.js`, `pages/mobile-web/MobileChopWebEntryPage.js`, `core/utils/chopWebApiHelper.js`.
