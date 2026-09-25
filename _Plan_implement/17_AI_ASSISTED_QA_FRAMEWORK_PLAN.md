# Kế Hoạch: Đưa AI Vào Hỗ Trợ PO/BA, Team Tech và QA Trong Framework Automation

> **Mã kế hoạch:** `PLAN-17`
> **Trạng thái:** `DRAFT v3 — ĐÃ BỔ SUNG KHẮC PHỤC 10 LỖ HỔNG (GAP-01..10) VỀ STREAMING, QUOTA DRIFT, SAFETY SANDBOX CHO QA-2, CANCEL SIGNAL & MOCK CORPUS. ĐÃ ĐỒNG BỘ VÀO NHÁNH MAIN. CHỜ DUYỆT.`
> **Chiến lược nhánh:** Dự án do 1 người phát triển chính → Thực hiện trực tiếp trên nhánh `main` (Trunk-based development). Tuân thủ nghiêm ngặt Quality Gates (Gate 3 + Gate 4) trên từng sub-plan nhỏ để giữ nhánh `main` luôn xanh.
> **Chặng 1 (2026-09-26):** đã chọn A, P3, F1, F3, F5, F8, F9 → sub-plan [17a_FOUNDATION_GATEWAY_PLAN.md](17a_FOUNDATION_GATEWAY_PLAN.md) (DRAFT, chờ chốt 8 quyết định ở mục 11). F0 đã xong.  
> **Cách duyệt:** Đánh dấu `[x]` ở **Mục 9 – Phiếu Chọn**. Chỉ hạng mục được đánh dấu mới được lên plan chi tiết (contract AC/TC) và implement.
> **Phạm vi:** `core/ai/`, `dashboard/` (services, routes, `js/views`, `js/components`), `scripts/`, `.github/workflows/`. Không đổi kiến trúc Vanilla HTML/CSS/JS, POM, fixture.
> **Tham chiếu:** [AGENTS.md](../AGENTS.md), [DASHBOARD_AI_PROMPT.md](../ai/dashboard/DASHBOARD_AI_PROMPT.md), [AI_LESSONS.md](../ai/dashboard/AI_LESSONS.md), [03_ACCEPTANCE_GATES.md](file:///D:/_Master_Process/03_ACCEPTANCE_GATES.md), [PLAN-16](16_TRACEABILITY_CONFLICT_RESOLUTION_STUDIO_PLAN.md)
> **Nhật ký review:** xem **Mục 10**.

---

## 1. Hiện Trạng AI Trong Framework (khảo sát 2026-09-24)

**Provider đang dùng: 9Router** (gateway local `http://localhost:20128/v1`, chuẩn OpenAI-compatible, model mặc định `myCombo`), cấu hình tại **Settings → Cấu hình AI** (`#/settings`, section `settings-ai`). Màn này có 2 nơi lưu:
- **Cấu hình server**: `PUT /api/ai/config` → ghi `AI_PROVIDER`, `AI_BASE_URL`, `AI_MODEL`, `AI_API_KEY` vào `.env` ([aiRoutes.js:73-87](../dashboard/routes/aiRoutes.js#L73-L87)).
- **Cấu hình cá nhân**: `localStorage['qa_studio_ai_personal_config']` → gửi kèm từng request qua header `X-AI-Config` (ưu tiên hơn cấu hình server; được đọc ở `aiRoutes`, `qaRoutes`, `agentRoutes`).
- Nút tự nhận 9Router + tải danh sách model qua `GET /api/ai/models`.
- Header đã có **pill hạn mức token** `#agent-quota-pill` ([index.html:84](../dashboard/public/index.html#L84)).

> **Quyết định:** Mọi tính năng AI **chỉ đọc cấu hình từ màn Settings** (qua AI Gateway F1). Không tính năng nào tự đọc `.env` hay tự chọn provider.

| Chỗ đang dùng AI | File | Làm gì | Nhận xét |
|---|---|---|---|
| AI Agent (chat + tool) | [core/ai/agentService.js](../core/ai/agentService.js), `#/agent` | Chat với LLM, tool `list_files / read_file / write_file / run_command` | `write_file` ghi thẳng, **không backup, không diff**. `run_command` chặn bằng regex blocklist → dễ lách. Có nhận `9router` |
| Inline suggest | `/api/ai/inline-suggest` | Gợi ý code trong editor | Qua agentService |
| Copilot generate-state | [core/ai/copilotService.js](../core/ai/copilotService.js) | Prompt → kịch bản wizard | **Chỉ chạy `localProvider` (regex)**, chưa gọi LLM thật |
| Suy luận Test Case | [qaInferenceService.js](../dashboard/services/qaInferenceService.js) | Open Questions → đề xuất TC còn thiếu | Heuristic + AI; **không nhận 9Router** |
| Phân tích Requirement | [qaRequirementAnalyzerService.js](../dashboard/services/qaRequirementAnalyzerService.js) | Text thô → REQ/AC/TC scaffold | **Không nhận 9Router** |
| AI sửa Finding | [qaFindingFixerService.js](../dashboard/services/qaFindingFixerService.js) | Đề xuất diff sửa lỗi traceability | **Không nhận 9Router** |
| Trọng tài AI (PLAN-16) | [qaConflictService.js](../dashboard/services/qaConflictService.js) | Spec vs Doc: bên nào đúng | Có nhận `9router`, có timeout |
| Chẩn đoán lỗi test | [diagnosticsAnalyzer.js](../core/diagnostics/diagnosticsAnalyzer.js), panel `.diagnostics-panel` ở Runner | Phân loại lỗi test bằng regex | **Không dùng AI**, 5 luật cố định |
| Chạy CI từ xa | [core/ci/remoteRunService.js](../core/ci/remoteRunService.js) | Gửi `workflow_dispatch` lên GitHub | **Chỉ dispatch**: không theo dõi trạng thái, không tải kết quả/artifact |

### 1.1. Vấn đề nền tảng cần xử lý trước khi thêm tính năng AI mới

| # | Vấn đề | Mức | Bằng chứng |
|:-:|---|:-:|---|
| G1 | **Key 9Router mặc định viết cứng trong source** (`sk-222d2824…`), còn bị **gửi qua query string** `/api/ai/models?apiKey=`; route này nhận `baseURL` tùy ý từ query rồi `fetch` → **rủi ro SSRF** | **P0** | [aiRoutes.js:47-51](../dashboard/routes/aiRoutes.js#L47-L51); `app.js` dòng 6544, 6653, 6690-6691, 6714, 6718, 6725. `dashboard/` nằm trong `files` của package và luôn được `sync:satellites` → key đã có trong lịch sử Git và **có thể đã sang các repo vệ tinh** |
| G2 | Cấu hình provider lặp ở **7 module / ~17 lời gọi AI**; **3 service không nhận 9Router**: khi `AI_BASE_URL` trống sẽ gọi thẳng `api.openai.com` hoặc Google `?key=` → **bỏ qua 9Router dù Settings chọn 9Router** | P1 | `qaInferenceService` (:322, :377-380, :405, :943, :1021), `qaRequirementAnalyzerService` (:166, :303), `qaFindingFixerService` (:254, :353). Chỉ `agentService` (:99-108) và `qaConflictService` (:513-526) nhận `9router` |
| G3 | Không có audit log (gửi gì, trả gì, bao nhiêu token, áp dụng hay từ chối). Dashboard **không có danh tính người dùng** (chỉ có `actor='qa-lead'` cứng ở `masterProcessService.js:163`) | P1 | — |
| G4 | Output AI không kiểm schema thống nhất; mỗi service tự parse JSON | P1 | — |
| G5 | Agent ghi file và chạy lệnh **không qua bước duyệt** | P1 | `executeTool()` trong agentService |
| G6 | Không có bộ đo chất lượng AI, và **repo framework không có dữ liệu để đo**: `requirements/` và `test-cases/` trống, `junit.xml` 0 fail, `tests/e2e` chỉ có spec mẫu → lấy dữ liệu từ CarThings (R6) | P1 | — |
| G7 | Settings chỉ chọn **1 model cho mọi việc** | P2 | — |
| G8 | Bộ đếm quota chỉ tính **cửa sổ 60 giây**, bảng `MODEL_QUOTAS` cứng, lưu trong RAM (mất khi restart); chỉ `agentService` đọc `usage`, các service `qa*` không đọc. Hạn mức thật **1 triệu token / 5 giờ** lại **dùng chung** với các client khác của 9Router | P1 | `agentService.js:136-155`, :361-364, :404-407, :658 |
| G9 | `qaInferenceService`, `qaRequirementAnalyzerService`, `qaFindingFixerService` **không có timeout / AbortSignal**. `apiClient.request` phía UI mặc định timeout 30s, quá ngắn cho AI | P1 | chỉ `qaConflictService.js:536` có timeout |
| G10 | Pill `#agent-quota-pill` là `<button>` nhưng khai `role="status"`, và **điều hướng 2 lần** (`data-view` + listener riêng ở `app.js` ~15782). Ngưỡng màu 50%/20% khác với ngưỡng plan đề xuất | P2 | [index.html:84](../dashboard/public/index.html#L84) |
| G11 | `app.js` đã **17.351 dòng**, `qaSlice.js` 2.409 dòng. Diff và "engine badge" của AI đang vẽ tay với màu hex cứng, lặp ở 2 helper; modal `qa-*` đặt style inline, trái quy chuẩn modal | P2 | `findingFixerHelper.js:112, 205-245`, `reqAnalyzerHelper.js:110`, `qa.html:412-934` |
| G12 | **Hủy request ở UI không ngắt backend gọi 9Router**: client bấm "Hủy" chỉ ngắt HTTP browser-server; nếu Express không truyền `req.on('close')`/`signal` tới 9Router, 9Router **vẫn chạy ngầm, rò rỉ token và tài nguyên (Zombie Requests)** | **P0** | Chưa nối `req.signal` từ Express xuyên qua Gateway tới 9Router `fetch` |
| G13 | **Thiếu cơ chế Streaming (SSE / onProgress)** cho tác vụ nặng (QA-2 sinh spec, QA-3 triage, BA-1 soát REQ mất 15–45s); request REST đồng bộ khiến UI như bị đơ, dễ làm người dùng tưởng treo và bấm đúp | P1 | `agentService.js` đang để `stream: false`, các route `qa*` chỉ dùng JSON response thông thường |
| G14 | **Bộ đếm Quota local gây False Positive Lockout**: 9Router dùng chung nhiều tool; bộ đếm file local lệch với thực tế 9Router; tự động khóa cứng ("hết hạn mức - dùng luật") khi 9Router vẫn còn quota gây ức chế | P1 | Mục 4 (F8) cần đổi thành Soft Indicator; chỉ hard-lock khi nhận mã HTTP 429 thật từ 9Router |
| G15 | **QA-2 tự động chạy test lặp lại thiếu Sandbox an toàn**: Chạy `npx playwright test` tự động trên web live/staging dễ bị captcha/timeout/auth lỗi → AI tưởng spec sai rồi cố sửa lặp lại, ngốn token và có nguy cơ mutate data thật | **P0** | Cần phân tách: Cấp 1 (Tự động static lint/syntax & framework check); Cấp 2 (Người bấm nút chạy trên Browser Runner) |
| G16 | **Bộ đo chất lượng phụ thuộc cứng đường dẫn ngoài workspace (`D:/_CarThings/...`)**: Khi đem sang máy khác hoặc CI sẽ bị hard-fail, framework mất tính độc lập (self-contained) | P1 | Cần có Synthetic Corpus nhẹ trong repo framework tại `test-fixtures/ai-eval/` (loại khỏi satellite sync) |
| G17 | **Thiếu xử lý bóc tách Markdown Code Fences (` ```json `)** khi nhận JSON từ LLM: Gemini rất hay bọc JSON trong code block hoặc kèm lời dẫn; `JSON.parse` thông thường sẽ ném syntax error giả | P2 | Cần tiện ích `extractJsonFromMarkdown()` chuẩn hóa trước khi validate schema |
| G18 | **Model combo 9Router (`qaFast`/`qaDeep`) chưa có cơ chế Graceful Fallback**: Nếu người dùng chưa cấu hình combo alias trong 9Router, 9Router sẽ trả 400/404 làm gãy toàn bộ tính năng AI | P1 | Gateway phải tự fallback về model mặc định trong Settings nếu alias không tồn tại |

> **Khuyến nghị:** G1, G12, G15 là các rủi ro P0 cần xử lý dứt điểm ngay từ Foundation (xem F0, F1, F5).

### 1.2. Ràng Buộc Đã Chốt Với Chủ Dự Án (2026-09-24)

| # | Câu hỏi | Trả lời | Ảnh hưởng lên plan |
|:-:|---|---|---|
| R1 | Dùng AI nào? | **Gemini qua 9Router**, cấu hình ở Settings | Gateway chỉ cần adapter OpenAI-compatible trỏ vào 9Router. Chia model theo tác vụ bằng combo 9Router (3.1) |
| R2 | Dữ liệu có gửi cloud không? | ✅ Nội dung được gửi Gemini qua 9Router để xử lý; **mọi lịch sử, log, kết quả AI chỉ lưu trên máy** | Dữ liệu runtime chỉ ghi vào `/.tmp/` ở gốc repo (đã gitignore); không commit, không sync vệ tinh, không telemetry. Vẫn che `.env`, key, mật khẩu, PII |
| R3 | Jira/Confluence? | **Có, dùng copy–dán**, không tích hợp API | Ô dán nội dung (BA-4) + nút "Copy cho Jira" (BA-5, QA-4). Không cần token Jira |
| R4 | CI ở đâu? | **GitHub Actions** (runner GitHub-hosted) | Runner **không gọi được 9Router local** → AI không chạy trong CI; kết quả CI được kéo về máy để phân tích (DEV-3) |
| R5 | Ngân sách token | **~1 triệu token / 5 giờ** | F8 đếm theo cửa sổ 5 giờ; số đếm là **ước tính** vì 9Router dùng chung với công cụ khác |
| R6 | Dữ liệu mẫu để đo chất lượng AI | **Bộ Synthetic Corpus nội bộ + CarThings mở rộng** | Tạo bộ mẫu chuẩn tại `test-fixtures/ai-eval/` trong framework (tự kiểm thử độc lập). CarThings (`D:/_CarThings/...`) dùng làm bộ mở rộng khi chạy cờ `--corpus` (xem F6, F6a) |
| R7 | Số người dùng / implement | **Chỉ 1 người (chủ dự án), làm thẳng trên `main`** | Lộ trình tính tuần tự cho 1 người, thực hiện thẳng trên nhánh `main` (Trunk-based development). Không cần danh tính/phân quyền phức tạp |

---

## 2. Nguyên Tắc Thiết Kế (áp dụng cho mọi idea)

1. **AI đề xuất, người quyết định.** Mọi thay đổi file: xem đề xuất → bấm áp dụng → kiểm file chưa bị đổi từ lúc AI đọc (so hash) → backup (`resourceService.createBackup`) → ghi → kiểm lại sau ghi → hoàn tác nếu sai. Mẫu PLAN-16.
2. **Hỏng AI không làm hỏng dashboard.** Tác vụ có luật thay thế (QA-1, QA-3, QA-9, BA-1…) thì rơi về luật và **ghi rõ "Kết quả từ luật (không dùng AI)"**. Tác vụ không thể có luật thay thế (QA-2, QA-8, QA-10, PO-4, BA-2) thì hiện thông báo rõ ràng và nút thử lại — không trả kết quả giả.
3. **Server tự tính lại, không tin dữ liệu client/AI gửi lên** khi ghi repo (bài học P0 #09 của PLAN-16).
4. **Output có schema & Sanitization.** Bắt buộc bóc tách markdown code fence (`extractJsonFromMarkdown()`) trước khi parse. Sai schema → thử lại 1 lần → rơi về luật / báo lỗi theo nguyên tắc 2.
5. **Che dữ liệu nhạy cảm trước khi gửi** (`maskSecrets`) + chặn `.env`, dữ liệu test thật, PII.
6. **Dữ liệu runtime chỉ ở `/.tmp/` gốc repo (R2).** Session, audit log, cache, bản nháp AI không bao giờ ghi vào `core/`, `dashboard/`, `ai/` (vì `sync-satellites` chép cả thư mục làm việc, bỏ qua `.gitignore`). Có rule `check:framework` kiểm.
7. **Có số đo.** Mỗi tính năng AI có tập mẫu và ngưỡng chấp nhận trước khi bật mặc định.
8. **Vòng đời chặt & Triệt tiêu Zombie Request.** Mỗi lời gọi AI có timeout theo tác vụ, hủy được, gắn `AbortController` vào `disposers` của view. **Phía Server Express bắt buộc bind `req.on('close')` vào `AbortController` của 9Router `fetch`** để ngắt tiến trình ngầm ngay lập tức khi client hủy. Phản hồi về muộn (đã chuyển view/entity) bị bỏ qua.
9. **Không viết code AI mới vào `app.js`.** Code mới ở `js/views/<view>/*Helper.js` và `js/components/ai/`. Listener gắn khi mount hoặc qua delegation, không gắn lúc khởi động (AI_LESSONS 2026-09-10, 09-11).
10. **Không render output AI bằng `innerHTML`**, kể cả nội dung chép vào clipboard — chỉ `textContent`.
11. **Safety Sandbox cho Code sinh ra (QA-2).** Tuyệt đối không cho AI tự động chạy Playwright test headless lặp lại trên live target web để tự sửa lỗi. Chỉ tự động kiểm tra tĩnh (`node --check`, AST, `npm run check:framework`). Chạy spec trên browser bắt buộc do người dùng bấm nút trên UI Runner.
12. **Streaming / Tiến trình thời gian thực.** Các tác vụ AI nặng (>10s) phải hỗ trợ Server-Sent Events (SSE) hoặc chunk streaming để hiển thị trạng thái đang xử lý, tránh đơ UI.

---

## 3. Các Option Kiến Trúc

### Option A — Nhúng vào Dashboard ⭐ Khuyến nghị cho P0–P2
Tính năng AI nằm trong các view có sẵn (`#/qa`, Runner, Báo cáo, Page Manager, Settings) qua **AI Gateway** dùng chung.
- ✅ Ai cũng dùng được qua giao diện, kể cả PO/BA.
- ✅ Tái dùng service và UI primitive sẵn có; chạy được với Gemini qua 9Router.
- ❌ Tác vụ nhiều bước (QA-2 sinh spec + tự sửa) phải tự viết vòng lặp nhỏ trong `core/ai/tasks`.
- **Chi phí:** Trung bình.

### Option B — MCP Server + AI bên ngoài
Viết `tools/mcp-server/` mở công cụ của framework theo chuẩn MCP.
- ✅ Không phải tự viết agent.
- ❌ **Không dùng được Gemini/9Router trực tiếp:** Playwright Test Agents (`npx playwright init-agents`) chỉ hỗ trợ host `claude / codex / copilot / opencode / vscode` và sinh file `.claude/agents/*.md` + `.mcp.json` với `model: sonnet`. Muốn dùng 9Router chỉ có đường **opencode** trỏ provider OpenAI-compatible vào 9Router.
- ❌ PO/BA khó dùng.

### Option C — Lai (A + B), làm sau
Giữ A làm chính; khi thật sự cần tác vụ dài trong IDE thì thêm MCP server (DEV-5) dùng chung lớp `core/ai/tasks` (F9). **Không chặn** P0–P2.

### Option D — Bot trong CI ❌ Không khuyến nghị
Trái R2 và R4: phải dựng self-hosted runner trên máy có 9Router, hoặc để key Gemini trên GitHub (bỏ qua 9Router, lịch sử nằm trong log CI). Thay bằng **DEV-3** (kéo kết quả CI về phân tích local).

### 3.1. Provider: 9Router qua Settings (đã chốt)

| Option | Mô tả | Chọn |
|---|---|---|
| P1 | **9Router là provider mặc định**, 1 model cho mọi tác vụ | ✅ Đã chốt |
| P2 | Chọn model theo tác vụ trong Settings (bảng "Tác vụ → Model", danh sách từ `GET /api/ai/models`) | Tùy chọn |
| P3 | **Combo riêng trong 9Router**: `qaFast` → Gemini Flash (triage, review, tóm tắt), `qaDeep` → Gemini Pro (sinh spec, phân tích requirement, trọng tài). Settings chỉ trỏ tên combo | ⭐ Khuyến nghị |

Adapter Gemini/OpenAI/DeepSeek cũ giữ làm dự phòng; **khi Settings chọn 9Router thì không request nào được đi thẳng tới `googleapis.com` / `api.openai.com`** (có test chặn).

---

## 4. Nền Tảng (Phase 0)

| Mã | Hạng mục | Nội dung | Effort |
|---|---|---|:-:|
| F0 | Gỡ key cứng + chặn SSRF (G1) | Xóa key khỏi `aiRoutes.js` và `app.js`; **bắt buộc tạo key mới trong 9Router** (key cũ nằm vĩnh viễn trong lịch sử Git); rà và dọn các repo vệ tinh; bỏ `apiKey` khỏi query string (`/api/ai/models` đọc key ở server); `baseURL` chỉ nhận allowlist (`localhost:20128`, host provider chính thức); rule `check:framework` chặn chuỗi dạng key trong source. Nút "Tự nhận 9Router" chỉ điền Base URL + model | S |
| F1 | **AI Gateway** `core/ai/gateway/` | `callAi({ task, input, schema, clientConfig, signal, stream })`. Cấu hình duy nhất từ Settings: cá nhân (`X-AI-Config`) → server (`.env`) → báo "Chưa cấu hình AI". Adapter chính OpenAI-compatible cho 9Router. **Nối signal hủy Express `req.on('close')` xuyên suốt tới 9Router `fetch`** (chống zombie request). **Tự động bóc tách markdown code fence (`extractJsonFromMarkdown()`)** trước khi validate schema. **Fallback model**: nếu model/combo alias trả 400/404, tự động hạ cấp về model mặc định trong Settings. Timeout theo tác vụ, che secret, đọc `usage`. Nhận biết `ECONNREFUSED` → "9Router chưa chạy", 429 → "Hết hạn mức". Hỗ trợ SSE cho tác vụ dài. **Chuyển toàn bộ ~17 lời gọi trong 7 module**. Test: chọn 9Router → 0 request tới googleapis/openai.com | M |
| F1b | Mở rộng Settings → Cấu hình AI | Thêm **card** trong section `settings-ai` (không tạo tab con mới): bảng tác vụ → model/combo; công tắc bật/tắt từng tính năng (dùng `toggle-switch.css`); nút "Kiểm tra từng tác vụ"; số token hôm nay theo tác vụ. Chuyển style inline của card 9Router (`settings.html` ~355) vào `settings.css` | M |
| F2 | Kho prompt có version `ai/prompts/<task>.v1.md` | Prompt tách khỏi code; audit log ghi version. **Quyết định sync:** `ai/prompts/` sync sang vệ tinh như prompt chuẩn; vệ tinh muốn tùy chỉnh thì đặt ở `ai/prompts.local/` (không sync, được ưu tiên) | S |
| F3 | Audit log `/.tmp/ai-audit/YYYY-MM-DD.jsonl` | Ghi: task, model, prompt version, token (thật hoặc ước tính), thời gian, kết quả kiểm schema, hành động **áp dụng / từ chối / hủy**, và dự án (framework hay vệ tinh nào). Chỉ 1 người dùng (R7) → không ghi danh tính. **Mặc định không lưu nội dung prompt/response** (chỉ hash); bật lưu nội dung là tùy chọn. Tự xóa sau 30 ngày, trần 50 MB. Xem ở Settings → tab con **"Nhật ký AI"** | S |
| F4 | Context Builder | Gom ngữ cảnh theo ngân sách token: `manifest.json`, Page Object + method, fixtures, `actionRegistry`, traceability matrix. Chặn file nhạy cảm | M |
| F5 | **Bộ component AI dùng chung** `js/components/ai/` | `aiRequest.js` (gọi, hủy, timeout, bỏ phản hồi muộn, trạng thái), `aiResultCard.js` (tag "AI đề xuất", chip độ tin cậy, dòng nguồn gốc, nhãn "Kết quả từ luật"), `aiDiffReview.js` (diff + Áp dụng/Bỏ qua, dùng `.app-modal`), toast "Hoàn tác". API apply chung ở server: kiểm hash gốc → backup → ghi → kiểm lại → hoàn tác. **Điều kiện xong:** chuyển 3 helper cũ (`findingFixerHelper`, `reqAnalyzerHelper`, `ConflictStudioHelper`) sang component này, bỏ màu hex cứng, chuẩn hóa modal `qa-*` | M |
| F6 | Eval harness `core/ai/eval/` | Provider giả (mock) để test không tốn token; `npm run ai:eval` in điểm từng tác vụ. **Xây dựng bộ Synthetic Evaluation Dataset nội bộ tại `test-fixtures/ai-eval/`** (REQ có bẫy mơ hồ, spec lỗi mẫu; loại khỏi `tools/sync-satellites.json`) giúp framework **hoàn toàn tự kiểm thử độc lập (self-contained)**. Script `ai:eval` thêm vào danh sách script merge sang vệ tinh | M |
| F6a | **Bộ dữ liệu mẫu CarThings mở rộng** (G6, R6) | Đặt tại `D:/_CarThings/Automation_Carthings/.tmp/ai-eval-corpus/` — **không copy vào framework**. Đóng vai trò là **tập dữ liệu mở rộng** khi chạy cờ `npm run ai:eval -- --corpus=D:/_CarThings/...`. Gồm: (1) REQ/TC thật; (2) Lỗi test thật. **Loại khỏi mọi thứ gửi Gemini:** `data/CCCD/` (ảnh căn cước), ảnh avatar, tài khoản/mật khẩu trong `data/*.json` | M |
| F7 | Siết an toàn Agent (G5) | `run_command` đổi sang **allowlist** (`npm run …`, `npx playwright …`, `git status/diff/log`); `write_file` qua F5; chế độ "Chỉ đọc" / "Hỏi trước khi ghi" | M |
| F8 | Ngân sách token (G8, G10, R5, G14) | Cửa sổ trượt **5 giờ**, hạn mức mặc định 1.000.000 (chỉnh trong Settings), lưu ở `/.tmp/ai-usage.json` kèm **In-Memory Concurrency Mutex** (chống lost-update). Lấy `usage` thật; thiếu thì ước tính `ký tự / 4`. **Bộ đếm local là Soft Indicator** để cảnh báo trên `#agent-quota-pill` (reset lúc HH:mm). **CHỈ hard-lock rơi về luật khi nhận mã HTTP 429 thật từ 9Router** (chống False Positive Lockout). Mỗi tác vụ có trần token/lần; giới hạn chạy song song (mặc định 2). Chạy hàng loạt: ước tính trước + hỏi xác nhận | M |
| F9 | Lớp nghiệp vụ `core/ai/tasks/` | Mỗi tác vụ AI (triage, sinh TC, soát REQ…) là 1 module thuần: nhận input, gọi Gateway, trả output đã kiểm schema. Route dashboard và MCP (nếu làm DEV-5) cùng gọi lớp này | S |
| F10 | Ngôn ngữ giao diện AI thống nhất | Token `--ai-accent` trong `tokens.css` (light/dark, khớp `.view-tab--ai`), icon `ph-sparkle`, nút AI luôn ở **khu action của header panel** với nhãn "✦ <động từ> bằng AI", bộ câu chữ trạng thái chuẩn (Mục 4.2) | S |

### 4.1. Ước Tính Token (hạn mức 1 triệu / 5 giờ)

Ước lượng ban đầu; thay bằng số thật từ F3 sau 1–2 tuần.

| Tác vụ | Token / lần | Số lần / 1 triệu | Cách tiết kiệm |
|---|---:|---:|---|
| QA-3 Triage 1 lỗi | 5–10k | ~100–200 | Gom lỗi cùng dấu hiệu (message + locator + file) → 1 lần gọi/nhóm; luật regex chạy trước, chắc chắn thì không gọi AI |
| BA-1 Soát 1 REQ | 10–20k | ~50–100 | Cache theo hash nội dung |
| QA-1 Sinh TC cho 1 REQ | 10–25k | ~40–100 | Chỉ gửi AC + TC hiện có |
| QA-2 Sinh 1 spec (≤2 vòng sửa) | 30–80k | ~12–30 | Chỉ gửi Page Object liên quan; `qaDeep` sinh, `qaFast` sửa |
| QA-5 Gợi ý 1 locator | 5–15k | ~70–200 | Cắt DOM quanh vùng lỗi |
| PO-1 Bản tin phát hành | 15–30k | ~30–60 | Số liệu tính bằng code, AI chỉ viết lời |
| QA-10 So ảnh | 50k+ / cặp | <20 | Chỉ chạy tay |

> 1 triệu / 5 giờ dư cho dùng hằng ngày. Rủi ro nằm ở chạy hàng loạt → F8 bắt buộc ước tính + xác nhận.

### 4.2. Trạng Thái & Trải Nghiệm Chung Cho Mọi Tính Năng AI

**Trạng thái bắt buộc (câu chữ tiếng Việt chuẩn, định nghĩa 1 lần trong F10):**

| Trạng thái | Hiển thị |
|---|---|
| Sẵn sàng | Nút "✦ … bằng AI" |
| Ước tính (tác vụ hàng loạt) | Modal xác nhận: "≈ N token · còn M · reset lúc HH:mm" — focus mặc định ở **Hủy** |
| Đang chạy | Spinner + nút **Hủy** (Esc cũng hủy); vùng kết quả `aria-busy="true"` |
| Xong | Kết quả trong `aiResultCard`: tag "AI đề xuất", chip độ tin cậy (**có chữ**, không chỉ màu), dòng nguồn gốc "model · prompt vX · HH:mm · N token" → link tới Nhật ký AI |
| Rơi về luật | Nhãn "Kết quả từ luật (không dùng AI)" + lý do (sai schema / 9Router tắt / hết hạn mức) |
| 9Router chưa chạy | "9Router chưa chạy tại localhost:20128" + link mở Settings → AI |
| Hạn mức ≥80% / ≥95% / hết | Cảnh báo vàng / "Chỉ chạy tác vụ nhẹ" / "Hết hạn mức, reset lúc HH:mm — đang dùng luật" |
| Timeout | "AI phản hồi quá lâu" + Thử lại |
| Không có kết quả | Trạng thái rỗng có hướng dẫn, không để vùng trắng |
| Sau khi áp dụng | Toast "Đã áp dụng" + nút **Hoàn tác** (dùng bản backup) |

Không bao giờ hiện stack trace, `undefined`, `null` hay JSON thô cho người dùng.

**Theo đối tượng người dùng:**
- **PO/BA** (BA-1/2/4/5, PO-1/3/4): lời thường; câu được tô sáng + câu gợi ý + "Chấp nhận / Bỏ qua"; **không diff, không JSON**; có mục mở rộng "Xem chi tiết kỹ thuật".
- **QA/Dev** (QA-*, DEV-*, Nhật ký AI): diff, bằng chứng, prompt gốc.

**Accessibility & responsive:** `aria-live="polite"` cho vùng kết quả; modal giữ focus bên trong và trả focus khi đóng; kiểm 1920×1080, 1440×900, 1280, **390×844** (diff cuộn trong khung riêng, trang không tràn ngang); Light/Dark.

### 4.3. Ánh Xạ Kịch Bản Gate 4 Cho Tính Năng AI

| Kịch bản | Áp dụng cho AI |
|---|---|
| ASYNC-01 | Bấm 2 lần "✦ … bằng AI" / "Áp dụng" → chỉ 1 request, 1 lần ghi, token chỉ tính 1 lần |
| ASYNC-02 | Chuyển view/REQ khi AI đang chạy → request bị hủy (abort), không hiện kết quả sai chỗ |
| ASYNC-03 | Phản hồi về muộn / file đã đổi sau khi AI đọc → bỏ phản hồi; apply bị chặn vì hash gốc khác |
| ASYNC-04 | AI lỗi / timeout → thử lại được, không trừ token 2 lần cho cùng 1 kết quả |
| ASYNC-05 | 2 request cùng ghi `/.tmp/ai-usage.json` / audit log → không mất dữ liệu (ghi atomic) |
| OWN-01..05 | 20 lần mount/unmount view có AI → số listener không tăng; request đang chạy bị hủy khi unmount; hủy giữa chừng một batch triage |
| UI-01..05 | Pill header và card Settings cùng số liệu; focus trong modal; A→B→A nhanh không lẫn kết quả |
| LIFE-01 | Kiểm qua UI/API thật với **provider mock ở tầng HTTP** (không dùng unit test thay E2E) |

---

## 5. Danh Mục Idea Theo Vai Trò

Ký hiệu: **Giá trị** H/M/L · **Effort** S (≤2 ngày) / M (3–5 ngày) / L (>1 tuần) · **Rủi ro** thấp/TB/cao. "Đặt ở" = vị trí trong dashboard hiện có.

### 5.1. PO / BA

| Mã | Idea | Mô tả | Đặt ở / tái dùng | Giá trị | Effort | Rủi ro |
|---|---|---|---|:-:|:-:|:-:|
| **BA-1** | Soát độ rõ requirement | AI tô sáng câu mơ hồ ("nhanh", "thân thiện", "hợp lệ"), thiếu điều kiện lỗi/biên, AC mâu thuẫn → sinh **Open Questions** vào file REQ | QA → Tài liệu (`.qa-reader`), nút ở toolbar REQ; `openQuestions.js`, `qaRequirementAnalyzerService` | H | M | thấp |
| **BA-2** | Viết AC Given/When/Then | User story → AC dạng GWT + bảng BVA/EP; BA sửa rồi lưu | Cùng modal phân tích REQ | H | S | thấp |
| **BA-3** | Ảnh hưởng khi REQ đổi | So bản cũ/mới → AC đổi, TC/spec bị ảnh hưởng | `/api/qa/requirement/impact` | H | M | thấp |
| **BA-4** | Dán story từ Jira/Confluence ⭐ | **Mở rộng modal `#qa-req-analyzer-modal` sẵn có** (đã có ô dán): thêm ô mã issue (`PROJ-123`, không bắt buộc), làm sạch Jira wiki markup / HTML Confluence → Markdown bằng code, rồi AI tạo `requirements/REQ-xxx.md` có `Source: PROJ-123`. Dán lại cùng issue → nối BA-3. **Không làm modal mới** (tránh trùng modal này và chế độ "Dán nội dung thô" của Scaffold) | `reqAnalyzerHelper.js` | **H** | S | thấp |
| **BA-5** | Copy để dán lên Jira | Nút "Copy cho Jira" trên thẻ REQ: số TC, pass/fail, Open Questions, rủi ro chưa phủ. Có xem trước nội dung sẽ chép + toast "Đã chép" | Tiện ích chung `copyForJira(format)` | M | S | thấp |
| **PO-1** | Bản tin sẵn sàng phát hành | Trang tóm tắt lời thường: REQ đã có test, test fail, rủi ro chưa phủ, quyết định treo → gợi ý **Go / No-Go** kèm lý do | QA → tab con mới "Sẵn sàng phát hành"; `.hero-stat-card`, `.qa-badge` | H | M | thấp |
| **PO-2** | Ưu tiên test theo rủi ro | Chấm rủi ro từng REQ → gợi ý bộ smoke/regression | trace + git history | M | M | TB |
| **PO-3** | Trợ lý sổ quyết định | Tóm tắt `decisions.json`, phát hiện quyết định mâu thuẫn, nhắc quyết định treo | decisions API | M | S | thấp |
| **PO-4** | Hỏi đáp về chất lượng | **Mở rộng view AI Agent** bằng chế độ "Chỉ đọc / Hỏi đáp chất lượng" (không làm chat thứ 2) | `templates/agent.html`, `agent.js`, F4 | M | M | thấp |

### 5.2. QA

| Mã | Idea | Mô tả | Đặt ở / tái dùng | Giá trị | Effort | Rủi ro |
|---|---|---|---|:-:|:-:|:-:|
| **QA-1** | Sinh TC từ AC (nâng cấp) | Chuyển `infer-testcases` sang Gateway; chống trùng theo ngữ nghĩa; bắt buộc TC âm/biên/bảo mật mỗi AC | `qaInferenceService` | H | S | thấp |
| **QA-2** | Sinh Playwright spec từ TC | TC → spec dùng **đúng** POM, fixture, `actionRegistry`. **Phân tách 2 cấp an toàn (G15)**: (1) Cấp tự động: kiểm tra tĩnh `node --check` + `npm run check:framework` + AST validator; (2) Cấp người dùng: nút "Chạy thử trong Browser Runner" để người dùng tự bấm và giám sát, **tuyệt đối không tự động trigger test headless lặp lại trên live target**. Không có luật thay thế | `core/ai/tasks`, generator | H | L | TB |
| **QA-3** | Triage lỗi test (RCA) ⭐ | Đọc error, trace, screenshot, HTML dump → **Lỗi sản phẩm / Lỗi test / Môi trường / Flaky** + bằng chứng + gợi ý sửa. Luật regex chạy trước, AI chỉ khi luật không chắc. **Mở rộng panel "Giải thích lỗi test" (`.diagnostics-panel`) ở Runner + nút "Triage" ở mục fail trong Báo cáo** — không làm panel mới | `diagnosticsAnalyzer`, `failureDebugHelper`, `.diagnostic-finding`, `aiResultCard` | **H** | M | thấp |
| **QA-4** | Bug report nháp | Từ QA-3 loại "Lỗi sản phẩm" → bug nháp (Summary, Steps, Expected/Actual, Environment, link `Source`). "Copy cho Jira"; ảnh/trace ở local để tự đính kèm | `copyForJira` | H | S | thấp |
| **QA-5** | Gợi ý sửa locator ⭐ | Locator hỏng → so DOM dump → đề xuất locator mới (ưu tiên `getByRole/getByTestId`) + độ tin cậy. Không tự sửa khi test chạy; áp dụng qua `aiDiffReview`, chạy lại xanh mới ghi | Page Manager panel locator (`pom-panel-locator`) + link từ kết quả triage | H | M | TB |
| **QA-6** | Phát hiện test flaky | Lịch sử pass/fail → test flaky + nguyên nhân khả dĩ | failure tracker, JUnit | M | M | thấp |
| **QA-7** | Sinh dữ liệu test | Dữ liệu thực tế (tên, SĐT, địa chỉ VN) + giá trị biên/sai định dạng | `dataManager` | M | S | thấp |
| **QA-8** | Làm sạch code Recorder | Bản ghi → method Page Object, tên có nghĩa, thêm assertion | `recordParser`, `recordTransformer` | M | M | TB |
| **QA-9** | Review spec tự động | `waitForTimeout`, thiếu assertion, selector giòn, thiếu tag `@TC/@AC`. Luật tĩnh trước, AI bổ sung | `check:framework` | M | S | thấp |
| **QA-10** | So giao diện bằng model thị giác | So ảnh giữa 2 lần chạy/2 viewport → lỗi layout, dark mode. Chỉ báo cáo | screenshots | M | L | TB |
| **QA-11** | Khám phá tự động | Duyệt app → kịch bản chưa có test. **Playwright `planner` không chạy với 9Router trong dashboard** → cần host opencode trỏ 9Router, hoặc tự viết vòng lặp MCP client | Playwright 1.61 | M | **L** | TB |

### 5.3. Team Tech

| Mã | Idea | Mô tả | Đặt ở / tái dùng | Giá trị | Effort | Rủi ro |
|---|---|---|---|:-:|:-:|:-:|
| **DEV-1** | Test cần chạy cho diff ⭐ | `git diff` → spec bị ảnh hưởng (file → page object → spec) + AI gợi ý test còn thiếu | `qa:changed` | H | M | thấp |
| **DEV-2** | Review PR theo chuẩn framework | Prompt C (Gate 3) trên diff | Master prompts | M | S | thấp |
| **DEV-3** | Tóm tắt kết quả CI (phân tích local) | Kéo kết quả GitHub Actions về máy → QA-3 phân tích bằng 9Router → tóm tắt trong **Báo cáo → segment mới "CI (GitHub)"**. **Việc phải làm mới** (hiện `remoteRunService` chỉ dispatch): (1) client GitHub REST: tìm run theo `correlation_id`, theo dõi trạng thái, tải + giải nén artifact; (2) PAT quyền `actions:read` lưu `.env`; (3) thêm `upload-artifact` cho `junit.xml` + `test-results/` vào `playwright.yml` (hiện chỉ `discord-run-playwright.yml` upload, giữ 7 ngày). Không dùng `gh` (máy chưa cài). Tùy chọn gửi tóm tắt qua webhook Discord có sẵn | `.resource-segmented-control`, `.resource-viewer` | H | **M/L** | thấp |
| **DEV-4** | Tự trích bài học Gate 0.5 | Đề xuất dòng mới cho `.ai/learning/candidates.md` (đang 49/50 → cần curator chạy trước) | knowledge scripts | M | S | thấp |
| **DEV-5** | Framework MCP Server (Option C) | Mở `qa_trace`, `qa_gaps`, `list_findings`, `run_suite`, `read_report`, `scaffold_requirement`, `list_page_objects`, gọi lớp F9. Dùng với opencode (trỏ 9Router), Gemini CLI, Claude Code… | F9, scripts `qa-trace` | M | M | TB |
| **DEV-6** | Nâng cấp AI Agent | Lập kế hoạch → Duyệt → Thực thi; tool riêng cho framework thay `run_command` tự do | `agentService`, F5, F7 | M | M | TB |
| **DEV-7** | Sinh test API từ OpenAPI/HAR | Sinh spec trong `tests/api/` dùng `apiHelper` | `apiHelper` | M | M | thấp |

---

## 6. Lộ Trình (Option A; **1 người làm trực tiếp trên nhánh `main`** — R7)

Nếu làm đủ mọi hạng mục ⭐ theo thứ tự "nền tảng xong hết rồi mới làm tính năng" thì mất **12–20 tuần** mới xong P2, và 6–10 tuần đầu chưa có tính năng mới nào dùng được. Với 1 người, khuyến nghị **lộ trình gọn**: làm nền tảng vừa đủ, ra tính năng sớm, bổ sung nền tảng khi tính năng cần tới.

> **Quy ước phát triển Solo:**
> - Thực hiện trực tiếp trên nhánh **`main`** (Trunk-based development) để tránh lệch nhánh (branch drift).
> - Để đảm bảo an toàn, mỗi chặng được tách thành một sub-plan nhỏ độc lập (ví dụ `17a_FOUNDATION_GATEWAY_PLAN.md`) có hợp đồng AC/TC và Gate 4 trước khi code.
> - Sau mỗi sub-plan, bắt buộc chạy test suite (`npm test`, `check:framework`) đạt 100% xanh trước khi commit và sync.

| Chặng | Tuần (ước tính) | Nội dung | Có gì dùng được sau chặng | Điều kiện ra chặng |
|---|---|---|---|---|
| **0 – Sửa ngay** | Tuần 1 | F0 | Key an toàn, hết SSRF | Không còn key trong source; key đã đổi; `check:framework` chặn key |
| **1 – Nền tảng tối thiểu** | Tuần 1–4 | F1, F9, F5, F8, F3 (bản gọn: chỉ ghi log, chưa có trang xem) | Mọi tính năng AI cũ **thực sự đi qua 9Router**, có nút Hủy, có hoàn tác, pill token 5 giờ đúng | ~17 lời gọi AI qua Gateway, test cũ xanh; chọn 9Router → 0 request tới googleapis/openai.com; 3 helper cũ dùng `js/components/ai/`; Gate 4 ASYNC/OWN cho `aiRequest` đạt |
| **2 – Đo lường + tính năng đầu tiên** | Tuần 5–7 | F6, F6a (trên CarThings), **đo mốc** (thời gian triage 1 lỗi, REQ → TC), QA-3, BA-4 | Triage lỗi test bằng AI; dán story Jira → REQ | Bộ mẫu CarThings ≥ 20 lỗi có nhãn + ≥ 10 REQ; QA-3 đúng ≥ 80% |
| **3 – Thắng nhanh còn lại** | Tuần 8–10 | BA-1, QA-1, QA-4, PO-3, F10, F1b (combo `qaFast`/`qaDeep`), F3 trang "Nhật ký AI" | Soát REQ, sinh TC, bug nháp, sổ quyết định | BA-1 bắt ≥ 80% câu mơ hồ cài sẵn |
| **4 – Tăng năng suất** | Tuần 11–17 | F4, F2, QA-5, QA-9, DEV-1, PO-1, BA-3, rồi QA-2 (lớn nhất, làm cuối) | Sinh spec, sửa locator, test theo diff, bản tin phát hành | QA-2: spec qua `check:framework` và chạy xanh ≥ 70% không sửa tay; QA-5 đúng ≥ 70% |
| **5 – Mở rộng** (tùy chọn) | Sau tuần 17 | F7, DEV-3, BA-5, QA-6, PO-2, DEV-5, QA-7, QA-8, BA-2 | — | Theo từng idea |
| **6 – Thử nghiệm** | Khi rảnh | QA-10, QA-11, PO-4, DEV-6, DEV-7 | — | Spike trước, đánh giá chi phí/giá trị |

> Mỗi chặng dừng được ở cuối mà hệ thống vẫn chạy ổn — không để dở dang giữa chặng. F7 (siết Agent) lùi xuống chặng 5 vì chỉ có 1 người dùng; nếu hay dùng AI Agent để ghi file thì nên kéo F7 lên chặng 1.

Mỗi chặng theo Master Process: contract AC/TC → implement → Gate 3 → Gate 4 (ma trận Mục 4.3, JUnit receipt, `master.ps1 gate`).

---

## 7. Rủi Ro & Cách Giảm

| Rủi ro | Cách giảm |
|---|---|
| AI bịa (sai locator, sai AC, sai kết luận) | Schema; server tự kiểm lại với repo; người duyệt; chạy lại test trước khi ghi |
| Lộ dữ liệu | `maskSecrets` + chặn file nhạy cảm (F4); audit log mặc định không lưu nội dung; dữ liệu runtime chỉ ở `/.tmp/` |
| Dữ liệu runtime bị sync sang vệ tinh | Nguyên tắc 6 + rule `check:framework`; `sync-satellites` chép cả thư mục làm việc nên không được ghi runtime vào `core/`, `dashboard/`, `ai/` |
| Key lộ / SSRF qua `/api/ai/models` | F0: đổi key, allowlist `baseURL`, không gửi key qua query string |
| 9Router tắt / hết hạn mức | Gateway nhận `ECONNREFUSED`/429 → báo rõ + rơi về luật |
| Số token dashboard đếm thấp hơn thực tế | Ghi rõ "ước tính"; 9Router dùng chung với công cụ khác; ưu tiên số của 9Router nếu có |
| Chi phí token tăng | Trần theo tác vụ, cache theo hash, combo `qaFast/qaDeep`, luật chạy trước, xác nhận khi chạy hàng loạt |
| Prompt injection từ nội dung repo/requirement | Nội dung repo đặt trong khối dữ liệu riêng; ghi file luôn qua F5; agent dùng allowlist |
| Đổi model/prompt làm chất lượng giảm | `ai:eval` chạy trước mỗi lần đổi |
| Dữ liệu CarThings (ảnh căn cước, tài khoản) bị gửi Gemini hoặc lọt sang vệ tinh khác | Bộ mẫu để trong `.tmp/` của repo CarThings; Context Builder chặn `data/CCCD/`, ảnh, file tài khoản; lỗi cố ý chỉ chạy trên test/staging hoặc mock |
| `app.js` phình thêm | Nguyên tắc 9 |
| Team phụ thuộc AI | Mọi đề xuất kèm lý do + bằng chứng |

---

## 8. Chỉ Số Đo Thành Công

- Thời gian triage 1 test fail: so với mốc đo ở chặng 2 (mục tiêu giảm ≥ 50%).
- Thời gian REQ → TC → spec chạy được.
- Tỉ lệ đề xuất AI **chấp nhận nguyên** / **sửa rồi chấp nhận** / **từ chối** (từ F3).
- Số câu hỏi mơ hồ phát hiện trước khi dev bắt đầu (BA-1).
- Token mỗi tuần theo tác vụ; số lần rơi về luật vì hết hạn mức.

---

## 9. Phiếu Chọn (đánh dấu `[x]` rồi báo lại)

### 9.1. Option kiến trúc
- [x] **A** — Nhúng vào Dashboard ⭐ khuyến nghị cho P0–P2 (chốt 2026-09-26)
- [ ] **C** — Thêm MCP server sau (DEV-5), dùng chung lớp F9
- [ ] **B** — Chỉ MCP + AI bên ngoài (cần host opencode/Claude Code…)
- ~~D — Bot CI~~ (không khuyến nghị theo R2/R4; thay bằng DEV-3)

### 9.2. Provider (9Router qua Settings — đã chốt)
- [x] P1 9Router là provider mặc định
- [ ] P2 Chọn model theo tác vụ trong Settings
- [x] P3 Combo 9Router `qaFast` / `qaDeep` ⭐ (chốt 2026-09-26, fallback về model Settings khi thiếu alias)

### 9.3. Nền tảng
- [x] F0 Gỡ key cứng + chặn SSRF — **đã làm 2026-09-26** (`dashboard/services/aiEndpointPolicy.js`, rule quét key trong `check:framework`). Còn lại cho chủ dự án: tạo key mới trong 9Router rồi cập nhật `.env` (key cũ vẫn nằm trong lịch sử Git của Hub và 2 vệ tinh); vệ tinh chỉ hết key cứng sau lần sync tới
- [x] F1 AI Gateway → [17a](17a_FOUNDATION_GATEWAY_PLAN.md)
- [ ] F1b Mở rộng Settings → Cấu hình AI
- [ ] F2 Kho prompt có version
- [x] F3 Nhật ký AI (audit log) — bản gọn, chưa có trang xem → 17a
- [ ] F4 Context Builder
- [x] F5 Bộ component AI dùng chung → 17a (`aiDiffReview` chờ D2 của 17a)
- [ ] F6 Eval harness
- [ ] F6a Bộ dữ liệu mẫu từ CarThings (nằm lại trong repo CarThings)
- [ ] F7 Siết an toàn Agent
- [x] F8 Ngân sách token 5 giờ → 17a
- [x] F9 Lớp nghiệp vụ `core/ai/tasks` → 17a
- [ ] F10 Ngôn ngữ giao diện AI thống nhất

### 9.4. PO / BA
- [ ] BA-1 Soát độ rõ requirement ⭐
- [ ] BA-2 Viết AC Given/When/Then
- [ ] BA-3 Ảnh hưởng khi REQ đổi
- [ ] BA-4 Dán story từ Jira/Confluence ⭐
- [ ] BA-5 Copy để dán lên Jira
- [ ] PO-1 Bản tin sẵn sàng phát hành ⭐
- [ ] PO-2 Ưu tiên test theo rủi ro
- [ ] PO-3 Trợ lý sổ quyết định
- [ ] PO-4 Hỏi đáp về chất lượng

### 9.5. QA
- [ ] QA-1 Sinh TC từ AC (nâng cấp)
- [ ] QA-2 Sinh Playwright spec từ TC ⭐
- [ ] QA-3 Triage lỗi test ⭐
- [ ] QA-4 Bug report nháp
- [ ] QA-5 Gợi ý sửa locator ⭐
- [ ] QA-6 Phát hiện test flaky
- [ ] QA-7 Sinh dữ liệu test
- [ ] QA-8 Làm sạch code Recorder
- [ ] QA-9 Review spec tự động
- [ ] QA-10 So giao diện bằng model thị giác
- [ ] QA-11 Khám phá tự động

### 9.6. Team Tech
- [ ] DEV-1 Test cần chạy cho diff ⭐
- [ ] DEV-2 Review PR theo chuẩn framework
- [ ] DEV-3 Tóm tắt kết quả CI (phân tích local)
- [ ] DEV-4 Tự trích bài học Gate 0.5
- [ ] DEV-5 Framework MCP Server
- [ ] DEV-6 Nâng cấp AI Agent
- [ ] DEV-7 Sinh test API từ OpenAPI/HAR

### 9.7. Câu hỏi còn mở
Không còn. Đã chốt: dữ liệu mẫu từ CarThings (R6), 1 người làm (R7).
Chỉ cần xác nhận: CarThings có **môi trường test/staging** để chạy lỗi cố ý (F6a) không, hay chỉ có production? Nếu chỉ có production → F6a chỉ làm hỏng spec ở mức mock/route (Playwright `page.route`), không tác động dữ liệu thật.

---

## 10. Nhật Ký Review (2026-09-24)

**Lượt 1 — tự rà:** lộ trình ghi ngắn hơn tổng effort; khuyến nghị Option C mâu thuẫn với nơi đặt QA-2/QA-5; nguyên tắc "mọi tính năng có đường không AI" không đúng với QA-2/PO-4…; trùng số nguyên tắc 6; audit log ghi "người áp dụng" nhưng dashboard không có danh tính; thiếu quy định lưu log; thiếu hủy/giới hạn song song/phản hồi muộn; thiếu đo mốc.

**Lượt 2 — review chéo kỹ thuật (đối chiếu code):**

| # | Phát hiện | Mức | Đã sửa ở |
|:-:|---|:-:|---|
| 1 | `remoteRunService` chỉ dispatch, không tải kết quả; máy không có `gh`; `playwright.yml` không upload artifact → DEV-3 thiếu nhiều việc | P0 | DEV-3 (liệt kê việc mới, effort M/L) |
| 2 | Repo không có dữ liệu thật để làm bộ mẫu → điều kiện ra phase không đo được | P0 | F6a mới, G6, điều kiện P0b/P1 |
| 3 | Chỉ 3 service không nhận 9Router (không phải tất cả) và chúng gọi thẳng openai.com/Google | P1 | G2, F1 (test chặn) |
| 4 | ~17 lời gọi AI trong 7 module, không phải "6 chỗ" | P1 | G2, F1, điều kiện P0a |
| 5 | Chỉ agentService đọc `usage`; ngân sách dùng chung 9Router → số đếm là ước tính | P1 | G8, F8 (M) |
| 6 | Lộ trình ngắn 2–3 lần so với effort | P1 | Mục 6 (tách P0a/P0b, ghi rõ giả định 1 người) |
| 7 | Thiếu kịch bản Gate 4 cho AI; 3 service không có timeout | P1 | G9, Mục 4.3, nguyên tắc 8 |
| 8 | Không có danh tính người dùng | P1 | G3, F3 |
| 9 | Playwright Test Agents không chạy với Gemini/9Router | P1 | Option B, QA-11 (L) |
| 10 | Option C không khớp lộ trình; thiếu lớp `core/ai/tasks` | P1 | Mục 3 (A là chính), F9 mới |
| 11 | `sync-satellites` chép cả thư mục bỏ qua `.gitignore`; `tests/` bị chặn sync; chỉ script `mp:*` được merge; `ai/prompts` sẽ đè bản vệ tinh | P2 | Nguyên tắc 6, F2, F6 |
| 12 | Key còn đi qua query string; `baseURL` tùy ý → SSRF | P2→**P0** | G1, F0 |
| 13 | Trùng số nguyên tắc; F1b, F7 thực tế là M | P2 | Mục 2, Mục 4 |
| — | *Bác bỏ:* "`/.tmp/` chưa được gitignore" — đã có ở `.gitignore:30` | — | — |

**Lượt 2 — review chéo UI/UX:**

| # | Phát hiện | Mức | Đã sửa ở |
|:-:|---|:-:|---|
| 1 | Header đã có pill token `#agent-quota-pill` (60s, ngưỡng 50/20%, lỗi `role` + điều hướng kép) → F8 phải tái dùng, không làm thanh mới | P0 | G10, F8 |
| 2 | Diff/badge AI vẽ tay, màu hex cứng, lặp 2 helper → cần component chung, chuyển 3 helper cũ | P0 | G11, F5 |
| 3 | `apiClient` timeout 30s; cần `AbortController` trong `disposers`, bỏ phản hồi muộn | P0 | G9, F5 `aiRequest`, nguyên tắc 8 |
| 4 | `app.js` 17.351 dòng → cấm thêm code AI vào đó | P0 | G11, nguyên tắc 9 |
| 5 | Thiếu bộ trạng thái chung (ước tính, hủy, rơi về luật, 9Router tắt, hạn mức, hoàn tác) | P0 | Mục 4.2 |
| 6 | Cần ngôn ngữ giao diện AI thống nhất (`--ai-accent`, `ph-sparkle`, vị trí nút) | P1 | F10 |
| 7 | PO/BA cần lời thường, không diff/JSON | P1 | Mục 4.2 |
| 8 | Thiếu yêu cầu accessibility/responsive | P1 | Mục 4.2 |
| 9 | BA-4 trùng modal phân tích REQ; QA-3 trùng panel Chẩn đoán; PO-4 trùng Agent chat → mở rộng cái có sẵn | P1 | BA-4, QA-3, PO-4 |
| 10 | Modal `qa-*` dùng style inline trái quy chuẩn | P2 | F5 (chuẩn hóa) |
| 11 | F1b đặt thành card trong `settings-ai`; F3 thành tab con "Nhật ký AI" | P2 | F1b, F3 |

**Cập nhật sau review (chủ dự án trả lời):**
- R6 — dữ liệu mẫu lấy từ CarThings; bộ mẫu để lại trong repo CarThings để không bị `sync:satellites` đẩy sang Vieclam24h; loại `data/CCCD/`, avatar, tài khoản khỏi mọi thứ gửi Gemini.
- R7 — 1 người: bỏ ghi danh tính ở F3; lộ trình đổi sang tuần tự theo chặng, có tính năng dùng được từ tuần 5–7 thay vì sau 6–10 tuần nền tảng.
- **Chiến lược nhánh:** Làm trực tiếp trên nhánh `main` (Trunk-based development).

**Lượt 3 — Khắc phục 10 lỗ hổng kiến trúc & thực thi (GAP-01..GAP-10):**

| # | Mã | Phát hiện lỗ hổng | Mức | Đã khắc phục tại |
|:-:|:---:|---|:---:|---|
| 1 | GAP-01 | Nhánh `feat/plan-16-conflict-studio` bị tụt hậu 2 commit so với `main` | **P0** | Đã merge toàn bộ vào `main`, đồng bộ commit `18c2fc3` |
| 2 | GAP-02 | QA-2 tự động chạy test lặp lại thiếu Sandbox an toàn trên web live | **P0** | Nguyên tắc 11, QA-2: tách Cấp 1 static syntax/lint + Cấp 2 Browser Runner thủ công |
| 3 | GAP-03 | Bấm "Hủy" trên UI không ngắt backend gọi 9Router (Zombie Requests/Token leak) | **P0** | Nguyên tắc 8, G12, F1: Express `req.on('close')` bind xuyên suốt tới `fetch` |
| 4 | GAP-04 | Quota local counter gây False Positive Lockout khi 9Router dùng chung | P1 | G14, F8: đổi thành Soft Indicator; chỉ hard-lock khi nhận HTTP 429 thật từ 9Router |
| 5 | GAP-05 | Thiếu cơ chế Streaming (SSE / onProgress) cho tác vụ nặng (>10s) | P1 | G13, Nguyên tắc 12, F1: hỗ trợ endpoint SSE / streaming |
| 6 | GAP-06 | Bộ đo chất lượng phụ thuộc cứng đường dẫn ngoài workspace (`D:/_CarThings/...`) | P1 | G16, R6, F6: tạo Synthetic Corpus nội bộ tại `test-fixtures/ai-eval/` |
| 7 | GAP-07 | Model combo (`qaFast`/`qaDeep`) lỗi 400/404 nếu 9Router chưa cấu hình alias | P1 | G18, F1: tự động fallback về model mặc định trong Settings |
| 8 | GAP-08 | Thiếu bóc tách Markdown Code Fences (` ```json `) dẫn đến syntax error giả | P2 | G17, Nguyên tắc 4, F1: tiện ích `extractJsonFromMarkdown()` |
| 9 | GAP-09 | Concurrency race condition ghi `ai-usage.json` (lost-update) | P2 | F8: In-Memory Concurrency Mutex trên server Node.js |
| 10 | GAP-10 | Phạm vi quá rộng, khó nghiệm thu theo Quality Gate nếu làm 1 lần | P2 | Mục 6: chia nhỏ thành các sub-plan (`17a_FOUNDATION_GATEWAY_PLAN.md`...) |

---

> ⭐ = nên ưu tiên (giá trị cao, dựa được trên code sẵn có, rủi ro thấp–TB).
> Sau khi duyệt, mỗi hạng mục được chọn sẽ có plan chi tiết riêng (`17a_…`, `17b_…`) gồm contract AC/TC, bảng kiểm kê file:line và ma trận Gate 4 trước khi code.
