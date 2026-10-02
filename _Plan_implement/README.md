# Implementation Plans Dashboard — `@hadinhkms/qa-automation-engine`

Nơi lưu trữ và điều phối toàn bộ các **Implementation Plan** của QA Automation Engine Hub theo quy chuẩn **Feature-Cluster** và **Archive Lifecycle** của Master Process.

> 📁 **Quy ước dự án:** Mọi kế hoạch của Hub được lưu trữ độc quyền tại thư mục `_Plan_implement/` (không sử dụng song song `plan/` hay `plans/`).

---

## 1. 🚀 Đang Triển Khai (Active Plans)

| Mã Plan | Tính Năng / Kế Hoạch | Thư Mục Cụm (Feature-Cluster) | File Điều Phối | Trạng Thái | Tiến Độ |
|---|---|---|---|:---:|:---:|
| **PLAN-20** | **Ổn Định Khung Kiểm Thử, Dashboard Parity & CI/CD Hub** | [framework-stabilization/](framework-stabilization/) | [plan-20-overview.md](framework-stabilization/plan-20-overview.md) | `READY_FOR_EXECUTION` | 0/3 Phase |

### Chi tiết kế hoạch đang chạy:
- **[Plan 20: Framework Reliability & Quality Stabilization](framework-stabilization/plan-20-overview.md)**:
  - 🔹 [Phase 1: E2E Isolation & Runner Hygiene](framework-stabilization/phase-1-e2e-isolation-and-smoke-fix.md): Cô lập test bằng HTML fixture cục bộ (hết phụ thuộc `example.com`), dọn rác `.tmp-workspace-*` và thêm `testIgnore`.
  - 🔹 [Phase 2: Dashboard Parity & DOM Budget](framework-stabilization/phase-2-dashboard-parity-and-dom-budget.md): Bổ sung CSS tokens (`--warning-subtle`, `--accent-subtle`), chuẩn hóa viền/màu trong `qa.css`, tối ưu Lazy Mount đưa DOM ban đầu về `< 1,500` node.
  - 🔹 [Phase 3: Traceability Hub-Spoke & CI Pipeline](framework-stabilization/phase-3-traceability-hub-spoke-and-ci-pipeline.md): Chuẩn hóa `qaTrace.js` chế độ Hub Mode (0 finding major), kích hoạt CI Playwright headless trên PR, dọn dẹp Git tracking.

---

## 2. 📋 Kế Hoạch Đang Chờ / Backlog

*Hiện tại không có kế hoạch nào trong Backlog. Toàn bộ trọng tâm đang tập trung vào thực thi Plan 20.*

---

## 3. 📦 Kế Hoạch Đã Hoàn Thành & Lưu Trữ (Archived Plans)

Các kế hoạch đã hoàn tất thực thi, nghiệm thu Gate 4 và triển khai production được phân loại lưu trữ theo niên khóa (`archive/YYYY-MM/<feature>/`):

| Mã Plan | Tên Kế Hoạch | Thư Mục Lưu Trữ | Ngày Lưu Trữ | Trạng Thái |
|---|---|---|---|:---:|
| **PLAN-19** | **BDD Spec & Smart Test Data Studio (19, 19a, 19b)** | [archive/2026-10/plan-19-bdd-spec-and-smart-test-data/](archive/2026-10/plan-19-bdd-spec-and-smart-test-data/) | 2026-10-02 | `ĐÃ NGHIỆM THU` |
| **PLAN-18** | **QA Static Findings Batch Processing & Conflict Studio** | [archive/2026-09/plan-18-qa-static-findings-batch-processing/](archive/2026-09/plan-18-qa-static-findings-batch-processing/) | 2026-09-30 | `ĐÃ NGHIỆM THU` |
| **PLAN-17** | **AI Assisted QA Framework (Copilot, Triage & Fast-Wins)** | [archive/2026-09/plan-17-ai-assisted-qa-framework/](archive/2026-09/plan-17-ai-assisted-qa-framework/) | 2026-09-28 | `ĐÃ NGHIỆM THU` |
| **PLAN-16** | **Traceability Conflict Resolution Studio** | [archive/2026-09/plan-16-traceability-conflict-studio/](archive/2026-09/plan-16-traceability-conflict-studio/) | 2026-09-27 | `ĐÃ NGHIỆM THU` |
| **PLAN-09** | **Frontend Strangler Monolith & System Modularization** | [archive/2026-09/plan-09-strangler-architecture/](archive/2026-09/plan-09-strangler-architecture/) | 2026-09-25 | `ĐÃ NGHIỆM THU` |

---

## 4. Quy Ước Thư Mục Cụm (Feature-Cluster Convention)

1. **Mỗi tính năng là một thư mục riêng biệt:**
   - Kế hoạch mới được tạo trong `_Plan_implement/<tên-tính-năng>/`.
   - File tổng quan: `<tên-tính-năng>-overview.md` (hoặc `plan-<mã>-overview.md`).
   - Các file phase con: `phase-1-<tên-phase>.md`, `phase-2-<tên-phase>.md`... (≤ 200 dòng/file).
2. **Kỷ luật chia nhỏ (Plan Splitting Protocol):**
   - Tuyệt đối không tạo 1 file markdown monolith duy nhất cho kế hoạch đa phase.
   - Luôn duy trì bảng WBS, sơ đồ phụ thuộc (Dependency Graph) và ma trận nghiệm thu.
3. **Thực thi bằng Master Prompt 12:**
   ```markdown
   PROJECT_ROOT: .
   PLAN_PATH: _Plan_implement/<tên-tính-năng>/<tên-tính-năng>-overview.md
   EXECUTION_SCOPE: Phase 1
   ```
4. **Lưu trữ tự động khi đóng phase:**
   - Khi kế hoạch hoàn tất 100%, di chuyển cụm sang `_Plan_implement/archive/YYYY-MM/<tên-tính-năng>/` và cập nhật mục 3 của bảng Dashboard này.
