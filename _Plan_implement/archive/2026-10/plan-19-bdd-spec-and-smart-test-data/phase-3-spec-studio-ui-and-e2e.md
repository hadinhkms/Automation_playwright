# Phase 3 — Giao Diện Spec Studio & Kiểm Thử Toàn Diện Gate 4

> **Tác giả Nghiệp vụ:** @ba (phiên init) · **Tác giả Kỹ thuật:** @tl (phiên init) · **Research:** Không áp dụng  
> **Trạng thái:** `COMPLETED` · **Cấp độ:** `L3`  

---

## A. Nghiệp Vụ (BA — A/R; Tech Lead — C)

### A1. Mục Tiêu & Phạm Vi Phase
- **In-Scope:**
  - Bổ sung 2 tab (`bva`, `bdd`) và 2 action button trong modal Phân tích Yêu cầu `#/qa`.
  - Triển khai các component: `specStudioPanels.js`, `bvaPanel.js`, `bddPanel.js`, dirty guard, hộp xác nhận đóng an toàn.
  - Phủ đủ 100% 16 kịch bản bắt buộc của hệ thống Acceptance Gates v1.0.
  - Vượt qua kiểm thử UI 4 viewports (1920, 1440, 1280, 390) × 2 themes (Light/Dark).
- **Out-of-Scope:**
  - Không ghi đè trực tiếp tài liệu REQ trên đĩa (D2); chỉ hỗ trợ sao chép Markdown/JSON vào clipboard.
  - Không sửa đổi logic phân tích của các tab cũ (`tc`, `clarity`, `impact`).

### A2. Yêu Cầu & Quy Tắc Nghiệp Vụ Áp Dụng
- `REQ-19B-05`: Tích hợp 2 tab Ma trận biên và Chuẩn hoá BDD vào modal phân tích yêu cầu với trạng thái loading và copy clipboard.
- `REQ-19B-06`: Quản lý vòng đời hiển thị, dirty guard cảnh báo mất dữ liệu chưa sao chép, và cờ huỷ request khi chuyển view.
- `BR-19B-07`: Hiển thị an toàn 100% bằng `textContent` chống XSS (INV-6); markdown hiển thị trong `<pre>`, không parse HTML.
- `BR-19B-08`: Phủ kín 16 kịch bản bắt buộc của hệ thống Acceptance Gates v1.0 (ASYNC-01..05, OWN-01..05, UI-01..05, LIFE-01).

### A3. User Flow & Nhánh Lỗi/Hủy
- Luồng chính: Mở modal QA Analyzer -> Bấm "Ma trận biên" (hoặc "Chuẩn hoá BDD") -> Loading -> Render kết quả vào panel -> Bấm "Sao chép" -> Thông báo thành công.
- Nhánh huỷ/đóng: Đóng modal khi có kết quả BDD chưa sao chép -> Hiện confirm dialog ("Ở lại" / "Bỏ và đóng") -> Chọn bỏ thì đóng an toàn.

### A4. Trạng Thái Biên (EDGE-xx)
- `EDGE-19B-05`: Sửa textarea khi BDD đang chờ xử lý -> Khi kết quả về hiển thị banner cảnh báo stale, giữ nguyên nội dung textarea đã sửa.
- `EDGE-19B-06`: Clipboard API bị trình duyệt từ chối quyền -> Báo lỗi thân thiện, giữ nguyên cờ dirty.

### A5. Tiêu Chí Nghiệm Thu (AC-xx)
- `AC-19B-07`: Giao diện tương tác trực quan, an toàn XSS và vượt qua 100% 16 scenario của Acceptance Gates v1.0 (dẫn `BR-19B-07`, `BR-19B-08`).

