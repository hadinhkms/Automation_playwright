# Phase 2 — Thư viện build, lịch sử lượt chạy & báo cáo

> **Tác giả Nghiệp vụ / Kỹ thuật:** @claude (phiên 2026-11-19) · **Research:** Không áp dụng
> **Cấp độ:** L3 · **Phụ thuộc:** Phase 1 · **Trạng thái:** `DONE`

**Bước 0 bắt buộc của session:** rà soát lại Phase 1 theo §F của [phase-1-android-mvp.md](phase-1-android-mvp.md) (chạy lại test, mở UI, sửa nếu sai), ghi kết quả rà soát vào §I của file này trước khi code P2.

---

## A. Nghiệp Vụ

### A1. Mục Tiêu & Phạm Vi
- **In-Scope:**
  1. Tải APK lên từ Dashboard (kéo thả hoặc chọn file), xoá build, hiện tên package/version nếu đọc được.
  2. Lưu **lịch sử lượt chạy Mobile** (tối thiểu 30 lượt gần nhất): thời điểm, thiết bị, app, spec, tag, kết quả, thời lượng, ảnh.
  3. Reporter **JUnit** cho WDIO, test ID ổn định `classname.name`, ghi vào `test-results/native/<platform>/junit-*.xml`.
  4. View **Báo cáo** có nhóm "Mobile": danh sách lượt chạy + ảnh bằng chứng native.
  5. View **Test Suites** nhận nền tảng `android-native`: suite chứa spec native, nút Chạy suite gọi Mobile runner.
- **Out-of-Scope:** iOS (P3), Inspector (P4), chạy song song nhiều thiết bị.
- **UI:** yes

### A2. Yêu Cầu & Quy Tắc
- `REQ-201` Upload chỉ nhận `.apk` (P3 mở rộng `.ipa`, `.app.zip`), tối đa 300 MB, lưu vào `apps/` (đã gitignore).
- `REQ-202` Lịch sử lượt chạy còn lại sau khi khởi động lại Dashboard.
- `REQ-203` Mỗi lượt chạy sinh 1 file JUnit dùng được cho `python .master_process/scripts/record-gate-run.py`.
- `BR-201` Không ghi đè build trùng tên khi chưa xác nhận trong UI; không xoá build đang được lượt chạy dùng.
- `BR-202` Tên file làm sạch: chỉ `[A-Za-z0-9._-]`, không đường dẫn, không file ẩn.

### A3. User Flow
- Upload: khung 1 → "Tải build lên" → chọn file → thanh tiến độ → build xuất hiện, được chọn sẵn ở khung 2.
- Báo cáo: Báo cáo → nhóm Mobile → bấm một lượt → xem kết quả, ảnh, tải JUnit.
- Suite: Test Suites → tạo suite nền tảng Android native → chọn spec → Chạy → chuyển sang Mobile App với lượt đang chạy.
- Lỗi: file sai đuôi / quá lớn / trùng tên / mất mạng giữa chừng → thông báo rõ, không để file dở trong `apps/`.

### A4. Trạng Thái Biên
- `EDGE-201` Upload bị huỷ giữa chừng → xoá file tạm `.part`.
- `EDGE-202` Hai tab cùng upload một tên → tab sau nhận `409`.
- `EDGE-203` Lịch sử hỏng JSON → bỏ qua bản ghi lỗi, không làm sập view.
- `EDGE-204` Lượt chạy dừng giữa chừng → vẫn ghi lịch sử với trạng thái `stopped`.

