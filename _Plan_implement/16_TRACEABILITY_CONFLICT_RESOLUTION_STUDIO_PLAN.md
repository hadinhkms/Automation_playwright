# Kế Hoạch Hiện Thực Hóa: Traceability Conflict Resolution Studio (Hòa Giải Xung Đột Truy Vết "Tài Liệu và Spec Nói Khác Nhau")

> **Mã kế hoạch:** `PLAN-16`  
> **Trạng thái:** `IMPLEMENTED — đã qua test tự động + E2E UI; CHỜ Gate 4 chính thức (contract PLAN-16 được BA duyệt hash + review độc lập)`  
> **Phân hệ mục tiêu:** Dashboard Core (`d:\_Automation-Project\dashboard`) — View **QA Docs & Automation** (`#/qa`)  
> **Tài liệu tham chiếu:** [AGENTS.md](file:///d:/_Automation-Project/AGENTS.md), [03_ACCEPTANCE_GATES.md](file:///D:/_Master_Process/03_ACCEPTANCE_GATES.md), [00_CORE_PROCESS_GUIDE.md](file:///D:/_Master_Process/00_CORE_PROCESS_GUIDE.md)

---

## 1. Bối Cảnh & Mục Tiêu Cốt Lõi

### 1.1. Hiện Trạng & Vấn Đề (Problem Statement)
- Tại mục **Vấn Đề (Findings)** trong phân hệ **QA Docs & Automation** (`#/qa`), nhóm lỗi **"Tài liệu và spec nói khác nhau"** (`ac-lech-giua-tai-lieu-va-spec` Traceability Drift) hiện đang có **21 phát hiện**.
- Trước đây, hệ thống chỉ hiển thị 21 dòng này dưới dạng danh sách bullet point text thuần thô sơ (`ul > li` text đơn giản).
- Người dùng (kỹ sư QA, BA, PO, Developer) gặp các khó khăn lớn:
  1. **Quá tải nhận thức (Cognitive Overload)**: Không biết xung đột thuộc về file spec nào, nằm ở trang màn hình nào.
  2. **Không có công cụ hành động**: Để sửa, người dùng phải mở thủ công file Playwright spec và file Markdown `test-cases/*.md` để gõ tay, rất dễ sinh thêm lỗi gõ nhầm.
  3. **Thiếu căn cứ phân giải**: Khi mã test spec ghi `AC-002` nhưng tài liệu ghi `AC-003`, không ai dám khẳng định bên nào đúng nếu không đọc kỹ assertion trong test script và tiêu chí Given-When-Then trong tài liệu.

### 1.2. Mục Tiêu Cốt Lõi Của PLAN-16
Chuyển đổi triệt để danh sách 21 bullet points thô sơ thành **Traceability Conflict Resolution Studio** trực quan, thông minh và an toàn, giải quyết trọn vẹn theo góc nhìn 3 vai trò:
1. **Business Analyst (BA)**: Tự động bóc tách và liên kết ngược (`reverse-link`) từ `TC-xxx` trong spec về đúng file `test-cases/*.md` và đúng dòng trong bảng Traceability matrix.
2. **Product Owner (PO)**: Bảo vệ nguyên tắc Single Source of Truth (SSOT), cung cấp 4 cơ chế hòa giải (Sync Doc theo Spec, Sync Spec theo Doc, Trọng tài AI phân giải, và Escalate vào `decisions.json`).
3. **Senior UI/UX Designer**: Thiết kế giao diện SaaS cao cấp (chuẩn Linear/Vercel), gom nhóm theo từng file spec, card so sánh đối xứng 2 cột (Side-by-Side Comparison), nút bấm hành động nhanh trực quan, tuyệt đối không dùng `innerHTML` trên dữ liệu từ repo.

---

## 2. Giải Pháp Đa Vai Trò (PO - BA - UI/UX Designer Solutions)

| Vai Trò | Trọng Tâm Quan Tâm | Giải Pháp Kỹ Thuật Đề Xuất & Quyền Lực |
|---|---|---|
| **BA (Business Analyst)** | • **Nguyên nhân gốc rễ**: Lệch Traceability Drift xảy ra khi Dev code bổ sung/sửa mã `@AC-xxx` trong file spec mà không cập nhật lại bảng Traceability trong file doc `test-cases/*.md` (hoặc ngược lại).<br>• **Nhu cầu**: Cần biết chính xác file doc nào, dòng nào trong bảng matrix chứa test case đó, và mô tả Given-When-Then của cả 2 AC để so sánh ngữ cảnh. | • **Traceability Linker**: Tự động dò ngược file `test-cases/*.md` và test block trong Playwright spec.<br>• **Context Extraction**: Trích xuất chi tiết nội dung của cả `@AC-spec` và `AC-doc` để hiển thị đối chiếu trực tiếp. |
| **PO (Product Owner)** | • **Nguyên nhân gốc rễ**: Cần bảo vệ **Single Source of Truth (SSOT)**. Đôi khi Spec code đã được kiểm thử trên thực tế chạy đúng (Spec là SSOT), nhưng đôi khi Doc tài liệu mới là yêu cầu nghiệp vụ chuẩn mà code làm lệch (Doc là SSOT).<br>• **Nhu cầu**: Không thể ép buộc 1 chiều. Cần có 4 phương án hành động rõ ràng kèm trọng tài thông minh. | • **1-Click Sync Doc to Spec**: Cập nhật file markdown theo code kiểm thử thực tế.<br>• **1-Click Sync Spec to Doc**: Sửa lại tag/tiêu đề test spec theo tài liệu đặc tả.<br>• **AI Arbitrator (Trọng tài AI)**: Đọc code assertion `expect()` và so với Given-When-Then để tư vấn bên nào đúng.<br>• **Escalate to Decision (`decisions.json`)**: Đẩy vào sổ quyết định để PO/Team họp duyệt nếu xung đột phức tạp. |
| **Senior UI/UX Designer** | • **Hiện trạng**: Danh sách 21 bullet point text dài dòng, khó đọc, không thể tương tác, dễ gây quá tải nhận thức (Cognitive Overload).<br>• **Nhu cầu**: SaaS studio hiện đại chuẩn Linear/Vercel, phân cấp thị giác rõ ràng, thao tác trong 1 cú click. | • **Grouped Accordion by Spec**: Gom nhóm 21 xung đột theo từng file spec (ví dụ `company-rental-flow.spec.js` gom 6 lỗi), có badge đếm số lượng.<br>• **Side-by-Side Comparison Card**: Layout 2 cột đối xứng (Spec vs Doc) với màu sắc nhận diện đặc trưng (Blue cho Spec, Amber cho Doc), ở giữa là icon xung đột `⇄`.<br>• **Action Toolbar**: Nút hành động trực quan, trạng thái loading/disabled khi đang xử lý, tự động cập nhật danh sách sau khi đồng bộ thành công. |

---

## 3. Vạch Lá Tìm Sâu: Đánh Giá 6 Lỗ Hổng Tiềm Ẩn (Gap Audit) & Giải Pháp Khắc Phục

Đóng vai trò **Senior QA Lead & System Architect**, kế hoạch tiến hành rà soát kỹ lưỡng các kịch bản biên (Edge Cases), điều kiện tải và phát hiện **6 lỗ hổng kỹ thuật tiềm ẩn**:

| STT | Lỗ Hổng / Điểm Lủng Tiềm Ẩn | Mức Độ | Hậu Quả Nếu Không Xử Lý | Giải Pháp Kỹ Thuật Đã Hiện Thực Hóa |
|:---:|---|:---:|---|---|
| **01** | **Mù Thư Mục Con Khi Tìm File Doc (`findDocFileForTc`)** | **P0** | Nếu repo tổ chức tài liệu chia theo module (`test-cases/desktop/rental.md`), `fs.readdirSync` ở cấp gốc sẽ trả về `null` $\to$ Gây lỗi 404 không tìm thấy file. | Xây dựng thuật toán quét đệ quy (Recursive Directory Walker) duyệt toàn bộ cây thư mục và tôn trọng `qa.config.json`. |
| **02** | **Lệch Vị Trí Cột Trong Bảng Markdown (`sync_doc_to_spec`)** | **P0** | Hardcode vị trí cột `parts[tcIdx - 1]` sẽ ghi đè nhầm cột khác nếu bảng Markdown có thứ tự cột khác, hoặc ném 409 nếu khai báo dạng bullet list. | Ưu tiên thay thế chính xác regex `\b${docAc}\b` trên dòng chứa `tcId`, sau đó mới fallback sang cấu trúc bảng `parts[tcIdx - 1]`. |
| **03** | **Biến Dạng Định Dạng Ký Tự Xuống Dòng (Line-Ending Churn: CRLF vs LF)** | **P1** | Đọc bằng `split(/\r?\n/)` rồi nối lại bằng `join('\n')` sẽ biến 100% dòng trong file thành LF trên Windows, khiến Git diff báo đỏ/xanh toàn bộ file. | Tự động nhận diện EOL gốc (`content.includes('\r\n') ? '\r\n' : '\n'`) và ghi lại đúng định dạng EOL đó. |
| **04** | **Race Condition & Double-Click Khi Mạng Chậm (`ASYNC-01`)** | **P1** | Người dùng click đúp nút "Cập nhật" hoặc "Ghi sổ quyết định" sinh lỗi 409 hoặc duplicate hàng loạt quyết định `D-01`, `D-02` trong `decisions.json`. | Frontend vô hiệu hóa nút (`btn.disabled = true`) khi đang request. Backend kiểm tra nếu đã có quyết định pending cho `tcId` thì tái sử dụng, không tạo trùng. |
| **05** | **Rò Rỉ Bộ Nhớ Disposers Khi Số Xung Đột Giảm Về 0 (`OWN-01..05`)** | **P1** | Khi người dùng sửa hết các lỗi xung đột hoặc chuyển tab, hàm `render()` không được gọi $\to$ các listener cũ tồn tại trong bộ nhớ. | Luôn dọn sạch disposers qua `destroy()` ngay đầu hàm `render()`, và gắn hook unmount vào `QaSlice`. |
| **06** | **Regex Bóc Tách `parseConflictDetail` Quá Cứng Nhắc** | **P2** | Regex cũ `(TC-\d+)` sẽ thất bại nếu TC có hậu tố chữ cái hoặc phân vùng: `TC-AUTH-001`, `TC_011`, `TC-011a`. | Nới lỏng regex nhận diện `([A-Za-z0-9_.-]+)` an toàn, bao phủ mọi chuẩn đặt tên của dự án. |

---

### 3.1. Rà Soát Lại Sau Hiện Thực Hóa (2026-09-24) — 8 Lỗ Hổng Bổ Sung Đã Sửa

Lần kiểm tra lại cho thấy bản đầu tiên chưa đạt dù test xanh. Các lỗ hổng dưới đây đã được sửa và có test chặn hồi quy:

| STT | Lỗ Hổng | Mức Độ | Hậu Quả | Cách Sửa |
|:---:|---|:---:|---|---|
| **07** | UI tự bóc `detail` bằng regex cứng `(TC-\d+)`; không khớp thì gán `specAc='Spec'`, `docAc='Doc'` | **P0** | Bấm sync ghi chữ `Spec` vào file tài liệu | Server bóc sẵn `finding.conflict` (một regex duy nhất); thẻ không bóc được chỉ hiện text, không có nút ghi |
| **08** | Chỉ dùng AC **đầu tiên** của mỗi phía | **P0** | TC nhiều AC: sync báo thành công nhưng xung đột vẫn còn | Đồng bộ cả **tập** AC; giữ kiểu viết (`@AC-001 @AC-002` / `AC-001, AC-002`) |
| **09** | Tin AC do client gửi (`targetAc`, `specAc`, `docAc`) | **P0** | Payload cũ/giả ghi AC tùy ý vào repo | Client chỉ gửi `tcId + specFile + resolutionType`; server tính lại từ file bằng chính analyzer |
| **10** | Không kiểm chứng sau khi ghi | **P1** | Repo bị sửa dở | Ghi xong chạy lại analyzer; còn lệch → hoàn tác toàn bộ, trả 409 kèm dòng cần sửa tay |
| **11** | Đọc `qa.config.json` với khóa sai `testCases` và ghi cứng `decisions.json` | **P1** | Cấu hình thư mục/sổ quyết định bị bỏ qua | Dùng `qaService.readQaConfig()` (`dirs.testCases`, `dirs.specs`, `decisionsFile`) |
| **12** | Sổ quyết định hỏng JSON bị ghi đè bằng sổ rỗng; kiểm trùng bằng `includes` (`TC-01` ⊂ `TC-011`) | **P1** | Mất toàn bộ quyết định cũ; quyết định bị nhận nhầm là trùng | Sổ hỏng → 409, không ghi; kiểm trùng qua `source {kind,tcId,specFile}` và so theo ranh giới từ |
| **13** | Dòng tài liệu khai chung nhiều TC (`TC-031, TC-032`) bị sửa luôn | **P1** | Đổi AC của TC khác | Bỏ qua dòng mơ hồ, báo rõ lý do trên thẻ |
| **14** | Listener nút "Áp dụng đề xuất AI" không vào `disposers`; studio không được xả khi số xung đột về 0; badge dùng class không tồn tại | **P2** | Rò listener; badge không có style | Mọi listener qua `_on()`; `renderFindings()` luôn `destroy()` studio trước khi vẽ; chip dùng token thật |


---

## 4. Rào Chắn An Toàn & Đảm Bảo Kiến Trúc (Safety & Architectural Guardrails)

1. **Cơ chế An toàn Dữ liệu (Safe Mutations & Automatic Backups)**:
   - Mọi thao tác ghi đè lên file Spec (`tests/**/*.spec.js`) hoặc file Markdown (`test-cases/*.md`) hoặc `decisions.json` đều **bắt buộc tự động tạo bản sao lưu** tại thư mục `.dashboard-backups/` qua `resourceService.createBackup` trước khi chỉnh sửa.
   - Hỗ trợ khôi phục tức thì khi cần.
2. **Nguyên tắc Bảo mật UI (Zero innerHTML)**:
   - Toàn bộ component và card hiển thị xung đột đều được dựng bằng DOM API thuần (`document.createElement`, `textContent`) để triệt tiêu 100% rủi ro XSS khi render nội dung code từ repo hoặc output từ AI.
3. **Quản lý Vòng Đời Tránh Rò Rỉ Bộ Nhớ (`OWN-01..05`)**:
   - Khởi tạo controller độc lập `ConflictStudioHelper`, tích hợp vào `mount()` và `unmount()` của `QaSlice`.
   - Mỗi lần render hoặc unmount, toàn bộ event listeners của các nút bấm đều được xả sạch sẽ qua mảng `disposers`.
4. **Tuân thủ Chuẩn Kích Thước Module & Pre-commit Audit**:
   - Tuân thủ quy định của Master Process (`master.py audit . --staged`).
   - Các file phục vụ studio đều được khai báo chú thích miễn trừ hợp lệ:
     `// master-process-disable-size-check: Traceability Conflict Studio visual manager and reconciler`

---

## 5. Thiết Kế Kiến Trúc & Các Thành Phần Triển Khai

```
┌────────────────────────────────────────────────────────────────────────┐
│                   Traceability Conflict Studio                         │
├───────────────────────────────────┬────────────────────────────────────┤
│           Backend Layer           │           Frontend Layer           │
├───────────────────────────────────┼────────────────────────────────────┤
│ • qaConflictService.js            │ • conflictStudioHelper.js          │
│   - parseConflictDetail()         │   - bySpec grouping Accordion      │
│   - findDocFileForTc()            │   - Side-by-Side Comparison Cards  │
│   - resolveConflict()             │   - Inline Action Buttons          │
│   - arbitrateWithAi() (Dual Engine│   - AI Recommendation Modal Box    │
│   - escalateConflictToDecision()  │ • qaSlice.js                       │
│ • qaRoutes.js                     │   - Integration into renderFindings│
│   - POST /api/qa/conflict/resolve │ • qa.css                           │
│   - POST /api/qa/conflict/arbitrat│   - Modern theme, badges, buttons  │
│   - POST /api/qa/conflict/escalate│                                    │
└───────────────────────────────────┴────────────────────────────────────┘
```

### 5.1. Chi Tiết Backend API (hợp đồng hiện hành)
Client **không** gửi AC nào; server tự tính trạng thái từ file bằng `scripts/lib/qaTrace.js`.
- **`GET /api/qa/conflict/context?tcId&specFile`** → `{ specAcs, docAcs, specOnly, docOnly, inSync, blocks[{line,title,snippet,hasAssertion}], docFiles, docLocations[{file,line,text}], acDefinitions{AC:{file,line,text}}, docDetails }`
- **`POST /api/qa/conflict/resolve`** `{ resolutionType: 'sync_doc_to_spec' | 'sync_spec_to_doc', tcId, specFile }` → `{ ok, newAcs, targetFiles, changes[], skipped[], backups[], message }`; đã khớp → `{ ok, noop: true }`; không sửa được / còn lệch sau khi ghi → **409** (đã hoàn tác) kèm `skipped[]`.
- **`POST /api/qa/conflict/arbitrate`** `{ tcId, specFile }` → `{ recommendation, confidence (0-100), reason, engine: 'ai' | 'heuristic', engineNote }`; đầu ra AI được kiểm theo enum, lỗi/timeout 45s → luật suy luận tĩnh; đã khớp → 409.
- **`POST /api/qa/conflict/escalate`** `{ tcId, specFile, reason? }` → `{ ok, decisionId, decision, backup, isDuplicate? }`; ghi vào `decisionsFile` theo cấu hình, gắn `source`.
- `GET /api/qa/trace`: mỗi finding `ac-lech-giua-tai-lieu-va-spec` có thêm `conflict {specFile, tcId, specAcs, docAcs, specOnly, docOnly}`. `GET /api/qa/decisions` trả thêm `source`.

---

## 6. Danh Mục Thay Đổi Mã Nguồn (Detailed File Inventory)

| File | Loại | Trách Nhiệm |
|---|:---:|---|
| `dashboard/services/qaConflictService.js` | NEW | Tính trạng thái từ file, viết lại tập AC, kiểm chứng + hoàn tác, ngữ cảnh BA, trọng tài AI/heuristic, sổ quyết định |
| `dashboard/services/qaConflictService.test.js` | NEW | 17 unit test (nhiều AC, tag, CRLF/EOL trộn, hoàn tác, dòng mơ hồ, cấu hình thư mục, path traversal, sổ hỏng, trùng TC) |
| `dashboard/services/qaService.js` | MODIFY | Gắn `finding.conflict`; trả `source` của quyết định |
| `dashboard/routes/qaRoutes.js` | MODIFY | 4 endpoint conflict (thêm `GET /context`) |
| `dashboard/public/js/views/qa/conflictStudioHelper.js` | NEW | Accordion `<details>`, thẻ so sánh, ngữ cảnh, phán quyết, khóa toàn studio khi đang ghi, dọn listener |
| `dashboard/public/js/views/qa/qaSlice.js` | MODIFY | Khởi tạo/xả studio; luôn `destroy()` trước khi vẽ lại Findings |
| `dashboard/public/styles/views/qa.css` | MODIFY | Style studio, responsive 390px, disabled/busy |
| `dashboard/public/styles/tokens.css` | MODIFY | Thêm token chung `--success`, `--info` (dark + light) |
| `tests/dashboard-api/qa.test.js` | MODIFY | 7 API contract test cho conflict |
| `tests/dashboard/qa-conflict-studio.spec.js` | NEW | 16 E2E UI (LIFE-01, ASYNC-01, OWN, 4 viewport × 2 theme) |

---

## 7. Kế Hoạch Kiểm Thử & Kết Quả Nghiệm Thu (Verification Matrix)

### 7.1. Bằng Chứng Tự Động (chạy ngày 2026-09-24)
| Lệnh | Kết quả |
|---|---|
| `node --test dashboard/services/qaConflictService.test.js` | 17/17 PASS |
| `node --test dashboard/services/*.test.js` | 48/48 PASS |
| `npm run test:dashboard:api` | 62/62 PASS |
| `npx playwright test -c playwright.dashboard.config.js tests/dashboard/qa-conflict-studio.spec.js` | 16/16 PASS |
| `npx playwright test -c playwright.dashboard.config.js` (toàn bộ) | 60 PASS / 5 FAIL — cả 5 đều fail sẵn trên HEAD trước thay đổi (HEAD: 6 FAIL; xem 7.3) |
| `npm run check:framework`, `npm run check:dashboard-features` | PASS |
| `python D:/_Master_Process/master.py audit .` | Không vi phạm mới từ file PLAN-16 |

### 7.2. Ma Trận Scenario
| Scenario | Bằng chứng |
|---|---|
| ASYNC-01 double-click / chờ mạng chậm | E2E: toàn bộ nút hành động bị khóa, đúng 1 request; API: gọi lần 2 trả `noop` |
| ASYNC late response | Phản hồi tìm lại thẻ theo khóa + chữ ký AC; thẻ đã đổi thì bỏ qua |
| ASYNC save failure | E2E: 409 hiện lỗi trên thẻ, file giữ nguyên, nút mở lại |
| OWN-01..05 | E2E: 20 lượt reload giữ nguyên số disposer; hết xung đột → 0 disposer |
| UI (accordion, focus, 4 viewport × 2 theme) | E2E: không tràn ngang; ảnh chụp đã soát bằng mắt |
| LIFE-01 | E2E chạy qua UI → server → file thật → analyzer |

### 7.3. Rủi Ro Còn Lại / Chưa Làm
- **Gate 4 chính thức chưa chạy**: cần `.delivery/contract.json` cho PLAN-16 được BA duyệt hash và reviewer độc lập; không tự duyệt.
- 5 test UI fail sẵn từ trước, không thuộc PLAN-16: `qa-view-design-parity` (fallback `var(--success, #10b981)`, badge nền sáng, viền vàng, primitive hero) và `templates-performance-a11y` TC-13. Bổ sung token `--success` đã sửa được 1 test cũ.
- Nhánh gọi AI thật (Gemini/OpenAI/9Router) chưa chạy với key thật; đã test kiểm tra đầu ra và nhánh fallback.
- Dòng AC nằm rải rác trong câu hoặc khai chung nhiều TC vẫn phải sửa tay (có báo rõ trên thẻ).