### A6. Kịch Bản Nghiệm Thu Nghiệp Vụ (UAT-xx) (Bắt buộc cho L2+)
- `UAT-19B-03`:
  - **Mục tiêu nghiệp vụ:** Trải nghiệm người dùng trơn tru khi phân tích biên và chuẩn hoá BDD trên giao diện Web Studio.
  - **Vai trò / Persona:** QA Lead / Tester.
  - **Dữ liệu tiền đề:** Yêu cầu đăng ký tài khoản với nhiều điều kiện biên.
  - **Các bước thao tác:** Mở modal phân tích REQ, kích hoạt phân tích biên, sao chép kết quả; kích hoạt chuẩn hoá BDD, thử đóng modal khi chưa sao chép.
  - **Kết quả mong đợi:** Bảng biên hiển thị rõ ràng, hộp thoại xác nhận xuất hiện đúng lúc ngăn mất dữ liệu, clipboard sao chép chuẩn xác.
  - **Truy vết:** Dẫn `REQ-19B-05`, `REQ-19B-06`, `BR-19B-07`, `BR-19B-08` và phủ `AC-19B-07`.

---

## B. Kỹ Thuật (Tech Lead — A/R; BA — C)

### B1. Quyết Định Kỹ Thuật (TECH-xx)
- `TECH-19B-05`: Tách riêng các view panel vào thư mục `dashboard/public/js/views/qa/specStudio/` (dẫn `REQ-19B-05`, lý do nhằm giữ glue code trong `reqAnalyzerHelper.js` ≤ 15 dòng để bảo vệ giới hạn file).
- `TECH-19B-06`: Áp dụng sequence counter (`seq`) và `AbortController` (dẫn `REQ-19B-06`, phương án để triệt tiêu race condition ASYNC-02/03 và rò rỉ bộ nhớ OWN-05).

### B2. Bản Đồ File & Ngân Sách Dòng (File Splitting Budget)
| Path | Loại File | Thao Tác (Tạo/Sửa) | Trần Số Dòng | Dự Kiến |
|---|---|:---:|:---:|:---:|
| `dashboard/public/templates/qa.html` | Component | Sửa | 150 | 50 |
| `dashboard/public/styles/views/qa.css` | Module | Sửa | 250 | 80 |
| `dashboard/public/js/views/qa/reqAnalyzerHelper.js` | Module | Sửa | 250 | 15 |
| `dashboard/public/js/views/qa/specStudio/specStudioPanels.js` | Component | Tạo | 150 | 130 |
| `dashboard/public/js/views/qa/specStudio/bvaPanel.js` | Component | Tạo | 150 | 140 |
| `dashboard/public/js/views/qa/specStudio/bddPanel.js` | Component | Tạo | 150 | 140 |
| `tests/dashboard/qa-spec-studio.spec.js` | Test | Tạo | 800 | 500 |
| `tests/dashboard/qa-spec-studio-layout.spec.js` | Test | Tạo | 800 | 350 |

### B3. Contract & Schemas
- UI Event hooks: `#qa-req-btn-bva`, `#qa-req-btn-bdd`, panels `#qa-req-panel-bva`, `#qa-req-panel-bdd`.

### B4. Quản Lý Phụ Thuộc (Dependencies)
- Không có.

### B5. Yêu Cầu Phi Chức Năng (NFR)
- 0 lỗi console, tương thích 4 viewport (1920, 1440, 1280, 390) × 2 themes (Light/Dark); focus trap và a11y đầy đủ.

### B6. Rủi Ro Kỹ Thuật & Cách Chặn
- DOM render vượt ngưỡng ban đầu: chặn bằng lazy render nội dung panel chỉ khi bấm tab tương ứng.

---

## C. Ma Trận Kiểm Thử (BA + Tech Lead; QA — C)