### A5. Tiêu Chí Nghiệm Thu
- `AC-201` (BR-202) Given file `app.apk` 50 MB When tải lên Then `201`, file nằm trong `apps/`, xuất hiện ở danh mục.
- `AC-202` Given file `x.exe` hoặc > 300 MB hoặc tên `../a.apk` Then `400`/`413`, không có file nào được ghi.
- `AC-203` (BR-201) Given build đang được lượt chạy dùng When xoá Then `409`.
- `AC-204` Given đã chạy 2 lượt When khởi động lại Dashboard Then `GET /api/mobile/runs` trả đủ 2 lượt, mới nhất trước.
- `AC-205` Given một lượt chạy xong Then có `junit-*.xml` hợp lệ, số testcase = số kết quả hiển thị.
- `AC-206` Given suite nền tảng `android-native` When Chạy suite Then Mobile runner chạy đúng các spec của suite.

### A6. UAT
- `UAT-201` QA tải APK mới từ máy mình lên, chạy smoke, mở Báo cáo thấy lượt vừa chạy kèm ảnh. Truy vết: REQ-201..203, AC-201/204/205.

---

## B. Kỹ Thuật

### B1. Quyết Định
- `TECH-201` Upload bằng `PUT /api/mobile/builds/:name` với body nhị phân (không multipart, không thêm thư viện), ghi stream vào `apps/<name>.part`, đủ dung lượng thì `rename`, để REQ-201 không để file dở trong `apps/`.
- `TECH-202` Đọc package/version bằng `aapt2 dump badging` nếu có trong Android SDK build-tools; không có thì bỏ qua, vì REQ-201 chỉ bắt buộc tên file.
- `TECH-203` Lịch sử lưu `test-results/mobile-runs/index.json` (giới hạn 30, ghi nguyên tử qua file tạm), để REQ-202 giữ được dữ liệu qua khởi động lại.
- `TECH-204` Thêm `@wdio/junit-reporter@9.32.0` (khớp phiên bản WDIO hiện có), vì REQ-203 cần JUnit cho receipt Gate 4.

### B2. Bản Đồ File (dự kiến)
| Path | Loại | Thao tác | Trần |
|---|---|:---:|:---:|
| `dashboard/services/mobileBuildService.js` | Service | Tạo | 160 |
| `dashboard/services/mobileRunHistory.js` | Service | Tạo | 160 |
| `dashboard/routes/mobileRoutes.js` | Route | Sửa | 160 |
| `wdio.android.conf.js` | Config | Sửa (junit) | — |
| `dashboard/public/js/views/mobile/mobileBuilds.js` | Module | Tạo | 200 |
| `dashboard/public/js/views/resources/*` | Module | Sửa (nhóm Mobile) | 200 |
| `dashboard/public/js/views/suites/*`, `app.js` phần suite | Module | Sửa (platform native) | — |
| `tests/dashboard-api/mobile-builds.test.js` | Test | Tạo | — |

### B3. Contract
| Method | Path | Mã |
|---|---|---|
| PUT | `/api/mobile/builds/:name` | 201, 400, 409, 413 |
| DELETE | `/api/mobile/builds/:name` | 200, 404, 409 |
| GET | `/api/mobile/runs?limit=30` | 200 |
| GET | `/api/mobile/runs/:id` | 200, 404 |

### B4. Dependencies
- `@wdio/junit-reporter@9.32.0` (devDependency) — IMP-25-01 (overview §3; xử lý ghi ở PDR-2-01).

### B5. NFR
- Upload 200 MB không chặn event loop (stream). Danh sách 30 lượt render < 100 ms.

### B6. Rủi Ro
- Ghi đè `apps/` khi đang chạy → khoá theo tên build đang dùng.
- File lớn làm đầy ổ → kiểm `Content-Length` trước khi ghi.

---

## C. Ma Trận Kiểm Thử
| AC | TC | Mức | File | Ca biên |
|---|---|:---:|---|---|
| AC-201, AC-202 | TC-2.1..2.6 | integration | `tests/dashboard-api/mobile-builds.test.js` | đuôi sai, 0 byte, quá cỡ, traversal, trùng tên, huỷ giữa chừng |
| AC-203 | TC-2.7 | unit | `dashboard/services/mobileBuildService.test.js` | build đang dùng |
| AC-204 | TC-2.8 | unit | `mobileRunHistory.test.js` | JSON hỏng, >30 bản ghi |
| AC-205 | TC-2.9 | e2e máy thật | đối chiếu JUnit với kết quả UI | — |
| AC-206 | TC-2.10 | e2e | qua UI Test Suites | — |

