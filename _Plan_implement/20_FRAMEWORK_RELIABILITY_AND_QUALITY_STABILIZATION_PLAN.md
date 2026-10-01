# Kế Hoạch 20: Ổn Định Khung Kiểm Thử, Dashboard Parity & Chuẩn Hóa CI/CD Hub Engine

> **Plan ID:** `PLAN-20-STABILIZATION-2026-10-02` · **Cấp độ:** `L3` · **Phiên bản:** `1.0.0`  
> **Trạng thái:** `DRAFT_PENDING_APPROVAL` · **Mục tiêu:** 100% Green E2E Smoke & Dashboard Suites, Khắc phục vỡ DOM Budget, Chuẩn hóa Traceability Hub-Spoke & Kích hoạt CI Playwright.

---

## 1. Bối Cảnh & Mục Tiêu

### 1.1. Bối Cảnh
Sau đợt kiểm tra toàn diện chất lượng dự án `@hadinhkms/qa-automation-engine`, phát hiện hệ thống đang tồn tại 4 nhóm vấn đề nghiêm trọng:
1. **E2E Smoke Suite bị sập (3/7 test fail)**: Do phụ thuộc vào `https://example.com` đã bị thay đổi cấu trúc DOM (mất thẻ `<h1>`).
2. **Dashboard Test Suite bị sập (7 test fail)**: Do rác thư mục `.tmp-workspace-*` bị lọt vào runner, giao diện vượt ngân sách DOM gấp 3 lần (`4,641` phần tử so với chỉ tiêu `< 1,500`), thiếu token CSS (`--warning-subtle`, `--accent-subtle`), và còn dùng fallback màu cứng.
3. **Traceability Check sập (43 finding major)**: `scripts/qa-trace.js` quét toàn bộ `tests/` và xử phạt các test nội bộ Dashboard vì không có `@REQ-xxx`, trong khi Hub theo nguyên tắc bất biến không chứa `requirements/` và `test-cases/` của nghiệp vụ vệ tinh.
4. **CI/CD GitHub Actions không chạy Playwright test trên Push/PR**: Chỉ chạy `check:framework` và `node --test`, khiến toàn bộ lỗi hỏng test E2E lọt qua khâu tích hợp liên tục.

### 1.2. Mục Tiêu Nghiệm Thu Tổng Thể
- Đưa toàn bộ các bộ test về trạng thái **100% Green**:
  - `npm run suite:desktop` / `npm run suite:smoke`: PASS 7/7 tests (0 failure, 0 timeout).
  - `npm run test:dashboard:regression`: PASS toàn bộ Dashboard API (164/164) & Dashboard Chromium UI (154/154).
  - `npm run qa:check`: PASS 0 major findings trên Hub Engine.
- Tối ưu hiệu năng Dashboard: Giảm số lượng phần tử DOM ban đầu từ `4,641` xuống dưới `1,500` phần tử.
- Chuẩn hóa CI/CD: Đảm bảo kiểm tra tự động chạy Playwright headless trên mọi Pull Request.

---

## 2. Cấu Trúc Phase & Phân Rã Công Việc (WBS)

Kế hoạch được chia thành 3 phase độc lập, thực thi tuần tự:

```text
Phase 1: E2E Smoke Isolation & Runner Hygiene 
   ├── Cô lập test bằng local HTML fixture (hết phụ thuộc example.com)
   └── Bổ sung testIgnore và dọn sạch .tmp-workspace-*
         │
         ▼
Phase 2: Dashboard Parity & DOM Budget Optimization
   ├── Bổ sung CSS tokens & khử màu cứng trong qa.css
   ├── Khắc phục vỡ DOM Budget (chuyển sang Lazy Template Mount < 1500 nodes)
   └── Khớp nội dung bản thảo BDD trong qa-document-reader.spec.js
         │
         ▼
Phase 3: Hub-Spoke Traceability & CI/CD Hardening
   ├── Nâng cấp qaTrace.js hỗ trợ chế độ Hub Engine & bỏ qua thư mục ẩn
   ├── Cấu hình GitHub Actions chạy Playwright headless trên PR
   └── Gỡ bỏ _backup_vieclam24h/ khỏi Git tracking
```

| Phase | File Đặc Tả Chi Tiết | Trọng Tâm Xử Lý | Trạng Thái |
|---|---|---|:---:|
| **1** | [phase-1-e2e-isolation-and-smoke-fix.md](phase-1-e2e-isolation-and-smoke-fix.md) | E2E Isolation, Sửa SamplePage/Mobile, testIgnore | `READY` |
| **2** | [phase-2-dashboard-parity-and-dom-budget.md](phase-2-dashboard-parity-and-dom-budget.md) | Tokens CSS, DOM Budget < 1500, QA View Parity | `READY` |
| **3** | [phase-3-traceability-hub-spoke-and-ci-pipeline.md](phase-3-traceability-hub-spoke-and-ci-pipeline.md) | qaTrace Hub Mode, CI/CD Workflow, Clean Backup | `READY` |

---

## 3. Ma Trận Quyết Định Kỹ Thuật (Design Decisions)

| Mã | Quyết Định | Giải Pháp Lựa Chọn | Lý Do & Lợi Ích |
|---|---|---|---|
| **D1** | Khắc phục phụ thuộc `example.com` | Xây dựng trang HTML test fixture tĩnh tích hợp sẵn tại `data/fixtures/sample-app.html` và serve nội bộ qua route hoặc Playwright route/data URL. | Đảm bảo test 100% offline, kháng flaky, tốc độ chạy < 100ms thay vì 15,000ms timeout. |
| **D2** | Quản lý rác workspace | Thêm `testIgnore: ['**/.tmp-workspace-*/**', '**/test-results/**']` vào config và bổ sung hook dọn rác tự động trong `fixtureWorkspace.js`. | Loại bỏ vĩnh viễn nguy cơ runner chạy nhầm file test rác và làm sai lệch báo cáo. |
| **D3** | Kiểm soát DOM Budget | Sử dụng template on-demand mount trong `dashboard/public/app.js`: chỉ chèn template vào DOM khi người dùng chuyển sang view tương ứng. | Giảm số node DOM ban đầu từ 4,641 xuống < 1,500, cải thiện 60% tốc độ render và đạt chuẩn Plan 09 §8. |
| **D4** | Cơ chế Traceability cho Hub | Thêm tham số `--hub` hoặc nhận diện Hub tự động qua `package.json` name `@hadinhkms/qa-automation-engine`. | Tách biệt kiểm thử hạ tầng khung lõi khỏi kiểm thử tính năng nghiệp vụ của vệ tinh. |

---

## 4. Tiêu Chuẩn Nghiệm Thu Cổng (Quality Gates)

- **Gate 1 (Plan Verification)**: Toàn bộ phase files có đầy đủ chữ ký chéo `@ba` / `@tl`, bảng ma trận file budget, AC/TC.
- **Gate 2 (Contract Lock)**: Bảng băm SHA256 các file phase được khóa chặt chẽ.
- **Gate 3 (Code Review)**: Review độc lập không phát hiện vi phạm kiến trúc, không tăng số file `disable-size-check`.
- **Gate 4 (QA Verification)**:
  - 100% test pass trên cả 3 bộ: Desktop Smoke, Mobile Web Smoke, Dashboard Regression.
  - Zero unexpected console errors/warnings.
  - Kiểm tra giao diện responsive tại 4 viewport (1920x1080, 1440x900, 1280x800, 390x844) trên cả Light và Dark mode.
