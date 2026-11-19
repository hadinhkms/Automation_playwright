# Phase 3 — iOS qua Mac host từ xa (cài đặt sẵn, chờ máy Mac)

> **Tác giả Nghiệp vụ / Kỹ thuật:** @claude (phiên 2026-11-19) · **Research:** Không áp dụng
> **Cấp độ:** L3 · **Phụ thuộc:** Phase 2 · **Trạng thái:** `DONE` (phần cài đặt; AC-305 và UAT-301 `BLOCKED (chờ Mac)`)
> **Quyết định Owner (2026-11-19):** làm sẵn toàn bộ phần cài đặt bây giờ; máy Mac cung cấp sau. Mọi bước cần Mac thật được đánh dấu `BLOCKED (chờ Mac)`, không được báo là đạt.

**Bước 0 bắt buộc của session:** rà soát lại Phase 2 theo §F của [phase-2-builds-and-reports.md](phase-2-builds-and-reports.md), sửa nếu thiếu, ghi kết quả vào §I của file này.

---

## A. Nghiệp Vụ

### A1. Mục Tiêu & Phạm Vi
- **In-Scope:**
  1. Cấu hình **Mac host** trong Cấu hình hệ thống → mục "Mobile / iOS": địa chỉ Appium trên Mac, cổng, danh sách thiết bị iOS (tên, UDID, phiên bản iOS, simulator hay máy thật), thông tin ký WebDriverAgent cho máy thật (Team ID, bundle id), đường dẫn app trên Mac.
  2. Nút **Kiểm tra kết nối**: gọi `GET http://<mac>:<port>/status`, báo phiên bản Appium, driver XCUITest có sẵn hay không, thời gian phản hồi.
  3. Framework: `wdio.ios.conf.js` (Appium **bên ngoài**, không tự khởi động), `core/native/iosCapabilities.js`. **Không** tạo `pages/native/ios/` hay `tests/native/ios/app-launch.native.js`: spec và Screen dùng chung với Android (`tests/native/shared/`, `pages/native/screens/`), theo PDR-3-01.
  4. Mobile App view: bật nút iOS; khung 1 hiện trạng thái Mac host + thiết bị khai báo; khung 2 chọn app iOS (đường dẫn trên Mac, URL tải về, hoặc bundle id đã cài); chạy/dừng/kết quả dùng chung runner.
  5. Upload `.ipa` / `.app.zip` vào `apps/` (mở rộng P2) để lưu trữ; chạy thì dùng **đường dẫn trên Mac** hoặc **URL** (Appium trên Mac phải đọc được file).
  6. Tài liệu `docs/IOS_NATIVE_TESTING.md`: checklist cài đặt máy Mac (Xcode, `xcode-select`, Appium 2, `appium driver install xcuitest`, mở cổng, ký WDA).
- **Out-of-Scope:** device farm (BrowserStack…), tự đẩy file sang Mac qua SSH, dò thiết bị tự động trên Mac.
- **UI:** yes

### A2. Yêu Cầu & Quy Tắc
- `REQ-301` Cấu hình iOS lưu ở `.env` (server scope) với khoá `IOS_*`, đọc lại khi khởi động.
- `REQ-302` Kiểm tra kết nối không treo quá 5 s; lỗi mạng hiện thông báo kèm việc cần làm.
- `BR-301` Địa chỉ Mac chỉ nhận `http(s)://host[:port]`, host là IP hoặc tên máy; không cho chèn đường dẫn tuỳ ý.
- `BR-302` Không lưu mật khẩu Apple ID. Ký WDA chỉ dùng Team ID + bundle id.

### A3. User Flow
- Cài đặt: Cấu hình hệ thống → Mobile / iOS → nhập Mac host → Kiểm tra kết nối → Lưu.
- Chạy: Mobile App → iOS → chọn thiết bị khai báo → chọn app → Chạy (nút khoá khi Mac chưa phản hồi, ghi rõ lý do).
- Chưa có Mac: view iOS hiện trạng thái "Chưa cấu hình Mac host" + liên kết sang Cấu hình.

### A4. Trạng Thái Biên
- `EDGE-301` Mac tắt / sai cổng → `reachable=false`, thông báo rõ.
- `EDGE-302` Appium có nhưng thiếu driver XCUITest → cảnh báo cài driver.
- `EDGE-303` Đổi cấu hình khi đang chạy → không áp dụng cho lượt đang chạy.

