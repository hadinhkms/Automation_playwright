# Phase 3 — iOS qua Mac host từ xa (cài đặt sẵn, chờ máy Mac)

> **Tác giả Nghiệp vụ / Kỹ thuật:** @claude (phiên 2026-11-19) · **Research:** Không áp dụng
> **Cấp độ:** L3 · **Phụ thuộc:** Phase 2 · **Trạng thái:** `TODO`
> **Quyết định Owner (2026-11-19):** làm sẵn toàn bộ phần cài đặt bây giờ; máy Mac cung cấp sau. Mọi bước cần Mac thật được đánh dấu `BLOCKED (chờ Mac)`, không được báo là đạt.

**Bước 0 bắt buộc của session:** rà soát lại Phase 2 theo §F của [phase-2-builds-and-reports.md](phase-2-builds-and-reports.md), sửa nếu thiếu, ghi kết quả vào §I của file này.

---

## A. Nghiệp Vụ

### A1. Mục Tiêu & Phạm Vi
- **In-Scope:**
  1. Cấu hình **Mac host** trong Cấu hình hệ thống → mục "Mobile / iOS": địa chỉ Appium trên Mac, cổng, danh sách thiết bị iOS (tên, UDID, phiên bản iOS, simulator hay máy thật), thông tin ký WebDriverAgent cho máy thật (Team ID, bundle id), đường dẫn app trên Mac.
  2. Nút **Kiểm tra kết nối**: gọi `GET http://<mac>:<port>/status`, báo phiên bản Appium, driver XCUITest có sẵn hay không, thời gian phản hồi.
  3. Framework: `wdio.ios.conf.js` (Appium **bên ngoài**, không tự khởi động), `core/native/iosCapabilities.js`, `pages/native/ios/`, spec mẫu `tests/native/ios/app-launch.native.js`.
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
| `pages/native/ios/AppLaunchPage.js`, `tests/native/ios/app-launch.native.js` | POM/Spec | Tạo | 200 |
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
| AC-303 | TC-3.4 | unit | `mobileIosService.test.js` | file://, khoảng trắng, `;` |
| AC-304 | TC-3.5 | unit | `mobileServices.test.js` (nhánh iOS) | sim / máy thật |
| AC-305 | TC-3.6 | e2e | máy Mac thật | `BLOCKED (chờ Mac)` |

## D. Phạm Vi Dev Tự Quyết
- Cách nhập danh sách thiết bị (bảng hay JSON), vị trí mục cấu hình trong Settings.

## E. Câu Hỏi Mở
- 0 câu hỏi chặn.
- Khi có Mac: Owner cung cấp IP/tên máy, simulator hay iPhone thật, Team ID nếu chạy máy thật.

## F. Tiêu Chí Ra Phase
- [ ] Bước 0: rà soát P2 ghi vào §I.
- [ ] AC-301..304 đạt có bằng chứng; AC-305/UAT-301 ghi `BLOCKED (chờ Mac)`.
- [ ] Đủ test + kiểm tra như X-05 của overview; UI 4 kích thước × 2 theme.
- [ ] Cập nhật overview, commit và push lên `main`.

## G. Soát Chéo
- Rà soát độc lập ở đầu session P4.

## H. Nhật Ký Thay Đổi (PDR)
| PDR | Loại | Plan gốc | Thực tế | Ảnh hưởng | Trạng thái |
|---|:---:|---|---|---|:---:|

## I. Bằng Chứng
_(Điền khi thực thi)_
