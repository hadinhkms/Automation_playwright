# Implementation Plans Dashboard — `@hadinhkms/qa-automation-engine`

Nơi lưu trữ và điều phối toàn bộ các **Implementation Plan** của QA Automation Engine Hub theo quy chuẩn **Feature-Cluster** và **Archive Lifecycle** của Master Process.

> 📁 **Quy ước dự án:** Mọi kế hoạch của Hub được lưu trữ độc quyền tại thư mục `_Plan_implement/` (không sử dụng song song `plan/` hay `plans/`).

---

## 1. 🚀 Đang Triển Khai (Active Plans)

| Mã Plan | Tính Năng / Kế Hoạch | Thư Mục Cụm (Feature-Cluster) | File Điều Phối | Trạng Thái | Tiến Độ |
|---|---|---|---|:---:|:---:|
| **PLAN-21** | **Bộ Liên Kết Truy Vết Thông Minh (Smart Trace Linker)** | [smart-trace-linker/](smart-trace-linker/) | [plan-21-overview.md](smart-trace-linker/plan-21-overview.md) | `COMPLETED` | 3/3 Phase |
| **PLAN-20** | **Ổn Định Khung Kiểm Thử, Dashboard Parity & CI/CD Hub** | [framework-stabilization/](framework-stabilization/) | [plan-20-overview.md](framework-stabilization/plan-20-overview.md) | `COMPLETED` | 3/3 Phase |

### Chi tiết kế hoạch đang chạy:
- **[Plan 21: Smart Trace Linker (1-Click Spec to Requirement)](smart-trace-linker/21_SMART_TRACE_LINKER_PLAN.md)** ([Điều phối Phase](smart-trace-linker/plan-21-overview.md)):
  - 🔹 [Phase 1: Backend Smart Matcher & Linker API](smart-trace-linker/phase-1-backend-smart-matcher-and-linker-api.md): Thuật toán so khớp Heuristic / Semantic song ngữ, 2 route API `/api/qa/smart-link` và `/api/qa/smart-link/apply` (có `withWriteLock`).
  - 🔹 [Phase 2: Studio UI & Code Editor Integration](smart-trace-linker/phase-2-studio-ui-and-editor-integration.md): Nút bấm thông minh trên Code Editor toolbar (`#/builder`, `builder-view`), nút trong bảng Vấn đề (`#/qa`, `findingRows.js`), modal Preview Lazy-Mounted và đăng ký CSS Master Cascade.
  - 🔹 [Phase 3: Reverse Sync, Edge Cases & Verification](smart-trace-linker/phase-3-reverse-sync-and-e2e-verification.md): Cơ chế đồng bộ ngược cho spec đã có REQ, test E2E Playwright, Gate 4 `npm run mp:gate` và bảo toàn Hub-to-Spoke.
- **[Plan 20: Framework Reliability & Quality Stabilization](framework-stabilization/plan-20-overview.md)**:
  - 🔹 Phase 1: E2E Isolation & Runner Hygiene (Đã nghiệm thu)
  - 🔹 Phase 2: Dashboard Parity & DOM Budget (Đã nghiệm thu)
  - 🔹 Phase 3: Traceability Hub-Spoke & CI Pipeline (Đã nghiệm thu)

---

## 2. 📋 Kế Hoạch Đang Chờ / Backlog

*Hiện tại không có kế hoạch nào trong Backlog. Toàn bộ trọng tâm đang tập trung vào thực thi Plan 21.*

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
