# Kế Hoạch 19: BDD Specification & Smart Test Data Studio

> **Mã kế hoạch:** `PLAN-19`  
> **Phiên bản:** `v1.0` — Ngày lập: 2026-09-28  
> **Trạng thái:** `DRAFT v1 — CHỜ DUYỆT (Chờ PO / BA duyệt trước khi bắt đầu Phase 1)`  
> **Phân loại triển khai:** L3 — Nâng cấp năng lực BDD Living Documentation và Trình quản lý dữ liệu kiểm thử (Test Data Studio).  
> **Phạm vi:**  
> 1. **BA-2 (BDD Given-When-Then Formatter):** Chuẩn hóa User Story / AC tự do sang định dạng BDD Given-When-Then chuẩn mực.  
> 2. **BA-2+ (Boundary Value & Equivalence Partitioning Studio):** Tự động phát hiện ràng buộc số/chuỗi và lập ma trận phân vùng tương đương (EP) + phân tích giá trị biên (BVA).  
> 3. **QA-7 (Smart Test Data & Persona Generator):** Bộ sinh dữ liệu kiểm thử thực tế thị trường VN (CCCD 12 số modulo hợp lệ, SĐT nhà mạng, MST 10/13 số, Họ tên VN) + Thư viện Payload biên (XSS, SQLi, Unicode tiếng Việt tổ hợp, chuỗi cực đại).  
> 4. **AI Tasks & Gateway Integration:** Tích hợp `formatBddRequirement.js`, `generateBoundaryMatrix.js`, `generateSyntheticData.js` vào `core/ai/tasks/` kết nối AI Gateway lõi.  
> 5. **Dashboard UI Views:** Mở rộng view `#/qa` (Requirement Analyzer Studio) và `#/data` (Test Data Studio).  
> **Điều kiện đầu vào:** PLAN-17 (Gateway, Context Builder, UI Components) và PLAN-18 (Rule-based Batch Processing) đã hoàn tất 100%.  
> **Chiến lược nhánh:** Trunk-based development trên `main`, kiểm định qua Gate 3 và Gate 4 trước khi commit.  
> **Tham chiếu bắt buộc:** [AGENTS.md](../AGENTS.md), [DASHBOARD_AI_PROMPT.md](../ai/dashboard/DASHBOARD_AI_PROMPT.md), [03_ACCEPTANCE_GATES.md](../.master_process/03_ACCEPTANCE_GATES.md), [gate-scenarios.json](../.master_process/config/gate-scenarios.json), [17_AI_ASSISTED_QA_FRAMEWORK_PLAN.md](17_AI_ASSISTED_QA_FRAMEWORK_PLAN.md).  

---

## 0. Bối Cảnh & Giá Trị Nghiệp Vụ (PO & BA Perspective)

### 0.1. Hiện trạng & Khoảng trống (Gaps)
1. **Khâu Phân tích Yêu cầu (BA Gap):**
   - Đội ngũ BA và QA khi đưa User Story từ Jira/Confluence vào `requirements/*.md` thường viết AC dạng văn xuôi tự do.
   - Hiện đã có công cụ soát độ rõ (BA-1) và sinh test case (QA-1), nhưng thiếu công cụ **chuẩn hóa BDD Given-When-Then (BA-2)** và **phân tích giá trị biên (BVA/EP)**. Điều này dẫn đến việc bỏ sót các ca kiểm thử biên (off-by-one, boundary overflows, invalid format).
