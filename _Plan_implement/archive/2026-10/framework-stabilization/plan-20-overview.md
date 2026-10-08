# Kế Hoạch 20: Ổn Định Khung Kiểm Thử, Dashboard Parity & Chuẩn Hóa CI/CD Hub Engine — Plan Overview

> **Plan ID:** `PLAN-20-STABILIZATION-2026-10-02` · **Baseline Commit:** `a20461e` · **Cấp độ:** `L3`  
> **Trạng thái:** `COMPLETED` · **Nguồn gốc:** [20_FRAMEWORK_RELIABILITY_AND_QUALITY_STABILIZATION_PLAN.md](20_FRAMEWORK_RELIABILITY_AND_QUALITY_STABILIZATION_PLAN.md)

---

## 1. Bối Cảnh & Mục Tiêu
- **Bối cảnh:** Dự án Hub `@hadinhkms/qa-automation-engine` đang đóng vai trò trung tâm cung cấp thư viện, dashboard và chuẩn kiểm thử cho các dự án vệ tinh (`CarThings`, `Vieclam24h`). Sau kiểm tra diện rộng, phát hiện:
  - 3 test E2E Desktop & Mobile bị timeout 15s do `example.com` thay đổi giao diện (bỏ thẻ `h1`).
  - 7 test Dashboard UI bị fail do rác workspace, vỡ ngân sách DOM (4641 node > 1500) và lệch token CSS.
  - Kiểm tra `qa:check` báo 43 lỗi do xung đột mô hình Hub rỗng requirement.
  - CI GitHub Actions bỏ qua việc chạy Playwright test trên Push và Pull Request.
- **Mục tiêu:** Khắc phục triệt để toàn bộ 4 vấn đề trên, đưa 100% test suites về màu xanh, tối ưu tốc độ và củng cố hàng rào chất lượng CI/CD.

## 2. WBS & Đồ Thị Phụ Thuộc (Dependency Graph)

| Phase | Tên Giai Đoạn | File Chi Tiết | Phụ Thuộc | Chủ Trì | Trạng Thái |
|---|---|---|---|---|:---:|
| 1 | E2E Isolation & Runner Hygiene | [phase-1-e2e-isolation-and-smoke-fix.md](phase-1-e2e-isolation-and-smoke-fix.md) | Không | @ba / @tl | `COMPLETED` |
| 2 | Dashboard Parity & DOM Budget | [phase-2-dashboard-parity-and-dom-budget.md](phase-2-dashboard-parity-and-dom-budget.md) | Phase 1 | @ba / @tl | `COMPLETED` |
| 3 | Traceability Hub-Spoke & CI Pipeline | [phase-3-traceability-hub-spoke-and-ci-pipeline.md](phase-3-traceability-hub-spoke-and-ci-pipeline.md) | Phase 2 | @ba / @tl | `COMPLETED` |

```text
Phase 1 (E2E Isolation & Clean Runner) ──► Phase 2 (Dashboard Parity & DOM Budget) ──► Phase 3 (Traceability & CI Pipeline)
```

## 3. Điều Kiện Mang Theo & Quy Tắc Bất Biến (Rules & Constraints)
| Mã | Loại | Mô Tả Quy Tắc |
|---|---|---|
| **C-1** | Quy tắc Bất Biến | Tuyệt đối không thêm chú thích `// master-process-disable-size-check:` cho bất kỳ file mới hoặc file sửa đổi nào. |
| **C-2** | Nguyên tắc Cô lập | Các test starter demo không được phụ thuộc vào kết nối Internet hoặc website bên ngoài không kiểm soát. |
| **C-3** | Tính Tương Thích | Sửa đổi tại Hub phải đảm bảo không làm gãy giao thức đồng bộ Hub-to-Spoke (`npm run presync:drift`). |

## 4. Bảng Kiểm Tra Tiến Độ Toàn Diện (Checklist)
- [x] **Phase 1**:
  - [x] Tạo local HTML test fixture tại `data/fixtures/sample-app.html`.
  - [x] Sửa `pages/desktop/SamplePage.js` & `pages/mobile/SampleMobilePage.js` trỏ vào local fixture.
  - [x] Thêm `testIgnore` trong `playwright.dashboard.config.js` & dọn 5 thư mục rác `.tmp-workspace-*`.
  - [x] Xác nhận `npm run suite:desktop` và `npm run suite:mobile` đạt **100% PASS**.
- [x] **Phase 2**:
  - [x] Khai báo `--warning-subtle`, `--accent-subtle` vào `tokens.css`.
  - [x] Loại bỏ hardcoded color fallback trong `qa.css` & chuẩn hóa viền hairline spinner.
  - [x] Chuyển đổi cơ chế mount template trong `dashboard/public/app.js` sang Lazy Mount, đo đạc DOM ban đầu `< 1,500` phần tử.
  - [x] Cập nhật assertion thông điệp bản thảo BDD trong `qa-document-reader.spec.js`.
  - [x] Xác nhận `npx playwright test --config=playwright.dashboard.config.js` đạt **100% PASS** (149/149).
- [x] **Phase 3**:
  - [x] Bổ sung cơ chế nhận diện Hub Mode trong `scripts/lib/qaTrace.js` (bỏ qua `tests/dashboard/**` và thư mục ẩn).
  - [x] Cập nhật `.github/workflows/playwright.yml`: cài browser và chạy `npm run suite:smoke` trên PR; cập nhật Discord notification.
  - [x] Loại bỏ `_backup_vieclam24h/` khỏi Git tracking và bổ sung vào `.gitignore`.
  - [x] Chạy kiểm định Gate 4 tổng hợp.