### A5. Tiêu Chí Nghiệm Thu
- `AC-301` (BR-302) Given Appium giả (server HTTP local trả `/status` hợp lệ) When Kiểm tra kết nối Then hiện "Kết nối được" + phiên bản.
- `AC-302` Given địa chỉ không phản hồi Then trả kết quả lỗi trong ≤ 5 s, không treo UI.
- `AC-303` (BR-301) Given địa chỉ dạng `file:///` hoặc chứa khoảng trắng/ký tự shell Then `400`.
- `AC-304` Given cấu hình iOS hợp lệ When xem lệnh ở khung 3 Then lệnh là `npx wdio run ./wdio.ios.conf.js …` và capabilities sinh ra đúng (unit test).
- `AC-305` `BLOCKED (chờ Mac)`: chạy `app-launch.native.js` trên simulator iOS từ Dashboard → Đạt.

### A6. UAT
- `UAT-301` Owner nhập Mac host thật, Kiểm tra kết nối, chạy smoke trên simulator. `BLOCKED (chờ Mac)`. Truy vết: REQ-301/302, AC-301/305.

---

## B. Kỹ Thuật

### B1. Quyết Định
- `TECH-301` Không bật Appium service trong `wdio.ios.conf.js`; luôn kết nối `IOS_APPIUM_HOST:IOS_APPIUM_PORT`, vì Appium iOS chỉ chạy được trên Mac (REQ-301).
- `TECH-302` Tách cấu hình theo nền tảng trong `mobileSpecService.PLATFORMS` (`ios: { specDir: 'tests/native/ios', config: 'wdio.ios.conf.js', appExt: ['.ipa', '.app.zip'] }`) để dùng lại runner P1 thay vì viết runner mới (REQ-301).
- `TECH-303` App iOS truyền bằng `IOS_APP` (đường dẫn trên Mac hoặc URL http/https) hoặc `IOS_BUNDLE_ID`, vì Appium trên Mac không đọc được file trên máy Windows (BR-301 giới hạn định dạng).
- `TECH-304` Kiểm tra kết nối dùng `fetch` có `AbortSignal.timeout(5000)` ở server để đáp ứng REQ-302 và tránh CORS.

### B2. Bản Đồ File (dự kiến)
| Path | Loại | Thao tác | Trần |
|---|---|:---:|:---:|
| `wdio.ios.conf.js` | Config | Tạo | — |
| `core/native/iosCapabilities.js` | Module | Tạo | 200 |
| ~~`pages/native/ios/AppLaunchPage.js`, `tests/native/ios/app-launch.native.js`~~ → `pages/native/screens/AppLaunchScreen.js`, `tests/native/shared/app-launch/app-launch.native.js` (PDR-3-01) | POM/Spec | Tạo/Chuyển | 200 |
| `dashboard/services/mobileIosService.js` | Service | Tạo | 160 |
| `dashboard/services/mobileRunOptions.js` | Service | Sửa (nhánh iOS) | 160 |
| `dashboard/public/js/views/settings/mobileSettingsHelper.js` + `templates/settings.html` | Module | Tạo/Sửa | 200 |
| `dashboard/public/js/views/mobile/*` | Module | Sửa | 200 |
| `docs/IOS_NATIVE_TESTING.md` | Docs | Tạo | — |

### B3. Contract
| Method | Path | Mã |
|---|---|---|
| GET | `/api/mobile/ios/config` | 200 |
| PUT | `/api/mobile/ios/config` | 200, 400 |
| POST | `/api/mobile/ios/check` | 200 (`reachable`, `appiumVersion`, `xcuitest`, `latencyMs`, `error`) |
| GET | `/api/mobile/catalog?platform=ios` | 200 |
| GET | `/api/mobile/devices?platform=ios`, `/api/mobile/doctor?platform=ios` | 200 (thiết bị khai báo; 4 mục kiểm tra) — PDR-3-04 |
| POST | `/api/mobile/run` (`platform: "ios"`) | 202, 400, 409, 503 (Mac chưa sẵn sàng) |

Khoá `.env`: `IOS_APPIUM_HOST`, `IOS_APPIUM_PORT`, `IOS_DEVICES` (JSON), `IOS_APP`, `IOS_BUNDLE_ID`, `IOS_XCODE_ORG_ID`, `IOS_WDA_BUNDLE_ID` (đã khai sẵn trong `.env.example` mục 7).

