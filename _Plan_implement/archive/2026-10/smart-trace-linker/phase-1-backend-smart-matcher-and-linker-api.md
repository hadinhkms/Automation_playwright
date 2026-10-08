# Phase 1 — Backend Smart Matcher, Scaffold Engine & Linker API

> **Tác giả Nghiệp vụ:** @ba · **Tác giả Kỹ thuật:** @tl · **Research:** Không áp dụng  
> **Trạng thái:** `COMPLETED` · **Cấp độ:** `L3`  
> **Nằm trong:** [Plan 21 Overview](plan-21-overview.md)

---

## A. Nghiệp Vụ (BA — A/R; Tech Lead — C)

### A1. Mục Tiêu & Phạm Vi Phase
- **In-Scope:**
  - Xây dựng module dịch vụ lõi `smartTraceLinkerService.js` phân tích spec vừa viết:
    - Bóc tách cấu trúc spec: `describe` title, danh sách `test()`, các bước `test.step()`, URLs và assertions.
    - Quét toàn bộ kho `requirements/REQ-*.md` và `test-cases/REQ-*.md` hiện có trong workspace.
    - Chấm điểm tương thích (Match Score từ 0% đến 100%) dựa trên từ khóa ngữ nghĩa và miền chức năng (domain). Hỗ trợ **song ngữ Việt/Anh** (spec thực tế như `saucedemo_login.spec.js` viết tiếng Anh).
    - Phân nhánh đề xuất:
      * **Match $\ge 70\%$:** Gợi ý ghép vào Requirement hiện có, tự sinh `AC` mới (Given/When/Then) và `TC` tương ứng.
      * **Match $< 70\%$ hoặc Không có REQ:** Tạo bản thảo Requirement mới hoàn chỉnh với ID kế tiếp (`REQ-<next>`).
  - Cung cấp 2 API RESTful:
    - `POST /api/qa/smart-link`: Nhận đường dẫn file hoặc text spec, trả về xếp hạng đối sánh và bản thảo đề xuất.
    - `POST /api/qa/smart-link/apply`: Tiếp nhận lựa chọn của người dùng, thực hiện ghi đĩa an toàn (cập nhật file markdown và tự động chèn `@REQ-xxx` vào spec).
- **Out-of-Scope:**
  - Không vẽ giao diện frontend Studio (thuộc Phase 2).

### A2. Yêu Cầu & Quy Tắc Nghiệp Vụ Áp Dụng
- `REQ-21-01`: Công cụ phải tự động phân biệt được spec đã có hay chưa có tag `@REQ-xxx`, và trích xuất đầy đủ ý định kiểm thử (intent) từ tiêu đề test và các bước Given/When/Then. Nếu spec chưa có `test.describe()` mà chỉ có các `test()`, tự động gắn tag vào tiêu đề từng `test()` hoặc bọc describe chuẩn.
- `REQ-21-02`: Khi ghép vào requirement có sẵn, không được làm xáo trộn hoặc trùng lặp mã định danh `AC-yyy` và `TC-zzz` đã có. Mã mới phải tự động tăng tuần tự và tuân thủ định dạng chuẩn 3 chữ số (`AC-001`, `TC-001`).
- `BR-21-01`: Quy tắc chấm điểm tương thích (Match Scoring):
  - Dựa trên sự giao thoa từ khóa giữa tiêu đề test, tên Page Object và URL mục tiêu với tiêu đề REQ, phần mô tả và các AC hiện có. Dùng **trọng số theo tầng** (không dùng Jaccard thuần vì text ngắn khó đạt 70%): tiêu đề describe/REQ ×3, domain/URL path ×2, title test/AC ×1; điểm = overlap có trọng số / tổng trọng số tập token nhỏ hơn (overlap coefficient). Có bảng từ đồng nghĩa nhỏ Việt↔Anh (đăng nhập↔login, **xác thực↔auth/authentication/login**, tìm kiếm↔search, giỏ hàng↔cart…). Spec thật `tests/e2e/desktop/saucedemo_login.spec.js` có describe "Kiểm thử Xác thực Người dùng SauceDemo (E2E Real Web Suite)" (không có chữ "đăng nhập"), nên nhóm đồng nghĩa `{xac thuc, auth, login, dang nhap, signin}` bắt buộc có trong từ điển và là fixture đo AC-21-02. Stop words phải bao gồm cả nhiễu như `e2e`, `real`, `web`, `suite`, `kiem thu`.
  - Điểm $\ge 70\%$: Xếp hạng "Khớp cao" (High Match); từ 40% - 69%: "Khớp tiềm năng" (Partial Match); < 40%: Đề xuất "Nghiệp vụ mới" (New Requirement).
