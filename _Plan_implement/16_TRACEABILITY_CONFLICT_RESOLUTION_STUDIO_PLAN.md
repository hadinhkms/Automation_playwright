# Kế Hoạch Hiện Thực Hóa: Traceability Conflict Resolution Studio (Hòa Giải Xung Đột Truy Vết "Tài Liệu và Spec Nói Khác Nhau")

> **Mã kế hoạch:** `PLAN-16`  
> **Trạng thái:** `COMPLETED (Đã Hiện Thực Hóa & Vượt Qua Toàn Bộ Quality Gates)`  
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

### 5.1. Chi Tiết Backend API
- **`POST /api/qa/conflict/resolve`**:
  - Request body: `{ resolutionType: 'sync_doc_to_spec' | 'sync_spec_to_doc', tcId, specFile, docFile, targetAc, specAc, docAc }`
  - Response: `{ ok: true, targetFile, tcId, newAc, backup, message }`
- **`POST /api/qa/conflict/arbitrate`**:
  - Request body: `{ specFile, tcId, docFile, specAc, docAc, clientConfig? }`
  - Response: `{ ok: true, recommendation: 'sync_doc_to_spec' | 'sync_spec_to_doc', recommendedAc, confidence, reason, engine }`
- **`POST /api/qa/conflict/escalate`**:
  - Request body: `{ tcId, specFile, specAcs, docFile, docAcs, reason }`
  - Response: `{ ok: true, decisionId: 'D-xx', decision, message }`

---

## 6. Danh Mục Thay Đổi Mã Nguồn (Detailed File Inventory)

| File | Loại | Mô Tả Trách Nhiệm Kỹ Thuật |
|---|:---:|---|
| [dashboard/services/qaConflictService.js](file:///d:/_Automation-Project/dashboard/services/qaConflictService.js) | **[NEW]** | Service xử lý phân tích xung đột regex, tìm file markdown theo TC, cập nhật spec/doc an toàn kèm backup, AI/Heuristic arbitrator, và tạo quyết định trong `decisions.json`. |
| [dashboard/services/qaConflictService.test.js](file:///d:/_Automation-Project/dashboard/services/qaConflictService.test.js) | **[NEW]** | Bộ 8 unit tests độc lập kiểm chứng toàn bộ các hàm nghiệp vụ, quét đệ quy thư mục con, bảo tồn CRLF và chống duplicate decision. |
| [dashboard/routes/qaRoutes.js](file:///d:/_Automation-Project/dashboard/routes/qaRoutes.js) | **[MODIFY]** | Đăng ký 3 REST endpoints (`/api/qa/conflict/resolve`, `/arbitrate`, `/escalate`). |
| [dashboard/public/js/views/qa/conflictStudioHelper.js](file:///d:/_Automation-Project/dashboard/public/js/views/qa/conflictStudioHelper.js) | **[NEW]** | Module UI Controller độc lập quản lý render gom nhóm, thẻ so sánh đối xứng 2 cột, xử lý event click, rào chắn chống double-click và popup phân giải AI. |
| [dashboard/public/js/views/qa/qaSlice.js](file:///d:/_Automation-Project/dashboard/public/js/views/qa/qaSlice.js) | **[MODIFY]** | Khởi tạo `ConflictStudioHelper`, dọn dẹp khi unmount, và định tuyến render chuyên biệt cho nhóm `ac-lech-giua-tai-lieu-va-spec`. |
| [dashboard/public/styles/views/qa.css](file:///d:/_Automation-Project/dashboard/public/styles/views/qa.css) | **[MODIFY]** | Bổ sung styling CSS hiện đại cho Studio, card so sánh đối xứng và các nút bấm hành động mini. |
| [tests/dashboard-api/qa.test.js](file:///d:/_Automation-Project/tests/dashboard-api/qa.test.js) | **[MODIFY]** | Bổ sung 4 test cases kiểm thử API contract toàn diện cho các endpoint conflict mới. |

---

## 7. Kế Hoạch Kiểm Thử & Kết Quả Nghiệm Thu (Verification Matrix)

### 7.1. Kiểm Thử Tự Động (Automated Test Evidence)
1. **Unit Test Service**:
   - Lệnh: `node --test dashboard/services/qaConflictService.test.js`
   - Kết quả: **8/8 PASS** (190ms).
2. **API Contract Tests**:
   - Lệnh: `node --test tests/dashboard-api/qa.test.js`
   - Kết quả: **33/33 PASS** (3.1s).
3. **Toàn Bộ Dashboard API Suite**:
   - Lệnh: `npm run test:dashboard:api`
   - Kết quả: **59/59 PASS** (5.4s).
4. **Kiểm Tra Cấu Trúc Framework & View**:
   - Lệnh: `npm run check:framework` ➔ **PASS** (8 specs, 4 page objects).
   - Lệnh: `npm run check:dashboard-features` ➔ **PASS** (14 views đủ mảnh, 12 nhóm routes).
5. **Pre-commit Audit Master Process**:
   - Lệnh: `python D:/_Master_Process/master.py audit . --staged`
   - Kết quả: **0 Violations (PASS)**.

### 6.2. Kiểm Thử Giao Diện Thực Tế (Manual Verification)
1. Khởi động Dashboard bằng lệnh: `npm run dashboard`.
2. Mở trình duyệt tại `http://localhost:3000/#/qa` -> bấm subtab **Vấn đề** (Findings).
3. Quan sát nhóm **"Tài liệu và spec nói khác nhau"**:
   - Đã được thay thế hoàn toàn bằng **Traceability Conflict Studio**.
   - Các xung đột được phân cụm trực quan theo từng file `.spec.js`.
   - Các nút `[⇄ Cập nhật Doc theo Spec]`, `[⇄ Sửa Spec theo Doc]`, `[✨ Trọng tài AI]`, `[📋 Đẩy vào Sổ Quyết Định]` hoạt động chính xác, tạo backup an toàn và tự động giảm số lượng xung đột ngay sau khi đồng bộ.