### B4. Dependencies
- Không có.

Trên Mac cần Appium 2 + driver `xcuitest` (ghi trong docs, không phải package của repo).

### B5. NFR
- Kiểm tra kết nối ≤ 5 s. Không log Team ID ra console trình duyệt.

### B6. Rủi Ro
- Không có Mac để kiểm thật → mọi AC cần Mac để `BLOCKED`, phần còn lại kiểm bằng Appium giả.
- App trên Windows không tự sang Mac → docs hướng dẫn chép file, hoặc dùng URL.

---

## C. Ma Trận Kiểm Thử
| AC | TC | Mức | File | Ca biên |
|---|---|:---:|---|---|
| AC-301, AC-302 | TC-3.1..3.3 | integration | `tests/dashboard-api/mobile-ios.test.js` (fake Appium HTTP) | timeout, 500, JSON lạ |
| AC-303 | TC-3.4 | unit + integration | `mobileIosService.test.js`, `mobile-ios.test.js` | file://, khoảng trắng, `;` |
| AC-304 | TC-3.5 | unit + integration | `mobileIosService.test.js`, `core/native/iosCapabilities.test.js`, `mobile-ios.test.js` (WDIO thật → Appium giả) | sim / máy thật |
| AC-305 | TC-3.6 | e2e | máy Mac thật | `BLOCKED (chờ Mac)` |

## D. Phạm Vi Dev Tự Quyết
- Cách nhập danh sách thiết bị (bảng hay JSON), vị trí mục cấu hình trong Settings.

## E. Câu Hỏi Mở
- 0 câu hỏi chặn.
- Khi có Mac: Owner cung cấp IP/tên máy, simulator hay iPhone thật, Team ID nếu chạy máy thật.

## F. Tiêu Chí Ra Phase
- [x] Bước 0: rà soát P2 ghi vào §I (tìm và sửa 1 lỗi có sẵn: app đã cài không được mở khi đang chạy nền).
- [x] AC-301..304 đạt có bằng chứng; AC-305/UAT-301 ghi `BLOCKED (chờ Mac)`.
- [x] Đủ test + kiểm tra như X-05 của overview; UI 4 kích thước × 2 theme.
- [x] Cập nhật overview, commit và push lên `main`.

## G. Soát Chéo
- Rà soát độc lập ở đầu session P4.

