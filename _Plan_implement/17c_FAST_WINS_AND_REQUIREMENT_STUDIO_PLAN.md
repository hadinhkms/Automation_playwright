# Kế Hoạch 17c: Thắng Nhanh — Soát Requirement, Sinh Test Case, Soạn Bug Nháp & Nhật Ký AI

> **Mã kế hoạch:** `PLAN-17c` (Chặng 3 của [PLAN-17](17_AI_ASSISTED_QA_FRAMEWORK_PLAN.md) §6)  
> **Trạng thái:** `COMPLETED (100% PASS)`  
> **Phạm vi:** BA-1 (Soát độ rõ REQ) · QA-1 (Sinh TC từ AC) · QA-4 (Soạn Bug Report nháp) · F3 UI (Màn hình Nhật ký AI)  
> **Điều kiện đầu vào:** PLAN-17a và 17b đã hoàn tất (commits `c9a8de9`, `3332dcf`, `e44c929`), AI Gateway sẵn sàng, 20 ca lỗi CarThings đạt 100%.  
> **Chiến lược nhánh:** Trunk-based development trên `main`, kiểm định nghiêm ngặt qua Gate 3 và Gate 4 trước khi commit.  
> **Tham chiếu:** [AGENTS.md](../AGENTS.md), [17_AI_ASSISTED_QA_FRAMEWORK_PLAN.md](17_AI_ASSISTED_QA_FRAMEWORK_PLAN.md), [17a_FOUNDATION_GATEWAY_PLAN.md](17a_FOUNDATION_GATEWAY_PLAN.md), [17b_TRIAGE_AND_JIRA_STORY_PLAN.md](17b_TRIAGE_AND_JIRA_STORY_PLAN.md)

---

## 0. Tóm Tắt Mục Tiêu

Chặng 3 hiện thực hóa gói tính năng "Thắng nhanh" (Fast Wins) phục vụ trực tiếp cho BA, PO và QA trong chu trình Living Documentation & Defect Lifecycle:

1. **BA-1 — Soát Độ Rõ Của Requirement (Ambiguous Text / Clarity Checker):**
   - Đọc nội dung Requirement markdown (`requirements/REQ-xxx.md`).
   - Phân tích và phát hiện các cụm từ mơ hồ, định tính, thiếu tiêu chí đo lường (vd. "nhanh chóng", "đẹp", "dễ dùng", "nếu cần", thiếu timeout, thiếu validation biên).
   - Đề xuất câu hỏi làm rõ và văn bản viết lại sắc nét theo chuẩn BDD (Given-When-Then).
   - Độ chính xác phát hiện câu mơ hồ $\ge 80\%$.

2. **QA-4 — Soạn Thảo Bug Report Nháp Tự Động Từ Test Failure:**
   - Kết nối trực tiếp với kết quả RCA của QA-3 (`triageFailure`).
   - Tự động điền mẫu Bug Report chuẩn mực:
     * Tiêu đề chuẩn: `[Bug] <Tóm tắt ngắn gọn>`
     * Mức độ nghiêm trọng (Severity): Blocker / Major / Minor tương ứng với kết quả triage.
     * Các bước tái hiện (Steps to Reproduce) trích xuất từ test steps / call log.
     * Kết quả thực tế (Actual) vs Kết quả kỳ vọng (Expected).
     * Bằng chứng (Log stack, locator, ảnh chụp).
     * Đề xuất hướng xử lý cho Dev / QA.
   - Hỗ trợ copy Markdown 1-click để dán lên Jira / GitHub Issue.

3. **QA-1 — Sinh Test Case Tự Động Từ Acceptance Criteria (AC):**
   - Đọc danh sách AC từ Requirement markdown.
   - Sinh bộ Test Cases toàn diện bao gồm: Happy path, Negative flow, Boundary value (BVA), và Permission / Security checks.
   - Gắn mã `TC-xxx` theo format của dự án, liên kết chính xác `@AC-yyy`.

4. **F3 UI — Màn Hình Web Tra Cứu "Nhật Ký AI" (Audit Log Viewer):**
   - Giao diện trực quan đọc dữ liệu từ `GET /api/ai/audit`.
   - Hiển thị bảng lịch sử: Thời gian, Task, Provider/Model, Độ trễ (ms), Token tiêu thụ, Chi phí ước tính, Trạng thái (Success / Failed / Aborted).
   - Tích hợp bộ lọc theo Task và nút "Xóa nhật ký".