- `BR-21-02`: Quy tắc ghi đĩa an toàn (Atomic Apply & Concurrency Lock):
  - Toàn bộ hàm thực thi ghi đĩa phải được bọc trong `withWriteLock(root, ...)` từ `dashboard/services/qaBatchSessionStore.js`. **Lưu ý:** hàm này KHÔNG xếp hàng — đang có thao tác ghi khác thì ném ngay `409 BATCH_LOCKED`. API phải chuyển nguyên lỗi này cho client (không retry ngầm) và UI phải hiển thị "Đang có thao tác ghi khác, thử lại sau vài giây".
  - **Dựng nội dung trong bộ nhớ trước, ghi sau:** `appendTestCasesToDocument` hiện ghi thẳng bằng `fs.writeFileSync`, tự backup qua `resourceService.createBackup` và chỉ xử lý file TC — nên KHÔNG được gọi trực tiếp trong `applySmartLink` (sẽ phá rollback 3 file). Thay vào đó tách phần dựng nội dung thành hàm thuần `buildTestCaseDocument(currentContent, reqId, testCases)` (trả về chuỗi, không chạm đĩa); `appendTestCasesToDocument` gọi lại hàm này nên hành vi `/api/qa/append-testcases` không đổi. REQ (nối AC) và spec (chèn tag) cũng dựng chuỗi bằng hàm thuần tương tự.
  - Snapshot cả 3 file (spec, REQ, TC) trước khi ghi vào `.dashboard-backups/smart-link-<id>/files/` bằng cách tái dùng `snapshotPath`/`insideRoot`/`writeManifest` của `qaBatchManifest.js` (đã export; không tự tạo `.bak` rải trong repo). Nếu thiếu helper snapshot tổng quát thì thêm 1 hàm nhỏ `snapshotFiles(root, sessionId, relPaths)` vào `smartLinkSnapshot.js` (xem B2), không sửa `qaBatchManifest.js`.
  - Thứ tự ghi: TC → REQ → spec (spec cuối cùng, vì spec có tag mà tài liệu thiếu mới là trạng thái lỗi nghiêm trọng). Mỗi file ghi bằng `writeAtomic` của `qaBatchManifest.js` (file tạm + rename, có retry EPERM/EBUSY trên Windows). Nếu bất kỳ bước nào lỗi: khôi phục toàn bộ file đã ghi từ snapshot, xoá file mới tạo (nhánh New REQ), trả lỗi `APPLY_FAILED`; không để lại `*.tmp`.
  - **Định nghĩa `specHash`:** SHA-256 hex của nội dung spec đã chuẩn hoá EOL về `\n`. `POST /smart-link` băm đúng chuỗi được phân tích (`specContent` nếu có, ngược lại nội dung đĩa) và trả kèm `hashSource: "editor" | "disk"`. `apply` luôn so `specHash` với (a) nội dung đĩa khi `hashSource = "disk"`, hoặc (b) `currentEditorContent` khi `hashSource = "editor"`, và bắt buộc nội dung đĩa không đổi so với lúc quét (client gửi thêm `diskHash`). Lệch → 409 `SPEC_CHANGED`, không ghi.
  - Spec có nhiều `test.describe()`: gắn `@REQ-xxx` vào **mọi** describe cấp cao nhất chưa có tag REQ; nếu đã có tag REQ khác thì không ghi đè, trả cảnh báo `REQ_CONFLICT`.
  - Chèn tag không làm thay đổi các tag phân hệ khác (`@smoke`, `@e2e`, `@mobile`), không trùng tag nếu đã có.

