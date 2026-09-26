# Kế Hoạch 17b: Triage Lỗi Test (RCA) & Dán Story Jira/Confluence Vào Requirement Studio

> **Mã kế hoạch:** `PLAN-17b` (Chặng 2 của [PLAN-17](17_AI_ASSISTED_QA_FRAMEWORK_PLAN.md) §6)  
> **Trạng thái:** `HOÀN TẤT & ĐÃ NGHIỆM THU (11/11 TC Pass, Eval 90%, Gate 4 Passed)`  
> **Phạm vi:** QA-3 (Triage lỗi test RCA) · BA-4 (Dán Story Jira/Confluence) · F6 (Synthetic Eval)  
> **Điều kiện đầu vào:** PLAN-17a đã hoàn tất 100% (commit `c9a8de9`), AI Gateway sẵn sàng, `aiRequest` và `aiResultCard` sẵn sàng.  
> **Nhánh:** làm thẳng trên `main`, mỗi phase một commit có test xanh (Trunk-based development).  
> **Tham chiếu:** [AGENTS.md](../AGENTS.md), [17_AI_ASSISTED_QA_FRAMEWORK_PLAN.md](17_AI_ASSISTED_QA_FRAMEWORK_PLAN.md), [17a_FOUNDATION_GATEWAY_PLAN.md](17a_FOUNDATION_GATEWAY_PLAN.md)  

---

## 0. Tóm Tắt Mục Tiêu

Chặng 2 mang lại hai tính năng người dùng đầu tiên của khung AI hỗ trợ, dựa trên nền tảng Gateway đã vững chắc ở Chặng 1:

1. **QA-3 — Triage Lỗi Test Tự Động (Root Cause Analysis - RCA):**
   - Đọc thông tin lỗi kiểm thử: error message, stack trace, locator, code snippet, screenshot/console log.
   - Phân loại rõ ràng vào 4 nhóm nguyên nhân:
     * `product_bug` (Lỗi sản phẩm / tính năng).
     * `test_bug` (Lỗi test / locator trôi / assertion sai).
     * `environment` (Lỗi mạng / timeout điều hướng / dịch vụ offline).
     * `flaky` (Flaky test / race condition / timing bất ổn).
   - **Luật chạy trước, AI chạy sau**: Nếu 5 luật regex tĩnh trong `core/diagnostics/diagnosticsAnalyzer.js` phát hiện lỗi chắc chắn ($\ge 0.9$), hệ thống lập tức trả kết quả từ luật (0 token, 0ms latency). Chỉ khi luật rơi vào `unknown` hoặc người dùng yêu cầu phân tích sâu, Gateway mới gọi LLM (`tier: 'fast'`).
   - Mở rộng trực tiếp panel `.diagnostics-panel` ở Test Runner và thêm nút "Triage bằng AI" tại danh sách fail trong Báo cáo — không tạo panel rác.

2. **BA-4 — Dán Story Từ Jira / Confluence Vào Requirement Studio:**
   - Mở rộng modal `#qa-req-analyzer-modal` sẵn có: bổ sung ô nhập mã Issue (`PROJ-123`, không bắt buộc).
   - Thư viện chuyển đổi thuần JavaScript: làm sạch Jira Wiki Markup (`h1.`, `*bold*`, `[link|url]`, `{code}`, `{noformat}`, `bquote.`) và HTML từ Confluence về chuẩn Markdown đẹp mắt.
   - Tự động sinh trường truy vết `Source: PROJ-123` trong tài liệu `requirements/REQ-xxx.md` khi lưu hoặc scaffold.

3. **F6 — Bộ Mẫu Đánh Giá Nội Bộ (Synthetic Eval Dataset):**
   - Đặt tại `test-fixtures/ai-eval/`: chứa 20 lỗi kiểm thử mẫu có gán nhãn thực tế và 5 story mẫu từ Jira/Confluence.
   - Script đánh giá độc lập `npm run ai:eval` đo độ chính xác của QA-3 (mục tiêu $\ge 80\%$).

---

## 1. Hiện Trạng & Tái Sử Dụng

| Hạng mục | Vị trí hiện tại | Tái sử dụng & Nâng cấp cho 17b |
|---|---|---|
| Chẩn đoán lỗi test tĩnh | [core/diagnostics/diagnosticsAnalyzer.js](../core/diagnostics/diagnosticsAnalyzer.js) (37 dòng) | Giữ nguyên 5 luật regex; ánh xạ kết quả vào 4 nhóm chuẩn (`product_bug`, `test_bug`, `environment`, `flaky`). |
| AI Gateway | [core/ai/gateway/](../core/ai/gateway/) | Gọi qua `callAi({ task: 'triageFailure', tier: 'fast' })`, tự động quản lý timeout, abort, token ledger 5h và audit log. |
| AI Task | [core/ai/tasks/](../core/ai/tasks/) | Thêm `triageFailure.js` và `jiraStoryParser.js`. |
| UI Component | [dashboard/public/js/components/ai/](../dashboard/public/js/components/ai/) | Dùng `aiRequest.js` và `createResultCard` hiển thị huy hiệu "Luật suy luận" hoặc "AI · triage". |
| Modal Phân Tích REQ | [reqAnalyzerHelper.js](../dashboard/public/js/views/qa/reqAnalyzerHelper.js) & `#qa-req-analyzer-modal` | Bổ sung trường input Jira Issue Key, nút "Chuyển Jira Markup" và gắn `Source`. |

