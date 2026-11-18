# Phase 1 — Android MVP trên Dashboard

> **Tác giả Nghiệp vụ / Kỹ thuật:** @claude (phiên 2026-11-19) · **Research:** Không áp dụng
> **Cấp độ:** L3 · **Trạng thái:** `DONE` (2026-11-19)

---

## A. Nghiệp Vụ

### A1. Mục Tiêu & Phạm Vi Phase
- **In-Scope:** view `mobile-view`; liệt kê thiết bị Android (`adb devices -l`); kiểm tra môi trường (adb, ANDROID_HOME, Java, Appium, UiAutomator2); chọn app (APK trong `apps/` hoặc package đã cài); chọn file test + tag; chạy/dừng; log trực tiếp; kết quả từng test; ảnh bằng chứng.
- **Out-of-Scope:** upload APK, lịch sử lượt chạy, JUnit, iOS, Inspector (P2–P4).
- **UI:** yes

### A2. Yêu Cầu & Quy Tắc
- `REQ-01` Chạy `tests/native/android/**/*.native.js` từ UI, kết quả tương đương `npx wdio run ./wdio.android.conf.js`.
- `BR-01` Một thời điểm chỉ một lượt chạy (Playwright hoặc Mobile).
- `BR-02` Chỉ chạy được spec/APK có trong danh mục server trả về.

### A3. User Flow
- Happy: mở Tiện ích → Mobile App → chọn thiết bị → chọn app → chọn test/tag → Chạy → xem log, kết quả, ảnh.
- Lỗi: chưa có thiết bị / thiếu APK / chưa nhập package / chưa chọn test → nút Chạy khoá, dòng gợi ý nêu lý do.

### A4. Trạng Thái Biên
- `EDGE-01` adb không có trong PATH → thông báo cài Platform Tools.
- `EDGE-02` Thiết bị `unauthorized`/`offline` → thẻ khoá, kèm hướng dẫn.
- `EDGE-03` Phản hồi về muộn khi chuyển view → bỏ qua (bộ đếm thế hệ `_gen`).
- `EDGE-04` Không cài `@wdio/cli` → `503` + "chạy npm install".

### A5. Tiêu Chí Nghiệm Thu
- `AC-01` Given máy thật đã cắm When bấm Chạy với app hợp lệ Then trạng thái `running → passed/failed`, kết quả từng test hiện đúng.
- `AC-02` (BR-01) Given đang có lượt Mobile When gọi `/api/run`, `/api/ui`, `/api/mobile/run` Then cả ba trả `409`.
- `AC-03` Given đang chạy When bấm Dừng Then trạng thái `stopped`, không còn tiến trình WDIO/Appium, cổng 4723 trống.
- `AC-04` (BR-02) Given input xấu (spec ngoài danh mục, tag có ký tự shell, package sai, APK ngoài `apps/`) Then `400`, không tiến trình nào được tạo.

### A6. UAT
- `UAT-01` QA cắm điện thoại, chọn app Máy tính đã cài, chạy `app-launch.native.js` → 3/3 Đạt, thấy ảnh màn hình app. Truy vết: REQ-01, AC-01.

---

## B. Kỹ Thuật

### B1. Quyết Định
- `TECH-01` Spawn `node node_modules/@wdio/cli/bin/wdio.js` (không `npx`, không shell) để đáp ứng REQ-01 mà không ghép chuỗi vào shell (BR-02). Tìm file trực tiếp vì package `exports` chặn `require.resolve`.
- `TECH-02` Truyền app/thiết bị qua biến môi trường (`ANDROID_UDID`, `ANDROID_APP_PATH`, `ANDROID_APP_PACKAGE`, `ANDROID_APP_ACTIVITY`, `ANDROID_NO_RESET`) để `core/native/androidCapabilities.js` giữ nguyên, vì REQ-01 yêu cầu kết quả tương đương CLI.
- `TECH-03` Kết quả lấy từ dòng `✓/✖` của spec reporter; SSE dùng chung `/api/events` với type `mobile_status`, `mobile_log`, vì để hiện kết quả từng test (REQ-01) không cần thêm reporter mới.
- `TECH-04` Dừng trên Windows bằng `taskkill /T /F` để giết cả cây (WDIO worker + Appium), vì BR-01 cần giải phóng khoá và cổng 4723 ngay.
- `TECH-05` Tab nằm trong menu **Tiện ích**, vì thêm tab cấp cao làm thanh điều hướng tràn ở 1280px (REQ-01 phải dùng được ở mọi viewport).