### A3. Đặc Tả Hợp Đồng API (API Schema Contracts)

#### 1. `POST /api/qa/smart-link`
- **Request Body**:
  ```json
  {
    "specPath": "tests/e2e/desktop/login.spec.js",
    "specContent": "string (optional: nội dung draft chưa lưu trên editor)"
  }
  ```
- **Response 200**:
  ```json
  {
    "specPath": "tests/e2e/desktop/login.spec.js",
    "specHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "diskHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "hashSource": "disk",
    "mode": "link",
    "hasExistingReq": false,
    "existingReqTags": [],
    "delta": null,
    "intent": {
      "describeTitle": "Đăng nhập hệ thống",
      "testTitles": ["Đăng nhập thành công với tài khoản hợp lệ", "Báo lỗi khi sai mật khẩu"],
      "keywords": ["dang", "nhap", "tai", "khoan", "login", "mat", "khau"]
    },
    "candidates": [
      {
        "reqId": "REQ-001",
        "title": "Đăng nhập và xác thực tài khoản",
        "score": 0.88,
        "matchLevel": "high",
        "docPath": "requirements/REQ-001-dang-nhap.md",
        "tcPath": "test-cases/REQ-001-dang-nhap.md",
        "suggestedAcId": "AC-004",
        "suggestedTcId": "TC-004",
        "preview": {
          "newAcLines": ["- AC-004: Given thông tin tài khoản hợp lệ, When đăng nhập, Then chuyển hướng vào dashboard."],
          "newTcRows": ["| REQ-001 | AC-004 | TC-004 | Yes | tests/e2e/desktop/login.spec.js | P1 |"]
        }
      }
    ],
    "newScaffold": {
      "nextReqId": "REQ-003",
      "slug": "dang-nhap-he-thong",
      "reqFileName": "REQ-003-dang-nhap-he-thong.md",
      "tcFileName": "REQ-003-dang-nhap-he-thong.md",
      "reqContent": "# REQ-003 Đăng nhập hệ thống\n\n- AC-001: ...",
      "tcContent": "# Test Cases: REQ-003\n\n## Traceability\n| Requirement | Acceptance criterion | Test case | Automation | Spec | Priority |\n..."
    }
  }
  ```

- **Trường `mode` (phân luồng duy nhất cho UI):**
  - `"link"`: spec chưa có tag REQ → trả `candidates` + `newScaffold` như trên, `delta = null`.
  - `"reverse_sync"`: spec đã có đúng 1 tag `@REQ-xxx` hợp lệ và tồn tại tài liệu → KHÔNG xếp hạng candidates (`candidates = []`, `newScaffold = null`); trả `delta = { reqId, docPath, tcPath, newTests: [{ title, suggestedTcId, suggestedAcId, steps }], knownCount, renamedWarnings: [] }` do `detectSpecDelta()` tính (xem TECH-21-07). `newTests` rỗng → UI hiển thị "Đã đồng bộ", không có nút Apply.
  - `"conflict"`: spec có nhiều tag REQ khác nhau (hoặc tag trỏ tới REQ không tồn tại) → trả `existingReqTags` + cảnh báo `REQ_CONFLICT`, không cho Apply.

#### 2. `POST /api/qa/smart-link/apply`
- **Request Body**:
  ```json
  {
    "specPath": "tests/e2e/desktop/login.spec.js",
    "specHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "diskHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "mode": "link_existing", // "create_new" hoặc "reverse_sync" (khi reverse_sync: targetReqId = tag REQ đang có trong spec, chỉ nối TC/AC, không chèn tag)
    "targetReqId": "REQ-001", // bắt buộc với link_existing, khớp ^REQ-\\d{3}$
    "newReqData": {           // dùng khi mode === "create_new"
      "title": "Đăng nhập hệ thống",
      "slug": "dang-nhap-he-thong"
    },
    "currentEditorContent": "string (optional: dùng để patch và trả về editor state)"
  }
  ```
