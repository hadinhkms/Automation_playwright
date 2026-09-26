# Kế Hoạch 17e: Mở Rộng & Tự Động Hóa — Trợ Lý Quyết Định, Copy Jira, Phát Hiện Test Flaky & Tóm Tắt CI

> **Mã kế hoạch:** `PLAN-17e` (Chặng 5 của [PLAN-17](17_AI_ASSISTED_QA_FRAMEWORK_PLAN.md) §6)  
> **Trạng thái:** `COMPLETED (100% PASS)`  
> **Phạm vi:** PO-3 (Trợ lý sổ quyết định) · BA-5 (Copy for Jira) · QA-6 (Phát hiện test flaky) · DEV-3 (Tóm tắt kết quả CI)  
> **Điều kiện đầu vào:** PLAN-17a, 17b, 17c, 17d đã hoàn tất trên `main`, AI Gateway hoạt động ổn định.  
> **Chiến lược nhánh:** Trunk-based development trên `main`, tuân thủ 12 nguyên tắc thiết kế, line limits nghiêm ngặt.  
> **Tham chiếu:** [AGENTS.md](../AGENTS.md), [17_AI_ASSISTED_QA_FRAMEWORK_PLAN.md](17_AI_ASSISTED_QA_FRAMEWORK_PLAN.md)

---

## 0. Tóm Tắt Mục Tiêu

Chặng 5 hoàn thiện các tính năng mở rộng cuối cùng trong bức tranh toàn cảnh của PLAN-17:

1. **PO-3 — Trợ Lý Sổ Quyết Định (`draftDecisionRecord.js`):**
   - Phân tích và quản lý `decisions.json`.
   - Phát hiện các quyết định mâu thuẫn, quyết định treo chưa hoàn tất, đề xuất bản ghi quyết định ADR (Context, Decision, Consequences).

2. **BA-5 — Định Dạng Copy Cho Jira (`copyForJira.js`):**
   - Chuẩn hóa thông tin Requirement, Test Cases, Open Questions, kết quả chạy test sang định dạng bảng biểu và markup đặc trưng của Jira.

3. **QA-6 — Phát Hiện Test Flaky (`detectFlakyTests.js`):**
   - Phân tích lịch sử các lần chạy test để tìm ra test case chập chờn (pass/fail xen kẽ), tính chỉ số flakiness rate và chỉ ra nguyên nhân khả dĩ.

4. **DEV-3 — Tóm Tắt Kết Quả CI (`summarizeCiRun.js`):**
   - Phân tích báo cáo JUnit XML của đợt chạy CI, tổng hợp số lượng pass/fail/skip, điểm nóng hồi quy và soạn bản tin tóm tắt cho team.

---

## 1. Danh Mục File & Giới Hạn Dòng

| Module | Đường Dẫn | Trách Nhiệm | Giới Hạn Dòng |
|---|---|---|:---:|
| `draftDecisionRecord.js` | `core/ai/tasks/draftDecisionRecord.js` | Quản trị sổ quyết định ADR, phát hiện mâu thuẫn | $\le 150$ |
| `copyForJira.js` | `core/ai/tasks/copyForJira.js` | Định dạng dữ liệu QA/REQ cho Jira | $\le 150$ |
| `detectFlakyTests.js` | `core/ai/tasks/detectFlakyTests.js` | Phát hiện test case chập chờn từ lịch sử chạy | $\le 150$ |
| `summarizeCiRun.js` | `core/ai/tasks/summarizeCiRun.js` | Tổng hợp báo cáo JUnit XML từ CI | $\le 150$ |
| `aiExtendedRoutes.js` | `dashboard/routes/aiExtendedRoutes.js` | Router phụ trách các endpoints Chặng 5 | $\le 150$ |
| Test API Contract | `tests/dashboard-api/gatewayExtended.test.js` | Unit & API contract tests cho Chặng 5 (5/5 PASS) | $\le 150$ |

---

## 2. Kế Hoạch Triển Khai (3 Phase)

### Phase 1: Core Tasks
- [x] 1.1 `core/ai/tasks/draftDecisionRecord.js`
- [x] 1.2 `core/ai/tasks/copyForJira.js`
- [x] 1.3 `core/ai/tasks/detectFlakyTests.js`
- [x] 1.4 `core/ai/tasks/summarizeCiRun.js`
- [x] 1.5 Cập nhật `core/ai/tasks/index.js`

### Phase 2: Backend Routes & Unit Tests
- [x] 2.1 `dashboard/routes/aiExtendedRoutes.js`
- [x] 2.2 Tích hợp vào `dashboard/routes/aiRoutes.js`
- [x] 2.3 Unit test `tests/dashboard-api/gatewayExtended.test.js` (PASS 100%)

### Phase 3: UI Integration & Verification Gate 4
- [x] 3.1 Nút "Copy cho Jira" (BA-5) và "Kiểm tra Flaky" (QA-6) trong Dashboard
- [x] 3.2 Kiểm tra `check:framework` và commit trên `main`