---

## 2. Thiết Kế Chi Tiết

### 2.1. Phân Loại Triage (QA-3)

```
[Test Failure Input]
       │
       ▼
[diagnosticsAnalyzer (Regex)] ───(Độ tin cậy ≥ 0.9?)───► [Trả kết quả Luật: 0 token]
       │ (unknown / thấp)                                     │
       ▼                                                      │
[callAi: task 'triageFailure']                                │
       │                                                      │
       ▼                                                      ▼
[aiResultCard: "AI đề xuất"]                           [aiResultCard: "Luật suy luận"]
  - Nhóm: product_bug / test_bug / environment / flaky
  - Độ tin cậy: XX%
  - Căn cứ & Đề xuất hành động khắc phục
```

**Schema Output của Triage AI:**
```json
{
  "category": "product_bug" | "test_bug" | "environment" | "flaky",
  "confidence": 85,
  "summary": "1 câu tóm tắt nguyên nhân gốc rễ bằng tiếng Việt",
  "evidence": "Trích đoạn stack hoặc locator làm căn cứ",
  "suggestedFix": "Hướng dẫn cụ thể cho QA/Dev sửa lỗi"
}
```

### 2.2. Bộ Chuyển Đổi Jira / Confluence Markup (BA-4)

Hàm thuần JavaScript [core/ai/tasks/jiraStoryParser.js](../core/ai/tasks/jiraStoryParser.js):
- `h1. Title` $\to$ `# Title`
- `h2. Title` $\to$ `## Title`
- `*bold*` $\to$ `**bold**`
- `_italic_` $\to$ `*italic*`
- `{code:javascript}...{code}` $\to$ ```` ```javascript...``` ````
- `{noformat}...{noformat}` $\to$ ```` ```...``` ````
- `[text|url]` $\to$ `[text](url)`
- `- item` / `* item` $\to$ `- item`
- Xóa bỏ các thẻ wrapper rác của Confluence HTML (`<div class="wiki-content">`, span style thừa).

---

## 3. Kế Hoạch Triển Khai Tuần Tự (Trunk-Based)

### Phase 1 — Triage Engine & Tasks (Core & Backend)
- [x] 1.1 `core/ai/tasks/triageFailure.js`: Task AI triage lỗi test kèm schema và prompt RCA chuyên nghiệp.
- [x] 1.2 `core/ai/tasks/jiraStoryParser.js`: Parser chuyển đổi Jira Wiki Markup & Confluence HTML sang Markdown.
- [x] 1.3 Mở rộng `core/diagnostics/diagnosticsAnalyzer.js`: Map 5 luật regex cũ sang 4 nhóm chuẩn cấp cao.
- [x] 1.4 Route `POST /api/diagnostics/triage`: Chạy dual-engine (Luật trước $\to$ AI sau), ghi nhận audit log và quota.
- [x] 1.5 Unit tests cho Triage Task và Jira Parser (`tests/dashboard-api/gatewayTriage.test.js`).

### Phase 2 — UI Integration (Runner & Requirement Studio)
- [x] 2.1 Mở rộng `#qa-req-analyzer-modal`: Thêm input `#qa-req-jira-key` và nút "Làm sạch Jira Markup".
- [x] 2.2 Nối `reqAnalyzerHelper.js`: Khi dán Jira markup, tự động format sang Markdown và thêm `Source: PROJ-xxx` vào kết quả scaffold.
- [x] 2.3 Mở rộng panel `.diagnostics-panel` ở Runner: Hiển thị kết quả triage dual-engine, nút "Triage bằng AI".
- [x] 2.4 Cập nhật `initPlanThreeControls` trong `app.js` tích hợp endpoint triage mới.

### Phase 3 — Synthetic Eval & Quality Gate (Gate 4)
- [x] 3.1 Bộ mẫu synthetic tại `test-fixtures/ai-eval/`: 20 lỗi fail mẫu và 5 câu chuyện Jira mẫu.
- [x] 3.2 Script `scripts/eval-triage.js` đo độ chính xác (đạt 90.0% $\ge 80\%$).
- [x] 3.3 Hợp đồng `.delivery/phases/plan-17b.json` (6 AC, 11 TC).
- [x] 3.4 E2E Playwright test suite `tests/dashboard/qa-ai-triage.spec.js` (5/5 PASS, 8.5s).
- [x] 3.5 Bàn giao Gate 4 và commit sạch lên `main`.
