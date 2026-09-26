# Kế Hoạch 17a: Nền Tảng AI Tối Thiểu — AI Gateway, Tác Vụ, Component, Ngân Sách Token, Nhật Ký

> **Mã kế hoạch:** `PLAN-17a` (Chặng 1 của [PLAN-17](17_AI_ASSISTED_QA_FRAMEWORK_PLAN.md) §6)
> **Trạng thái:** `DRAFT v1 — CHỜ DUYỆT (mục 11 có 8 quyết định cần chốt trước khi soạn contract)`
> **Phạm vi đã chọn (2026-09-26):** Option A · P3 (combo `qaFast`/`qaDeep`) · F1 AI Gateway · F9 `core/ai/tasks` · F5 component AI dùng chung · F8 ngân sách token 5 giờ · F3 nhật ký AI (bản gọn)
> **Điều kiện đầu vào:** F0 đã xong (commit `45f85c2`, `216d35f`). Chủ dự án còn phải tạo key mới trong 9Router và cập nhật `.env`.
> **Nhánh:** làm thẳng trên `main`, mỗi phase một commit có test xanh (PLAN-17 R7).
> **Tham chiếu:** [AGENTS.md](../AGENTS.md), [DASHBOARD_AI_PROMPT.md](../ai/dashboard/DASHBOARD_AI_PROMPT.md), [AI_LESSONS.md](../ai/dashboard/AI_LESSONS.md), [03_ACCEPTANCE_GATES.md](file:///D:/_Master_Process/03_ACCEPTANCE_GATES.md), [PLAN-18](18_QA_STATIC_FINDINGS_BATCH_PROCESSING_PLAN.md)

---

## 0. Tóm Tắt

Hiện nay mỗi module tự đọc `.env`, tự chọn provider, tự gọi `fetch` và tự parse JSON. Kết quả:
- Chọn 9Router vẫn có đường đi thẳng tới `api.openai.com`.
- Chỉ 1 trong 4 module có timeout.
- Bấm "Hủy" hay "Dừng Agent" không dừng được request đang chạy.
- Cấu hình AI cá nhân không tới được các tính năng QA.
- Bộ đếm token chỉ nhìn cửa sổ 60 giây.

17a gom mọi lời gọi AI về một **Gateway** trong `core/ai/gateway/`. Mỗi tính năng AI trở thành một **tác vụ** thuần trong `core/ai/tasks/`. UI dùng chung một **`aiRequest`** có hủy thật và bỏ qua phản hồi muộn. Header hiển thị **ngân sách token 5 giờ** ước tính. Mọi lời gọi được ghi **nhật ký** vào `/.tmp/`. Chặng này không thêm tính năng AI mới; các tính năng hiện có chạy đúng, hủy được và đo được.

---

## 1. Hiện Trạng Kiểm Kê Lại (2026-09-26, HEAD `216d35f`)

PLAN-17 khảo sát ngày 2026-09-24 ghi "~17 lời gọi trong 7 module". Từ đó PLAN-18 đã xoá luồng AI sửa finding, và F0 đã sửa cách chọn key.

### 1.1. Lời gọi sinh nội dung (12 điểm `fetch` + 1 fallback, 4 module)

| # | Module · hàm | Dòng | Nhánh provider | Timeout | Đọc `usage` | Nhận 9Router khi `AI_BASE_URL` trống |
|:-:|---|---|---|:-:|:-:|:-:|
| 1 | `core/ai/agentService.js` · `geminiCall` | 243 | Gemini native | ❌ | ✅ | — |
| 2 | `agentService` · `openAiCall` | 303 | OpenAI-compatible | ❌ | ✅ | ✅ |
| 3–4 | `agentService` · `inlineSuggest` (Gemini + fallback model) | 626, 643 | Gemini native | ❌ | ✅ | — |
| 5 | `agentService` · `inlineSuggest` | 669 | OpenAI-compatible | ❌ | ✅ | ✅ |
| 6 | `dashboard/services/qaConflictService.js` · `callAi` | 542 | Gemini native | ✅ 45s | ❌ | — |
| 7 | `qaConflictService` · `callAi` | 552 | OpenAI-compatible | ✅ 45s | ❌ | ✅ |
| 8 | `qaInferenceService.js` · `inferWithAi` | 385 | Gemini native | ❌ | ❌ | — |
| 9 | `qaInferenceService` · `inferWithAi` | 412 | OpenAI-compatible | ❌ | ❌ | ❌ `:408` rơi về `api.openai.com` |
| 10 | `qaInferenceService` · `extractWithAi` | 1003 | Gemini native | ❌ | ❌ | — |
| 11 | `qaInferenceService` · `extractWithAi` | 1029 | OpenAI-compatible | ❌ | ❌ | ❌ `:1025` |
| 12 | `qaRequirementAnalyzerService.js` · `analyzeWithAi` | 283 | Gemini native | ❌ | ❌ | — |
| 13 | `qaRequirementAnalyzerService` · `analyzeWithAi` | 310 | OpenAI-compatible | ❌ | ❌ | ❌ `:306` |

Ngoài ra có 3 lời gọi kiểm tra (không sinh nội dung): `agentService.testConnection` (`:552`, `:564`) và `GET /api/ai/models` (`aiRoutes.js`). `copilotService` chỉ chạy luật, không gọi AI.

### 1.2. Nơi UI gọi AI

| Nơi gọi | Route | Timeout phía UI | Gửi cấu hình cá nhân | Hủy được |
|---|---|:-:|:-:|:-:|
| `agent.js` (tab AI Agent) | `/api/agent/*` | 15s | ✅ | Nút Dừng chỉ đổi trạng thái; request vẫn chạy (`agentService.stop` `:496`) |
| `app.js:3147` (gợi ý code trong editor) | `/api/ai/inline-suggest` | không | ✅ | ❌ |
| `qaSlice.js:856` (Scaffold từ văn bản thô) | `/api/qa/scaffold/extract` | 30s (mặc định `apiClient`) | ❌ | ❌ |
| `qaSlice.js:1055` (Suy luận TC) | `/api/qa/infer-testcases` | 30s | ❌ | ❌ |
| `reqAnalyzerHelper.js:170` (Phân tích requirement) | `/api/qa/analyze-requirement` | 30s | ❌ | ❌ |
| `conflictStudioHelper.js:459` (Trọng tài AI) | `/api/qa/conflict/arbitrate` | 60s (server 45s) | ❌ | ❌ |

`apiClient` mặc định timeout 30s (`js/core/apiClient.js:19`) và đã nhận `options.signal` (`:33`). Tác vụ AI 15–45s thường bị UI cắt ở giây 30 trong khi server vẫn gọi 9Router.

### 1.3. Token và pill

- `agentService.js:136-208`: bảng `MODEL_QUOTAS` viết cứng, cửa sổ 60 giây, lưu trong RAM (mất khi restart). Chỉ agent và inline suggest ghi `usage`; 3 service QA thì không.
- `#agent-quota-pill` (`index.html:84`) là `<button>` nhưng khai `role="status"`. Nó điều hướng 2 lần: qua `data-view="agent-view"` và qua listener riêng ở `app.js:15785`. Dữ liệu lấy từ `/api/agent/status` (`app.js:15767`).

### 1.4. Đã xong ở F0, 17a dùng lại

`dashboard/services/aiEndpointPolicy.js` quy định:
- Key trong `.env` chỉ đi tới endpoint đã lưu (`mayUseServerKey`).
- `/api/ai/*` chặn request cross-site.
- `.env` chỉ nhận giá trị một dòng.

17a chuyển phần chọn endpoint và key của module này vào `core/ai/gateway/` (xem D8).

---

## 2. Mục Tiêu & Ngoài Phạm Vi

### 2.1. Mục tiêu đo được

1. Toàn bộ 13 điểm ở 1.1 đi qua `callAi` của Gateway. Không file nào ngoài `core/ai/gateway/adapters/` gọi `fetch` tới provider AI; một rule trong `check:framework` kiểm điều này.
2. Khi provider là 9Router, chạy cả 5 tác vụ và agent với một 9Router giả thì **0 request** tới `googleapis.com`, `api.openai.com`, `api.deepseek.com`.
3. Mọi tác vụ có timeout riêng. Client ngắt kết nối thì request tới 9Router bị hủy trong ≤ 500 ms. Nút "Dừng Agent" hủy lời gọi đang chạy.
4. JSON bọc trong ` ```json ` hoặc kèm lời dẫn vẫn parse được. Sai schema thì thử lại 1 lần, rồi rơi về luật hoặc báo lỗi rõ ràng.
5. Có alias `qaFast`/`qaDeep` trong 9Router thì dùng alias; không có thì tự dùng model trong Settings, tính năng không gãy.
6. Pill hiển thị token đã dùng trong 5 giờ gần nhất (ước tính, lưu ở `/.tmp/ai-usage.json`, còn nguyên sau restart). Chỉ khoá khi 9Router trả 429 thật.
7. Mỗi lời gọi ghi đúng 1 dòng vào `/.tmp/ai-audit/YYYY-MM-DD.jsonl`, không chứa nội dung prompt hay response.
8. 4 luồng AI ở tab QA dùng `aiRequest`: có nút Hủy, đếm giây, bỏ qua phản hồi muộn, có nhãn "AI đề xuất" hoặc "Kết quả từ luật", và gửi cấu hình cá nhân.
9. Các test hiện có vẫn xanh. Response shape của các route hiện có không bị bớt hay đổi field.

### 2.2. Ngoài phạm vi

F1b (bảng tác vụ → model trong Settings), F2 kho prompt, F4 Context Builder, F6/F6a eval, F7 siết Agent, F10 ngôn ngữ giao diện AI, mọi tính năng mới (BA-*, QA-*, DEV-*, PO-*). Stream token SSE, `aiDiffReview` và API apply chung là hạng mục hoãn, xem D1 và D2. Không tách `app.js` ngoài 2 chỗ nêu ở mục 5.

---

## 3. Bất Biến (Invariants)

| Mã | Bất biến |
|---|---|
| INV-1 | Chỉ `core/ai/gateway/config.js` quyết định provider, baseURL, key và model. Không service nào tự đọc `.env` để gọi AI. |
| INV-2 | Key trong `.env` chỉ đi tới endpoint đã lưu (kế thừa F0). Key cá nhân chỉ đi tới endpoint người dùng chọn. |
| INV-3 | Provider là `9router` thì mọi lời gọi sinh nội dung tới 9Router; không có nhánh tắt sang API chính thức. |
| INV-4 | Mọi lời gọi có `timeoutMs` theo tác vụ và một `AbortSignal`. Client ngắt kết nối thì upstream bị hủy. |
| INV-5 | Output AI qua `extractJson` rồi `validateShape` trước khi tới route. Route không bao giờ nhận JSON chưa kiểm. |
| INV-6 | Dữ liệu runtime chỉ nằm trong `<root>/.tmp/` (đã gitignore, không thuộc module sync). Nhật ký không chứa nội dung prompt/response, chỉ hash. |
| INV-7 | Bộ đếm local chỉ để cảnh báo. Chỉ 429 thật từ provider mới khoá lời gọi (theo `retry-after`). |
| INV-8 | Không thêm code AI mới vào `app.js`; chỉ đổi nguồn dữ liệu và a11y của pill. |
| INV-9 | Output AI chỉ render bằng `textContent`. |
| INV-10 | Route hiện có giữ URL và response shape; chỉ được thêm field (`engine`, `engineNote`, `requestId`, `usage`). |

---

## 4. Kiến Trúc

### 4.1. Luồng

```
UI (aiRequest) ──POST + X-AI-Config──▶ route (qaRoutes / aiRoutes / agentRoutes)
                                         │ signal = abortSignalFor(request, response)
                                         ▼
                              core/ai/tasks/<task>.run({ input, clientConfig, root, signal })
                                         │ dựng prompt, schema, fallback rule
                                         ▼
                              core/ai/gateway.callAi({ task, messages, schema, clientConfig, root, signal })
       config.resolve ─▶ limits.acquire ─▶ models.pick(tier) ─▶ adapter.send ─▶ json.extract+validate
              │                                   │ 400/404 alias → Settings model (1 lần)
              ▼                                   ▼
        usage.record (F8)                  audit.append (F3)
```

### 4.2. API `callAi`

```js
callAi({
  task,            // 'inferTestCases' | 'extractScaffold' | 'analyzeRequirement' | 'arbitrateConflict' | 'inlineSuggest' | 'agentTurn'
  messages,        // [{ role: 'system'|'user'|'assistant', content }], adapter tự chuyển sang Gemini contents
  schema,          // hình dạng JSON mong đợi; null với inlineSuggest/agentTurn
  clientConfig,    // cấu hình cá nhân từ X-AI-Config (có thể null)
  root,            // gốc repo, để đọc .env và ghi .tmp
  signal,          // AbortSignal từ route
  tools,           // chỉ agentTurn: danh sách tool theo định dạng hiện có của agentService
})
// → { ok: true, data, text, model, tier, aliasFallback, usage: { prompt, completion, total, estimated }, requestId, durationMs }
// → { ok: false, code, message, retryable, retryAfterMs, requestId }   // không ném lỗi cho các lỗi đã biết
```

Mã lỗi và câu chữ tiếng Việt (dùng chung cho mọi tác vụ, hiển thị qua `aiStatus`):

| `code` | Khi nào | Thông báo |
|---|---|---|
| `NOT_CONFIGURED` | không có key dùng được | Chưa cấu hình AI. Mở Cài đặt → Cấu hình AI. |
| `PROVIDER_DOWN` | `ECONNREFUSED`, DNS, reset | 9Router chưa chạy (localhost:20128). Mở 9Router rồi thử lại. |
| `AUTH` | 401/403 | API Key không hợp lệ hoặc hết hạn. |
| `RATE_LIMITED` | 429 thật | Hết hạn mức ở 9Router. Thử lại sau {n} giây. |
| `TIMEOUT` | quá `timeoutMs` | AI không trả lời sau {n} giây. |
| `CANCELLED` | signal bị hủy | Đã hủy. |
| `BAD_OUTPUT` | sai schema sau 1 lần thử lại | AI trả kết quả sai định dạng. |
| `TOO_LARGE` | input ước tính vượt trần | Nội dung quá dài cho tác vụ này ({n} token ước tính). |
| `BUSY` | đang có 2 lời gọi AI | Đang có 2 tác vụ AI chạy. Chờ xong hoặc hủy bớt. |

### 4.3. Tác vụ (F9) và tầng model (P3)

| Tác vụ | Route (giữ nguyên) | Code AI hiện tại | Tầng | Timeout server | Trần input / output | Khi AI lỗi |
|---|---|---|:-:|:-:|:-:|---|
| `inferTestCases` | `POST /api/qa/infer-testcases` (`mode=ai`) | `inferWithAi` | deep | 60s | 12k / 4k | Giữ hành vi hiện tại, chuẩn hoá thông báo |
| `extractScaffold` | `POST /api/qa/scaffold/extract` | `extractWithAi` | deep | 60s | 12k / 4k | Luật heuristic (đã có), gắn nhãn |
| `analyzeRequirement` | `POST /api/qa/analyze-requirement` | `analyzeWithAi` | deep | 60s | 12k / 4k | Luật heuristic + `fallbackNotice` (đã có) |
| `arbitrateConflict` | `POST /api/qa/conflict/arbitrate` | `callAi` | fast | 45s | 6k / 1k | `heuristicVerdict` (đã có) |
| `inlineSuggest` | `POST /api/ai/inline-suggest` | `inlineSuggest` | fast | 10s | 2k / 256 | Trả gợi ý rỗng |
| `agentTurn` | `/api/agent/*` | `geminiCall`, `openAiCall` | model Settings | 90s/lượt | theo session | Báo lỗi trong luồng chat |

Tầng → model:
- `fast` → `qaFast`, `deep` → `qaDeep`. Có thể đổi tên qua `.env` (`AI_MODEL_FAST`, `AI_MODEL_DEEP`).
- Alias chỉ được dùng khi provider là 9Router **và** alias có trong `GET /v1/models` (cache 5 phút).
- Không có alias, hoặc gọi alias bị 400/404, thì dùng model trong Settings (thử lại 1 lần, ghi `aliasFallback: true`).
- `agentTurn` luôn dùng model Settings.

### 4.4. Hủy và timeout

- `abortSignalFor(request, response)` trong `routeUtils.js` trả `AbortSignal`, bị hủy khi `response` phát `close` mà `writableEnded` còn `false`. Server dùng `http` thuần nên không có `req.signal` sẵn.
- Signal của task = `AbortSignal.any([routeSignal, AbortSignal.timeout(timeoutMs)])`. Node 20.18 có `AbortSignal.any`.
- `agentService` giữ một `AbortController` cho mỗi session đang chạy; `stop(id)` gọi `abort()`.
- UI: `aiRequest` đặt timeout = timeout server + 5s, để server luôn báo `TIMEOUT` trước khi UI tự cắt.

### 4.5. JSON (G17)

`json.js`:
- `extractJson(text)`: bỏ code fence ` ```json `/` ``` `, lấy khối `{…}` hoặc `[…]` cân bằng đầu tiên, bỏ qua dấu ngoặc nằm trong chuỗi.
- `validateShape(schema, value)`: kiểm `type`, `required`, `properties`, `items`, `enum`. Viết tay, không thêm dependency.
- Sai schema thì gửi lại 1 lần, kèm câu nhắc "chỉ trả JSON đúng schema". Sai lần 2 thì trả `BAD_OUTPUT`.

### 4.6. Ngân sách token 5 giờ (F8)

- `/.tmp/ai-usage.json`: `{ entries: [{ t, task, tokens, estimated }], blockedUntil }`. Bỏ các mục cũ hơn 5 giờ mỗi lần ghi.
- Ghi tuần tự qua một hàng đợi promise trong tiến trình (mutex, GAP-09); file ghi tạm rồi rename.
- Ngân sách mặc định 1.000.000, đổi bằng `.env` `AI_TOKEN_BUDGET_5H` (D5).
- Lấy `usage` thật từ response. Thiếu thì ước tính `ký tự / 4` và gắn `estimated: true`.
- `GET /api/ai/usage` trả `{ usedTokens, budget, remainingPercent, oldestEntryAt, resetsAt, estimatedShare, blockedUntil }`.
- 429 thật thì đặt `blockedUntil = now + retry-after` (mặc định 60s). Trong thời gian đó tác vụ có luật thì dùng luật, còn lại trả `RATE_LIMITED`.
- Tối đa 2 lời gọi AI chạy song song; lời gọi thứ 3 trả `BUSY` ngay (D6). Slot được trả cả khi lỗi hoặc bị hủy.

### 4.7. Nhật ký (F3, bản gọn)

- Mỗi lời gọi ghi 1 dòng vào `/.tmp/ai-audit/YYYY-MM-DD.jsonl`, gồm:
  - `ts`, `requestId`, `task`, `provider`, `model`, `tier`, `aliasFallback`
  - `promptHash` (sha256), `inputChars`, `usage`, `durationMs`
  - `outcome`: `ok`/`fallback`/`cancelled`/`timeout`/`error`/`bad_output`, cùng `errorCode`
  - `project`: tên thư mục gốc, để biết framework hay vệ tinh nào
- Ghi bất đồng bộ. Ghi lỗi không làm hỏng lời gọi.
- Lúc khởi động và sau mỗi 100 dòng: xoá file quá 30 ngày; tổng quá 50 MB thì xoá file cũ nhất.
- Chặng này chưa ghi "áp dụng/từ chối" (D3) và chưa có trang xem.

### 4.8. UI (F5)

- `js/components/ai/aiRequest.js`:
  - `startAiRequest({ url, body, timeoutMs, owner })` trả `{ promise, cancel, requestId }`.
  - Tự gắn `X-AI-Config` từ cấu hình cá nhân và dùng `apiClient` với `signal`.
  - Mỗi request có số thứ tự: kết quả của request cũ hơn request mới nhất cùng `owner` bị bỏ.
  - `owner.dispose()` hủy request đang chạy (D7).
- `aiStatus.js`: một dòng trạng thái gồm spinner, "Đang chờ AI… {n}s" và nút **Hủy**; hiển thị lỗi theo bảng 4.2 kèm nút **Thử lại** khi `retryable`; `aria-live="polite"`.
- `aiResultCard.js`: tag nguồn gốc, gồm "✦ AI đề xuất · {model}" hoặc "Kết quả từ luật (không dùng AI)" kèm lý do. Thay badge đang vẽ tay bằng hex (`reqAnalyzerHelper.js:114-126`, `:206`) và `engineNote` của Conflict Studio.
- `styles/components/ai.css`: chỉ dùng token có sẵn; không thêm `--ai-accent` (thuộc F10).
- Pill:
  - Bỏ `role="status"` trên `<button>`; phần trăm đặt trong `<span aria-live="polite">`.
  - Chỉ giữ một đường điều hướng: bỏ listener `app.js:15785`, giữ `data-view`.
  - Nhãn "Token 5 giờ", tooltip "đã dùng ~X / Y (ước tính) · làm mới lúc HH:mm". Giữ ngưỡng màu hiện tại (≥50%, 20–50%, <20%).

---

## 5. Danh Mục File

**Mới (mỗi file ≤ 150 dòng, không dùng `master-process-disable-size-check`):**

| File | Nội dung |
|---|---|
| `core/ai/gateway/index.js` | `callAi`, ráp các phần bên dưới |
| `core/ai/gateway/config.js` | Dựng cấu hình theo thứ tự cá nhân → server; dùng `endpointPolicy` |
| `core/ai/gateway/endpointPolicy.js` | Chuyển từ `dashboard/services/aiEndpointPolicy.js` (D8) |
| `core/ai/gateway/adapters/openaiCompatible.js`, `adapters/gemini.js` | Gửi request, map lỗi, đọc `usage` |
| `core/ai/gateway/errors.js` | Mã lỗi + câu chữ bảng 4.2 |
| `core/ai/gateway/json.js` | `extractJson`, `validateShape` |
| `core/ai/gateway/models.js` | Tầng, cache alias, fallback |
| `core/ai/gateway/limits.js` | Giới hạn song song, trần token |
| `core/ai/gateway/usage.js` | F8 |
| `core/ai/gateway/audit.js` | F3 |
| `core/ai/tasks/index.js` + 5 file tác vụ | F9 |
| `dashboard/public/js/components/ai/aiRequest.js`, `aiStatus.js`, `aiResultCard.js` | F5 |
| `dashboard/public/styles/components/ai.css` | Style F5 |
| `tests/dashboard/support/fakeAiProvider.js` | 9Router giả: độ trễ, 429, 404 alias, trả code fence, ghi header |

**Sửa:**
- `core/ai/agentService.js`: `geminiCall`/`openAiCall`/`inlineSuggest`/`testConnection` gọi Gateway; bỏ `MODEL_QUOTAS` và cửa sổ 60s; `stop()` hủy thật.
- `qaInferenceService.js`, `qaRequirementAnalyzerService.js`, `qaConflictService.js`: phần AI chuyển sang tác vụ; phần luật giữ nguyên.
- `qaRoutes.js`, `aiRoutes.js`, `core/ai/agentRoutes.js`: truyền signal và `clientConfig`; thêm `GET /api/ai/usage`.
- `routeUtils.js` (`abortSignalFor`).
- `index.html` (pill), `app.js` (nguồn dữ liệu pill, bỏ listener trùng), `agent.js` (panel quota).
- `reqAnalyzerHelper.js`, `conflictStudioHelper.js`, `qaSlice.js` (`:856`, `:1055`), `templates/qa.html` (chỗ đặt dòng trạng thái).
- `scripts/check-framework-structure.js`: thêm rule cấm gọi tới host AI ngoài `core/ai/gateway/adapters/`.

**Lưu ý đặt tên test:** `.gitignore` bỏ qua `tests/**/ai-*`, `tests/**/ai_*`, `tests/**/*-ai.*`, `tests/**/*_ai.*` và `tests/ai/` (dành cho test nháp AI sinh). Test của 17a không được đặt tên theo các mẫu này, nếu không sẽ không được commit (đã gặp khi làm F0).

---

## 6. Trải Nghiệm Người Dùng

| Tình huống | Hiển thị |
|---|---|
| Đang chạy | Dòng trạng thái "Đang chờ AI… 12s" và nút Hủy; nút chạy bị khoá (chống bấm đúp) |
| Xong bằng AI | Kết quả + "✦ AI đề xuất · qaDeep" |
| Rơi về luật | Kết quả + "Kết quả từ luật (không dùng AI): 9Router chưa chạy" |
| Lỗi không có luật thay thế | Thông báo bảng 4.2 + nút Thử lại; nội dung người dùng nhập vẫn giữ |
| Hủy | Về trạng thái trước khi chạy, toast "Đã hủy"; không tính token (response không tới) |
| Rời view khi đang chạy | Request bị hủy (D7); quay lại thấy trạng thái ban đầu |
| 9Router trả 429 | Pill đỏ, tooltip ghi thời điểm mở lại; tác vụ có luật dùng luật |

Kiểm ở 1920×1080, 1440×900, 1280×800, 390×844 với 2 theme. Dòng trạng thái và tag nguồn gốc phải xuống dòng, không tràn ngang ở 390px.

---

## 7. Rủi Ro → Rào Chắn → Bằng Chứng

| # | Rủi ro | Rào chắn | Scenario |
|:-:|---|---|---|
| R1 | Tách transport khỏi vòng lặp tool của agent làm hỏng Agent | Chỉ thay lớp gửi request; giữ nguyên vòng lặp và định dạng tool; chạy lại `agentService.test.js`, `agentRoutes.test.js`, `agent-ui-*.test.js` | AI17-15, 16 |
| R2 | 9Router xử lý alias, 404 hoặc 429 khác giả định | Phase 0 thăm dò 9Router thật và ghi lại response vào fixture | AI17-05 |
| R3 | Hủy không tới được upstream | Fake provider ghi sự kiện `aborted`; test đo ≤ 500 ms | AI17-08, 09 |
| R4 | Lost update ở `ai-usage.json` | Mutex + ghi tạm rồi rename; 50 lời gọi song song | AI17-11 |
| R5 | Đổi response shape làm hỏng UI cũ | Snapshot shape trước/sau cho 5 route | AI17-17 |
| R6 | Nhật ký làm lộ dữ liệu | Chỉ ghi hash và số ký tự; test quét dòng log tìm chuỗi prompt | AI17-13 |
| R7 | Rule `check:framework` bắt nhầm | Rule chỉ quét `core/`, `dashboard/services|routes`; có test âm | AI17-01 |
| R8 | Satellite nhận `core/ai/` mới nhưng `.env` khác | Gateway chỉ đọc `.env` của repo đang chạy; không có đường dẫn cứng | AI17-02 |

---

## 8. Kiểm Thử

### 8.1. Scenario

| Mã | Cấp | Nội dung |
|---|---|---|
| AI17-01 | unit | Không file nào ngoài `adapters/` gọi host AI; rule bắt được một file mẫu vi phạm và bỏ qua file hợp lệ |
| AI17-02 | unit | Dựng cấu hình: cá nhân có key → dùng cá nhân; không có → server; server key chỉ với endpoint đã lưu; không có gì → `NOT_CONFIGURED` |
| AI17-03 | integration | Provider 9Router + fake 9Router: 5 tác vụ + agent + inline gọi đúng 9Router, 0 request tới API chính thức |
| AI17-04 | unit | `extractJson`: code fence, lời dẫn, text sau JSON, ngoặc trong chuỗi, mảng gốc; `validateShape` báo đúng trường sai |
| AI17-05 | integration | Alias có → dùng `qaDeep`; không có trong `/models` → model Settings; alias trả 404 → thử lại 1 lần bằng model Settings, `aliasFallback: true` |
| AI17-06 | integration | Sai schema lần 1, đúng lần 2 → `ok`; sai 2 lần → `BAD_OUTPUT` và tác vụ rơi về luật khi có |
| AI17-07 | integration | Map lỗi: từ chối kết nối → `PROVIDER_DOWN`; 401 → `AUTH`; 429 kèm `retry-after` → `RATE_LIMITED` + `blockedUntil`; timeout → `TIMEOUT` |
| AI17-08 | integration | Client ngắt kết nối giữa chừng → fake 9Router thấy request bị hủy ≤ 500 ms; nhật ký ghi `cancelled` |
| AI17-09 | integration | `POST /api/agent/sessions/:id/stop` khi đang chờ provider → lời gọi bị hủy, session `stopped`, không có event sau khi dừng |
| AI17-10 | unit | `usage`: cửa sổ trượt 5 giờ (giờ giả), ước tính khi thiếu `usage`, còn sau khi tạo lại module |
| AI17-11 | integration | 50 lời gọi ghi `usage` song song → tổng đúng, file JSON hợp lệ |
| AI17-12 | integration | Vượt ngân sách local chỉ cảnh báo, lời gọi vẫn chạy; chỉ 429 thật mới khoá; hết `blockedUntil` thì chạy lại |
| AI17-13 | unit | Nhật ký: 1 dòng mỗi lời gọi, không chứa prompt/response, xoá theo 30 ngày và 50 MB, ghi lỗi không làm hỏng lời gọi |
| AI17-14 | unit | Giới hạn song song 2: lời gọi thứ 3 → `BUSY`; slot trả lại khi lỗi hoặc hủy; `TOO_LARGE` trước khi gọi mạng |
| AI17-15 | integration | Agent: một lượt có tool call chạy qua Gateway với cả Gemini và OpenAI-compatible (fake) |
| AI17-16 | integration | Các test AI hiện có (`agentService`, `agentRoutes`, `agent-ui-*`, `qaConflictService`, `qaRequirementAnalyzerService`, `aiKeyBinding`, `settings-ai-security`) xanh |
| AI17-17 | integration | 5 route giữ response shape (snapshot trước/sau), chỉ thêm field ở INV-10 |
| AI17-18 | e2e | Phân tích requirement: bấm chạy → dòng trạng thái đếm giây → Hủy → trạng thái ban đầu; fake 9Router thấy bị hủy |
| AI17-19 | e2e | Chạy phân tích, đổi nội dung nhập rồi chạy lại khi lần 1 chưa xong → chỉ kết quả lần 2 hiện |
| AI17-20 | e2e | Chạy AI rồi chuyển sang view khác và quay lại → request đã hủy, không có kết quả cũ chèn vào |
| AI17-21 | e2e | 20 vòng vào/ra view QA → số listener và request đang mở không tăng; disposer cũ không hủy request của lần mount mới; dispose 2 lần an toàn |
| AI17-22 | e2e | 9Router tắt → "Kết quả từ luật (không dùng AI): 9Router chưa chạy"; bật lại → Thử lại → "✦ AI đề xuất" |
| AI17-23 | e2e | Pill: không còn `role="status"` trên button, điều hướng đúng 1 lần, focus thấy được, class theo ngưỡng, tooltip có "ước tính" |
| AI17-24 | e2e | Cấu hình cá nhân trong localStorage tới được `/api/qa/analyze-requirement` (header `X-AI-Config`) |
| AI17-25 | e2e | 4 kích thước × 2 theme cho dòng trạng thái, tag nguồn gốc, pill; không tràn ngang; 0 lỗi console ngoài lỗi đã biết |
| AI17-26 | e2e | Danh sách nút AI đếm độc lập trong DOM khớp registry tác vụ |

### 8.2. Ánh xạ gate scenarios

| Nhóm | Mã | Scenario 17a |
|---|---|---|
| async_state | ASYNC-01 | AI17-19 (người dùng sửa nội dung khi AI đang chạy) |
| | ASYNC-02 | AI17-20 |
| | ASYNC-03 | AI17-19 |
| | ASYNC-04 | AI17-08, 09, 18, 22 |
| | ASYNC-05 | AI17-06, 22 (chỉ báo xong sau khi server trả kết quả đã kiểm) |
| ownership_lifecycle | OWN-01..05 | AI17-21 |
| router_ui | UI-01 | AI17-26 |
| | UI-02, UI-03 | AI17-23 |
| | UI-04 | AI17-20 |
| | UI-05 | Không áp dụng: các luồng AI trong phạm vi không có bản lưu nháp; nội dung nhập được giữ khi lỗi (AI17-22). Ghi lý do trong contract. |
| lifecycle_integration | LIFE-01 | AI17-22 (qua UI: chạy, lỗi, thử lại, rời view, dọn dẹp) |

---

## 9. Kế Hoạch Triển Khai (ước lượng ~18 ngày công, 1 người)

### Phase 0 — Chuẩn bị (1 ngày)
- [ ] 0.1 **Chủ dự án:** tạo key mới trong 9Router, cập nhật `.env`, xác nhận 9Router từ chối key cũ.
- [ ] 0.2 Review độc lập Gate 3 cho F0 (`45f85c2`, `216d35f`), do session khác thực hiện.
- [x] 0.3 Thăm dò 9Router thật (chỉ đọc): shape của `GET /v1/models`, response khi model không tồn tại, header của 429, `stream: true`. Ghi vào fixture của `fakeAiProvider.js`.
- [x] 0.4 Soạn contract `.delivery/phases/plan-17a.json`: AC theo mục 2.1, mỗi TC là một test thật ở đúng cấp, phủ 16 gate scenario (UI-05 ghi rõ không áp dụng). Chờ BA duyệt hash.
- [x] 0.5 Baseline: unit, `test:dashboard:api`, E2E dashboard, `check:framework`. Ghi các lỗi có sẵn: `bddDraft.test.js` và `templates-performance-a11y` TC-13.
- **Exit:** key mới hoạt động, fixture 9Router có dữ liệu thật, contract đã soạn ✓.

### Phase 1 — Gateway lõi (4 ngày)
- [x] 1.1 `endpointPolicy.js` (chuyển từ `aiEndpointPolicy.js`, giữ re-export), `config.js`, `errors.js`.
- [x] 1.2 `adapters/openaiCompatible.js`, `adapters/gemini.js`: signal, timeout, map lỗi, đọc `usage`.
- [x] 1.3 `json.js`, `models.js` (tầng, alias, fallback), `limits.js`.
- [x] 1.4 `index.js` (`callAi`) + `abortSignalFor` trong `routeUtils.js`.
- [x] 1.5 Test AI17-02, 04, 05, 06, 07, 14.
- **Exit:** `callAi` chạy với fake provider cho cả 2 adapter; chưa module nào dùng ✓.

### Phase 2 — Tác vụ và chuyển đổi (4 ngày)
- [x] 2.1 `core/ai/tasks/` cho 5 tác vụ; prompt và schema chuyển nguyên văn từ service cũ.
- [x] 2.2 Chuyển 3 service QA sang tác vụ; route truyền signal và `clientConfig`.
- [x] 2.3 `agentService`: transport qua Gateway, `stop()` hủy thật, `testConnection` qua adapter.
- [x] 2.4 Rule `check:framework` (AI17-01).
- [x] 2.5 Test AI17-01, 03, 08, 09, 15, 16, 17.
- **Exit:** 13 điểm ở mục 1.1 đi qua Gateway; 0 request tới API chính thức khi dùng 9Router; test cũ xanh ✓.

### Phase 3 — Ngân sách token và nhật ký (3 ngày)
- [x] 3.1 `usage.js`, `GET /api/ai/usage`, bỏ `MODEL_QUOTAS` và cửa sổ 60s trong `agentService`.
- [x] 3.2 `audit.js` và dọn dẹp theo hạn.
- [x] 3.3 Pill: a11y, bỏ điều hướng trùng, nguồn dữ liệu mới; panel quota của `agent.js`.
- [x] 3.4 Test AI17-10, 11, 12, 13, 23.
- **Exit:** pill hiển thị số 5 giờ và còn nguyên sau restart; chỉ 429 thật mới khoá ✓.

### Phase 4 — Component AI và giao diện (4 ngày)
- [x] 4.1 `aiRequest.js`, `aiStatus.js`, `aiResultCard.js`, `ai.css`.
- [x] 4.2 Chuyển `reqAnalyzerHelper`, `conflictStudioHelper`, `qaSlice` (scaffold extract, suy luận TC); bỏ màu hex và `style` inline ở những chỗ này.
- [x] 4.3 Test AI17-18..22, 24..26 (Playwright E2E `tests/dashboard/qa-ai-foundation.spec.js` 10/10 PASS).
- **Exit:** 4 luồng AI của tab QA hủy được, bỏ qua phản hồi muộn, có tag nguồn gốc và gửi cấu hình cá nhân ✓.

### Phase 5 — Gate 4 và bàn giao (2 ngày)
- [x] 5.1 Chạy toàn bộ bộ test (gateway 29/29, services 118/118, E2E 10/10, framework check pass); receipt JUnit bằng `record-gate-run.py`.
- [ ] 5.2 Review độc lập Gate 3/4, chạy lại các TC critical trên cùng SHA; `master.ps1 gate`.
- [ ] 5.3 Chạy drift check; sync vệ tinh chỉ khi chủ dự án đồng ý (xem memory: `git add -A` trong vệ tinh sẽ gom cả file chưa commit).
- [ ] 5.4 Ghi bài học vào `AI_LESSONS.md` và candidate (sau khi chạy Knowledge Curator vì `candidates.md` đang ở 49/50 dòng).

---

## 10. Định Nghĩa Hoàn Thành

- [ ] Mục tiêu 2.1 (1)–(9) đều có bằng chứng test ở đúng cấp.
- [ ] 16 gate scenario có TC hoặc lý do không áp dụng đã được duyệt.
- [ ] Không file mới nào vượt 150 dòng hoặc dùng `master-process-disable-size-check`; `agentService.js` và 3 service QA ngắn lại.
- [ ] 4 kích thước × 2 theme đã kiểm; 0 lỗi console mới.
- [ ] Contract được BA duyệt hash; `master.ps1 gate` PASS; có review độc lập.

---

## 11. Quyết Định Cần Chốt

| # | Đề xuất | Lý do | Nếu không duyệt |
|---|---|---|---|
| D1 | **Hoãn stream token (SSE) tới QA-2.** Chặng 1 có đếm giây + nút Hủy ở UI và hủy thật ở server. | Cả 4 tác vụ QA trả JSON, chỉ dùng được khi đã nhận đủ; stream token không giúp hiển thị. Đây là **lệch nguyên tắc 12 của PLAN-17**. | Thêm route SSE chung và đọc stream ở `aiRequest` (+3 ngày) |
| D2 | **Hoãn `aiDiffReview` và API apply chung** tới chặng có AI sinh diff (QA-2, QA-5). | Các luồng ghi hiện có (scaffold, thêm TC, sửa xung đột) đã có backup riêng. PLAN-18 đã có sẵn manifest/rollback để dùng lại khi cần. | +3 ngày, và chưa có luồng nào dùng tới |
| D3 | Nhật ký chặng này chỉ ghi kết quả lời gọi, chưa ghi "áp dụng/từ chối". | Việc áp dụng/từ chối gắn với `aiDiffReview` (D2). | Phải nối `requestId` vào 3 route ghi file |
| D4 | Alias mặc định `qaFast`/`qaDeep`, đổi được qua `.env`; chỉ dùng khi 9Router có alias. Bảng chọn model trong Settings để F1b (Chặng 3). | P3 đã chọn, nhưng F1b không nằm trong chặng này. | Làm thêm một phần F1b |
| D5 | Ngân sách 1.000.000 token / 5 giờ, đổi qua `.env` `AI_TOKEN_BUDGET_5H`; chưa có UI chỉnh. | UI chỉnh thuộc F1b. | Như D4 |
| D6 | Lời gọi AI thứ 3 bị từ chối ngay (`BUSY`), không xếp hàng. | Chỉ 1 người dùng; xếp hàng sẽ làm UI chờ mà không rõ lý do. | Thêm hàng đợi có hủy |
| D7 | Rời view khi AI đang chạy thì hủy request. | Tránh tốn token cho kết quả không ai xem. | Cho chạy nền và hiện kết quả khi quay lại (cần lưu trạng thái theo view) |
| D8 | Chuyển phần chọn endpoint/key từ `dashboard/services/aiEndpointPolicy.js` sang `core/ai/gateway/endpointPolicy.js`; dashboard giữ re-export. | `core/` không được phụ thuộc `dashboard/`. | Gateway phải `require` ngược vào `dashboard/` |

---

## 12. Rủi Ro Còn Lại (ngoài phạm vi 17a)

- **CSRF toàn server.** `parseBody` nhận JSON gửi dạng `text/plain`, nên trang web khác có thể gửi POST tới route ghi file hoặc route agent. F0 mới chặn `/api/ai/*`. Nên làm một plan nhỏ riêng: kiểm `Sec-Fetch-Site`/`Origin`/`Host` cho mọi `POST|PUT|PATCH|DELETE` trong `server.js`. `aiEndpointPolicy.isCrossSiteRequest` dùng lại được.
- **Hook secret của Master Process** (`modularity_audit.py`, regex `sk-[0-9a-zA-Z]{20,}`) không bắt được key có dấu `-` như key 9Router cũ. Nên sửa ở Hub Master Process (repo khác).
- Số token là ước tính, vì 9Router dùng chung với công cụ khác; tooltip pill phải ghi rõ.
- `app.js` vẫn 17.351 dòng. 17a chỉ sửa 2 chỗ (pill, listener trùng); gợi ý code trong editor vẫn gọi `fetch` trực tiếp phía client, nhưng phía server đã qua Gateway.
