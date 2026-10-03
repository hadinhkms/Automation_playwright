# Implementation Plans Dashboard — `@hadinhkms/qa-automation-engine`

Nơi lưu trữ và điều phối toàn bộ các **Implementation Plan** của QA Automation Engine Hub theo quy chuẩn **Feature-Cluster** và **Archive Lifecycle** của Master Process.

> 📁 **Quy ước dự án:** Mọi kế hoạch của Hub được lưu trữ độc quyền tại thư mục `_Plan_implement/` (không sử dụng song song `plan/` hay `plans/`).

---

## 1. 🚀 Kế Hoạch Đang Triển Khai (Active Implementation Plans)

| Mã Plan | Tính Năng / Kế Hoạch | Thư Mục Cụm (Feature-Cluster) | File Điều Phối | Trạng Thái | Tiến Độ & Mục Tiêu |
|---|---|---|---|:---:|---|
| **PLAN-23** | **Khắc Phục Lỗ Hổng Hệ Thống, Đồng Bộ Hub Anti-Drift & Chuẩn Hóa Plan** | [system-hardening-and-remediation/](system-hardening-and-remediation/) | [plan-23-overview.md](system-hardening-and-remediation/plan-23-overview.md) | `COMPLETED` | 4/4 Phase hoàn tất (100% Green, Drift IN_SYNC, Probes PASS) |

### Chi tiết các phase của Plan 23:
- **[Plan 23: System Hardening, Anti-Drift & Gate Remediation](system-hardening-and-remediation/plan-23-overview.md)**:
  - 🔹 [Phase 1: Đồng Bộ Hub Anti-Drift & Cập Nhật Tri Thức](system-hardening-and-remediation/phase-1-drift-sync-and-knowledge.md): Khắc phục lệch commit Hub `20caf254`, cập nhật lockfile và template tri thức mới.
  - 🔹 [Phase 2: Căn Chỉnh Hợp Đồng Gate 4 & Đóng Sổ Audit](system-hardening-and-remediation/phase-2-gate4-contract-and-evidence-realignment.md): Đồng bộ contract SHA256 pin, đóng chính thức finding HUB-01/HUB-02 trong Sổ Audit.
  - 🔹 [Phase 3: Vệ Sinh Mã Nguồn, Chống Rác Workspace & Sửa Probes](system-hardening-and-remediation/phase-3-hygiene-and-probe-fixes.md): Xóa thư mục rác tạm thời, thêm teardown an toàn, tinh chỉnh Probe P5 tránh false positive.
  - 🔹 [Phase 4: Lưu Trữ Kế Hoạch Cũ & Chuẩn Hóa Dashboard Plan](system-hardening-and-remediation/phase-4-plan-archive-and-standardization.md): Gom plan 20, 21, 22 vào niên khóa `archive/2026-10/` và duy trì chuẩn Master Process.

---

## 2. 📋 Kế Hoạch Tiếp Theo (Upcoming Plans & Backlog)

- **Kế hoạch Dự kiến (Candidates for Plan 24):**
  - **Tái cấu trúc & Chia nhỏ các Legacy Module (Modular Decomposition):** Triển khai chia nhỏ các file mang cờ `master-process-disable-size-check` lâu đời (`core/generator/objectRepository.js`, `core/utils/commonUtils.js`, `core/utils/dataManager.js`) về ngân sách chuẩn $\le 200$ dòng.
  - **Mở rộng Đa Dự Án (Multi-Tenant Workspace Selector):** Hỗ trợ chuyển đổi nhanh ngữ cảnh giữa Hub và các vệ tinh ngay trên giao diện Dashboard.

---

## 3. 📦 Kế Hoạch Đã Hoàn Thành & Lưu Trữ (Archived Plans)

Các kế hoạch đã hoàn tất thực thi, nghiệm thu Gate 4 và triển khai production được phân loại lưu trữ theo niên khóa (`archive/YYYY-MM/<feature>/`):

| Mã Plan | Tên Kế Hoạch | Thư Mục Lưu Trữ | Ngày Lưu Trữ | Trạng Thái |
|---|---|---|---|:---:|
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
