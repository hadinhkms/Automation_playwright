# Kế Hoạch 19b: Ma Trận Giá Trị Biên (BVA/EP) & Chuẩn Hoá AC Given-When-Then (BA-2)

> **Mã kế hoạch:** `PLAN-19b` — tách từ [PLAN-19](19_BDD_SPEC_AND_SMART_TEST_DATA_STUDIO_PLAN.md) v1  
> **Phiên bản:** `v1.1` — 2026-09-28  
> **Trạng thái:** `DRAFT — CHỜ CHỐT D1–D7 (mục 0), BA DUYỆT CORPUS (Phụ lục A, B) VÀ HASH CONTRACT (Phase 0)`  
> **Phân loại:** L3. Ma trận biên **không dùng AI** (0 token); chỉ riêng BDD gọi AI qua gateway.  
> **Phạm vi:** modal **Phân tích Yêu cầu** trong `#/qa` (`#qa-req-analyzer-modal`), `dashboard/services/`, `core/ai/tasks/`, `dashboard/routes/`.  
> **Phụ thuộc:** không phụ thuộc PLAN-19a. Làm sau 19a để mỗi lần chỉ có một phase chờ gate trên `main`.  
> **Tham chiếu bắt buộc:** [AGENTS.md](../AGENTS.md), [DASHBOARD_AI_PROMPT.md](../ai/dashboard/DASHBOARD_AI_PROMPT.md), [AI_LESSONS.md](../ai/dashboard/AI_LESSONS.md), [AI_PROMPTS.md §3, §5](../ai/shared/AI_PROMPTS.md), [03_ACCEPTANCE_GATES.md](../.master_process/03_ACCEPTANCE_GATES.md), [gate-scenarios.json](../.master_process/config/gate-scenarios.json), [PLAN-17 §BA-2](17_AI_ASSISTED_QA_FRAMEWORK_PLAN.md).  
> **Nhánh:** trunk-based trên `main`. Commit code **trước** khi ghi receipts.

---

## 0. Quyết Định Cần Chốt Trước Phase 1

