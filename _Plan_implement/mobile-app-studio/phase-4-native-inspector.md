# Phase 4 — Native Inspector & sinh Page Object

> **Tác giả Nghiệp vụ / Kỹ thuật:** @claude (phiên 2026-11-19) · **Research:** Không áp dụng
> **Cấp độ:** L3 · **Phụ thuộc:** Phase 3 · **Trạng thái:** `DONE` (Android; iOS trên máy Mac thật `BLOCKED (chờ Mac)`)

**Bước 0 bắt buộc của session:** rà soát lại Phase 3 theo §F của [phase-3-ios-remote-mac.md](phase-3-ios-remote-mac.md), sửa nếu thiếu, ghi kết quả vào §I của file này.

---

## A. Nghiệp Vụ

### A1. Mục Tiêu & Phạm Vi
- **In-Scope:**
  1. Mở **phiên Inspector** trên thiết bị và app đang chọn ở chế độ Chạy test (Android; iOS khi có Mac), không cần Appium Inspector riêng. Mobile App có thanh chế độ **Chạy test | Inspector** (PDR-4-06).
  2. Hiện **ảnh màn hình** + **cây phần tử** (page source) cạnh nhau; bấm lên ảnh chọn phần tử nhỏ nhất tại điểm đó, bấm trên cây thì khoanh vùng trên ảnh.
  3. Bảng thuộc tính phần tử + **gợi ý locator** theo thứ tự ưu tiên, dùng đúng tiền tố của `core/native/locators.js`: `id:` (resource-id) / `~` (accessibility id) → `uia:` (hoặc iOS `pred:` / `chain:`) → `text:` → `xpath:` tương đối. Mỗi gợi ý có số phần tử khớp (1 = tốt), đếm bằng đúng chiến lược Screen sẽ dùng khi chạy.
  4. Thao tác điều hướng app: chạm, nhập chữ, Back, làm mới ảnh.
  5. Gom phần tử đã chọn thành **Screen dùng chung** (UX §4.3, I-02): Screen mới `pages/native/screens/<Tên>Screen.js` có `static locators = { ten: { android, ios } }`, hoặc ghi **ô của nền tảng đang mở** vào Screen có sẵn (ô nền tảng kia giữ nguyên). Nháp ở `.dashboard-drafts/pages/native/screens/`, xem trước và sửa bằng editor dùng chung, rồi **Tạo** (PDR-4-01).
- **Out-of-Scope:** ghi lại thao tác thành spec (recorder native); UX §6.3 I-01, I-03, I-04, I-05 (PDR-4-05) — để backlog.
- **UI:** yes

### A2. Yêu Cầu & Quy Tắc
- `REQ-401` Inspector dùng chung khoá chạy (X-02): đang có lượt test thì không mở được, và ngược lại.
- `REQ-402` Phiên tự đóng sau 10 phút không thao tác hoặc khi rời view.
- `BR-401` Screen nháp không được ghi vào `pages/` cho tới khi người dùng bấm Tạo; tên file/class làm sạch (`<Tên>Screen`, chữ Latin).
- `BR-402` Locator sinh ra dùng tiền tố mà `NativeBasePage.el()` dịch sang đúng các hàm có sẵn (`id:` ≙ `byId`, `~` ≙ `byAccessibilityId`, `text:` ≙ `byText`…); gợi ý hiện kèm dòng code tương ứng (PDR-4-01).

### A3. User Flow
- Mobile App → (chế độ Chạy test: chọn thiết bị + hồ sơ app) → chế độ **Inspector** → Bắt đầu → ảnh + cây phần tử hiện ra → chọn phần tử → chọn locator → "Thêm vào Screen" (tên + loại hàm) → Ghi vào Screen mới / Screen có sẵn → Xem trước → Tạo.
- Lỗi: thiết bị rớt kết nối / Appium lỗi → phiên đóng, thông báo, không giữ khoá.

### A4. Trạng Thái Biên
- `EDGE-401` Page source rất lớn (> 2 MB) → vẫn render, cây thu gọn mặc định.
- `EDGE-402` Bấm vào vùng không có phần tử → không chọn gì, không lỗi.
- `EDGE-403` Mở 2 tab cùng Inspector → tab sau nhận `409`.
- `EDGE-404` Tên Screen trùng file có sẵn → không ghi đè; UI khoá nút Tạo và gợi ý chọn "Screen có sẵn" (chỉ thêm/cập nhật locator của nền tảng đang mở), API trả `409`.

