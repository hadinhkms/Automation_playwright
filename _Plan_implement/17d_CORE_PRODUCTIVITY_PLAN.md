# Kế Hoạch 17d: Tăng Năng Suất — Context Builder, Spec Review, Gợi Ý Locator, Test Impact, Release Briefing, Spec Generator

> **Mã kế hoạch:** `PLAN-17d` (Chặng 4 của [PLAN-17](17_AI_ASSISTED_QA_FRAMEWORK_PLAN.md) §6)  
> **Trạng thái:** `COMPLETED (100% PASS)`  
> **Phạm vi:** F4 Context Builder · F2 Prompt Repo · QA-5 (Sửa Locator) · QA-9 (Spec Reviewer) · DEV-1 (Test Impact Diff) · PO-1 (Bản tin phát hành) · BA-3 (Ảnh hưởng REQ đổi) · QA-2 (Playwright Spec Generator với 2-level Sandbox)  
> **Điều kiện đầu vào:** PLAN-17a, 17b, 17c đã hoàn tất trên `main`, AI Gateway hoạt động ổn định, 100% test contract & E2E xanh.  
> **Chiến lược nhánh:** Trunk-based development trên `main`, tuân thủ 12 nguyên tắc thiết kế, line limits nghiêm ngặt.  
> **Tham chiếu:** [AGENTS.md](../AGENTS.md), [17_AI_ASSISTED_QA_FRAMEWORK_PLAN.md](17_AI_ASSISTED_QA_FRAMEWORK_PLAN.md)

---

## 0. Tóm Tắt Mục Tiêu

Chặng 4 tập trung vào nâng cao năng suất kỹ thuật cho QA, Dev và PO/BA:

1. **F4 — Context Builder (`core/ai/context/contextBuilder.js`):**
   - Đóng gói ngữ cảnh thông minh theo ngân sách token: Page Objects, fixtures, actions, manifest tri thức.
   - Che giấu bí mật (`maskSecrets`) và chặn các file nhạy cảm (`.env`, `data/CCCD/`, credentials).

2. **F2 — Versioned Prompts (`ai/prompts/` & `core/ai/prompts/promptLoader.js`):**
   - Quản lý prompt mẫu có phiên bản (`<task>.v1.md`).
   - Ưu tiên `ai/prompts.local/` (nếu có tùy biến máy trạm) trước `ai/prompts/`, fallback về prompt mặc định.

3. **QA-5 — Gợi Ý Sửa Locator Hỏng (`suggestLocator.js`):**
   - Đọc snippet lỗi và DOM dump quanh vùng lỗi.
   - Đề xuất locators bền vững (`getByRole`, `getByTestId`, `getByText`) kèm độ tin cậy và giải thích.

4. **QA-9 — Tự Động Review Spec (`reviewSpec.js`):**
   - Phát hiện các anti-pattern của Playwright: `waitForTimeout`, thiếu assertion, selector giòn, thiếu tag `@TC/@AC`.
   - Kết hợp phân tích tĩnh (0 token) và AI bổ sung phân tích logic.

5. **DEV-1 — Phân Tích Ảnh Hưởng Test Từ Git Diff (`analyzeTestImpact.js`):**
   - Phân tích diff thay đổi trong code/page objects để đề xuất các spec cần chạy và test case còn thiếu.

6. **PO-1 — Bản Tin Sẵn Sàng Phát Hành (`generateReleaseBriefing.js`):**
   - Tổng hợp số liệu test, tỷ lệ bao phủ, rủi ro và câu hỏi mở thành báo cáo Go / No-Go cho PO.

7. **BA-3 — Phân Tích Thay Đổi Requirement (`analyzeRequirementChange.js`):**
   - So sánh phiên bản cũ vs mới của file REQ markdown, chỉ ra ACs đổi, TCs/specs bị ảnh hưởng.