| AC ID | TC ID | Mức (unit/integration/e2e) | Critical? | File Test Dự Kiến | Ca Biên / Ghi Chú |
|---|---|:---:|:---:|---|---|
| `AC-19B-07` | `TC-19` | `e2e` | Yes | `tests/dashboard/qa-spec-studio.spec.js` | UI-02 / LIFE-01: Luồng mở modal và kích hoạt 2 tab |
| `AC-19B-07` | `TC-20` | `e2e` | No | `tests/dashboard/qa-spec-studio.spec.js` | UI-01: Khớp danh sách tab trong modal DOM |
| `AC-19B-07` | `TC-21` | `e2e` | No | `tests/dashboard/qa-spec-studio.spec.js` | UI-04: Chuyển tab nhanh bva -> bdd -> bva |
| `AC-19B-07` | `TC-22` | `e2e` | No | `tests/dashboard/qa-spec-studio.spec.js` | ASYNC-01: Sửa textarea khi đang chờ kết quả |
| `AC-19B-07` | `TC-23` | `e2e` | No | `tests/dashboard/qa-spec-studio.spec.js` | ASYNC-02: Đóng modal huỷ request đang chờ |
| `AC-19B-07` | `TC-24` | `e2e` | No | `tests/dashboard/qa-spec-studio.spec.js` | ASYNC-03: Xử lý 2 request liên tiếp chống late response |
| `AC-19B-07` | `TC-25` | `e2e` | Yes | `tests/dashboard/qa-spec-studio.spec.js` | ASYNC-04: Báo lỗi 502 và Thử lại thành công |
| `AC-19B-07` | `TC-26` | `e2e` | No | `tests/dashboard/qa-spec-studio.spec.js` | ASYNC-05: Clipboard resolve và xử lý từ chối |
| `AC-19B-07` | `TC-27` | `e2e` | Yes | `tests/dashboard/qa-spec-studio.spec.js` | UI-05: Hộp thoại xác nhận đóng khi dirty |
| `AC-19B-07` | `TC-28` | `e2e` | Yes | `tests/dashboard/qa-spec-studio.spec.js` | OWN-01..04: 20 vòng chuyển view không nhân bản listener |
| `AC-19B-07` | `TC-29` | `e2e` | No | `tests/dashboard/qa-spec-studio.spec.js` | OWN-05: Rời view khi đang chờ không lỗi console |
| `AC-19B-07` | `TC-30` | `e2e` | Yes | `tests/dashboard/qa-spec-studio.spec.js` | An toàn XSS khi render payload độc hại |
| `AC-19B-07` | `TC-31` | `e2e` | No | `tests/dashboard/qa-spec-studio-layout.spec.js` | UI-03: Viewport 1920x1080 Light mode |
| `AC-19B-07` | `TC-32` | `e2e` | No | `tests/dashboard/qa-spec-studio-layout.spec.js` | UI-03: Viewport 1920x1080 Dark mode |
| `AC-19B-07` | `TC-33` | `e2e` | No | `tests/dashboard/qa-spec-studio-layout.spec.js` | UI-03: Viewport 1440x900 Light mode |
| `AC-19B-07` | `TC-34` | `e2e` | No | `tests/dashboard/qa-spec-studio-layout.spec.js` | UI-03: Viewport 1440x900 Dark mode |
| `AC-19B-07` | `TC-35` | `e2e` | No | `tests/dashboard/qa-spec-studio-layout.spec.js` | UI-03: Viewport 1280x800 Light mode |
| `AC-19B-07` | `TC-36` | `e2e` | No | `tests/dashboard/qa-spec-studio-layout.spec.js` | UI-03: Viewport 1280x800 Dark mode |
| `AC-19B-07` | `TC-37` | `e2e` | No | `tests/dashboard/qa-spec-studio-layout.spec.js` | UI-03: Viewport 390x844 mobile Light mode |
| `AC-19B-07` | `TC-38` | `e2e` | No | `tests/dashboard/qa-spec-studio-layout.spec.js` | UI-03: Viewport 390x844 mobile Dark mode |

---

## D. Phạm Vi Dev Được Tự Quyết (Local Decisions)
- Tên class CSS phụ trợ và cấu trúc animation micro-transition.

---

## E. Câu Hỏi Mở & Giả Định (Open Questions)
- 0 câu hỏi chặn (zero blocking).

---