2. **Khâu Dữ liệu Kiểm thử (QA & Dev Gap):**
   - Test Data Studio (`#/data`) hiện chỉ có tính năng quản lý file JSON cơ bản và faker chuỗi ngẫu nhiên đơn giản (`{{random_phone}}`, `{{random_email}}`).
   - Thiếu khả năng sinh các định danh thực tế theo quy chuẩn Việt Nam:
     * CCCD 12 số hợp lệ (chuẩn mã tỉnh 001..096, mã thế kỷ/giới tính, năm sinh).
     * Mã số thuế (MST) 10 số / 13 số tuân theo thuật toán kiểm tra số kiểm tra (checksum modulo 11) của Tổng cục Thuế.
     * Số điện thoại đúng đầu số của các nhà mạng viễn thông Việt Nam (Viettel, VinaPhone, MobiFone).
   - Thiếu bộ dữ liệu nhân vật hoàn chỉnh (Test Persona) cho các bài toán thương mại điện tử, tuyển dụng và việc làm.
   - Thiếu thư viện Payload biên (XSS, SQLi, Unicode tiếng Việt dựng sẵn vs tổ hợp, khoảng trắng zero-width) để kiểm thử bảo mật và validation form.

### 0.2. Mục tiêu đo được (Measurable Goals)
- **G1 (Tốc độ & 0-Token cho dữ liệu chuẩn):** 100% dữ liệu định danh VN (CCCD, MST, SĐT, Họ tên) được sinh bằng thuật toán xác định (deterministic algorithm), thời gian sinh $\le 5\text{ms}$ cho 100 bản ghi, **0 token AI**.
- **G2 (Chuẩn hóa BDD):** Tự động chuyển đổi đoạn AC văn xuôi thành format BDD `Given ... When ... Then ...` chuẩn ngữ nghĩa, tích hợp 1-click vào Requirement Editor.
- **G3 (Phân tích biên BVA/EP):** Trích xuất chính xác 100% các khoảng giá trị biên số và chuỗi (ví dụ: `tuổi từ 18 đến 60`, `mật khẩu 8 đến 32 ký tự`), lập ma trận 5 điểm biên (Min-1, Min, Typical, Max, Max+1).
- **G4 (An toàn & Tính mô-đun):** Tuân thủ tuyệt đối giới hạn dòng mã (Service $\le 200$, Module $\le 250$, Helper $\le 150$). Không có lỗi rò rỉ bộ nhớ (OWN-01..05) và hỗ trợ đầy đủ Dark/Light mode, responsive 390px.

---

## 1. Kiến Trúc & Danh Mục File Phân Rã (Modularity Inventory)

Mọi file mới được thiết kế tách biệt theo nguyên tắc Single Responsibility, bảo đảm giới hạn số dòng của dự án:

| STT | File / Đường Dẫn | Vai Trò & Trách Nhiệm | Giới Hạn Dòng |
|:---:|---|---|:---:|
| 1 | `core/utils/vnDataGenerators.js` | **Thuật toán sinh dữ liệu VN:** Thuật toán CCCD 12 số (mã tỉnh, thế kỷ, năm sinh), MST 10/13 số (modulo 11 checksum), SĐT mạng VN, Họ tên VN | $\le 150$ |
| 2 | `core/utils/edgePayloads.js` | **Thư viện Payload biên:** Danh mục payload SQLi, XSS, Unicode NFC/NFD tiếng Việt, khoảng trắng lạ, chuỗi cực đại | $\le 120$ |
| 3 | `core/ai/tasks/formatBddRequirement.js` | **Task AI BDD Formatter:** Chuyển đổi User Story / AC sang Given-When-Then chuẩn | $\le 150$ |
| 4 | `core/ai/tasks/generateBoundaryMatrix.js` | **Task AI/Rule BVA Matrix:** Trích xuất điều kiện logic và lập ma trận phân vùng tương đương & giá trị biên | $\le 150$ |
| 5 | `core/ai/tasks/generateSyntheticData.js` | **Task AI Data Synthesizer:** Sinh dataset theo cấu trúc JSON Schema hoặc mô tả nghiệp vụ | $\le 150$ |
| 6 | `dashboard/services/testDataStudioService.js` | **Service Backend Dữ liệu Test:** Quản lý sinh persona, bộ dữ liệu tổng hợp, validate và backup an toàn | $\le 200$ |
| 7 | `dashboard/routes/testDataRoutes.js` | **Router Backend Endpoints:** Cung cấp API `/api/data/generate/vn`, `/api/data/payloads`, `/api/data/personas` | $\le 160$ |
| 8 | `dashboard/public/js/views/data/smartDataHelper.js` | **Frontend UI Helper (`#/data`):** Quản lý modal sinh dữ liệu thông minh, nạp persona và xuất dữ liệu | $\le 150$ |
| 9 | `dashboard/public/js/views/qa/bddStudioHelper.js` | **Frontend UI Helper (`#/qa`):** Quản lý tab BDD Formatter & ma trận Boundary Value trong Requirement Studio | $\le 150$ |
| 10 | `dashboard/public/templates/data.html` | **Template HTML Data Manager:** Thêm tab con "Sinh dữ liệu thông minh" & modal Persona Generator | Tối ưu HTML |
| 11 | `dashboard/public/templates/qa.html` | **Template HTML QA Docs:** Bổ sung nút "Chuẩn hóa BDD (GWT)" và tab "Ma trận Giá trị Biên" | Tối ưu HTML |
| 12 | `tests/core-utils/vnDataGenerators.test.js` | **Unit Test Core:** Kiểm thử độ chính xác thuật toán CCCD modulo, MST checksum, regex SĐT | $\le 150$ |
| 13 | `tests/dashboard-api/testDataStudio.test.js` | **API Contract Tests:** Kiểm thử 100% các endpoint mới của Test Data & BDD Studio | $\le 150$ |
| 14 | `tests/dashboard/qa-bdd-smart-data.spec.js` | **E2E Test Suite Playwright:** Kiểm thử luồng người dùng trên trình duyệt (BA tạo BDD + QA sinh data) | $\le 200$ |