### A5. Tiêu Chí Nghiệm Thu
- `AC-401` Given máy Android thật When Bắt đầu Inspector Then ≤ 60 s có ảnh + cây phần tử.
- `AC-402` (BR-402) Given chọn một nút có `resource-id` Then gợi ý đầu tiên là `byId('<id>')` với số khớp = 1.
- `AC-403` (BR-401) Given đã thêm ≥ 3 phần tử When Tạo Screen Then file mới trong `pages/native/screens/` qua `npm run check:framework` và dùng được trong một spec chạy đạt (PDR-4-01).
- `AC-404` Given phiên Inspector đang mở When gọi `/api/mobile/run` hoặc `/api/run` Then `409`; khi đóng phiên thì chạy được.
- `AC-405` Given không thao tác 10 phút Then phiên tự đóng, session Appium bị xoá.

### A6. UAT
- `UAT-401` QA mở Inspector trên app Vieclam24h.QA (`com.vieclam24h.qa`, App đã cài, noReset), chọn các phần tử của một màn chỉ đọc (màn đầu, danh sách việc làm), tạo `JobListScreen`, viết spec ngắn dùng Screen đó và chạy đạt từ Dashboard. Không đăng nhập, không ứng tuyển, không tạo dữ liệu (PDR-4-02). Truy vết: REQ-401, AC-401..403.

---

## B. Kỹ Thuật

### B1. Quyết Định
- `TECH-401` Server nói chuyện trực tiếp với Appium qua WebDriver HTTP (`POST /session`, `GET /screenshot`, `GET /source`, `POST /elements`, `DELETE /session`) bằng `fetch`, không chạy WDIO, vì phiên tương tác cần giữ lâu và đóng chủ động (REQ-402).
- `TECH-402` Android: Appium tự khởi động như P1 (`appium` CLI, cổng 4723) nếu chưa chạy; iOS: dùng Mac host P3, để REQ-401 dùng chung khoá và hạ tầng đã có.
- `TECH-403` Parse XML page source ở trình duyệt bằng `DOMParser`; toạ độ từ `bounds` (Android) / `x,y,width,height` (iOS), vì để BR-402 gợi ý locator cần đủ thuộc tính gốc.
- `TECH-404` Sinh Page Object từ template chung + lưu nháp qua cơ chế `.dashboard-drafts/` sẵn có, để tuân thủ BR-401 (không ghi vào `pages/` khi chưa xác nhận).

### B2. Bản Đồ File (thực tế, PDR-4-04)
| Path | Loại | Thao tác | Trần |
|---|---|:---:|:---:|
| `dashboard/services/mobileInspectorService.js` | Service | Tạo (phiên, khoá, tự đóng) | 160 |
| `dashboard/services/mobileInspectorCommands.js` | Service | Tạo (snapshot, find, action) | 160 |
| `dashboard/services/mobileInspectorTarget.js` | Service | Tạo (capabilities + địa chỉ Appium) | 160 |
| `dashboard/services/mobileAppiumClient.js` | Service | Tạo (WebDriver HTTP, bật/tắt Appium cục bộ) | 160 |
| `dashboard/services/nativePageObjectGenerator.js` | Service | Tạo (preview/draft/create/merge, danh sách Screen) | 160 |
| `core/native/locatorSuggest.js`, `core/native/screenSource.js` | Module | Tạo (gợi ý locator; đọc/ghi `static locators`) | 200 |
| `core/native/locators.js` (`toWebDriverQuery`), `core/native/androidCapabilities.js` (nhận `env`) | Module | Sửa | 200 |
| `dashboard/routes/mobileInspectorRoutes.js` | Route | Tạo (gọi từ `mobileRoutes.js`) | 160 |
| `dashboard/routes/mobileRoutes.js`, `runnerRoutes.js`, `dashboard/server.js` | Route | Sửa (khoá X-02, tắt server chờ đóng phiên) | — |
| `dashboard/public/js/views/mobile/inspector{Slice,Tree,View,Screen,Events}.js` | Module | Tạo | 200/file |
| `dashboard/public/js/views/mobile/{mobileSlice,mobileLive,mobileForm,mobileRender}.js`, `templates/mobile.html`, `styles/views/mobile-inspector.css` | Module | Sửa/Tạo | 200 |
| `tests/dashboard-api/mobile-inspector.test.js` (fake Appium), unit cạnh service | Test | Tạo | — |
| `pages/native/screens/JobListScreen.js`, `tests/native/shared/job-list/job-list.native.js`, `requirements/` + `test-cases/REQ-102-vieclam24h-job-list.md` | POM/Spec | Tạo (UAT-401) | 200 |