## D. Phạm Vi Dev Tự Quyết
- Bố cục nhóm Mobile trong Báo cáo, cách hiện tiến độ upload, tách module.

## E. Câu Hỏi Mở
- 0 câu hỏi chặn.
- Giả định: máy không có `aapt2` thì chỉ hiện tên file APK.

## F. Tiêu Chí Ra Phase
- [x] Bước 0: rà soát P1 ghi vào §I.
- [x] AC-201..206 đạt có bằng chứng; UAT-201 đạt trên máy thật, trừ bước "chạy bằng chính APK vừa tải lên" (§I, rủi ro R-2).
- [x] `verify-dashboard-features`, `check:framework`, `check-code-limits --strict`, unit + API test đạt.
- [x] UI kiểm ở 1920/1440/1280/390 × 2 theme, không lỗi console mới (lỗi cũ của app.js ghi ở §I).
- [x] Cập nhật overview (§2, §6), commit và push lên `main`.

## G. Soát Chéo
- Rà soát độc lập ở đầu session P3.

## H. Nhật Ký Thay Đổi (PDR)
| PDR | Loại | Plan gốc | Thực tế | Ảnh hưởng | Trạng thái |
|---|:---:|---|---|---|:---:|
| PDR-2-01 | TECH | §B4 dependency không dẫn IMP/RES (plan-check P3 fail) | Plan không có gói RES. Ghi tác động nội bộ IMP-25-01 (ADOPT) ở overview §3: dùng reporter JUnit chính thức của WDIO, cùng phiên bản 9.32.0 với `@wdio/cli` đang cài, không cần nghiên cứu ngoài; §B4 dẫn IMP-25-01 | `plan-25-overview.md` §3, §B4 | DONE |
| PDR-2-02 | TECH | §B2 sửa `app.js` phần suite và `views/resources/*` | Không sửa `app.js` (17.718 dòng, mọi thay đổi làm `check-code-limits --strict` fail). Module mới bọc hàm global của app.js: `views/suites/nativeSuiteExtension.js` + `nativeSuiteRender.js`; nhóm Mobile ở Báo cáo là `views/resources/mobileRunsPanel.js` + `mobileRunsRender.js`; CSS `styles/views/mobile-reports.css`; template `suites.html`, `resources.html`; 1 dòng import trong `main.js` | Không đổi hành vi Desktop/Mobile Web | DONE |
| PDR-2-03 | TECH | §B2 không có các file này | `core/native/junitReport.js` (+test): WDIO ghi 1 file JUnit mỗi worker (mỗi spec), REQ-203 cần 1 file mỗi lượt → gộp ở `onComplete` và khi runner đóng (lượt bị dừng). `mobileRunArtifacts.js` tách khỏi runner để runner < 160 dòng. `mobileApkInfo.js` (TECH-202). `mobileSuiteHandoff.js` (AC-206). `.gitignore` thêm `/apps/*.part`. Docs `ANDROID_NATIVE_TESTING.md` | Chỉ thêm file | DONE |
| PDR-2-04 | TECH | §B3 có 4 route | Thêm `GET /api/mobile/runs/:id/junit` (200 XML / 404) cho "tải JUnit" ở §A3; `PUT ...?overwrite=1` là cách UI xác nhận ghi đè (BR-201) | Contract test `mobile-builds.test.js` | DONE |
| PDR-2-05 | BUSINESS | Suite native "chọn spec → Chạy" | Suite `android-native` chỉ giữ danh sách file test và 1 tag; thiết bị/app lấy theo lựa chọn hiện tại ở Mobile App. Suite native không hiện ở tab Chạy test và không gộp vào Suite Cha (cả hai chạy Playwright) | §A3 luồng Suite | DONE |

