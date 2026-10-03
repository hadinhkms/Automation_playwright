# Kế Hoạch 22: Xử Lý Rủi Ro Hệ Thống, Khôi Phục CI/CD & Chuẩn Hóa Hub-to-Spoke

> **Plan ID:** `PLAN-22-RISK-REMEDIATION-2026-10-03` · **Cấp độ:** `L3` · **Phiên bản:** `1.0.0`  
> **Trạng thái:** `COMPLETED (100% GREEN)` · **Mục tiêu:** 100% Green Unit Test Runner (`node --test`), Khắc phục Rò rỉ AI Concurrency Slot, Đồng Bộ Hóa Hệ Sinh Thái Vệ Tinh (Hub-to-Spoke), Cập Nhật Audit Registry & Showcase Traceability Mẫu.

---

## 1. Bối Cảnh & Mục Tiêu

### 1.1. Bối Cảnh & Rủi Ro Phát Hiện (Audit Findings)
Qua đánh giá sức khỏe toàn diện hệ thống `@hadinhkms/qa-automation-engine`, phát hiện 4 nhóm rủi ro:
1. **CI Unit Test Runner sập (7/766 test fail)**:
   - File test sao lưu [visualBuilderCompiler.test.js](file:///d:/_Automation-Project/_backup_vieclam24h/core/generator/visualBuilderCompiler.test.js) bị `node --test` quét trúng nhưng thiếu module `./visualBuilderCompiler`.
   - 6 test trong [agentService.test.js](file:///d:/_Automation-Project/core/ai/agentService.test.js) gọi mạng thật vì thiếu mock adapter kết nối vào Gateway `callAi`, gây chiếm dụng 2 slot đồng thời của [limits.js](file:///d:/_Automation-Project/core/ai/gateway/limits.js) và bắn lỗi `BUSY: Đang có 2 tác vụ AI chạy`.
2. **Lệch pha Vệ Tinh (Satellite Drift)**:
   - `_SieuVietGroup` (Vieclam24h, trước đây là `_SV_Automation`) có file [run-suite.js](file:///d:/_Automation-Project/scripts/run-suite.js) chứa logic chạy suite riêng có nguy cơ bị ghi đè xóa mất khi sync từ Hub.
   - `Automation_Carthings` bị tụt hậu 41 file chưa được cập nhật các cải tiến của Plan 20 và Plan 21.
3. **Lệch pha Sổ Thẩm Định ([FINDINGS_REGISTRY.md](file:///d:/_Automation-Project/audit/FINDINGS_REGISTRY.md))**:
   - Registry đang theo dõi các file không còn tồn tại trong `tests/` của Hub (`job-search.spec.js`, `JobDetailPage.js`), tạo số liệu ảo trên audit báo cáo.
4. **Thiếu Bộ Mẫu Traceability & Rác Cấu Hình**:
   - `requirements/` và `test-cases/` đang rỗng; test `saucedemo_login.spec.js` chưa gắn `@REQ`.
   - Warning placeholder `baseURL https://example.com` xuất hiện liên tục khi chạy test do thiếu `dashboardConfig.json` ở root.

### 1.2. Mục Tiêu Nghiệm Thu Tổng Thể
- Đưa `node --test` về trạng thái **100% Green** (764/764 pass: 585 unit + 179 dashboard contract).
- Bảo toàn an toàn 100% mã nguồn khi chạy `npm run presync:drift:strict` và `npm run sync:satellites`.
- Làm sạch Sổ Thẩm định, liên kết chính xác hiện trạng Hub Engine.
- Cung cấp bộ dữ liệu Traceability mẫu hoàn chỉnh cho tính năng SauceDemo, đạt 0 major finding trên `qa:check`.

---

## 2. Cấu Trúc Phase & Phân Rã Công Việc (WBS)

```text
Phase 1: CI Unit Test Recovery & AI Gateway Mock Isolation
   ├── Cách ly _backup_vieclam24h khỏi runner qua script npm test:unit
   ├── Cập nhật createAgentService & gateway hỗ trợ mock fetchImpl / adapter
   └── Thêm resetSlotsForTesting() trong limits.js để chống rò rỉ slot
         │
         ▼
Phase 2: Hub-to-Spoke Satellite Sync & Audit Registry Alignment
   ├── Chuẩn hóa scripts/run-suite.js lên Hub hoặc đưa vào core/local/ vệ tinh
   ├── Kích hoạt sync:satellites cập nhật 41 file cho Automation_Carthings
   └── Lưu trữ findings cũ và cập nhật FINDINGS_REGISTRY.md sạch cho Hub
         │
         ▼
Phase 3: Traceability Showcase Suite, Config & Repo Hygiene
   ├── Tạo REQ-001 (Authentication) và REQ-001-authentication.md gắn kết với saucedemo_login.spec.js
   ├── Cập nhật .env.example và tạo dashboardConfig.json chuẩn ở root
   ├── Bổ sung _backup_vieclam24h/ vào .gitignore
   └── Xác nhận nghiệm thu toàn diện Gate 4 (Playwright + Dashboard + Unit tests)
```

| Phase | File Đặc Tả Chi Tiết | Trọng Tâm Xử Lý | Trạng Thái |
|---|---|---|:---:|
| **1** | [phase-1-ci-unit-test-recovery.md](phase-1-ci-unit-test-recovery.md) | Unit test 100% Green, Mock AI Gateway, Slot Reset | `COMPLETED` |
| **2** | [phase-2-hub-spoke-and-audit-sync.md](phase-2-hub-spoke-and-audit-sync.md) | Sync Drift `run-suite.js`, CarThings update, Clean Audit | `COMPLETED` |
| **3** | [phase-3-traceability-showcase-and-hygiene.md](phase-3-traceability-showcase-and-hygiene.md) | Showcase REQ-001, Root Config, Gitignore Backup, Gate 4 | `COMPLETED` |

---

## 3. Ma Trận Quyết Định Kỹ Thuật (Design Decisions)

| Mã | Quyết Định | Giải Pháp Lựa Chọn | Lý Do & Lợi Ích |
|---|---|---|---|
| **D1** | Phạm vi quét Unit Test | Tách biệt lệnh `test:unit` trong `package.json` với danh sách glob rõ ràng (`core/**`, `dashboard/**`, `scripts/**`, `tools/**`). | Ngăn runner quét các thư mục backup hoặc thư mục tạm thời mà không cần xóa vật lý dữ liệu backup. |
| **D2** | Cô lập Test AI Gateway | Bổ sung hàm `resetLimitsForTesting()` trong `limits.js` và hỗ trợ `fetchImpl` trong `createAgentService` chuyển tiếp vào gateway adapter. | Giúp unit test chạy hoàn toàn offline, tốc độ < 50ms, không rò rỉ trạng thái `activeCalls` giữa các test. |
| **D3** | An toàn mã nguồn vệ tinh | Đưa `scripts/run-suite.js` thành script chuẩn của Hub nếu phục vụ nhu cầu chung, hoặc ghi rõ hướng dẫn đưa vào `core/local/` trước khi sync. | Loại bỏ rủi ro mất mã nguồn riêng của vệ tinh `_SieuVietGroup` (trước đây là `_SV_Automation`). |
| **D4** | Showcase Traceability | Dùng `saucedemo_login.spec.js` làm kịch bản mẫu gắn với `REQ-001`, `AC-001..003` và `TC-001..003` (trong `test-cases/REQ-001-authentication.md`). | Người dùng mới cài đặt engine có sẵn dữ liệu mẫu thực tế, chứng minh tính năng QA View & Smart Linker hoạt động trơn tru. |