- **Response 200**:
  ```json
  {
    "success": true,
    "assignedReqId": "REQ-001",
    "patchedSpecContent": "const { test } = require('@playwright/test');\ntest.describe('Đăng nhập hệ thống @REQ-001', () => {\n...",
    "updatedFiles": [
      "test-cases/REQ-001-dang-nhap.md",
      "requirements/REQ-001-dang-nhap.md",
      "tests/e2e/desktop/login.spec.js"
    ],
    "backupSessionId": "smart-link-1727854000-xyz"
  }
  ```
- **Lỗi Chuẩn Hóa**:
  - `400 INVALID_PARAMS`: Thiếu tham số hoặc `reqId` không khớp `^REQ-\d{3}$`.
  - `403 PATH_REJECTED`: `specPath` nằm ngoài `tests/**` hoặc cố tình path traversal `..`.
  - `409 SPEC_CHANGED`: `specHash`/`diskHash` lệch so với nội dung hiện tại (người dùng vừa sửa file ngoài IDE hoặc gõ thêm trong editor).
  - `409 REQ_CONFLICT`: Spec đã gắn một tag REQ khác và không có cờ ghi đè.
  - `409 BATCH_LOCKED`: `withWriteLock` đang bị giữ bởi batch fixer/luồng ghi khác (không xếp hàng, không ghi gì); client được phép bấm thử lại.
  - `500 APPLY_FAILED`: lỗi ghi giữa chừng, đã rollback toàn bộ từ snapshot, không còn `*.tmp`.

### A4. Tiêu Chí Nghiệm Thu (AC-xx)
- `AC-21-01`: `POST /api/qa/smart-link` xử lý thành công payload `{ specContent }` hoặc `{ specPath }` trong thời gian $< 500\text{ms}$ (Heuristic mode), trả về danh sách `candidates` được sắp xếp theo điểm giảm dần và `newScaffold` dự phòng.
- `AC-21-02`: Với fixture chuẩn (workspace tạm có `REQ-001 Đăng nhập`/`Login` + **bản sao nguyên văn `tests/e2e/desktop/saucedemo_login.spec.js`** (describe "Xác thực Người dùng"), bản tiếng Anh và bản tiếng Việt), API trả về gợi ý `REQ-001` với điểm $\ge 75\%$ ở cả hai ngôn ngữ, kèm bản thảo `AC` và `TC` kế tiếp chính xác; spec về tìm kiếm việc làm trên cùng fixture trả điểm $< 40\%$ và `newScaffold`.
- `AC-21-03b`: Fault injection: giả lập lỗi ghi ở file thứ 2/3 → cả 3 file về nguyên trạng, không còn file tạm; `specPath` ngoài `tests/**` → 403; `reqId` sai định dạng (`REQ-1`, `REQ-0001`) → 400; spec đổi giữa 2 lần gọi → 409 `SPEC_CHANGED`; giữ sẵn lock (`withWriteLock` đang chạy) rồi gọi apply → 409 `BATCH_LOCKED` và 0 file bị đổi; apply lần 2 ngay sau lần 1 thành công không nhân đôi AC/TC/tag (idempotent qua `SPEC_CHANGED`/`delta` rỗng); spec `.spec.ts` được phân tích đúng và tag được chèn.
- `AC-21-03c`: `POST /smart-link` trên spec đã có 1 tag `@REQ-001` + 2 `test()` mới trả `mode = "reverse_sync"` với đúng 2 phần tử `delta.newTests`; trên spec có 2 tag REQ khác nhau trả `mode = "conflict"`.
- `AC-21-03`: `POST /api/qa/smart-link/apply` cập nhật thành công: chèn đúng `@REQ-xxx` vào file spec trên đĩa, nối thêm AC vào file requirement và TC vào file test case, exit code lệnh `npm run qa:check` sau đó không còn báo lỗi `spec-khong-truy-vet` cho file này.