## I. Bằng Chứng

Môi trường: Windows 11, baseline `525c0e0`, máy thật OPPO CPH2481 (Android 15, serial `6XPNHY9DVCUCR4OB`), aapt2 trong build-tools 35.0.0.

**Bước 0 — rà soát Phase 1**
- `node --test dashboard/services/mobileServices.test.js` → exit 0, 24/24. `node --test tests/dashboard-api/mobile.test.js` → exit 0, 13/13. `node scripts/verify-dashboard-features.js` → exit 0, 15 view đủ mảnh. `node scripts/check-code-limits.js --strict` → exit 0.
- UI Mobile App: nhận CPH2481 "Sẵn sàng", 5/5 mục Kiểm tra môi trường đạt, không lỗi console. Runner P1 chạy lại thật trong P2 (2 lượt, 3/3 Đạt). Không phát hiện lỗi P1 cần sửa. P2 đổi một điểm của P1: kết quả cuối lượt chạy lấy từ JUnit thay cho dòng log.

**Kiểm thử tự động (sau khi sửa xong)**

| Lệnh | Exit | Kết quả |
|---|:---:|---|
| `node --test dashboard/services/mobileServices.test.js dashboard/services/mobileRunHistory.test.js dashboard/services/mobileBuildService.test.js core/native/junitReport.test.js` | 0 | 56/56; chạy lặp 15 lần đều đạt |
| `node --test tests/dashboard-api/mobile.test.js tests/dashboard-api/mobile-builds.test.js` | 0 | 28/28 (13 P1 + 15 P2); lặp 3 lần đều đạt |
| `node scripts/verify-dashboard-features.js` | 0 | 15 view đủ mảnh, 17 nhóm route |
| `npm run check:framework` | 0 | 8 specs, 6 page objects |
| `node scripts/check-code-limits.js --strict` | 0 | 26 file, 0 cảnh báo vùng vàng |
| `npm run test:unit` | 1 | 693/697. 4 lỗi có sẵn, ở file P2 không đụng: `core/reporters/htmlSummaryReporter.test.js`, `tools/qa/lib/learner.test.js` (2), `learnerSecurityGit.test.js` (trùng mã `DH-07` trong catalog skill) |
| `npm run test:dashboard:api` | 1 | 223/225. 2 lỗi có sẵn: `master-process.test.js` (`DRIFT_DETECTED`, đã ghi ở P1), `qa-spec-studio.test.js` TC-24-02 (chỉ cho 1 plan active trong `_Plan_implement`, PLAN-25 active từ P1) |

**Ma trận AC**

| AC | TC | Bằng chứng |
|---|---|---|
| AC-201 | TC-2.1 | PUT 50 MB `app.apk` → 201, file trong `apps/`, có trong catalog. Thật: `Calculator2.apk` 16,3 MB → 201, aapt2 đọc `com.coloros.calculator · v16.2.32 · Calculator`. UI: kéo thả `My App (qa) v2.apk` → tên làm sạch `My-App-qa-v2.apk`, có thanh tiến độ, được chọn sẵn |
| AC-202 | TC-2.2, TC-2.3, TC-2.6 | `x.exe`, `../a.apk`, `.a.apk`, body rỗng → 400; > 300 MB → 413; huỷ giữa chừng (API và nút "Huỷ tải lên" ở UI, file 150 MB) → `apps/` không có file hay `.part` |
| AC-203 | TC-2.7 | Unit: ghi đè/xoá build đang dùng → 409. API: khi lượt chạy dùng `apps/app.apk`, DELETE và PUT overwrite → 409, build khác vẫn xoá được (200); sau khi lượt xong DELETE → 200 |
| AC-204 | TC-2.8 | Unit 8 ca (JSON hỏng, bản ghi lỗi, > 30, trùng id, id độc). API: 2 lượt (passed, stopped) → khởi động lại server → `GET /api/mobile/runs` trả 2 lượt, mới nhất trước |
| AC-205 | TC-2.9 | Máy thật lượt `mwmgxzc4`: `junit-mwmgxzc4.xml` 3 testcase = 3 kết quả trên UI = 3 dòng ở Báo cáo; test ID dạng `native.android.@android_@smoke_App_launch.TC-AND-001 - ...`; 1 file mỗi lượt (file worker đã gộp và xoá) |
| AC-206 | TC-2.10 | UI: tạo suite `smoke-android-native` (Android native, tag `@smoke`), lưu, tải lại trang vẫn đúng nền tảng/spec/lệnh `npx wdio`. Bấm Chạy → mở Mobile App, tự chạy `--spec tests/native/android/app-launch.native.js --mochaOpts.grep @smoke` trên máy thật → 3/3 Đạt, lịch sử ghi suite `smoke-android-native`. Suite thử đã gỡ khỏi `core/config/dashboardConfig.json` sau khi kiểm |
| EDGE-201..204 | | 201: TC-2.6. 202: TC-2.5 (lượt tải thứ hai cùng tên → 409, lượt đầu → 201). 203: unit. 204: lượt bị dừng ghi `stopped` |