## H. Nhật Ký Thay Đổi (PDR)
| PDR | Loại | Plan gốc | Thực tế | Ảnh hưởng | Trạng thái |
|---|:---:|---|---|---|:---:|
| PDR-3-01 | BUSINESS | §A1 mục 3, §B2: spec và Page Object iOS riêng (`tests/native/ios/app-launch.native.js`, `pages/native/ios/AppLaunchPage.js`) | Báo cáo UX S-01/S-02 (§6.2, "đầu P3, trước khi tạo file iOS"): một spec dùng chung `tests/native/shared/app-launch/app-launch.native.js`, một Screen `pages/native/screens/AppLaunchScreen.js` có `static locators = { ten: { android, ios } }`, `NativeBasePage.el()` + `core/native/locators.js` dịch tiền tố theo nền tảng. `tests/native/android/` và `tests/native/ios/` chỉ cho phần riêng một bên. Catalog trả `scope` (`shared`/`android`/`ios`), khung 2 hiện badge `A+iOS` / `A` / `iOS`. Lý do: tránh nhân đôi mọi luồng nghiệp vụ và để báo cáo so được cùng TC trên 2 nền tảng | `wdio.android.conf.js` đổi `specs`; `pages/native/android/AppLaunchPage.js` bị xoá; suite native cũ trỏ `tests/native/android/app-launch.native.js` sẽ báo "không tìm thấy" (không có suite nào như vậy trong `core/config/dashboardConfig.json`) | DONE |
| PDR-3-02 | BUSINESS | Không có trong plan | UX S-03/S-04: test ID `TC-AND-001..003` → `TC-101..103`; tag mức chạy `@smoke` đặt ở `it`, bỏ `@android`; `describe` = `App launch - Smoke @native @app-launch @REQ-101`. Thêm `requirements/REQ-101-app-launch.md`, `test-cases/REQ-101-app-launch.md` (cột "Nền tảng"). Cập nhật `docs/ANDROID_NATIVE_TESTING.md` §4–7 | Test ID JUnit đổi thành `native.android.App_launch_-_Smoke_@native_@app-launch_@REQ-101.TC-101 - …`; lịch sử cũ giữ ID cũ | DONE |
| PDR-3-03 | BUSINESS | Không có trong plan | UX S-05: hồ sơ app dùng chung `core/native/app-profiles.json` (Calculator OPPO cho Android, Settings `com.apple.Preferences` cho simulator iOS), đọc qua `dashboard/services/mobileAppProfiles.js`, catalog trả `profiles`, khung 2 có ô "Hồ sơ app". UX §6.1 còn lại làm được rẻ: U-01 (ảnh theo lượt `evidence/native/<platform>/<runId>/<TC>_<màn>_<bước>.png`, TC lấy từ `it` qua hook `beforeTest`), U-05 (Báo cáo: nhóm "Mobile" → "App native"), U-06 (không có APK thì chọn sẵn "App đã cài"), U-07 (khung lệnh cao cố định 3 dòng). Hoãn sang P4/backlog: U-02 (chọn từng `it`), U-03 (chạy lại test lỗi), U-04 (chi tiết dòng lỗi), U-08 (lọc nhiều tag) | Chỉ thêm | DONE |
| PDR-3-04 | TECH | §B2/§B3 | File thêm để giữ trần dòng (X-04, `mobileSlice.js` đã ở vùng vàng 194/200): `dashboard/services/mobileIosCheck.js` (kiểm tra kết nối + 503), `mobileIosRunOptions.js`, `mobileAppProfiles.js`, `dashboard/routes/mobileIosRoutes.js` (gọi từ `mobileRoutes.js`, không thêm nhóm route), `core/native/wdioShared.js` (config chung 2 nền tảng), `core/native/locators.js`; front-end `mobileLive.js`, `mobilePlatform.js`, `mobileSpecList.js`; CSS `styles/views/mobile-ios.css`; `package.json` thêm `test:ios`, `test:ios:smoke`. Thêm `GET /api/mobile/devices?platform=ios` và `/doctor?platform=ios` để khung 1 dùng lại danh sách thiết bị / 4 mục kiểm tra như Android | Contract thêm 2 biến thể GET; `mobile.test.js` sửa 2 ca vì iOS nay hợp lệ (`?platform=windows` vẫn 400) | DONE |
| PDR-3-05 | TECH | §A4 EDGE-302 không nói cách dò driver | Appium 2 `/status` không liệt kê driver. Dò bằng `POST /session` với `platformVersion: '0.0'` (thiết bị không thể có): thiếu driver → Appium trả "Could not find a driver" → `xcuitest=false`; có driver → driver tự từ chối thiết bị → `true`; hết giờ → `null` kèm gợi ý `appium driver list --installed`. Cả `/status` và lượt dò dùng chung một `AbortSignal.timeout(5000)` (REQ-302) | Cần xác nhận trên Mac thật (rủi ro R-3-1) | DONE |
| PDR-3-06 | TECH | Bước 0 phát hiện lỗi P1/P2 | `core/native/androidCapabilities.js` thêm `appium:forceAppLaunch: true`: với `noReset` và app đã cài đang chạy nền, Appium bỏ qua bước mở app ("is already running and noReset is enabled") nên TC-101/103 lỗi. Dữ liệu app vẫn giữ | Android chạy ổn định bất kể trạng thái app trước đó | DONE |

## I. Bằng Chứng

Môi trường: Windows 11, baseline `7e03be4`, Node 22, WDIO 9.32.0, máy thật OPPO CPH2481 (Android 15, `6XPNHY9DVCUCR4OB`), app `com.coloros.calculator` / `com.android.calculator2.Calculator`. **Không có máy Mac**: phần iOS kiểm bằng Appium giả (server HTTP local trả `/status`, `/session`).