### B3. Contract (PDR-4-03)
Mỗi tab tự sinh `key`; mọi lệnh trong phiên gửi kèm `key` (tab khác nhận `409`).

| Method | Path | Mã |
|---|---|---|
| GET | `/api/mobile/inspector/state` | 200 (`active`, `ready`, `platform`, `device`, `app`, `expiresAt`) |
| POST | `/api/mobile/inspector/start` (`key` + trường thiết bị/app như `/api/mobile/run`) | 201, 400, 409, 503 |
| GET | `/api/mobile/inspector/snapshot?key=` | 200 (`screenshot` base64, `source` xml, `window`), 400, 404, 409, 503 (mất kết nối → phiên đóng) |
| POST | `/api/mobile/inspector/find` (`{locator}` → `count`; `{element}` → `name`, `suggestions[]` có `count`) | 200, 400, 404, 409 |
| POST | `/api/mobile/inspector/action` (`tap` x,y / `type` locator,text / `back`) | 200, 400, 404, 409 |
| POST | `/api/mobile/inspector/stop` | 200, 404, 409 |
| GET | `/api/mobile/inspector/screens` | 200 (Screen có sẵn, locator, ô còn thiếu theo nền tảng) |
| POST | `/api/mobile/inspector/page-object` (`mode`: preview / draft / create, `merge`, `source`) | 200, 201, 400, 409 |

### B4. Dependencies
- Không có.

### B5. NFR
- Snapshot ≤ 3 s trên máy thật thông thường. Ảnh không lưu ra đĩa trừ khi người dùng bấm lưu.

### B6. Rủi Ro
- Session Appium mồ côi khi server tắt → `shutdown()` gọi `DELETE /session` và dừng Appium.
- XPath sinh tự động dễ gãy → luôn đặt XPath cuối danh sách, cảnh báo khi chỉ có XPath.

---

## C. Ma Trận Kiểm Thử
| AC | TC | Mức | File | Ca biên |
|---|---|:---:|---|---|
| AC-401 | TC-4.1 | e2e máy thật | thủ công qua UI | — |
| AC-402 | TC-4.2 | unit + integration | `core/native/locatorSuggest.test.js`, `mobile-inspector.test.js` | không id, trùng id, text/desc dài, dấu nháy, iOS |
| AC-403 | TC-4.3 | unit + integration + e2e | `nativePageObjectGenerator.test.js`, `mobile-inspector.test.js` + chạy spec | tên trùng, ký tự lạ, Screen viết tay, mã sửa lỗi cú pháp |
| AC-404 | TC-4.4 | integration | `tests/dashboard-api/mobile-inspector.test.js` | 409 hai chiều |
| AC-405 | TC-4.5 | unit (đồng hồ giả) | `mobileInspectorService.test.js` | — |

## D. Phạm Vi Dev Tự Quyết
- Bố cục ảnh/cây (2 cột hay tab trên mobile), màu khoanh vùng, cách thu gọn cây.

## E. Câu Hỏi Mở
- 0 câu hỏi chặn.

## F. Tiêu Chí Ra Phase
- [x] Bước 0: rà soát P3 ghi vào §I (sửa 1 lỗi nhỏ P3, 1 lỗi P2 lộ ra ở P4).
- [x] AC-401..405 đạt (phần iOS `BLOCKED (chờ Mac)`); UAT-401 đạt trên Android thật.
- [x] Đủ test + kiểm tra như X-05 của overview; UI 4 kích thước × 2 theme.
- [x] Cập nhật overview, commit và push lên `main`.

