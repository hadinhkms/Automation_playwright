# Implementation Plans Dashboard — `@hadinhkms/qa-automation-engine`

Nơi lưu trữ và điều phối toàn bộ các **Implementation Plan** của QA Automation Engine Hub theo quy chuẩn **Feature-Cluster** và **Archive Lifecycle** của Master Process.

> 📁 **Quy ước dự án:** Mọi kế hoạch của Hub được lưu trữ độc quyền tại thư mục `_Plan_implement/` (không sử dụng song song `plan/` hay `plans/`).

---

## 1. 🚀 Kế Hoạch Đang Triển Khai (Active Implementation Plans)

| Mã Plan | Tính Năng / Kế Hoạch | Thư Mục Cụm (Feature-Cluster) | File Điều Phối | Trạng Thái | Tiến Độ & Mục Tiêu |
|---|---|---|---|:---:|---|
| **PLAN-24** | **Khắc Phục Probe P4, Lưu Trữ Kế Hoạch 23 & Chuẩn Hóa Git Hygiene** | [probe-hardening-and-git-hygiene/](probe-hardening-and-git-hygiene/) | [plan-24-overview.md](probe-hardening-and-git-hygiene/plan-24-overview.md) | `IN_PROGRESS` | 2/3 Phase hoàn tất (P4 Green, Plan 23 Archived) |

### Chi tiết các phase của Plan 24:
- **[Plan 24: Probe Hardening, Plan 23 Archival & Git Hygiene](probe-hardening-and-git-hygiene/plan-24-overview.md)**:
  - 🔹 [Phase 1: Khắc Phục Probe P4 False Positive & Kiểm Định Probes](probe-hardening-and-git-hygiene/phase-1-probe-p4-fix-and-verification.md): Loại trừ tài liệu markdown khỏi git log quét secret, đưa Probe P4 về PASS 100%.
  - 🔹 [Phase 2: Lưu Trữ Plan 23 Vào Archive & Chuẩn Hóa Dashboard](probe-hardening-and-git-hygiene/phase-2-plan23-archival-and-dashboard-alignment.md): Lưu trữ Plan 23 vào `archive/2026-10/`, đồng bộ Dashboard và kiểm định liên kết.
  - 🔹 [Phase 3: Đóng Chu Trình Git Hygiene & Nghiệm Thu Sẵn Sàng Gate 4](probe-hardening-and-git-hygiene/phase-3-git-hygiene-and-gate4-readiness.md): Đóng gói commit sạch sẽ, xác nhận Probe P6 PASS và nghiệm thu Gate 4.

---

## 2. 📋 Kế Hoạch Tiếp Theo (Upcoming Plans & Backlog)

- **Kế hoạch Dự kiến (Candidates for Plan 25):**
  - **Tái cấu trúc & Chia nhỏ các Legacy Module (Modular Decomposition):** Triển khai chia nhỏ các file mang cờ `master-process-disable-size-check` lâu đời (`core/generator/objectRepository.js`, `core/utils/commonUtils.js`, `core/utils/dataManager.js`) về ngân sách chuẩn $\le 200$ dòng.
  - **Mở rộng Đa Dự Án (Multi-Tenant Workspace Selector):** Hỗ trợ chuyển đổi nhanh ngữ cảnh giữa Hub và các vệ tinh ngay trên giao diện Dashboard.

---

## 3. 📦 Kế Hoạch Đã Hoàn Thành & Lưu Trữ (Archived Plans)

Các kế hoạch đã hoàn tất thực thi, nghiệm thu Gate 4 và triển khai production được phân loại lưu trữ theo niên khóa (`archive/YYYY-MM/<feature>/`):

| Mã Plan | Tên Kế Hoạch | Thư Mục Lưu Trữ | Ngày Lưu Trữ | Trạng Thái |
|---|---|---|---|:---:|
| **PLAN-23** | **Khắc Phục Lỗ Hổng Hệ Thống, Đồng Bộ Hub Anti-Drift & Chuẩn Hóa Plan** | [archive/2026-10/system-hardening-and-remediation/](archive/2026-10/system-hardening-and-remediation/) | 2026-10-03 | `ĐÃ NGHIỆM THU` |
| **PLAN-22** | **Xử Lý Rủi Ro Hệ Thống, Khôi Phục CI & Chuẩn Hóa Hub** | [archive/2026-10/framework-risk-remediation/](archive/2026-10/framework-risk-remediation/) | 2026-10-03 | `ĐÃ NGHIỆM THU` |
| **PLAN-21** | **Bộ Liên Kết Truy Vết Thông Minh (Smart Trace Linker)** | [archive/2026-10/smart-trace-linker/](archive/2026-10/smart-trace-linker/) | 2026-10-03 | `ĐÃ NGHIỆM THU` |
| **PLAN-20** | **Ổn Định Khung Kiểm Thử, Dashboard Parity & CI/CD Hub** | [archive/2026-10/framework-stabilization/](archive/2026-10/framework-stabilization/) | 2026-10-03 | `ĐÃ NGHIỆM THU` |
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