### B2. Bản Đồ File
| Path | Loại | Thao tác | Dòng |
|---|---|:---:|:---:|
| `dashboard/services/mobileDeviceService.js` | Service | Tạo | 101 |
| `dashboard/services/mobileSpecService.js` | Service | Tạo | 86 |
| `dashboard/services/mobileRunOptions.js` | Service | Tạo | 78 |
| `dashboard/services/mobileRunnerService.js` | Service | Tạo | 149 |
| `dashboard/routes/mobileRoutes.js` | Route | Tạo | 58 |
| `dashboard/public/js/views/mobile/{mobileSlice,mobileView,mobileForm,mobileRender}.js` | Module | Tạo | 166/50/52/147 |
| `dashboard/public/templates/mobile.html`, `styles/views/mobile.css` | Template/CSS | Tạo | — |
| `server.js`, `runnerRoutes.js`, `main.js`, `templateLoader.js`, `tabRouter.js`, `index.html`, `styles.css` | Wiring | Sửa | +1..+7 |

### B3. Contract
| Method | Path | Mã |
|---|---|---|
| GET | `/api/mobile/catalog?platform=android` | 200, 400 (platform lạ) |
| GET | `/api/mobile/devices` | 200 (`available=false` + `error` khi adb lỗi) |
| GET | `/api/mobile/doctor` | 200 |
| GET | `/api/mobile/state` | 200 |
| POST | `/api/mobile/run` | 202, 400, 403 (freeze), 409, 503 |
| POST | `/api/mobile/stop` | 202, 409 |

### B4. Dependencies
- Không có.

`@wdio/*` 9.32.0 đã có sẵn trong `package.json`.

### B5. NFR
- Log giữ tối đa 600 khối ở server, 200 KB ở trình duyệt. Không chèn dữ liệu bằng `innerHTML`.

### B6. Rủi Ro
- UiAutomator2 trên một số ROM (OPPO Settings) không trả page source → test timeout. Không phải lỗi Dashboard; nút Dừng xử lý được.

---

## C. Ma Trận Kiểm Thử
| AC | TC | Mức | File | Ghi chú |
|---|---|:---:|---|---|
| AC-01 | TC-1.1 | e2e (máy thật) | thủ công qua UI + CLI đối chiếu | 3/3 Đạt |
| AC-02 | TC-1.2 | integration | gọi API khi đang chạy | 3 × 409 |
| AC-03 | TC-1.3 | e2e | nút Dừng + `Get-NetTCPConnection 4723` | — |
| AC-04 | TC-1.4 | unit + integration | `dashboard/services/mobileServices.test.js`, `tests/dashboard-api/mobile.test.js` | 13 ca biên |

## D. Phạm Vi Dev Tự Quyết
- Tách module frontend, tên class CSS `mobile-*`, nội dung câu gợi ý.

## E. Câu Hỏi Mở
- 0 câu hỏi chặn.

## F. Tiêu Chí Ra Phase
- [x] AC-01..04 đạt có bằng chứng.
- [x] UAT-01 đạt trên máy thật.
- [x] `check:framework`, `check-code-limits --strict`, `verify-dashboard-features` đạt.

## G. Soát Chéo
- BA/TL cùng một phiên; review độc lập thực hiện ở đầu session P2.

## H. Nhật Ký Thay Đổi (PDR)
| PDR | Loại | Plan gốc | Thực tế | Ảnh hưởng | Trạng thái |
|---|:---:|---|---|---|:---:|
| PDR-1-01 | TECH | Tab cấp cao cạnh "Chạy test" | Đưa vào menu Tiện ích | `index.html` | APPROVED |
| PDR-1-02 | BUSINESS | Chọn build từ thư viện | Thêm chế độ "App đã cài" (package/activity) | Form khung 2 | APPROVED |

## I. Bằng Chứng
- Máy thật OPPO CPH2481 (Android 15), app `com.coloros.calculator`: Dashboard 3/3 Đạt trong 44.6 s, có ảnh `app_launch_foreground_*.png`; CLI cùng tham số 3/3 Đạt.
- `node --test dashboard/services/mobileServices.test.js`: 24/24. `node --test tests/dashboard-api/mobile.test.js`: 13/13. `node --test "dashboard/**/*.test.js"`: 160/160.
- Khoá chạy: `/api/run`, `/api/ui`, `/api/mobile/run` đều 409 khi đang chạy. Dừng: trạng thái `stopped`, cổng 4723 trống.
- UI: 1920/1440/1280/390 × dark/light, không tràn ngang, không lỗi console; 20 vòng runner↔mobile giữ nguyên 9 listener.
- Lỗi có sẵn ngoài phạm vi: `tests/dashboard-api/master-process.test.js` (`/api/mp/status` = `DRIFT_DETECTED`); thanh điều hướng 1280px "Tiện ích" đè ô Token.