8. **QA-2 — Sinh Playwright Spec Từ Test Case (`generatePlaywrightSpec.js`):**
   - Chuyển đổi bộ BDD Test Cases thành file spec Playwright chuẩn mực với Page Objects của dự án.
   - **Safety Sandbox Level 1**: Kiểm tra cú pháp tĩnh (`vm.Script` / syntax check) trước khi trả về. Không tự động chạy headless trên live target.

---

## 1. Danh Mục File & Giới Hạn Dòng

| Module | Đường Dẫn | Trách Nhiệm | Giới Hạn Dòng |
|---|---|---|:---:|
| `contextBuilder.js` | `core/ai/context/contextBuilder.js` | Lọc & đóng gói ngữ cảnh, mask bí mật | $\le 150$ |
| `promptLoader.js` | `core/ai/prompts/promptLoader.js` | Đọc prompt có version, fallback sạch | $\le 120$ |
| `suggestLocator.js` | `core/ai/tasks/suggestLocator.js` | Gợi ý sửa locator từ DOM & stack trace | $\le 150$ |
| `reviewSpec.js` | `core/ai/tasks/reviewSpec.js` | Review Playwright spec (luật + AI) | $\le 150$ |
| `analyzeTestImpact.js` | `core/ai/tasks/analyzeTestImpact.js` | Map git diff tới test specs & rủi ro | $\le 150$ |
| `generateReleaseBriefing.js` | `core/ai/tasks/generateReleaseBriefing.js` | Bản tin Go / No-Go cho PO | $\le 150$ |
| `analyzeRequirementChange.js` | `core/ai/tasks/analyzeRequirementChange.js` | Phân tích chênh lệch AC khi REQ đổi | $\le 150$ |
| `generatePlaywrightSpec.js` | `core/ai/tasks/generatePlaywrightSpec.js` | Sinh spec Playwright có Level 1 sandbox | $\le 150$ |
| `aiProductivityRoutes.js` | `dashboard/routes/aiProductivityRoutes.js` | Router phụ trách các endpoints Chặng 4 | $\le 150$ |
| Test API Contract | `tests/dashboard-api/gatewayProductivity.test.js` | Unit & API contract tests cho Chặng 4 (10/10 PASS) | $\le 150$ |
| Test E2E Playwright | `tests/dashboard/qa-ai-productivity.spec.js` | E2E kiểm thử các luồng UI Chặng 4 (3/3 PASS) | PASS |

---

## 2. Kế Hoạch Triển Khai (3 Phase)

### Phase 1: Foundation (F4 Context Builder & F2 Prompt Loader)
- [x] 1.1 `core/ai/context/contextBuilder.js`
- [x] 1.2 `core/ai/prompts/promptLoader.js` và thư mục `ai/prompts/`
- [x] 1.3 Cập nhật index tasks

### Phase 2: Core Productivity Tasks & Endpoints
- [x] 2.1 `core/ai/tasks/suggestLocator.js`
- [x] 2.2 `core/ai/tasks/reviewSpec.js`
- [x] 2.3 `core/ai/tasks/analyzeTestImpact.js`
- [x] 2.4 `core/ai/tasks/generateReleaseBriefing.js`
- [x] 2.5 `core/ai/tasks/analyzeRequirementChange.js`
- [x] 2.6 `core/ai/tasks/generatePlaywrightSpec.js` (kèm sandbox syntax check)
- [x] 2.7 `dashboard/routes/aiProductivityRoutes.js` kết nối `aiRoutes.js`
- [x] 2.8 Unit test `tests/dashboard-api/gatewayProductivity.test.js` (10/10 PASS)

### Phase 3: UI Integration & Verification Gate 4
- [x] 3.1 Tích hợp nút và modal vào Dashboard
- [x] 3.2 Bộ test E2E `tests/dashboard/qa-ai-productivity.spec.js` (3/3 PASS)
- [x] 3.3 Kiểm tra `check:framework` và commit trên `main`