## G. Soát Chéo
- Review độc lập P4 ở một session riêng sau khi xong.

## H. Nhật Ký Thay Đổi (PDR)
| PDR | Loại | Plan gốc | Thực tế | Ảnh hưởng | Trạng thái |
|---|:---:|---|---|---|:---:|
| PDR-4-01 | BUSINESS | §A1 mục 5, BR-401/402, AC-403: Page Object `pages/native/<platform>/` theo `NativeBasePage`, nháp `.dashboard-drafts/pages/native/<platform>/` | Theo cấu trúc P3 (PDR-3-01) và UX I-02: Screen dùng chung `pages/native/screens/<Tên>Screen.js` với `static locators = { ten: { android, ios } }`. Inspector chỉ ghi ô của nền tảng đang mở; Screen có sẵn được **gộp** (thêm/cập nhật locator), không bao giờ ghi đè cả file. Nháp ở `.dashboard-drafts/pages/native/screens/` (thư mục con, không lẫn với nháp Page Object web). Locator dùng tiền tố mà `NativeBasePage.el()` dịch sang `byId`/`byAccessibilityId`/`byText`; gợi ý hiện kèm dòng code đó. Screen sinh sẵn `waitUntilLoaded()` (chờ phần tử "kiểm tra hiển thị" đầu tiên) và hàm theo loại phần tử: `tapX`, `fillX`, `xText`, `isXVisible`. Screen viết tay không theo mẫu một dòng/locator thì từ chối gộp (400), không sửa hỏng | Không có class riêng theo nền tảng; ô iOS còn thiếu được báo ở UI | DONE |
| PDR-4-02 | BUSINESS | UAT-401: tạo `LoginPage` từ ô nhập + nút đăng nhập | Owner (qua phiên chính, 2026-11-20): dùng app Vieclam24h.QA, chỉ màn chỉ đọc, không nhập mật khẩu thật. UAT làm trên màn đầu: `JobListScreen` (5 phần tử) + `tests/native/shared/job-list/job-list.native.js` (TC-104, TC-105, `@sanity`, không vào `@smoke`), truy vết `requirements/` + `test-cases/REQ-102-vieclam24h-job-list.md`. Spec tự `skip` khi app đang test không phải `com.vieclam24h.qa` | Thao tác `type` chỉ kiểm bằng Appium giả, chưa thử trên app thật | DONE |
| PDR-4-03 | TECH | §B3 | Thêm `key` theo tab (EDGE-403; rời view ở tab B không đóng phiên của tab A); `GET /state`, `GET /screens`; `find` nhận `{element}` và trả gợi ý có số khớp (gợi ý tính ở server, `core/native/locatorSuggest.js`, test được bằng node); `page-object` có `mode` preview/draft/create, `merge`, `source` (mã đã sửa trong editor, kiểm cú pháp + tên class). 503 khi thiết bị/Appium mất kết nối (phiên đóng, nhả khoá). `/api/mobile/run` kiểm khoá Inspector **trước** khi validate body | Contract mở rộng, không đổi API cũ | DONE |
| PDR-4-04 | TECH | §B2 | Tách file để giữ trần (X-04): `mobileInspectorCommands.js`, `mobileInspectorTarget.js`, `mobileAppiumClient.js`, `core/native/screenSource.js`, 5 module front-end, `styles/views/mobile-inspector.css`. `buildAndroidCapabilities(env)` / `appiumConnection(env)` nhận `env` (mặc định `process.env`, WDIO không đổi); `locators.toWebDriverQuery`; `mobileRunOptions` export `validateAndroidTarget`. `server.js` shutdown chờ Inspector xoá phiên (tối đa 2 s) rồi mới thoát. Appium do Inspector bật ghi log `test-results/appium/inspector.log`; `newCommandTimeout` 660 s | Chỉ thêm | DONE |
| PDR-4-05 | BUSINESS | UX §6.3 đề xuất I-01..I-05 cho P4 | Làm **I-02**. Hoãn sang backlog: **I-01** (Page Manager lọc "App native", bảng Android/iOS — Page Manager nằm trong `app.js` legacy, cần module wrap + parser riêng), **I-03** (nút "Sửa locator" từ dòng lỗi — cần U-04 chi tiết lỗi trước), **I-04** (tạo spec từ mẫu `test-cases/`), **I-05** (Page Manager tạo đích native). Thay một phần I-01: Inspector liệt kê Screen có sẵn và các ô còn thiếu theo nền tảng. U-02/U-03/U-04/U-08 của §6.1 vẫn ở backlog | Viết spec mới vẫn cần IDE (spec UAT-401 viết tay) | DONE |
| PDR-4-06 | BUSINESS | §A3: Inspector ở khung 3 hoặc nút "Mở Inspector" | Thanh chế độ **Chạy test / Inspector** dưới hero; Inspector là workspace 3 khung riêng (01 ảnh + điều khiển · 02 cây + thuộc tính · 03 locator + Screen), vì khung 3 của Chạy test không đủ chỗ cho ảnh, cây và editor. Thiết bị/app lấy từ chế độ Chạy test. Nút Chạy test bị khoá kèm lý do khi Inspector mở (thay vì chờ server trả 409) | Đổi chế độ trong view không đóng phiên; rời view thì đóng | DONE |
| PDR-4-07 | TECH | Bước 0 / kiểm thử | Sửa 2 lỗi hiển thị: (1) iOS chưa khai báo thiết bị hiện hướng dẫn kiểu Android (USB debugging) — lỗi P3; (2) test bị `skip` hiện nhãn "Lỗi" ở khung kết quả — lỗi P2, lộ ra khi spec mới tự bỏ qua; nay "Bỏ qua" và dòng tổng "· N bỏ qua" | Chỉ hiển thị | DONE |