**UAT-201 (máy thật)**: tải APK thật lên (API và UI), chạy smoke trên CPH2481 (2 lượt, 18,6–18,8 s, 3/3 Đạt), mở Báo cáo → Mobile thấy lượt vừa chạy, kết quả, ảnh `app_launch_foreground_*.png`, tải được JUnit. Chưa chạy bằng chính APK vừa tải lên: APK duy nhất có là Calculator hệ thống của điện thoại; chế độ APK sẽ cài đè và xoá dữ liệu app này trên máy của Owner (R-2).

**UI**: Mobile App, Báo cáo → Mobile, Test Suites (suite native) ở 1920×1080, 1440×900, 1280×800, 390×844 × light/dark: không tràn ngang trang, không chữ `undefined`/`null`. Đã sửa trong lúc kiểm: pill "Native" bị cắt 16 px (hàng lọc cho xuống dòng); danh sách lượt chạy cao 0 ở 390 px; "0.0 MB" với file < 1 MB; link "Tải JUnit" chưa có kiểu nút; tìm không khớp hiện nhầm "Chưa có lượt chạy". 20 vòng Mobile ↔ Báo cáo (Mobile) ↔ Suites: listener còn gắn vào DOM giữ nguyên 53, 0 lỗi JS. Log server không có lỗi.

**Lỗi có sẵn phát hiện khi kiểm (ngoài phạm vi P2, nằm trong `app.js` nên chưa sửa)**
- Test Suites: một lần bấm "Tạo kịch bản" sinh 2 suite (kiểm lại khi tắt module P2: vẫn 2).
- Test Suites: lưu khi view Cấu hình chưa mở → `PUT /api/settings` 400 "Default environment must exist" nhưng toast báo đã lưu thành công.
- Test Suites 390 px: thanh chọn suite rộng hơn màn hình (giống hệt khi chọn suite desktop).
- Báo cáo 390 px: danh sách báo cáo/evidence cũ cao 0 (nav giới hạn 380 px).
- Chuyển view thật nhanh: `openExplorer` (app.js:813) ghi vào `#resource-summary` khi view đã rời → `TypeError` trong console.

**Rủi ro còn lại**
- R-1: Suite native dựa vào việc bọc hàm global của `app.js`; đổi tên các hàm đó sẽ làm mất nền tảng native (đã ghi bài học trong `ai/dashboard/AI_LESSONS.md`).
- R-2: Chưa chạy lượt nào bằng APK tải lên (chỉ chế độ "App đã cài").
- R-3: Receipt Gate 4 (`record-gate-run.py`) đòi checkout sạch; trong phiên này checkout còn file chưa track của session khác (`ux-review-script-organization.md`) nên không tạo được receipt.