## F. Tiêu Chí Ra Phase (Exit Criteria)
- [x] 20/20 TC E2E tests PASS trên Playwright.
- [x] 16/16 Gate Scenarios có bằng chứng thực nghiệm đầy đủ.
- [x] 0 lỗi console, kiểm tra đạt 4 viewports × 2 themes.

---

## G. Soát Chéo (Cross-Review Signatures)
- Nghiệp vụ soát bởi Tech Lead: ✔ @tl (phiên init)
- Kỹ thuật soát bởi BA (không đổi nghiệp vụ): ✔ @ba (phiên init)

---

## H. Nhật Ký Thay Đổi Kế Hoạch (Plan Deviation Requests - PDR)
| PDR ID | Loại (BUSINESS / TECH) | Nội Dung Plan Gốc | Đề Xuất Thực Tế | Ảnh Hưởng (AC / File) | Trạng Thái (PENDING / APPROVED / REJECTED) |
|---|:---:|---|---|---|:---:|
| — | — | Không có sai lệch | Thực thi đúng 100% quy chuẩn | — | APPROVED |

---

## I. Bằng Chứng Thực Nghiệm (Evidence Block)
- **Lệnh chạy Playwright E2E:** `npx playwright test tests/dashboard/qa-spec-studio.spec.js --config=playwright.dashboard.config.js`
  * **Kết quả:** 12/12 tests PASS (100%), duration ~29s.
  * TC-19: UI-02 / LIFE-01: Luồng mở modal và kích hoạt 2 tab BVA và BDD — PASS
  * TC-20: UI-01: Khớp danh sách tab trong modal DOM (đủ 8 tabs) — PASS
  * TC-21: UI-04: Chuyển tab nhanh bva -> bdd -> bva — PASS
  * TC-22: ASYNC-01: Sửa textarea khi đang chờ kết quả -> hiện banner stale — PASS
  * TC-23: ASYNC-02: Đóng modal huỷ request đang chờ — PASS
  * TC-24: ASYNC-03: Xử lý 2 request liên tiếp chống late response — PASS
  * TC-25: ASYNC-04: Báo lỗi 502 và Thử lại thành công — PASS
  * TC-26: ASYNC-05: Clipboard copy resolve hoặc xử lý từ chối an toàn — PASS
  * TC-27: UI-05: Hộp thoại xác nhận đóng khi dirty — PASS
  * TC-28: OWN-01..04: 20 vòng chuyển view không nhân bản listener — PASS
  * TC-29: OWN-05: Rời view khi đang chờ không lỗi console — PASS
  * TC-30: An toàn XSS khi render payload độc hại trong BVA và BDD — PASS
- **Lệnh chạy Responsive Layout:** `npx playwright test tests/dashboard/qa-spec-studio-layout.spec.js --config=playwright.dashboard.config.js`
  * **Kết quả:** 8/8 tests PASS (100%), duration ~15s.
  * TC-31 & TC-32: Viewport 1920x1080 (Light & Dark mode) — PASS
  * TC-33 & TC-34: Viewport 1440x900 (Light & Dark mode) — PASS
  * TC-35 & TC-36: Viewport 1280x800 (Light & Dark mode) — PASS
  * TC-37 & TC-38: Viewport 390x844 mobile (Light & Dark mode) — PASS
- **Kiểm tra trần dòng:**
  * `dashboard/public/templates/qa.html`: Thêm tab và panel modal hợp lệ (ĐẠT)
  * `dashboard/public/styles/views/qa.css`: Thêm 35 dòng CSS Spec Studio (ĐẠT)
  * `dashboard/public/js/views/qa/reqAnalyzerHelper.js`: Thêm 15 dòng mount và lifecycle (ĐẠT)
  * `dashboard/public/js/views/qa/specStudio/specStudioPanels.js`: 106 dòng ≤ 150 (ĐẠT)
  * `dashboard/public/js/views/qa/specStudio/bvaPanel.js`: 146 dòng ≤ 150 (ĐẠT)
  * `dashboard/public/js/views/qa/specStudio/bddPanel.js`: 145 dòng ≤ 150 (ĐẠT)