## I. Bằng Chứng

Môi trường: Windows 11, baseline `e8bfa78`, Node 22, WDIO 9.32.0, Appium 2.13.0 (global) + UiAutomator2, máy thật OPPO CPH2481 (Android 15, `6XPNHY9DVCUCR4OB`), app **Vieclam24h.QA** `com.vieclam24h.qa` / `com.vieclam24h.MainActivity`, "App đã cài", noReset. Không dùng `com.vieclam24h`, `com.vieclam24h.stag`, app Settings của OPPO. Không đăng nhập, không nhập liệu, không ứng tuyển: chỉ đóng hộp thoại lỗi "Không thể tải dữ liệu…" (nút "Thử lại sau") và đọc màn đầu. **Không có máy Mac**: phần iOS kiểm bằng Appium giả.

**Bước 0 — rà soát Phase 3 (§F của phase-3)**
- `node --test dashboard/services/mobile*.test.js core/native/*.test.js` → exit 0, 87/87. `node --test --test-concurrency=1 tests/dashboard-api/mobile*.test.js` → exit 0, 36/36. `verify-dashboard-features` → 15 view đủ mảnh, 17 nhóm route. `check:framework` → đạt (8 specs, 6 page objects). `check-code-limits --strict` → exit 0.
- UI với Appium giả (`127.0.0.1:4799`): Cấu hình → Mobile / iOS → Kiểm tra kết nối → "Kết nối được · Appium 2.11.3-fake · phản hồi 14 ms · Driver XCUITest: có"; Lưu → `.env` chỉ đổi dòng `IOS_*` (`diff` phần còn lại không đổi). Mobile App → iOS: khung 1 hiện Mac host, 4 mục kiểm tra, lệnh `npx wdio run ./wdio.ios.conf.js …`, nút Chạy khoá với lý do "Chưa khai báo thiết bị iOS…". Android: thấy CPH2481, đủ 5 mục kiểm tra; hồ sơ "Vieclam24h QA" → `@smoke` → Chạy → lượt `mwnv8dul` **3/3 Đạt**.
- Lỗi tìm thấy: iOS chưa có thiết bị lại hiện hướng dẫn "bật USB debugging" (của Android) → sửa (PDR-4-07). Không thấy lỗi khác của P3. `.env` của Owner khôi phục từ bản sao lưu sau khi thử.

**Kiểm thử tự động (sau khi xong P4)**