---

## 2. Nguyên Tắc Bất Biến & Ràng Buộc Kỹ Thuật (Invariants)

- **INV-1 — Ưu tiên Thuật toán Xác định (Deterministic First):** Mọi dữ liệu định danh pháp lý Việt Nam (CCCD, MST, SĐT) bắt buộc phải được sinh bằng thuật toán thuần túy Node.js trong `core/utils/vnDataGenerators.js`. Tuyệt đối không dùng AI để đoán số CCCD/MST nhằm đảm bảo 100% hợp lệ về mặt cấu trúc và không tốn token.
- **INV-2 — Tuân Thủ AI Gateway:** Các tác vụ AI (chuyển đổi văn bản BDD, sinh schema tùy biến) bắt buộc đi qua `callAi()` của `core/ai/gateway/`. Phải hỗ trợ hủy request (`AbortSignal`), timeout 30s, token tracking 5h và fallback an toàn khi mất kết nối.
- **INV-3 — Dữ liệu Tổng hợp An toàn (Synthetic Privacy / Zero PII):** Nghiêm cấm sử dụng số CCCD thật, họ tên thật, địa chỉ nhà thật của người dùng thực tế. Toàn bộ dữ liệu sinh ra phải là dữ liệu tổng hợp giả lập (synthetic) phục vụ kiểm thử.
- **INV-4 — Bảo Toàn Cấu Trúc File & Atomic Backup:** Mọi thao tác lưu dữ liệu mới vào `data/*.json` hoặc cập nhật requirement vào `requirements/REQ-xxx.md` đều phải tạo snapshot backup tự động vào `.dashboard-backups/` và thực hiện ghi đĩa atomic.
- **INV-5 — Chuẩn Hóa Living Documentation:** Format BDD sinh ra phải tương thích 100% với scanner của `tools/qa/lib/sources.js` và bảng truy vết `tools/qa/lib/commands.js`, giữ nguyên ID `AC-xxx` và mã `@REQ-xxx`.

---

## 3. Đặc Tả Nghiệp Vụ & Hợp Đồng Dữ Liệu (Functional & API Contracts)

### 3.1. Hợp đồng API Backend