**Bước 0 — rà soát Phase 2 (§F của phase-2)**
- `node --test dashboard/services/mobileServices.test.js dashboard/services/mobileRunHistory.test.js dashboard/services/mobileBuildService.test.js core/native/junitReport.test.js` → exit 0, 56/56. `node --test --test-concurrency=1 tests/dashboard-api/mobile.test.js tests/dashboard-api/mobile-builds.test.js` → exit 0, 28/28. `verify-dashboard-features` → 15 view đủ mảnh. `check-code-limits --strict` → exit 0.
- UI: Mobile App chạy thật qua Dashboard. Lượt 1 → **1/3** (TC-AND-001, 003 lỗi "did not reach foreground", điện thoại đang ở app khác); lượt 2 → 3/3 chỉ vì trước đó đã tự mở Calculator bằng `am start`. CLI sau tái cấu trúc cũng 1/3 với ảnh lỗi là màn Home. Log Appium: `'com.coloros.calculator' is already running and noReset is enabled`. → **Lỗi có sẵn của P1/P2**: chế độ "App đã cài" không mở app khi app đang chạy nền. Sửa ở PDR-3-06; tái hiện đúng điều kiện (mở Calculator, bấm Home) rồi chạy lại → 3/3 Đạt (lượt CLI `p3cli2`, và lượt UI `mwnuqig0`).
- Báo cáo → Mobile: thấy lượt mới, kết quả 3/3, 1 ảnh, tải JUnit. Test Suites → "Android native": danh sách spec và lệnh `npx wdio` đúng (chỉ xem, không lưu).
- R-3 (receipt Gate 4): `record-gate-run.py` → `RUN BLOCKED`. Script đòi `git status --porcelain` rỗng và file test đã được git theo dõi; checkout có thay đổi `.agents/skills/` của phiên khác (không thuộc PLAN-25, không được đụng). **Vẫn BLOCKED**.

**Kiểm thử tự động (sau khi sửa xong)**

| Lệnh | Exit | Kết quả |
|---|:---:|---|
| `node --test dashboard/services/mobileServices.test.js dashboard/services/mobileRunHistory.test.js dashboard/services/mobileBuildService.test.js dashboard/services/mobileIosService.test.js core/native/junitReport.test.js core/native/iosCapabilities.test.js core/native/locators.test.js` | 0 | 87/87 (56 cũ + 31 mới) |
| `node --test --test-concurrency=1 tests/dashboard-api/mobile.test.js tests/dashboard-api/mobile-builds.test.js tests/dashboard-api/mobile-ios.test.js` | 0 | 36/36 (28 cũ + 8 iOS) |
| `node scripts/verify-dashboard-features.js` | 0 | 15 view đủ mảnh, 17 nhóm route |
| `npm run check:framework` | 0 | 8 specs, 6 page objects |
| `node scripts/check-code-limits.js --strict` | 0 | 39 file, 0 cảnh báo vùng vàng |
| `npm run test:unit` | 1 | 724/728. 4 lỗi có sẵn, giống baseline P2 (`htmlSummaryReporter`, `learner` L01/L02, `learnerSecurityGit` L16) |
| `npm run test:dashboard:api` | 1 | 231/233. 2 lỗi có sẵn, giống baseline P2 (`master-process` DRIFT, `qa-spec-studio`) |

**Ma trận AC**

| AC | TC | Kết quả | Bằng chứng |
|---|---|:---:|---|
| AC-301 | TC-3.1 | ĐẠT | API: PUT config → `.env` có `IOS_APPIUM_PORT=<fake>`, GET đọc lại; `POST /api/mobile/ios/check` → `reachable=true`, `appiumVersion=2.11.3`, `xcuitest=true`, `latencyMs` số. UI: Cấu hình → Mobile / iOS nhập `http://127.0.0.1:4799` → "Kết nối được · Appium 2.11.3-fake · phản hồi 13 ms · Driver XCUITest: có"; Lưu → `.env` chỉ đổi 7 dòng `IOS_*`, mọi dòng khác giữ nguyên (`diff`) |
| AC-302 | TC-3.2, TC-3.3 | ĐẠT | Appium giả không trả lời → `reachable=false`, "không phản hồi trong 5 giây", đo 4,5–6,5 s; cổng 1 → "từ chối kết nối"; `/status` 500 và JSON không phải Appium → `reachable=false` kèm lời khuyên. EDGE-302: Appium không có XCUITest → `xcuitest=false` + "appium driver install xcuitest" |
| AC-303 | TC-3.4 | ĐẠT | Unit 11 host xấu (`file:///`, khoảng trắng, `;`, `$(…)`, backtick, `/wd/hub`, `user:pass@`, `?x=`, thiếu scheme…) → 400; port, thiết bị, Team ID, bundle id, đường dẫn Windows → 400. API: 5 host xấu → 400 cả ở PUT và check, cấu hình đã lưu không đổi. UI: nhập `file:///etc/passwd` → "Dữ liệu không hợp lệ" + thông báo định dạng |
| AC-304 | TC-3.5 | ĐẠT | Unit: lệnh `npx wdio run ./wdio.ios.conf.js --spec … --mochaOpts.grep @smoke`; env mang host/port/thiết bị/app, không lọt `IOS_APP` cũ khi chạy bằng bundle id, Team ID không nằm trong options (SSE/lịch sử); capabilities sim (bundleId, noReset) và máy thật (udid, app, xcodeOrgId, updatedWDABundleId, không có trường mật khẩu). **Integration thật**: Dashboard `POST /api/mobile/run` (ios) → 202 → WDIO thật nạp `wdio.ios.conf.js` → Appium giả nhận `POST /session` với `platformName=iOS`, `automationName=XCUITest`, `deviceName=iPhone 15`, `platformVersion=17.5`, `bundleId=com.apple.Preferences`; không có Appium cục bộ được bật (TECH-301). EDGE-303: đổi cổng khi lượt đang khởi động → phiên vẫn tới Appium cũ. 503 khi Mac không tới được / thiếu XCUITest; 400 khi thiết bị chưa khai báo |
| AC-305 | TC-3.6 | **BLOCKED (chờ Mac)** | Chưa có máy Mac. Qua UI đã chạy tới Appium giả: log "RUNNING in iOS(17.5)… Failed to create a session" — chỉ chứng minh đường đi, **không** phải kết quả iOS |
| UAT-301 | | **BLOCKED (chờ Mac)** | Kịch bản ở `docs/IOS_NATIVE_TESTING.md` §4 |