| Lệnh | Exit | Kết quả |
|---|:---:|---|
| `node --test dashboard/services/mobile*.test.js dashboard/services/nativePageObjectGenerator.test.js core/native/*.test.js` | 0 | 110/110 (87 cũ + 23 mới: Inspector session 7, target 3, generator 6, locatorSuggest 7) |
| `node --test --test-concurrency=1 tests/dashboard-api/mobile*.test.js` | 0 | 45/45 (36 cũ + 9 `mobile-inspector.test.js`, Appium giả) |
| `node scripts/verify-dashboard-features.js` | 0 | 15 view đủ mảnh, 17 nhóm route |
| `npm run check:framework` | 0 | 8 specs, 7 page objects (thêm `JobListScreen`) |
| `node scripts/check-code-limits.js --strict` | 0 | 29 file, 0 cảnh báo vùng vàng |
| `npm run test:unit` | 1 | 744/748. 4 lỗi có sẵn, giống baseline P2/P3 (`htmlSummaryReporter`, `learner` L01/L02, `learnerSecurityGit` L16) |
| `npm run test:dashboard:api` | 1 | 240/242. 2 lỗi có sẵn, giống baseline P2/P3 (`master-process` status, `qa-spec-studio` TC-24-02) |

**Ma trận AC**

| AC | TC | Kết quả | Bằng chứng |
|---|---|:---:|---|
| AC-401 | TC-4.1 | ĐẠT | UI trên CPH2481: bấm Bắt đầu → ảnh 1080×2400 + cây 78 phần tử sau **12,3 s** (lần 2: 12,1 s; lần 3: 18,1 s gồm 4 s chờ). Appium do Dashboard tự bật (`test-results/appium/inspector.log`). Ảnh đầu tiên có thể trắng khi app chưa vẽ xong; bấm Làm mới là có màn đầy đủ |
| AC-402 | TC-4.2 | ĐẠT | Máy thật: `ScrollView list-jobs` → gợi ý đầu `id:list-jobs` · `this.byId('list-jobs')` · **1 khớp**; `ic-notification` → `id:ic-notification` 1 khớp; `item-job-card` → `id:` **4 khớp** (trùng id) và gợi ý khớp 1 nằm sau; XPath luôn cuối. Unit: thứ tự id → accessibility → UiSelector → text → XPath, không id, text/desc dài, dấu nháy, iOS. API: `find` với Appium giả trả `[id 1, uiautomator 2, text 2, xpath 3]` |
| AC-403 | TC-4.3 | ĐẠT | UI: chọn 5 phần tử (`retryLaterButton ~Thử lại sau`, `jobList id:list-jobs`, `searchPlaceholder`, `nearbyJobsTitle`, `notificationIcon id:ic-notification`, đều 1 khớp) → tên "JobList" → Xem trước (editor dùng chung, Prism 223 token) → sửa trong editor thêm `dismissErrorDialogIfShown()` → Tạo → `pages/native/screens/JobListScreen.js`, nháp bị xoá, `check:framework` 7 page objects. Spec dùng Screen chạy đạt (UAT-401). EDGE-404: tên "JobList" lần 2 → UI khoá Tạo + "Tên này đã có. Chọn Screen có sẵn…"; "Screen có sẵn" → "Ghi vào ô Android của …JobListScreen.js. Còn thiếu iOS: …". Unit/API: 409 khi trùng, gộp iOS giữ ô Android, Screen viết tay bị từ chối gộp, mã lỗi cú pháp 400 |
| AC-404 | TC-4.4 | ĐẠT | API: Inspector mở → `/api/run`, `/api/ui`, `/api/mobile/run` đều 409 ("Inspector đang mở…"); lượt Mobile đang chạy → `start` 409; đóng phiên → `/api/run` tới bước validate (400), `/api/mobile/run` 400. UI: khi Inspector mở, nút Chạy test khoá kèm "Inspector đang mở. Đóng phiên Inspector trước khi chạy test." |
| AC-405 | TC-4.5 | ĐẠT (unit, đồng hồ giả) | `mobileInspectorService.test.js`: 9 phút + 1 lệnh + 9 phút vẫn mở; thêm 1 phút → phiên đóng, `DELETE /session/s1`, Appium do Dashboard bật bị tắt, khoá nhả. Không chờ 10 phút thật trên máy; `newCommandTimeout` 660 s để Appium không tự đóng trước |
| UAT-401 | | ĐẠT (Android) | Như AC-403, rồi Mobile App → hồ sơ "Vieclam24h QA" → chỉ chọn `job-list.native.js` → Chạy → lượt **`mwnw0u74` 2/2 Đạt** (TC-104, TC-105, 14 s). Ảnh `evidence/native/android/mwnw0u74/TC-104_job_list_job_list_*.png` là màn "Khám phá" đầy đủ (không còn màn trắng như ghi chú P3, nhờ `waitUntilLoaded`). JUnit `test-results/native/android/junit-mwnw0u74.xml`. Cùng spec với hồ sơ Calculator → lượt `mwnw1pz1`: 2 test `skipped`, exit 0 |
| iOS Inspector | | **BLOCKED (chờ Mac)** | Unit: yêu cầu iOS → capabilities XCUITest, gửi tới Mac host trong `.env`, không bật Appium cục bộ; thiết bị chưa khai báo / thiếu Mac host → 400. Chạy thật cần Mac |