| # | Đề xuất | Lý do |
| --- | --- | --- |
| D1 | Ma trận biên chạy **hoàn toàn bằng luật**, không gọi AI. Câu có số nhưng không khớp mẫu thì liệt kê ở mục "Chưa nhận diện" | 0 token, kết quả xác định, kiểm được bằng corpus. Không đoán số |
| D2 | BDD bản đầu **chỉ sao chép Markdown**, không ghi vào file REQ. Người dùng dán vào Document Reader rồi Lưu | Document Reader đã có backup và chống ghi đè (`expectedBytes` → 409). Bỏ được một đường ghi file, chặn rời trang và xử lý xung đột |
| D3 | Từ khoá tiếng Anh in đậm `**Given/When/Then/And**`, nội dung bước bằng tiếng Việt | Trùng scaffold hiện có ([qaRequirementAnalyzerService.js:617](../dashboard/services/qaRequirementAnalyzerService.js#L617)) và [bddDraft.js](../scripts/lib/bddDraft.js). `GIVEN` viết hoa (bản v1) không phải cú pháp Gherkin |
| D4 | Mỗi AC đầu vào ứng với **đúng 1 scenario**. AI không được đổi hoặc bịa mã. AC mới do AI đề xuất nằm ở mục riêng, **không có heading** | Tuân thủ AI_PROMPTS §3.1: không đổi ID đã dùng. Scanner không đếm nhầm AC chưa có mã |
| D5 | BDD **không có luật thay thế**: AI lỗi thì báo lỗi kèm nút Thử lại | [PLAN-17 dòng 78](17_AI_ASSISTED_QA_FRAMEWORK_PLAN.md#L78): BA-2 không được trả kết quả giả |
| D6 | Giữ nguyên heuristic BVA cũ trong `analyzeWithHeuristic`; hợp nhất ở plan sau | Tránh đổi output của tab "Test case" đang dùng. Ghi ở mục Rủi ro |
| D7 | Giới hạn đầu vào: BVA ≤ 20.000 ký tự, BDD ≤ 8.000 ký tự. Vượt thì trả 413, **không cắt âm thầm** | BA biết phần nào không được xử lý |

---

## 1. Mục Tiêu & Ngoài Phạm Vi

### 1.1. Mục tiêu đo được

- **G1:** Trích ràng buộc đúng 100% câu trong corpus dương tính (Phụ lục A, 33 câu). Corpus âm tính (Phụ lục B, 10 câu) không sinh ràng buộc nào; câu nào có chữ số thì nằm trong `unrecognized` với đúng số dòng.
- **G2:** Mỗi ràng buộc có phân vùng tương đương (hợp lệ / không hợp lệ) và các điểm biên theo bảng 4.2.
- **G3:** Ma trận biên tốn 0 token. Có test HTTP chứng minh không có lời gọi AI.
- **G4:** BDD giữ nguyên 100% mã AC đầu vào. Markdown đầu ra được scanner `tools/qa/lib/sources.js` đọc đủ AC.
- **G5:** BDD không trả kết quả khi AI lỗi, sai schema hoặc bỏ sót AC.

### 1.2. Ngoài phạm vi

- Ghi BDD thẳng vào file REQ (D2). Nếu cần, làm ở 19c: nút "Chèn vào tài liệu đang mở" qua `PUT /api/qa/document` với `expectedBytes`.
- Số thập phân, tiền tệ (`triệu`, `nghìn`, `đồng`), ngày giờ, phần trăm. Bản đầu liệt kê các câu này là "chưa nhận diện".
- Sinh test case từ ma trận (đã có QA-1 `/api/ai/generate-tc`).
- Gọi sang PLAN-19a (vd. chuỗi mẫu tiếng Việt), để giữ 19b độc lập.

---

## 2. Ràng Buộc Từ Code Hiện Tại (Ground Truth)

| Sự thật (đã kiểm) | Hệ quả thiết kế |
| --- | --- |
| Modal phân tích REQ có các tab `tc`, `impact`, `logic`, `qa`, `clarity`, `spec` ([qa.html:860-990](../dashboard/public/templates/qa.html#L860-L990)). Nút "Soát độ rõ" nằm ở hàng công cụ phía input ([qa.html:836](../dashboard/public/templates/qa.html#L836)). `switchTab` ẩn/hiện theo id `qa-req-panel-<key>` ([reqAnalyzerHelper.js:799](../dashboard/public/js/views/qa/reqAnalyzerHelper.js#L799)) | Thêm tab `bva`, `bdd` và 2 nút theo đúng mẫu tab `clarity` |
| `reqAnalyzerHelper.js` 993 dòng, đang có exemption | Chỉ thêm ≤ 15 dòng để gắn vào; logic mới nằm trong `views/qa/specStudio/` |
| Heuristic BVA cũ ([qaRequirementAnalyzerService.js:325-390](../dashboard/services/qaRequirementAnalyzerService.js#L325-L390)) dùng `match` không cờ `g`: chỉ bắt khoảng đầu tiên, không có biên mở, không tách nhiều trường | Viết module mới độc lập, không sửa bản cũ (D6) |
| BA-1 (`/api/ai/req-clarity`) đã trả `clarifiedDraft` dạng Given-When-Then văn xuôi | BA-2 khác ở 3 điểm: có cấu trúc theo từng AC, được kiểm bằng luật, và giữ mã AC |
| Scanner nhận AC qua heading `^#{2,6}\s*AC-\d{3}` kèm `:`/`-` ([sources.js:30](../tools/qa/lib/sources.js#L30)); ID viết gần đúng bị báo near-miss | Renderer xuất `### AC-001: <tiêu đề>`, dùng cùng regex khi đọc AC từ đầu vào |
| [bddDraft.js](../scripts/lib/bddDraft.js) và `GET /api/qa/bdd-draft` dựng BDD từ **test case**, chỉ đọc, không lưu | Khác phạm vi (19b xử lý AC trong REQ). Không sửa |
| Mọi `/api/ai/*` qua chặn cross-site ở [aiRoutes.js:45](../dashboard/routes/aiRoutes.js#L45) trước khi tới handler. `aiRoutes.js` đã 248 dòng | Đặt `POST /api/ai/format-bdd` trong `aiFastWinsRoutes.js` (99 dòng), cạnh `req-clarity` |
| `callAi({ task, messages, schema, clientConfig, root, signal, tier, timeoutMs, temperature })` trả `{ ok, data, model, tier, usage, requestId, code, message }`. Mã lỗi: `NOT_CONFIGURED`, `PROVIDER_DOWN`, `AUTH`, `RATE_LIMITED`, `TIMEOUT`, `CANCELLED`, `BAD_OUTPUT`, `TOO_LARGE`, `BUSY` ([errors.js](../core/ai/gateway/errors.js)) | Task mới theo mẫu [checkRequirementClarity.js](../core/ai/tasks/checkRequirementClarity.js), **nhưng không có nhánh fallback luật** (D5) |
| Front-end đã có [aiRequest.js](../dashboard/public/js/components/ai/aiRequest.js) (seq guard + huỷ, `startAiRequest({ url, body, timeoutMs, owner })`) và `aiStatus.js` (đang chờ / lỗi / thử lại) | Dùng lại, không viết bộ gọi AI thứ hai |
| Qa view đã có `#qa-batch-confirm` và `confirmDialog()` ([batchConfirm.js](../dashboard/public/js/views/qa/batch/batchConfirm.js)) | Dùng lại cho UI-05 |
| Test AI hiện có: API dùng [fakeAiProvider.js](../tests/dashboard/support/fakeAiProvider.js) (ghi nhận abort); E2E dùng `page.route('**/api/ai/...')` | Không gọi AI thật trong test |
| `qaRoutes.js` 399 dòng, có exemption | Endpoint BVA nằm ở file route mới |

---

## 3. Nguyên Tắc Bất Biến

- **INV-1:** ma trận biên không gọi AI.
- **INV-2 (Không đoán):** câu không khớp mẫu thì trả `unrecognized`, không sinh số.
- **INV-3:** giữ mã AC (D4).
- **INV-4:** không trả kết quả giả (D5).
- **INV-5:** 19b không ghi file nào (D2).
- **INV-6 (Hiển thị an toàn):** mọi nội dung hiển thị qua `textContent`. Markdown nằm trong `<pre>`, không render HTML.
- **INV-7 (Oracle độc lập):** kỳ vọng lấy từ corpus và chuỗi viết tay trong test, không gọi lại hàm đang được kiểm để tính kỳ vọng.

---

## 4. Thiết Kế

### 4.1. Trích ràng buộc — `dashboard/services/qaBoundaryExtract.js` (≤ 200 dòng)

`extractConstraints(text)` trả `{ constraints, unrecognized: [{ line, text }] }`.

Mỗi ràng buộc có dạng:
`{ id: 'B-01', field, kind: 'number' | 'length', unit, min, max, implicitMin, needsReview, source: { line, text } }`

**Quy trình:**

1. Chuẩn hoá NFC; đổi `≥ ≤` thành `>= <=`; đổi `– —` thành `-`. Tách theo dòng, rồi tách câu theo `.`, `;`, `!`, `?` **có khoảng trắng hoặc hết dòng phía sau**. Nhờ vậy `1.000` không bị tách.
2. **Chặn (câu có chữ số thì cả câu vào `unrecognized`):**
   - ngày `\d{1,2}/\d{1,2}(/\d{2,4})?`;
   - giờ `\d{1,2}:\d{2}`;
   - số thập phân (`0,5`, `2.5`);
   - đơn vị tiền `triệu | nghìn | ngàn | tỷ | đồng | vnđ | vnd | usd | $`;
   - số đứng **sau** `ngày | tháng | năm | quý | tuần | phiên bản | version | v`.
3. **Số:** `\d{1,3}(?:[.,]\d{3})+` hoặc `\d+`, đổi thành số nguyên (`1.000` → 1000).
4. **Mẫu**, xét theo thứ tự (mỗi mẫu chiếm đoạn văn nó khớp):

   | Mẫu | Ví dụ từ khoá | Kết quả |
   | --- | --- | --- |
   | `MIN_SUFFIX` / `MAX_SUFFIX` | `từ N [đơn vị] trở lên` / `trở xuống` | min / max (gồm N) |
   | `RANGE` | `từ N đến/tới N`, `trong khoảng N đến N`, `between N and N`, `N-N <đơn vị>` (dạng trần bắt buộc có đơn vị) | min, max |
   | `EXACT` | `(gồm \| có)? đúng N`, `gồm N <đơn vị>` | min = max = N |
   | `MAX_INCL` | `tối đa`, `không quá`, `không vượt quá`, `không (được )?(dài \| lớn \| nhiều \| cao) hơn`, `at most`, `maximum`, `up to`, `<=` (cho phép `:` sau từ khoá) | max = N |
   | `MIN_INCL` | `tối thiểu`, `ít nhất`, `không (ít \| nhỏ \| thấp) hơn`, `at least`, `minimum`, `>=` | min = N |
   | `MIN_EXCL` | `lớn hơn`, `nhiều hơn`, `dài hơn`, `trên`, `more than`, `greater than`, `>` (không đứng sau `không`) | min = N + 1 |
   | `MAX_EXCL` | `nhỏ hơn`, `ít hơn`, `ngắn hơn`, `dưới`, `less than`, `fewer than`, `<` | max = N − 1 |

5. **Đơn vị và `kind`:**
   - `kind = 'length'` khi đơn vị là `ký tự | kí tự | chữ số | character(s) | char(s) | digit(s)`;
   - ngược lại `kind = 'number'`, và `unit` giữ từ đứng sau số nếu thuộc danh sách `tuổi | mục | ảnh | file | tệp | lần | người | giây | phút | giờ | ngày | sản phẩm | item(s)`.
6. **Tên trường:** lấy đoạn từ đầu câu (hoặc từ cuối lần khớp trước) tới đầu lần khớp này.
   - Bỏ gạch đầu dòng hoặc số thứ tự ở đầu; bỏ `và | and | ,` ở đầu; bỏ `:` `,` ở cuối.
   - Lặp lại việc bỏ các từ đệm ở cuối: `phải | có | là | dài | có độ dài | độ dài | được | chỉ | cho phép chọn | cho phép | chọn | nhập | gồm | không được | must be | must | should be | should | be | is`.
   - Viết hoa chữ cái đầu.
7. **Gộp:** trong cùng câu, lần khớp có tên trường rỗng (vd. `… tối thiểu 8 ký tự và tối đa 32 ký tự`) được gộp vào ràng buộc liền trước nếu ràng buộc đó chưa có biên này. Nếu không gộp được thì đặt tên trường `(chưa rõ trường)` và `needsReview = true`.
8. **`needsReview = true`** khi câu chứa `báo lỗi | bị chặn | không hợp lệ | không cho phép | từ chối | error | reject | invalid`. Câu mô tả điều kiện lỗi có thể làm đảo chiều biên.
9. Câu có chữ số mà không sinh ràng buộc nào thì vào `unrecognized`.

### 4.2. Ma trận — `dashboard/services/qaBoundaryMatrix.js` (≤ 200 dòng)

`buildMatrix(constraint)` trả `{ partitions, values, invalidTypes }`.

| Loại ràng buộc | Điểm biên (`values`, khử trùng, sắp tăng dần) | Phân vùng |
| --- | --- | --- |
| Hai phía [a, b] | a−1 ✗, a ✓, a+1 ✓, nominal ✓, b−1 ✓, b ✓, b+1 ✗. nominal = a + ⌊(b−a)/2⌋ | `< a` ✗ · `a … b` ✓ · `> b` ✗ |
| Chỉ min a | a−1 ✗, a ✓, a+1 ✓ | `< a` ✗ · `≥ a` ✓ |
| Chỉ max b | b−1 ✓, b ✓, b+1 ✗. Riêng `length` thêm 0 với `implicitMin: true` (cần BA xác nhận trường có bắt buộc không) | `≤ b` ✓ · `> b` ✗ |
| Đúng n | n−1 ✗, n ✓, n+1 ✗ | `≠ n` ✗ · `= n` ✓ |

- Với `length`, bỏ các giá trị < 0. Mỗi giá trị có `sample = 'x'.repeat(value)` khi value ≤ 1024.
- `invalidTypes`: với `number` là `["", "abc", "1.5", " "]`; với `length` là `["   "]`, cộng thêm `""` khi min ≥ 1.
- **Ví dụ:** `[18, 60]` cho ra 17 ✗ · 18 · 19 · 39 · 59 · 60 · 61 ✗.

### 4.3. BDD — `core/ai/tasks/bddCriteriaRules.js` (≤ 150) và `core/ai/tasks/formatBddCriteria.js` (≤ 150)

**`bddCriteriaRules.js`** (hàm thuần, không gọi AI):

- `extractAcBlocks(text)` trả `{ acs: [{ id, title, body }], warnings }`.
  - Nhận heading `^#{2,6}\s*AC-\d{3}` (cùng regex với scanner), dòng bắt đầu bằng `AC-\d{3}[:.-]`, và `**AC-\d{3}**`.
  - Mã gần đúng (`AC-8`, `AC_012`, `ac-001`) chỉ vào `warnings`, không được nhận là AC.
- `validateScenarios(data, inputAcs)` trả `{ ok, scenarios, proposals, openQuestions, code?, details? }`:

  | Luật | Vi phạm thì |
  | --- | --- |
  | Có 1–30 scenario | `BDD_INVALID` |
  | `given`, `when`, `then` mỗi mảng 1–6 bước; mỗi bước 1–300 ký tự sau khi trim | `BDD_INVALID` |
  | Bước bắt đầu bằng từ khoá (`Given/When/Then/And/But/Cho/Biết/Khi/Thì/Và/Nhưng`, có hoặc không có `:`) | Tự bỏ từ khoá |
  | `acId` khác `null` và không có trong đầu vào | `BDD_UNKNOWN_AC` |
  | Mã đầu vào bị thiếu hoặc lặp | `BDD_MISSING_AC` (`details` liệt kê mã) |
  | `title` trống nhưng có `acId` | Lấy tiêu đề của AC đầu vào |
  | `acId: null` | Chuyển sang `proposals` |
  | `openQuestions` nhiều hơn 10 | Cắt còn 10 |

- `renderBddMarkdown({ scenarios, proposals })` xuất (dòng `\n`, NFC):

  ```markdown
  ### AC-001: Nộp hồ sơ thiếu số điện thoại

  **Given** ứng viên đang ở màn hình Nộp hồ sơ
  **When** ứng viên để trống "Số điện thoại" và bấm "Nộp hồ sơ"
  **Then** hệ thống hiển thị lỗi "Số điện thoại không được để trống"
  **And** hồ sơ không được gửi

  #### Đề xuất AC mới (gán mã AC-xxx trước khi dán vào tài liệu)

  - Nộp hồ sơ khi mất mạng
    - **Given** …
  ```

**`formatBddCriteria.js`**:

- `SCHEMA`: `{ scenarios: [{ acId: string|null, title, given: string[], when: string[], then: string[] }], openQuestions: string[] }`.
- `buildBddPrompts({ requirementText, acs })`. Prompt yêu cầu AI:
  - giữ nguyên mã AC, mỗi AC một scenario (D4);
  - không bịa mã (AC mới dùng `acId: null`);
  - viết bước bằng tiếng Việt, không lặp từ khoá trong bước;
  - mỗi bước là một hành động hoặc kết quả quan sát được, giữ số liệu cụ thể có trong AC;
  - điều gì văn bản không nói thì đưa vào `openQuestions`, không tự thêm vào bước.
- `runFormatBddCriteria({ requirementText, clientConfig, root, signal })`:
  - gọi `callAi` với `task: 'formatBddCriteria'`, `tier: 'fast'`, `timeoutMs: 45000`, `temperature: 0.1`;
  - `!ok` → `{ ok: false, code: res.code, error: res.message }`;
  - `ok` → chạy `validateScenarios`, rồi `renderBddMarkdown`.
- Export cả 2 file qua `core/ai/tasks/index.js`.

### 4.4. API

**`POST /api/qa/boundary-matrix`** — file mới `dashboard/routes/qaSpecRoutes.js` (≤ 100 dòng), đăng ký trong `server.js` trước `handleQaBatchRoutes`. Không gọi AI.

- Body: `{ requirementText }`.
- **200:** `{ ok: true, source: 'rule', constraints: [{ …constraint, matrix }], unrecognized }`
- **400:** `EMPTY_TEXT` hoặc body không phải JSON. **413:** `TEXT_TOO_LONG` (> 20.000 ký tự).

**`POST /api/ai/format-bdd`** — thêm vào `aiFastWinsRoutes.js` theo mẫu `req-clarity`, có `signal: abortSignalFor(request, response)`.

- Body: `{ requirementText, title? }`.
- **200:** `{ ok: true, acIds, scenarios, proposals, openQuestions, markdown, warnings, model, tier, usage, requestId }`
- **400:** `EMPTY_TEXT`. **413:** `TEXT_TOO_LONG` (> 8.000 ký tự).
- **502:** `{ ok: false, code, error, details? }`. `code` là mã lỗi của gateway, hoặc `BDD_INVALID` / `BDD_UNKNOWN_AC` / `BDD_MISSING_AC`. Không có trường `markdown`.
- **403:** cross-site (chặn sẵn ở `aiRoutes.js`).

### 4.5. UI — 2 tab mới trong modal phân tích REQ

- **Nút:** cạnh `#qa-req-btn-clarity`, thêm `#qa-req-btn-bva` ("Ma trận biên") và `#qa-req-btn-bdd` ("Chuẩn hoá BDD").
- **Tab:** `data-tab="bva"` (badge `#qa-req-tab-bva-count`) và `data-tab="bdd"` (badge `#qa-req-tab-bdd-status`).
- **Panel:** `#qa-req-panel-bva`, `#qa-req-panel-bdd`, đều có class `qa-req-panel` để `switchTab` có sẵn điều khiển.
- **Luồng:** giống `runClarityCheck`: ẩn phần input → loading → gọi API → hiện results section → vẽ panel → `switchTab`.
- **Panel BVA:**
  - Mỗi ràng buộc là một thẻ gồm: tên trường, `kind` và đơn vị, câu nguồn kèm số dòng.
  - Badge "Cần kiểm tra chiều biên" khi `needsReview`; badge "Biên ngầm định" khi có `implicitMin`.
  - Bảng phân vùng và bảng điểm biên (`Nhãn | Giá trị | Hợp lệ`).
  - Mục "Câu có số chưa nhận diện".
  - Nút `#qa-req-bva-copy` ("Sao chép JSON").
- **Panel BDD:**
  - Trạng thái qua `aiStatus`: đang chờ (có nút Huỷ) và lỗi (có nút Thử lại).
  - `<pre id="qa-req-bdd-markdown">` (hiển thị bằng `textContent`).
  - Cảnh báo mã AC gần đúng; danh sách câu hỏi mở.
  - `#qa-req-bdd-copy` ("Sao chép Markdown").
  - Banner `#qa-req-bdd-stale`: "Văn bản đã thay đổi — chạy lại".
  - Hướng dẫn "Dán vào tài liệu REQ qua Document Reader rồi Lưu".
- **Chống phản hồi muộn:**
  - BDD dùng `window.AiRequest.startAiRequest({ url: '/api/ai/format-bdd', owner: this })`.
  - BVA dùng `apiClient.post(…, { signal })` và `const seq = ++this.seq`.
  - Mỗi lần textarea đổi thì `textRev` tăng. Kết quả mang `textRev` lúc gửi; khi khác `textRev` hiện tại thì hiện banner stale (ASYNC-01).
- **Chưa sao chép (dirty):** đã có kết quả BDD mà chưa sao chép thành công. Khi đó ✕, "Đóng" hay Esc (sự kiện `cancel` của dialog) đều hỏi qua `confirmDialog(#qa-batch-confirm)`.
- **File JS** (thư mục `dashboard/public/js/views/qa/specStudio/`, mỗi file ≤ 150 dòng):
  - `specStudioPanels.js`: `mountSpecPanels(root, hooks)` trả `{ destroy, confirmClose }`. Gắn nút, theo dõi `textRev`, quản lý dirty. Có `const SPEC_TABS`.
  - `bvaPanel.js`: gọi API và vẽ panel BVA.
  - `bddPanel.js`: gọi AI và vẽ panel BDD.
- **Sửa `reqAnalyzerHelper.js`** (≤ 15 dòng): `import`; trong `init` gọi `this.specPanels = mountSpecPanels(root, { switchTab, showResults, showInput })`; trong `destroy` gọi `this.specPanels?.destroy()`; `closeModal` chờ `await this.specPanels?.confirmClose()`; chặn `cancel` của dialog.
- **Style** trong `styles/views/qa.css`, chỉ dùng token có sẵn. Hàng 8 tab cuộn ngang bên trong modal ở 390px.

---

## 5. Danh Mục File

| Loại | File | Ngân sách dòng |
| --- | --- | --- |
| Mới | `dashboard/services/qaBoundaryExtract.js`, `qaBoundaryMatrix.js` (+ `.test.js` colocated) | ≤ 200 mỗi file |
| Mới | `core/ai/tasks/bddCriteriaRules.js`, `formatBddCriteria.js` (+ `bddCriteriaRules.test.js`, `formatBddCriteria.test.js`) | ≤ 150 mỗi file |
| Mới | `dashboard/routes/qaSpecRoutes.js` | ≤ 100 |
| Mới | `tests/dashboard-api/qa-spec-studio.test.js` | — |
| Mới | `dashboard/public/js/views/qa/specStudio/{specStudioPanels,bvaPanel,bddPanel}.js` | ≤ 150 mỗi file |
| Mới | `tests/dashboard/qa-spec-studio.spec.js`, `qa-spec-studio-layout.spec.js` | — |
| Sửa | `core/ai/tasks/index.js` (export) | +4 |
| Sửa | `dashboard/routes/aiFastWinsRoutes.js` (`/api/ai/format-bdd`) | +≤ 25 |
| Sửa | `dashboard/server.js` (require + gọi `handleQaSpecRoutes`) | +2 |
| Sửa | `dashboard/public/templates/qa.html` (2 nút, 2 tab, 2 panel) | — |
| Sửa | `dashboard/public/js/views/qa/reqAnalyzerHelper.js` | +≤ 15 |
| Sửa | `dashboard/public/styles/views/qa.css` | — |

---

## 6. Chiến Lược Kiểm Thử — AC → TC

Mỗi TC ứng với đúng 1 test. Level: gọi hàm = `unit`, HTTP = `integration`, Playwright = `e2e`. ★ = critical.

### P19B-AC-01 — Trích ràng buộc đúng, không đoán

| TC | Nội dung | Level |
| --- | --- | --- |
| TC-01 ★ | Corpus dương tính Phụ lục A (33 câu): đúng `field`, `kind`, `unit`, `min`, `max`, `needsReview`; biên mở được đổi sang biên đóng | unit |
| TC-02 ★ | Corpus âm tính Phụ lục B (10 câu): 0 ràng buộc; 8 câu có chữ số nằm trong `unrecognized` với đúng số dòng; 2 câu không có số thì không có trong đó | unit |
| TC-03 | Đoạn nhiều dòng: số dòng nguồn đúng; `1.000` → 1000; đầu vào NFC và NFD cho cùng kết quả; `≥ ≤ – —` được chuẩn hoá | unit |

### P19B-AC-02 — Ma trận phân vùng và điểm biên

| TC | Nội dung | Level |
| --- | --- | --- |
| TC-04 ★ | `[18,60]` → 17, 18, 19, 39, 59, 60, 61 với cờ hợp lệ đúng; `[1,2]` khử trùng; `[5,5]` → 4, 5, 6 | unit |
| TC-05 | Một phía: max 50 ký tự → 0 (implicit), 49, 50, 51; min 8 → 7, 8, 9; `length` không có giá trị âm; `number` min 0 vẫn giữ −1; phân vùng đúng | unit |
| TC-06 | `invalidTypes` theo `kind`; `sample` đúng độ dài; không có `sample` khi > 1024 | unit |

### P19B-AC-03 — BVA qua API, 0 token

| TC | Nội dung | Level |
| --- | --- | --- |
| TC-07 ★ | `POST /api/qa/boundary-matrix` văn bản mẫu → 200, `source: 'rule'`, ràng buộc kèm `matrix`; `GET /api/ai/audit` không tăng; FakeAiProvider không nhận request nào | integration |
| TC-08 | 400 khi rỗng hoặc body không phải JSON; 413 khi > 20.000 ký tự | integration |

### P19B-AC-04 — BDD qua gateway, không có kết quả giả

| TC | Nội dung | Level |
| --- | --- | --- |
| TC-09 | `buildBddPrompts` có danh sách mã AC, luật giữ mã và schema | unit |
| TC-10 ★ | `/api/ai/format-bdd` với FakeAiProvider trả JSON hợp lệ → 200, có `markdown`, `model`, `usage` | integration |
| TC-11 ★ | Provider trả thiếu AC-002 → 502 `BDD_MISSING_AC`, không có `markdown` | integration |
| TC-12 | Provider trả 500, timeout, hoặc JSON hỏng → 502 kèm `code` của gateway; không có `markdown`, không có `source: 'rule'` | integration |
| TC-13 | Client huỷ request → provider ghi nhận abort (`abortedRequests`) | integration |
| TC-14 | Header `Origin` khác → 403 | integration |

### P19B-AC-05 — Giữ nguyên mã AC

| TC | Nội dung | Level |
| --- | --- | --- |
| TC-15 ★ | `validateScenarios`: dữ liệu hợp lệ; thiếu `when`/`then`; `acId` lạ → `BDD_UNKNOWN_AC`; thiếu hoặc lặp → `BDD_MISSING_AC`; bước > 300 ký tự; > 30 scenario; bỏ từ khoá đầu bước; `title` trống thì lấy từ đầu vào | unit |
| TC-16 | `extractAcBlocks`: nhận `### AC-001 - t`, `### AC-002: t`, `AC-003: t` ở đầu dòng, `**AC-004**`; `AC-8`, `AC_012` vào `warnings`, không được nhận | unit |

### P19B-AC-06 — Markdown tương thích scanner

| TC | Nội dung | Level |
| --- | --- | --- |
| TC-17 | `renderBddMarkdown` khớp chuỗi mong đợi viết tay (2 AC + 1 đề xuất) | unit |
| TC-18 ★ | LIFE-01 (API): `format-bdd` (fake provider) → ghép markdown vào REQ fixture qua `PUT /api/qa/document` → `GET /api/qa/summary` thấy đủ AC đầu vào; không có near-miss mới; không có AC nào từ phần đề xuất | integration |

### P19B-AC-07 — Giao diện

| TC | Nội dung | Level |
| --- | --- | --- |
| TC-19 | UI-02 / LIFE-01: mở modal, nạp mẫu, bấm "Ma trận biên" → tab `bva` được chọn, có thẻ ràng buộc; bấm "Chuẩn hoá BDD" (stub) → tab `bdd`, hiện markdown | e2e |
| TC-20 | UI-01: danh sách tab viết tay `[tc, impact, logic, qa, clarity, spec, bva, bdd]` khớp DOM | e2e |
| TC-21 | UI-04: chuyển tab nhanh bva → bdd → bva → chỉ panel `bva` hiện | e2e |
| TC-22 | ASYNC-01: sửa textarea khi BDD đang chờ → kết quả về kèm banner stale; phần đã sửa trong textarea giữ nguyên | e2e |
| TC-23 | ASYNC-02: đóng modal khi BDD đang chờ → request bị huỷ; mở lại không thấy kết quả cũ | e2e |
| TC-24 | ASYNC-03: chạy 2 lần, lần 1 trễ → chỉ hiện kết quả lần 2 | e2e |
| TC-25 ★ | ASYNC-04: stub 502 → báo lỗi + Thử lại; thử lại với stub 200 → có kết quả; textarea giữ nguyên | e2e |
| TC-26 | ASYNC-05: "Đã sao chép" chỉ hiện sau khi clipboard resolve; clipboard từ chối → báo lỗi, vẫn dirty | e2e |
| TC-27 ★ | UI-05: đóng khi có BDD chưa sao chép → hộp xác nhận; "Ở lại" / "Bỏ và đóng"; sau khi sao chép thì đóng không hỏi | e2e |
| TC-28 ★ | OWN-01..04: 20 vòng chuyển `#/qa` ↔ view khác, mở modal, bấm BVA 1 lần → đúng 1 request. Qua `import()` module: mount ×2, destroy ×2, disposer cũ an toàn | e2e |
| TC-29 | OWN-05: rời view khi BDD đang chờ → không sửa DOM, 0 lỗi console | e2e |
| TC-30 ★ | An toàn hiển thị: requirement có `<img src=x onerror=alert(1)>` và `<script>` → BVA/BDD hiện nguyên văn; không có sự kiện `dialog`, không có `img[onerror]` | e2e |
| TC-31…38 | UI-03: 4 viewport × Light/Dark. Hàng tab cuộn ngang trong modal ở 390px; bảng ma trận cuộn bên trong; không tràn trang; có focus-visible; 0 lỗi console; không có `undefined`/`null` | e2e |

**Cộng:** 7 AC, 38 TC (10 unit, 8 integration, 20 e2e), 12 critical.

---

## 7. Ánh Xạ Gate Scenarios (đủ 16 — cả 4 nhóm `applies: true`)

| Gate | TC |
| --- | --- |
| ASYNC-01 | TC-22 |
| ASYNC-02 | TC-23 (API: TC-13) |
| ASYNC-03 | TC-24 |
| ASYNC-04 | TC-25 |
| ASYNC-05 | TC-26 |
| OWN-01..04 | TC-28 |
| OWN-05 | TC-29 |
| UI-01 | TC-20 |
| UI-02 | TC-19 |
| UI-03 | TC-31…38 |
| UI-04 | TC-21 |
| UI-05 | TC-27 |
| LIFE-01 | TC-18, TC-19 |

**Design anchors:**

| Anchor | Vị trí |
| --- | --- |
| `capture_identity` | `const seq = ++this.seq;` (`bvaPanel.js`) |
| `completion_guard` | `if (!this.alive \|\| seq !== this.seq) return;` |
| `disposer_guard` | `if (this.disposed) return;` |
| `registry` | `const SPEC_TABS` (`specStudioPanels.js`) |
| `inventory` | Mục 4.5 của file này (`origin: approved_spec`) |

---

## 8. Kế Hoạch Triển Khai (~4.5 ngày công)

### Phase 0 — Chuẩn bị (0.5 ngày)

- [ ] 0.1 Chốt D1–D7. **BA duyệt corpus Phụ lục A và B**: đây là tiêu chí nghiệm thu nghiệp vụ của ma trận biên.
- [ ] 0.2 Baseline:
  - `node --test dashboard/services/*.test.js core/ai/*.test.js`
  - `npm run test:dashboard:api`
  - `npx playwright test -c playwright.dashboard.config.js`
  - `npm run check:framework`
  - `npm run check:dashboard-features`
  - Ghi thêm số phần tử DOM ban đầu (TC-13 perf).
- [ ] 0.3 Soạn `.delivery/phases/plan-19b.json` (7 AC, 38 TC, 16 scenario; chạy `gates/contract.py`) và `plan-19b-evidence-map.json`. **BA duyệt hash.**
- **Exit:** D1–D7 đã chốt; corpus đã duyệt; baseline đã ghi; contract đã nộp duyệt.

### Phase 1 — Ma trận biên, 0 token (1 ngày)

- [ ] 1.1 Viết `qaBoundaryExtract.js` và `qaBoundaryMatrix.js` kèm test (TC-01…TC-06).
- [ ] 1.2 Viết `qaSpecRoutes.js` và đăng ký trong `server.js`; test API TC-07, TC-08.
- **Exit:**
  - `node --test dashboard/services/qaBoundary*.test.js` pass (corpus 43/43).
  - `npm run test:dashboard:api` pass.
  - `npm run check:dashboard-features` pass.

### Phase 2 — BDD qua gateway (1 ngày)

- [ ] 2.1 Viết `bddCriteriaRules.js` và `formatBddCriteria.js`, export qua `tasks/index.js`; unit test TC-09, TC-15, TC-16, TC-17.
- [ ] 2.2 Thêm `/api/ai/format-bdd` vào `aiFastWinsRoutes.js`; test API TC-10…TC-14 và TC-18 bằng FakeAiProvider.
- **Exit:**
  - `node --test core/ai/tasks/*.test.js` pass.
  - `npm run test:dashboard:api` pass.
  - Không có đường nào trả `markdown` khi `ok: false`.

### Phase 3 — Giao diện (1.5 ngày)

- [ ] 3.1 Markup trong `qa.html` và style trong `qa.css`.
- [ ] 3.2 Viết `specStudio/*.js`; gắn vào `reqAnalyzerHelper.js` (≤ 15 dòng).
- [ ] 3.3 Viết E2E `qa-spec-studio.spec.js` (TC-19…TC-30) và `qa-spec-studio-layout.spec.js` (TC-31…TC-38). AI được stub bằng `page.route`.
- **Exit:**
  - Dashboard E2E không có test nào chuyển từ pass sang fail so với baseline; các spec `qa-*.spec.js` hiện có vẫn pass.
  - Soát ảnh 4 viewport × 2 theme; 0 lỗi console.
  - Ghi số DOM tăng thêm.
  - Modularity không có vi phạm mới.

### Phase 4 — Gate 4 & bàn giao (0.5 ngày)

- [ ] 4.1 Commit code. Trên HEAD sạch, chạy toàn bộ lệnh ở 0.2.
- [ ] 4.2 Ghi receipt `plan19b-node` và `plan19b-e2e` bằng `record-gate-run.py`, rồi build evidence bằng `build-phase-evidence.py`. `verify-gate.py --gate 3|4` chạy cục bộ.
- [ ] 4.3 Phần chờ người khác:
  - BA duyệt hash;
  - reviewer độc lập PASS gate 3/4 và chạy lại 12 TC ★ trên cùng SHA;
  - chạy `master.ps1 gate`.
- [ ] 4.4 Chỉ ghi bài học mới đã xác nhận (`AI_LESSONS.md` / `candidates.md`).

---

## 9. Định Nghĩa Hoàn Thành

- [ ] 38/38 TC PASS trong JUnit; 16/16 gate scenario có bằng chứng.
- [ ] Corpus A 33/33 đúng, corpus B 10/10 không có ràng buộc giả.
- [ ] BVA tốn 0 token (TC-07). BDD không trả kết quả giả (TC-11, TC-12). Mã AC được giữ nguyên (TC-15, TC-18).
- [ ] 19b không ghi file nào; hiển thị an toàn (TC-30).
- [ ] 4 viewport × 2 theme đã soát; 0 lỗi console; không có vi phạm modularity mới.
- [ ] BA duyệt hash; `master.ps1 gate` PASS; có review độc lập và rerun critical.

---

## 10. Rủi Ro Còn Lại

- Câu mô tả điều kiện lỗi (vd. "trên 30 giây sẽ báo lỗi") có thể làm đảo chiều biên. Giảm nhẹ bằng `needsReview` và hiển thị câu nguồn; BA vẫn phải đọc lại.
- Tên trường là heuristic, chỉ dùng để hiển thị.
- Luật chỉ bảo đảm **cấu trúc** BDD và mã AC, không bảo đảm **ngữ nghĩa**. BA review trước khi dán.
- Hai bộ BVA cùng tồn tại cho tới khi hợp nhất (D6). Tab "Test case" vẫn dùng regex cũ, chỉ bắt khoảng đầu tiên.
- Luồng "Soát độ rõ" (BA-1) hiện chưa có seq guard. Ngoài phạm vi; tab mới không dùng lại luồng đó.
- Thêm 2 tab và 2 panel làm DOM ban đầu tăng (`templates-performance-a11y` TC-13 vốn đã fail từ trước).

---

## Phụ Lục A — Corpus dương tính (kỳ vọng của TC-01; BA duyệt ở Phase 0)

Cột "Kind": `length` không ghi đơn vị thì `unit` lấy nguyên văn từ câu (`ký tự` hoặc `characters`). `number` không ghi đơn vị thì `unit` là `null`. Mọi câu không ghi chú đều có `needsReview: false`.

| # | Câu | Trường | Kind (đơn vị) | min | max | Ghi chú |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `Độ tuổi tham gia từ 18 đến 60 tuổi.` | Độ tuổi tham gia | number (tuổi) | 18 | 60 | |
| 2 | `Mật khẩu dài từ 8 đến 32 ký tự.` | Mật khẩu | length | 8 | 32 | bỏ "dài" |
| 3 | `Mật khẩu có độ dài từ 8 đến 32 ký tự.` | Mật khẩu | length | 8 | 32 | bỏ "có độ dài" |
| 4 | `Tên đăng nhập từ 6 tới 20 ký tự.` | Tên đăng nhập | length | 6 | 20 | "tới" |
| 5 | `Mã giảm giá dài 6-12 ký tự.` | Mã giảm giá | length | 6 | 12 | dạng A-B |
| 6 | `Điểm thi từ 0 đến 10.` | Điểm thi | number | 0 | 10 | |
| 7 | `Password must be between 8 and 64 characters.` | Password | length | 8 | 64 | |
| 8 | `Họ tên tối đa 50 ký tự.` | Họ tên | length | – | 50 | |
| 9 | `Mô tả không vượt quá 1.000 ký tự.` | Mô tả | length | – | 1000 | dấu nghìn |
| 10 | `Số lượng ảnh tải lên không quá 10 ảnh.` | Số lượng ảnh tải lên | number (ảnh) | – | 10 | |
| 11 | `Khu vực đào tạo cho phép chọn tối đa 10 mục.` | Khu vực đào tạo | number (mục) | – | 10 | bỏ "cho phép chọn" |
| 12 | `Số lần nhập sai OTP tối đa 5 lần.` | Số lần nhập sai OTP | number (lần) | – | 5 | |
| 13 | `Ghi chú không được dài hơn 255 ký tự.` | Ghi chú | length | – | 255 | |
| 14 | `Số file đính kèm không nhiều hơn 5 file.` | Số file đính kèm | number (file) | – | 5 | |
| 15 | `Tiêu đề: tối đa 120 ký tự.` | Tiêu đề | length | – | 120 | bỏ ":" |
| 16 | `Số lượng khách tối đa: 20.` | Số lượng khách | number | – | 20 | ":" sau từ khoá |
| 17 | `Bio must be at most 160 characters.` | Bio | length | – | 160 | |
| 18 | `Mật khẩu tối thiểu 8 ký tự.` | Mật khẩu | length | 8 | – | |
| 19 | `Số người tham gia ít nhất 2 người.` | Số người tham gia | number (người) | 2 | – | |
| 20 | `Username must be at least 3 characters.` | Username | length | 3 | – | |
| 21 | `Tuổi từ 18 tuổi trở lên.` | Tuổi | number (tuổi) | 18 | – | |
| 22 | `Trẻ em từ 12 tuổi trở xuống được miễn phí.` | Trẻ em | number (tuổi) | – | 12 | |
| 23 | `Tuổi phải lớn hơn 18.` | Tuổi | number | 19 | – | biên mở |
| 24 | `Số lượng đặt hàng phải nhỏ hơn 100.` | Số lượng đặt hàng | number | – | 99 | biên mở |
| 25 | `Quantity must be greater than 0.` | Quantity | number | 1 | – | biên mở |
| 26 | `Age must be less than 100.` | Age | number | – | 99 | biên mở |
| 27 | `Số điện thoại gồm đúng 10 chữ số.` | Số điện thoại | length (chữ số) | 10 | 10 | đúng N |
| 28 | `- Mã OTP gồm 6 chữ số.` | Mã OTP | length (chữ số) | 6 | 6 | bỏ gạch đầu dòng |
| 29 | `Mật khẩu tối thiểu 8 ký tự và tối đa 32 ký tự.` | Mật khẩu | length | 8 | 32 | gộp |
| 30 | `Số tiền nạp tối thiểu 10000 và tối đa 5000000.` | Số tiền nạp | number | 10000 | 5000000 | gộp |
| 31 | `Số lượng sản phẩm trong giỏ >= 1 và <= 99.` | Số lượng sản phẩm trong giỏ | number | 1 | 99 | gộp, ký hiệu |
| 32 | `Tuổi từ 18 đến 60, mật khẩu từ 8 đến 32 ký tự.` | Tuổi / Mật khẩu | number / length | 18 / 8 | 60 / 32 | 2 ràng buộc |
| 33 | `Thời gian chờ trên 30 giây sẽ báo lỗi.` | Thời gian chờ | number (giây) | 31 | – | `needsReview: true` |

## Phụ Lục B — Corpus âm tính (kỳ vọng của TC-02)

| # | Câu | Kỳ vọng |
| --- | --- | --- |
| 1 | `Báo cáo xuất vào ngày 15 hằng tháng.` | `unrecognized` (số sau "ngày") |
| 2 | `Áp dụng từ tháng 1 đến tháng 3.` | `unrecognized` (số sau "tháng") |
| 3 | `Ngày hiệu lực từ 01/01/2026 đến 31/12/2026.` | `unrecognized` (ngày) |
| 4 | `Giờ làm việc từ 8:00 đến 17:30.` | `unrecognized` (giờ) |
| 5 | `Cân nặng từ 0,5 đến 2,5 kg.` | `unrecognized` (thập phân) |
| 6 | `Giá từ 1 triệu đến 5 triệu.` | `unrecognized` (tiền) |
| 7 | `Chọn đến mục thứ 11 sẽ bị hệ thống chặn.` | `unrecognized` (không khớp mẫu) |
| 8 | `API v2 trả về mã 200 khi thành công.` | `unrecognized` (phiên bản + không khớp mẫu) |
| 9 | `Hệ thống phản hồi nhanh.` | không ràng buộc, không vào `unrecognized` (không có số) |
| 10 | `Hỗ trợ tối đa người dùng đồng thời.` | không ràng buộc, không vào `unrecognized` (không có số) |