#### 1. Endpoint Sinh Dữ Liệu Việt Nam (Deterministic)
- **Route:** `POST /api/data/generate/vn`
- **Request Body:**
  ```json
  {
    "type": "cccd" | "mst" | "phone" | "persona" | "payloads",
    "count": 10,
    "options": {
      "gender": "male" | "female" | "any",
      "birthYear": 1995,
      "provinceCode": "001",
      "mstType": "enterprise" | "personal",
      "payloadCategory": "xss" | "sqli" | "unicode" | "all"
    }
  }
  ```
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "count": 10,
    "data": [
      {
        "id": "001095012345",
        "name": "Nguyễn Văn An",
        "phone": "0982345678",
        "email": "an.nguyen95@testmail.vn",
        "mst": "0101234567"
      }
    ],
    "generatedAt": "2026-09-28T03:00:00.000Z"
  }
  ```

#### 2. Endpoint Chuẩn Hóa BDD Given-When-Then (AI-Assisted)
- **Route:** `POST /api/qa/requirement/format-bdd`
- **Request Body:**
  ```json
  {
    "rawText": "Khi ứng viên nộp hồ sơ, nếu thiếu số điện thoại thì báo lỗi đỏ...",
    "reqId": "REQ-001",
    "acId": "AC-001"
  }
  ```
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "formattedBdd": "GIVEN ứng viên đang ở màn hình Nộp hồ sơ\nWHEN ứng viên để trống trường \"Số điện thoại\" và bấm \"Nộp hồ sơ\"\nTHEN hệ thống hiển thị thông báo lỗi màu đỏ \"Số điện thoại không được để trống\"\nAND nút \"Nộp hồ sơ\" vẫn bị vô hiệu hóa",
    "model": "qaFast",
    "tokensUsed": 185
  }
  ```

#### 3. Endpoint Trích Xuất Ma Trận Giá Trị Biên (BVA Matrix)
- **Route:** `POST /api/qa/requirement/boundary-matrix`
- **Request Body:**
  ```json
  {
    "requirementText": "Độ tuổi tham gia từ 18 đến 60 tuổi. Mật khẩu dài từ 8 đến 32 ký tự.",
    "reqId": "REQ-001"
  }
  ```
- **Response `200 OK`:**
  ```json
  {
    "success": true,
    "boundaries": [
      {
        "field": "Tuổi",
        "type": "integer",
        "validRange": [18, 60],
        "testValues": {
          "minMinus1": 17,
          "min": 18,
          "minPlus1": 19,
          "nominal": 30,
          "maxMinus1": 59,
          "max": 60,
          "maxPlus1": 61,
          "invalidTypes": ["-1", "abc", "18.5", ""]
        }
      }
    ]
  }
  ```

---

## 4. Ma Trận Kịch Bản Kiểm Định Cổng Nghiệm Thu (Gate 4 Matrix)

Tuân thủ nghiêm ngặt bảng kiểm định [gate-scenarios.json](../.master_process/config/gate-scenarios.json):

| Nhóm Kịch Bản | Mã Scenario | Hành Vi Kiểm Tra & Kỳ Vọng |
|---|:---:|---|
| **Async & State** | `ASYNC-01` | Người dùng bấm liên tục nút "Sinh dữ liệu VN" hoặc "Chuẩn hóa BDD" → Chỉ 1 request được xử lý tại một thời điểm, nút bấm hiển thị trạng thái loading, không sinh trùng token. |
| | `ASYNC-02` | Chuyển tab hoặc đóng modal khi AI đang sinh BDD / dữ liệu → Request bị hủy ngay lập tức (`req.on('close')` ngắt tới fetch), không báo lỗi giao diện khi mở lại. |
| | `ASYNC-03` | Kết nối mạng chập chờn hoặc timeout 30s từ provider → Hiển thị cảnh báo lỗi tiếng Việt thân thiện, nút "Thử lại" hoạt động mượt mà. |
| | `ASYNC-04` | Lưu dataset vào file `data/*.json` khi đang có tiến trình khác đọc → Ghi an toàn atomic qua file tạm `.tmp`, đảm bảo không mất dữ liệu. |
| **Ownership** | `OWN-01` | Khởi tạo và hủy `smartDataHelper` / `bddStudioHelper` qua `init()` và `destroy()` sạch sẽ, không tích tụ listener sau 20 chu kỳ đóng/mở view. |
| | `OWN-02` | Hủy modal sinh dữ liệu khi đang render bảng kết quả lớn (100 bản ghi) → DOM và memory giải phóng an toàn, không có lỗi Uncaught TypeError. |
| **Router & UI** | `UI-01` | Bố cục hiển thị sắc nét trên cả Dark Mode và Light Mode, chuẩn CSS tokens (`--accent`, `--panel-bg`, `--border`). |
| | `UI-02` | Kiểm tra độ phản hồi trên 4 độ phân giải: 1920×1080 (Desktop lớn), 1440×900 (Laptop), 1280px (Tablet ngang) và **390×844 (Mobile dọc)**: Bảng dữ liệu có thanh cuộn riêng, không tràn trang ngang. |
| | `UI-03` | Hỗ trợ bàn phím: Phím `Esc` đóng modal, phím `Enter` trong form sinh dữ liệu tự động kích hoạt tạo mẫu; Focus trap giữ trong modal. |
| **Lifecycle** | `LIFE-01` | Kiểm thử tích hợp E2E trên trình duyệt thật bằng Playwright (`qa-bdd-smart-data.spec.js`), kiểm chứng từ thao tác nhập form đến lưu file đĩa thật. |