### A5. Kịch Bản Nghiệm Thu Nghiệp Vụ (UAT-xx)
- `UAT-21-01`:
  - **Mục tiêu:** Kỹ sư viết một script kiểm thử mới không có `@REQ-xxx`, gọi API smart-link và nhận được đề xuất chính xác ngay lập tức.
  - **Thao tác:** Gửi request phân tích spec mới (`specContent` về tìm kiếm việc làm) trên workspace fixture; không cần file trên đĩa.
  - **Kỳ vọng:** API nhận diện đúng tính năng tìm kiếm việc làm, trả về danh sách REQ khớp hoặc mẫu REQ mới sẵn sàng áp dụng.

---

## B. Kỹ Thuật (Tech Lead — A/R; BA — C)

### B1. Quyết Định Kỹ Thuật (TECH-xx)
- `TECH-21-01`: Xây dựng các module riêng biệt trong `dashboard/services/` thay vì nhồi vào `qaService.js`. **Trần thực tế là 200 dòng/file** (`quality-policy.json` → role `service`, path `services/`), nên chia theo trách nhiệm, mỗi file ≤ 200 dòng, không dùng `master-process-disable-size-check`: `smartTraceLinkerService.js` (facade + 2 hàm public `analyzeSmartLink`/`applySmartLink`), `smartLinkSpecParser.js` (bóc tách spec, hash), `smartLinkMatcher.js` (token hoá, từ điển, chấm điểm), `smartLinkDrafter.js` (bản thảo AC/TC/scaffold + chèn tag), `smartLinkApply.js` (snapshot, ghi, rollback), `specDeltaService.js` (`detectSpecDelta`).
- `TECH-21-07` (chuyển từ Phase 3): `detectSpecDelta(root, specPath, specContent)` thuộc Phase 1 vì `/smart-link` cần nó để trả `mode = "reverse_sync"`; Phase 2 (nút UI) phụ thuộc trực tiếp vào đó.
- `TECH-21-02`: Thuật toán bóc tách Spec AST/Heuristic:
  - Trích xuất: `describeTitle`, `tests` (title, tags, steps Given/When/Then, assertions).
  - Chuẩn hóa text (bỏ dấu tiếng Việt, loại bỏ stop words: "kiểm thử", "kịch bản", "test", "cho", "với").
  - So sánh vector từ khóa với tập văn bản của từng `requirements/REQ-*.md` bằng thuật toán Cosine/Jaccard Similarity cục bộ.
- `TECH-21-03`: Tái sử dụng `synthesizeScaffoldContents` và `extractHeuristicFromTestScript` từ `qaInferenceService.js` để tránh trùng lặp mã nguồn sinh markdown chuẩn.
- `TECH-21-09`: `applySmartLink` bọc `withWriteLock(root, ...)`; dựng nội dung TC bằng `buildTestCaseDocument` (hàm thuần tách ra từ `appendTestCasesToDocument`, xem BR-21-02), nhánh New REQ gọi `synthesizeScaffoldContents` (hàm này cần được kiểm tra là không tự ghi đĩa; nếu có ghi thì dùng chế độ dry-run/trả chuỗi). Ghi file bằng `writeAtomic` + snapshot theo BR-21-02. ID `AC`/`TC` mới = max hiện có + 1, tính lại ngay trong lock, trước khi ghi.
- `TECH-21-12`: Refactor `appendTestCasesToDocument` trong `qaInferenceService.js` (đã 1,245 dòng, thuộc diện chỉ thêm tối đa ~30 dòng) là **di chuyển** phần dựng chuỗi sang hàm `buildTestCaseDocument` (cùng file hoặc `qaTestCaseDocument.js` mới ≤ 200 dòng) và export; chênh lệch dòng ròng ≤ +10. Giữ nguyên test hiện có của `/api/qa/append-testcases` làm bằng chứng không hồi quy.
- `TECH-21-10`: Validate đầu vào dùng chung một hàm `assertSpecPath(root, specPath)` (resolve + realpath, bắt buộc nằm trong `<root>/tests/`, đuôi `.spec.js|.spec.ts`) và regex `reqId` bắt buộc 3 số `^REQ-\d{3}$`; `specContent` giới hạn kích thước (≤ 512KB). `extractHeuristicFromTestScript` phải được xác nhận parse được `.spec.ts` (cú pháp `import`); nếu không, bóc tách bằng `smartLinkSpecParser.js` riêng.