---

## 1. Kiến Trúc & Danh Mục Module Mới

| Module | Đường Dẫn | Trách Nhiệm | Giới Hạn Dòng |
|---|---|---|:---:|
| `checkRequirementClarity.js` | `core/ai/tasks/checkRequirementClarity.js` | Task AI phân tích câu mơ hồ & đề xuất làm rõ | $\le 150$ |
| `draftBugReport.js` | `core/ai/tasks/draftBugReport.js` | Task AI sinh Bug Report nháp từ failure | $\le 150$ |
| `generateTestCases.js` | `core/ai/tasks/generateTestCases.js` | Task AI sinh danh sách Test Case từ AC | $\le 150$ |
| `aiFastWinsRoutes.js` | `dashboard/routes/aiFastWinsRoutes.js` | Router con phụ trách Fast Wins & Audit Log | $\le 150$ |
| `aiRoutes.js` (Tối ưu) | `dashboard/routes/aiRoutes.js` | Dispatcher mượt mà, phân quyền module an toàn | $\le 250$ |
| `reqAnalyzerHelper.js` | `dashboard/public/js/views/qa/reqAnalyzerHelper.js` | UI helper hiển thị điểm số rõ ràng & câu hỏi làm rõ | Tối ưu module |
| `templates/settings.html` | `dashboard/public/templates/settings.html` | Card 5 Bảng tra cứu AI Audit Log & Token ledger | Tối ưu HTML |
| Test API Contract | `tests/dashboard-api/gatewayFastWins.test.js` | Unit & API contract tests cho Chặng 3 (7 test cases PASS 100%) | $\le 150$ |
| Test E2E Playwright | `tests/dashboard/qa-ai-fast-wins.spec.js` | E2E kiểm thử luồng UI BA-1, QA-4, QA-1, F3 UI (4 test cases PASS 100%) | PASS |

---

## 2. Lộ Trình Triển Khai (3 Phase)

### Phase 1 — Core AI Tasks & Backend Endpoints
- [x] 1.1 Tạo `core/ai/tasks/checkRequirementClarity.js` (Schema, prompt, luật heuristic lọc từ mơ hồ tiếng Việt/Anh).
- [x] 1.2 Tạo `core/ai/tasks/draftBugReport.js` (Schema, prompt tạo bug report Jira Markdown).
- [x] 1.3 Tạo `core/ai/tasks/generateTestCases.js` (Schema, prompt sinh TC Given-When-Then từ AC).
- [x] 1.4 Mở rộng `dashboard/routes/aiFastWinsRoutes.js` và `aiRoutes.js` bổ sung endpoints mới kèm signal và token ledger.
- [x] 1.5 Viết bộ test `tests/dashboard-api/gatewayFastWins.test.js` (7 test cases PASS 100%).

### Phase 2 — Tích Hợp UI Trên Dashboard
- [x] 2.1 Mở rộng `#qa-req-analyzer-modal`: Thêm nút "Soát độ rõ (AI)" và hiển thị kết quả phân tích.
- [x] 2.2 Mở rộng `#qa-req-analyzer-modal`: Thêm nút "Sinh Test Case (AI)" từ AC đã chọn.
- [x] 2.3 Mở rộng panel `.diagnostics-panel` ở Test Runner: Bổ sung nút "Soạn Bug nháp" khi test fail kèm 1-click copy.
- [x] 2.4 Xây dựng component tra cứu Audit Log trong giao diện Dashboard (F3 UI Settings Card 5).

### Phase 3 — E2E Suite, CarThings Verification & Quality Gate 4
- [x] 3.1 Bộ test E2E Playwright `tests/dashboard/qa-ai-fast-wins.spec.js` (4/4 PASS 100%).
- [x] 3.2 Kiểm chứng trên 10 file REQ thật của CarThings (`carthings-requirements.json` qua `P17C-TC-11` PASS 100%).
- [x] 3.3 Đảm bảo 0 vi phạm modularity, `check:framework` PASS và commit sạch trên `main`.