---

## 5. Lộ Trình Triển Khai Chi Tiết (5 Phase Tuần Tự)

> **Kế hoạch dừng ở trạng thái DRAFT.** Chỉ thực hiện check `[x]` và triển khai code sau khi PO/BA duyệt văn bản kế hoạch này.

### Phase 1 — Core Heuristics & Deterministic Data Engine (Ước tính: 1 ngày)
- [ ] 1.1 Hiện thực `core/utils/vnDataGenerators.js`:
  * Hàm `generateCCCD(options)`: Chuẩn hóa 63 mã tỉnh VN, mã giới tính/thế kỷ, năm sinh, sinh 12 chữ số hợp lệ.
  * Hàm `generateMST(options)`: Thuật toán tính số kiểm tra modulo 11 chuẩn Tổng cục Thuế cho MST 10 số và 13 số.
  * Hàm `generatePhoneNumber(options)`: Sinh SĐT 10 số thuộc các dải số thực của Viettel, VinaPhone, MobiFone.
  * Hàm `generateVietnameseName(gender)`: Sinh họ tên đầy đủ từ từ điển họ và tên đệm phổ biến ở Việt Nam.
- [ ] 1.2 Hiện thực `core/utils/edgePayloads.js`: Thư viện payload định sẵn (SQLi, XSS, Unicode NFC/NFD, Zero-width space, Long strings 255/1024 chars).
- [ ] 1.3 Viết bộ unit test `tests/core-utils/vnDataGenerators.test.js`: Kiểm tra 100 ca sinh liên tiếp, đảm bảo 100% CCCD và MST vượt qua hàm kiểm định checksum.

### Phase 2 — AI Tasks & Backend Endpoints (Ước tính: 1 ngày)
- [ ] 2.1 Hiện thực task `core/ai/tasks/formatBddRequirement.js`: Prompt mẫu chuẩn hóa GWT, schema xác thực kết quả JSON.
- [ ] 2.2 Hiện thực task `core/ai/tasks/generateBoundaryMatrix.js`: Thuật toán heuristic bóc tách số + AI phân tích ngữ nghĩa điều kiện biên.
- [ ] 2.3 Hiện thực task `core/ai/tasks/generateSyntheticData.js`: Sinh dữ liệu mẫu theo JSON schema dựa trên AI Gateway.
- [ ] 2.4 Hiện thực `dashboard/services/testDataStudioService.js` và router `dashboard/routes/testDataRoutes.js`.
- [ ] 2.5 Viết API Contract test `tests/dashboard-api/testDataStudio.test.js` kiểm thử toàn bộ endpoint mới.