### B2. Bản Đồ File & Ngân Sách Dòng (File Splitting Budget)

| Path | Loại File | Thao Tác | Trần Số Dòng | Dự Kiến |
|---|---|:---:|:---:|:---:|
| `dashboard/services/smartTraceLinkerService.js` (facade) | Service Module | Tạo mới | 200 | 90 |
| `dashboard/services/smartLinkSpecParser.js` | Service Module | Tạo mới | 200 | 150 |
| `dashboard/services/smartLinkMatcher.js` | Service Module | Tạo mới | 200 | 170 |
| `dashboard/services/smartLinkDrafter.js` | Service Module | Tạo mới | 200 | 180 |
| `dashboard/services/smartLinkApply.js` (+ snapshot) | Service Module | Tạo mới | 200 | 190 |
| `dashboard/services/specDeltaService.js` | Service Module | Tạo mới | 200 | 120 |
| `dashboard/services/qaInferenceService.js` (hiện 1,245 dòng) | Service (đã quá trần) | Sửa | +30 dòng ròng (C-4) | +10 (tách `buildTestCaseDocument`) |
| `dashboard/routes/qaRoutes.js` (hiện 388 dòng) | API Route | Sửa | 450 | 430 |
| `tests/dashboard-api/smartTraceLinker.test.js` (+ `smartLinkMatcher.test.js` nếu > 400) | Unit + Contract Test | Tạo mới | 800 (role test) | 400 |

> Trần dòng lấy từ `.master_process/config/quality-policy.json` (service 200, test 800). Chạy `npm run check:framework` ngay sau khi tạo mỗi file để bắt vi phạm sớm.

### B3. Checklist Thực Thi & Bằng Chứng Nghiệm Thu
0. [x] Tách `buildTestCaseDocument` khỏi `appendTestCasesToDocument` (TECH-21-12); chạy test `/api/qa/append-testcases` hiện có để chứng minh không hồi quy; xác nhận `synthesizeScaffoldContents` không ghi đĩa.
1. [x] Tạo `smartLinkSpecParser.js` + `smartLinkMatcher.js` (bóc tách spec, chấm điểm so khớp, từ điển song ngữ gồm nhóm `xác thực/auth/login`, tính `specHash`/`diskHash`).
2. [x] Tạo `smartLinkDrafter.js` (`draftLinkToExistingReq`, `draftNewReqScaffold`, chèn tag) và `specDeltaService.js` (`detectSpecDelta`, trả `mode = "reverse_sync" | "conflict"`).
3. [x] Tạo `smartLinkApply.js` (`applySmartLink()` có `withWriteLock`, dựng chuỗi trong bộ nhớ, snapshot, `writeAtomic` TC → REQ → spec, rollback) và facade `smartTraceLinkerService.js`.
4. [x] Khai báo 2 route `POST /api/qa/smart-link` và `POST /api/qa/smart-link/apply` trong `qaRoutes.js`, chuyển nguyên mã lỗi (gồm `BATCH_LOCKED`).
5. [x] Viết suite `tests/dashboard-api/smartTraceLinker.test.js` (fixture song ngữ, fault injection, path traversal, 409 SPEC_CHANGED, 409 BATCH_LOCKED, reject `REQ-1`, `.spec.ts`, reverse_sync/conflict); xác nhận `npm run test:dashboard:api` thực sự liệt kê và chạy file này, 100% PASS.
