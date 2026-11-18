# Phase 2 — Thư viện build, lịch sử lượt chạy & báo cáo

> **Tác giả Nghiệp vụ / Kỹ thuật:** @claude (phiên 2026-11-19) · **Research:** Không áp dụng
> **Cấp độ:** L3 · **Phụ thuộc:** Phase 1 · **Trạng thái:** `TODO`

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
- `@wdio/junit-reporter@9.32.0` (devDependency).

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
- [ ] Bước 0: rà soát P1 ghi vào §I.
- [ ] AC-201..206 đạt có bằng chứng; UAT-201 đạt trên máy thật.
- [ ] `verify-dashboard-features`, `check:framework`, `check-code-limits --strict`, unit + API test đạt.
- [ ] UI kiểm ở 1920/1440/1280/390 × 2 theme, không lỗi console.
- [ ] Cập nhật overview (§2, §6), commit và push lên `main`.

## G. Soát Chéo
- Rà soát độc lập ở đầu session P3.

## H. Nhật Ký Thay Đổi (PDR)
| PDR | Loại | Plan gốc | Thực tế | Ảnh hưởng | Trạng thái |
|---|:---:|---|---|---|:---:|

## I. Bằng Chứng
_(Điền khi thực thi)_