**Android không hồi quy (yêu cầu của session)**: CLI `p3cli2` 3/3 Đạt (11 s, app đang chạy nền trước khi chạy); UI Mobile App → Android → hồ sơ "Calculator (OPPO, cài sẵn)" → `@smoke` → Chạy → lượt `mwnuqig0` **3/3 Đạt**, ảnh `evidence/native/android/mwnuqig0/TC-101_app_launch_foreground_*.png`, JUnit `classname=native.android.App_launch_-_Smoke_@native_@app-launch_@REQ-101`, `name=TC-101 - …`. Không dùng app Settings của OPPO.

**UI** (Mobile App Android + iOS, Cấu hình → Mobile / iOS, Báo cáo → App native) ở 1920×1080, 1440×900, 1280×800, 390×844 × light/dark: script kiểm không có cuộn ngang trang, không control nào tràn màn hình, không chữ `undefined`/`null`/`NaN`/`TODO`. Xem ảnh 390 px dark của iOS và Settings. 20 vòng bấm nhanh Android↔iOS↔Android + Mobile↔Cấu hình↔Báo cáo: 0 lỗi JS, trạng thái cuối khớp nền tảng đang chọn (phản hồi đến muộn của nền tảng cũ bị bỏ). Log server không lỗi. Sửa trong lúc kiểm: comment `**/` làm hỏng `nativeSuiteRender.js` (SyntaxError, sửa ngay); nhãn "Simulator" bị viết hoa bởi rule `label` chung; cảnh báo WDIO "pattern did not match" khi thư mục nền tảng chưa có.

**Dọn dẹp**: `.env` của Owner khôi phục từ bản sao lưu (không còn khoá `IOS_*` thử); lượt iOS thử với Appium giả đã gỡ khỏi `test-results/mobile-runs/index.json`; JUnit của test iOS tự xoá.

**Rủi ro còn lại**
- R-3-1: Cách dò XCUITest (PDR-3-05) và toàn bộ capabilities chưa chạy trên Appium thật trên Mac. Kiểm ở UAT-301.
- R-3-2: Build `.ipa`/`.app.zip` tải lên chỉ để lưu trữ; Appium trên Mac không đọc được `apps/` của Windows (ghi rõ trên UI và docs).
- R-3: receipt Gate 4 vẫn BLOCKED (checkout có thay đổi `.agents/` của phiên khác).
- Hồ sơ app và ID TC mới chưa được QA view đếm theo nền tảng (backlog UX §6.4).

**Việc Owner cần làm khi có Mac**: làm checklist `docs/IOS_NATIVE_TESTING.md` §1 (bước 1–10; thêm 11–14 nếu dùng iPhone thật), rồi §4 (UAT-301), ghi kết quả AC-305/UAT-301 vào bảng trên.