### Phase 3 — Giao Diện Người Dùng QA Docs & Data Studio (Ước tính: 1.5 ngày)
- [ ] 3.1 Cập nhật `dashboard/public/templates/data.html`: Thêm tab "Sinh dữ liệu thông minh", nút mở modal Persona Presets và form tùy chọn sinh VN Data.
- [ ] 3.2 Hiện thực `dashboard/public/js/views/data/smartDataHelper.js`: Xử lý tương tác sinh dữ liệu, xem trước bảng dữ liệu (preview table), và chèn thẳng vào file test data JSON đang mở.
- [ ] 3.3 Cập nhật `dashboard/public/templates/qa.html`: Thêm nút "Chuẩn hóa BDD (GWT)" và tab "Ma trận Giá trị Biên" trong `#qa-req-analyzer-modal`.
- [ ] 3.4 Hiện thực `dashboard/public/js/views/qa/bddStudioHelper.js`: Quản lý thao tác format BDD, hiển thị ma trận biên BVA/EP và cập nhật vào file requirement markdown.

### Phase 4 — E2E Playwright Suite & Modularity Audit (Ước tính: 1 ngày)
- [ ] 4.1 Xây dựng bộ test E2E `tests/dashboard/qa-bdd-smart-data.spec.js`:
  * Test Case 1: Mở Data Studio → Chọn sinh 10 CCCD và SĐT VN → Kiểm tra dữ liệu hiển thị đúng format → Lưu vào file test.
  * Test Case 2: Mở QA Docs → Nhập User Story văn xuôi → Bấm "Chuẩn hóa BDD" → Kiểm tra kết quả Given-When-Then.
  * Test Case 3: Bấm "Phân tích giá trị biên" → Kiểm tra ma trận Min/Max/Nominal hiển thị chuẩn xác.
  * Test Case 4: Kiểm thử responsive 390px trên thiết bị di động giả lập và đổi Dark/Light mode.
- [ ] 4.2 Chạy kiểm tra kiến trúc toàn diện: `npm run check:framework` và `python .master_process/master.py doctor .` (0 vi phạm số dòng, 0 vi phạm token, 0 drift).

### Phase 5 — Senior QA Verification & Gate 4 Sign-Off (Ước tính: 0.5 ngày)
- [ ] 5.1 Chạy lại toàn bộ test suite (`npm test`, `npm run test:dashboard:api`).
- [ ] 5.2 Lập hồ sơ bằng chứng Gate 4 (`.delivery/phases/plan-19-evidence.json`).
- [ ] 5.3 Review độc lập code diff và đối chiếu 16 scenarios trong `gate-scenarios.json`.
- [ ] 5.4 Chốt nghiệm thu và commit lên nhánh `main`.

---

## 6. Tiêu Chí Nghiệm Thu (Acceptance Criteria & Exit Criteria)

1. **AC-01 (Tính Hợp Lệ Dữ Liệu VN):** 100% mã CCCD sinh ra tuân thủ cấu trúc 12 số của Bộ Công An; 100% MST doanh nghiệp vượt qua phép kiểm tra trọng số modulo 11.
2. **AC-02 (Zero Token Footprint):** Các tác vụ sinh dữ liệu định danh (CCCD, SĐT, MST, Họ tên, Payload XSS/SQLi) hoàn toàn không tiêu tốn token AI.
3. **AC-03 (Chuẩn BDD GWT):** Văn bản xuất ra từ BDD Formatter đạt cấu trúc chuẩn Gherkin/BDD, có thể ánh xạ trực tiếp sang các step của Playwright test.
4. **AC-04 (BVA Coverage):** Mọi điều kiện biên được phân tách rõ ràng thành Phân vùng hợp lệ (Valid) và Phân vùng không hợp lệ (Invalid), hỗ trợ tạo test case tương ứng.
5. **AC-05 (Modularity & Clean Code):** Toàn bộ file mới tạo tuân thủ nghiêm ngặt giới hạn dòng mã theo `.quality-policy.json`, 0 console errors, 0 cảnh báo lint.
6. **AC-06 (Gate 4 PASS):** 100% test cases E2E và API contract tests PASS, có bằng chứng chạy thật trên máy tính, được xác nhận bởi Senior QA review độc lập.