**Vòng đời phiên (không mồ côi)**
- Đóng phiên bằng nút → `DELETE /session … 200` trong log Appium, cổng 4723 không còn LISTEN.
- Rời view (sang Cấu hình) khi phiên đang mở → `state.active=false`, `DELETE /session … 200`, Appium tắt (REQ-402).
- Tải lại trang khi phiên mở → `pagehide` gửi beacon `stop` → phiên đóng, Appium tắt.
- Tắt server: API test gọi `/api/shutdown` khi phiên mở → Appium giả nhận `DELETE /session/s2` trước khi tiến trình thoát. Khi tiến trình bị kill cứng (dừng preview), Appium con chết theo cây tiến trình (cổng 4723 trống); phiên trên thiết bị không được `DELETE` trong trường hợp này.
- Thiết bị/Appium mất kết nối → 503 "Phiên Inspector đã đóng…", khoá nhả (unit).

**UI** (Mobile App chế độ Chạy test và Inspector với phiên thật, phần tử đang chọn, editor mở) ở 1920×1080, 1440×900, 1280×800, 390×844 × light/dark: script kiểm 0 px cuộn ngang, 0 control tràn màn hình, không chữ `undefined`/`NaN`/`TODO`/`[object` (chữ `null` chỉ có trong mã Screen, đúng nghĩa ô iOS trống). Khung khoanh vùng tính lại khi đổi kích thước. 20 vòng Mobile App ↔ Cấu hình (xen kẽ đổi chế độ Inspector): số listener ròng không đổi (0 sau mỗi vòng), 0 lỗi JS. Console sau khi tải lại: 0 lỗi (các `ERR_CONNECTION_*` trước đó là lúc khởi động lại server). Log server: 0 lỗi. Lỗi tìm và sửa trong lúc kiểm: dòng đang chọn trong cây không được tô (truyền sai tên trường), test `skipped` hiện "Lỗi" (PDR-4-07), `waitUntilLoaded` chờ nút của hộp thoại thay vì danh sách, content-desc dài (dữ liệu việc làm) bị gợi ý làm accessibility id.

**Rủi ro còn lại**
- R-4-1: iOS Inspector (XCUITest, tọa độ theo point, không có Back) chưa chạy trên Mac thật — kiểm cùng UAT-301.
- R-4-2: Thao tác "Nhập" chỉ kiểm bằng Appium giả (không nhập liệu trên app thật theo yêu cầu Owner).
- R-4-3: AC-405 kiểm bằng đồng hồ giả, chưa chờ 10 phút thật.
- R-4-4: Khi Dashboard bị kill cứng (không qua `/api/shutdown` hay Ctrl+C), phiên UiAutomator2 trên máy không được `DELETE`; Appium vẫn chết theo. Lần mở sau tạo phiên mới bình thường.
- R-3 (receipt Gate 4) vẫn BLOCKED: `record-gate-run.py` cần working tree sạch, checkout còn thay đổi `.agents/skills/` của phiên khác.
- Backlog UX: I-01, I-03, I-04, I-05 (PDR-4-05), U-02/U-03/U-04/U-08.

