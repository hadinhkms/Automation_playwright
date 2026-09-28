# Kế Hoạch 19a: Bộ Sinh Dữ Liệu Kiểm Thử Việt Nam & Thư Viện Payload Biên (QA-7)

> **Mã kế hoạch:** `PLAN-19a` — tách từ [PLAN-19](19_BDD_SPEC_AND_SMART_TEST_DATA_STUDIO_PLAN.md) v1  
> **Phiên bản:** `v1.1` — 2026-09-28  
> **Trạng thái:** `DRAFT — CHỜ CHỐT D1–D6 (mục 0) VÀ BA DUYỆT HASH CONTRACT (Phase 0)`  
> **Phân loại:** L2/L3. **Không dùng AI**, 0 token.  
> **Phạm vi:** `core/utils/vnData/` (mới), `core/utils/dataManager.js`, `core/utils/commonUtils.js`, `dashboard/routes/`, view **Test Data Studio** (`#/data`).  
> **Phụ thuộc:** không phụ thuộc PLAN-19b. Làm trước 19b (rủi ro thấp, đóng gate nhanh).  
> **Tham chiếu bắt buộc:** [AGENTS.md](../AGENTS.md), [DASHBOARD_AI_PROMPT.md](../ai/dashboard/DASHBOARD_AI_PROMPT.md), [AI_LESSONS.md](../ai/dashboard/AI_LESSONS.md), [03_ACCEPTANCE_GATES.md](../.master_process/03_ACCEPTANCE_GATES.md), [gate-scenarios.json](../.master_process/config/gate-scenarios.json), [PLAN-18](18_QA_STATIC_FINDINGS_BATCH_PROCESSING_PLAN.md) (mẫu contract/evidence).  
> **Nhánh:** trunk-based trên `main`. Commit code **trước** khi ghi receipts (verifier yêu cầu evidence.revision == HEAD và tree sạch).

---

## 0. Quyết Định Cần Chốt Trước Phase 1

| # | Đề xuất | Lý do | Ai chốt |
| --- | --- | --- | --- |
| D1 | CCCD dùng danh sách **63 mã tỉnh** ở Phụ lục A | Số CCCD đã cấp không đổi sau sáp nhập tỉnh 2025. Cần BA xác nhận có mã mới nào phải thêm không | BA |
| D2 | MST chỉ sinh 2 loại: **doanh nghiệp 10 số** và **đơn vị phụ thuộc 13 số** (`NNNNNNNNNN-NNN`). Không có loại "MST cá nhân" | Theo TT 86/2024/TT-BTC, cá nhân dùng số định danh (CCCD) làm MST. BA xác nhận | BA |
| D3 | `generateRandomVNPhone()` hiện có ở Hub chuyển sang dùng bộ sinh mới | Bản hiện tại ([commonUtils.js:518](../core/utils/commonUtils.js#L518)) ghép `09/03/07/08/05` với 8 số ngẫu nhiên, nên sinh ra cả đầu số chưa cấp (050, 080…). Chữ ký hàm giữ nguyên; vệ tinh nhận thay đổi khi sync | PO |
| D4 | Bản đầu chỉ có **"Lưu thành dataset mới"** và **"Sao chép JSON"**. Không chèn vào dataset đang mở | Editor dataset thuộc `app.js` legacy (`isDataDirty`, `dataRawEditorController`, [app.js:9492](../dashboard/public/app.js#L9492)); chèn vào đó phải sửa file 17.6k dòng | PO |
| D5 | `count` là số nguyên từ 1 đến 500 | 500 bản ghi persona < 100KB, dưới trần 1MB của dataset | PO |
| D6 | Email luôn dùng `@example.com` | Tên miền dành riêng (RFC 2606), trùng quy ước ở [dataManager.js:29](../core/utils/dataManager.js#L29) | — |

---

## 1. Mục Tiêu & Ngoài Phạm Vi

### 1.1. Mục tiêu đo được

- **G1:** CCCD, MST, SĐT, họ tên, persona sinh bằng thuật toán. 100% qua bộ kiểm tra độc lập (oracle viết tay trong test, **không** gọi lại code của generator).
- **G2:** Có `seed` → cùng seed, cùng tham số thì ra cùng kết quả (tái hiện lỗi được). Không có seed → server tự chọn và trả seed về.
- **G3:** Không trùng giá trị trong một lần sinh (CCCD, SĐT, email).
- **G4:** Thư viện payload biên gồm 6 nhóm (mục 4.3), id ổn định. Dashboard hiển thị payload dạng văn bản, không thực thi.
- **G5:** Chạy lúc test: spec gọi `generateVnCccd()`… từ `commonUtils`, hoặc dataset dùng placeholder `{{vn_cccd}}` qua `resolveDynamicValues`.
- **G6:** 0 token AI. Không file nào của 19a `require`/`import` tới `core/ai`.

### 1.2. Ngoài phạm vi

- Địa chỉ, biển số xe, GPLX, tên công ty. CarThings đã có bản riêng ở `core/local/`; hợp nhất sau.
- Sinh dữ liệu bằng AI theo JSON Schema (`generateSyntheticData` của v1). Bỏ vì không có AC, và LLM có thể tái tạo PII thật.
- Chèn vào dataset đang mở (D4).
- Sửa `core/local/commonUtils.local.js` của CarThings. Vùng này thuộc dự án, không sync.

---

## 2. Ràng Buộc Từ Code Hiện Tại (Ground Truth)

| Sự thật (đã kiểm) | Hệ quả thiết kế |
| --- | --- |
| Hub đã có `{{random_phone}}`, `{{random_email}}`, `{{random_name}}` trong `generateDynamicValue` ([dataManager.js:20-45](../core/utils/dataManager.js#L20-L45)); regex placeholder chỉ nhận `[a-zA-Z0-9_]` | Thêm `{{vn_*}}` bằng cách gọi sang module mới ở nhánh `default`, không viết lại hàm |
| `dataManager.js` 316 dòng, đang có exemption size-check | Chỉ thêm ≤ 3 dòng (1 `require` + 2 dòng case `vn_*` gọi `resolveVnPlaceholder`), mọi logic mới nằm trong `core/utils/vnData/` |
| Spec `require` JSON trực tiếp (`tests/e2e/desktop/*.spec.js`), không tự resolve placeholder | Muốn giá trị mới mỗi lần chạy thì gọi hàm trong spec (như CarThings đang làm với `generateRandomVNIDCard`). Placeholder dùng cho dataset nào đi qua `resolveDynamicValues` |
| CarThings có `generateRandomVNIDCard` trong `core/local`: mã tỉnh ngẫu nhiên 001–096 (có mã không tồn tại) và số thế kỷ 0–9 bất kỳ | Tên hàm mới khác (`generateVnCccd`) để không đụng override; `withLocalOverrides` cho bản local thắng |
| `POST /api/data/create-dataset` nhận `content`, từ chối file đã tồn tại, có backup ([dataManager.js:245](../core/utils/dataManager.js#L245)) | Nút "Lưu thành dataset mới" dùng lại endpoint này. **Không tạo đường ghi file mới** |
| `DATA_DIR` cố định ở `<framework>/data` (không theo root của harness) | Test API/E2E ghi file phải dùng tên riêng `plan19a-*` và xoá ở `after` |
| `handleDataRoutes` trả `false` cho `/api/data/*` không khớp ([dataRoutes.js:18](../dashboard/routes/dataRoutes.js#L18)) | Route mới nằm ở file riêng, đăng ký ngay trước `handleDataRoutes` trong `server.js` |
| Data view do `app.js` legacy điều khiển; `DataSlice.mount()` gọi `openDataManager()` rồi `return` sớm ([dataSlice.js:23-39](../dashboard/public/js/views/data/dataSlice.js#L23-L39)) | Khởi tạo controller modal **bên trong nhánh `try`, sau `await window.openDataManager()` đã resolve và trước `return`** (tức dòng 29), vì nút `#data-vn-gen-open-btn` chỉ tồn tại sau khi legacy render xong. Huỷ trong `unmount()`. `init()` phải idempotent (bài học 2026-09-22 về template nạp động). Nếu nút chưa tồn tại (fallback khi legacy thay đổi), dùng guard `if (!root.querySelector('#data-vn-gen-open-btn')) return;` |
| `dataSlice.js` 312 dòng, là vi phạm modularity có sẵn | Chỉ thêm ≤ 6 dòng. Không tạo vi phạm mới |
| `confirmDialog()` dùng chung đã có ở [batchConfirm.js](../dashboard/public/js/views/qa/batch/batchConfirm.js) | Dùng lại cho chặn đóng modal (UI-05); không viết hộp xác nhận thứ hai |
| `apiClient.post(path, body, { signal })` hỗ trợ huỷ ([apiClient.js:33](../dashboard/public/js/core/apiClient.js#L33)) | Modal dùng `AbortController` + `apiClient` |
| `templates-performance-a11y` TC-13 fail từ trước (DOM ban đầu > 1500, do preload mọi template) | Markup modal gọn; ghi số DOM trước/sau vào exit Phase 3 |

---

## 3. Nguyên Tắc Bất Biến

- **INV-1 (0 token):** 19a không gọi AI. Có test tĩnh kiểm tra.
- **INV-2 (Oracle độc lập):** test kiểm CCCD, MST, SĐT bằng danh sách và thuật toán viết tay ngay trong file test (Phụ lục A, B và mục 4.2), không import hằng số từ module đang được kiểm.
- **INV-3 (Dữ liệu tổng hợp):** chỉ dùng cho môi trường test. CCCD, MST đúng cấu trúc vẫn có thể trùng số thật, nên **không** dùng để gọi eKYC hay tra cứu thuế thật. Ghi chú này hiện trong modal và trong JSDoc.
- **INV-4 (Không đường ghi mới):** lưu file chỉ đi qua `POST /api/data/create-dataset`. Endpoint sinh dữ liệu không ghi đĩa.
- **INV-5 (Hiển thị an toàn):** mọi giá trị hiển thị qua `textContent`, không dùng `innerHTML` với dữ liệu sinh ra.
- **INV-6 (Lỗi không mất dữ liệu):** lưu thất bại thì giữ nguyên bản xem trước và tên file để thử lại.

---

## 4. Thiết Kế

### 4.1. Module `core/utils/vnData/` (utils ≤ 150 dòng/file)

| File | Export | Ghi chú |
| --- | --- | --- |
| `seededRandom.js` | `createRng(seed)` → `{ next(), int(min, max), pick(arr) }`; `newSeed()` | mulberry32; seed là chuỗi, băm sang uint32. `int` gồm cả 2 đầu |
| `vnCodes.js` | `CCCD_PROVINCES`, `PHONE_PREFIXES`, `MST_WEIGHTS`, `MST_PREFIXES` | Chỉ dữ liệu (Phụ lục A, B; trọng số mục 4.2) |
| `vnIdentity.js` | `generateCccd(rng, opts)`, `mstCheckDigit(nine)`, `generateMst(rng, opts)`, `generatePhone(rng, opts)` | Quy tắc ở mục 4.2 |
| `vnNames.js` | `generateFullName(rng, { gender, diacritics })`, `toAscii(text)` | Từ điển họ / tên đệm / tên theo giới tính, lưu NFC. `toAscii` bỏ dấu và đổi `đ/Đ` thành `d/D` |
| `edgePayloads.js` | `PAYLOAD_CATEGORIES`, `listPayloads(category?)` | Mục 4.3 |
| `index.js` | `generateRecords({ type, count, seed, options })` → `{ type, count, seed, records }`; `resolveVnPlaceholder(token)`; `VnDataError` (`code`, `field`) | Kiểm tra đầu vào, dựng persona, chống trùng (thử lại tối đa `count × 20` lần, quá thì báo lỗi `field: 'count'`) |

**Kiểu `type`:** `cccd` · `mst` · `phone` · `name` · `persona`.

**Tuỳ chọn (`options`)** — sai thì `VnDataError` kèm `field`:

| Khoá | Áp dụng cho | Giá trị hợp lệ | Mặc định |
| --- | --- | --- | --- |
| `gender` | cccd, name, persona | `any` \| `male` \| `female` | `any` |
| `birthYear` | cccd, persona | số nguyên 1900 … năm hiện tại | ngẫu nhiên, 18–60 tuổi |
| `provinceCode` | cccd, persona | 3 chữ số thuộc Phụ lục A | ngẫu nhiên |
| `carrier` | phone, persona | `any` \| `viettel` \| `vinaphone` \| `mobifone` | `any` |
| `mstKind` | mst | `10` \| `13` | `10` |
| `diacritics` | name, persona | `true` \| `false` | `true` |

**Persona:** `{ fullName, gender, birthDate (YYYY-MM-DD), cccd, phone, email }`. Giới tính, năm sinh và CCCD phải nhất quán với nhau. Email là `<tên-không-dấu>.<họ-không-dấu><2 số cuối năm sinh><số thứ tự>@example.com`, viết thường.

**Placeholder:** `{{vn_cccd}}`, `{{vn_mst}}`, `{{vn_phone}}`, `{{vn_name}}`, `{{vn_email}}`. Token `vn_*` không nhận ra thì giữ nguyên, giống hành vi hiện có.

**Export công khai** (thêm vào `baseExports` của `commonUtils.js`): `generateVnCccd(opts)`, `generateVnMst(opts)`, `generateVnPhone(opts)`, `generateVnFullName(opts)`, `generateVnPersona(opts)`. Mỗi hàm trả 1 giá trị; `opts.seed` là tuỳ chọn.

### 4.2. Quy tắc định danh

- **CCCD (12 số):** `PPP` + `C` + `YY` + `NNNNNN`.
  - `PPP`: mã tỉnh, thuộc Phụ lục A.
  - `C`: thế kỷ + giới tính. Thế kỷ 20 (1900–1999): nam 0, nữ 1. Thế kỷ 21 (2000–2099): nam 2, nữ 3.
  - `YY`: 2 số cuối năm sinh.
  - `NNNNNN`: 6 số ngẫu nhiên.
  - **CCCD không có chữ số kiểm tra.**
- **MST 10 số:** `N1N2` thuộc `MST_PREFIXES` (mặc định `01`, `03`; BA có thể mở rộng), `N3…N9` ngẫu nhiên.
  - `S = Σ Ni × W[i]` với `W = [31, 29, 23, 19, 17, 13, 7, 5, 3]`.
  - `N10 = 10 − (S mod 11)`. Khi `S mod 11 = 0` thì không có chữ số hợp lệ, bỏ số đó và sinh lại.
  - Đã đối chiếu tay với 2 MST công khai: `0100109106` (S = 114, 114 mod 11 = 4, N10 = 6) và `0300588569` (S = 375, 375 mod 11 = 1, N10 = 9).
- **MST 13 số:** `<MST 10 số hợp lệ>-<001…999>`.
- **SĐT (10 số):** `<đầu số 3 chữ số thuộc Phụ lục B>` + 7 số ngẫu nhiên. `any` chọn đều trong 3 nhà mạng. Có chuyển mạng giữ số, nên đầu số chỉ cho biết nhà mạng gốc.

### 4.3. Thư viện payload biên (`edgePayloads.js`)

Mỗi payload có dạng `{ id, category, value, description }`. `id` ổn định, ví dụ `xss-01`.

| Nhóm | Nội dung tối thiểu |
| --- | --- |
| `xss` | `<script>alert(1)</script>`, `<img src=x onerror=alert(1)>`, `"><svg onload=alert(1)>`, `javascript:alert(1)` |
| `sqli` | `' OR '1'='1`, `'; DROP TABLE users;--`, `" OR ""="`, `1' AND SLEEP(5)--` |
| `unicode` | "Nguyễn" dạng NFC và NFD (giống nhau khi normalize, khác bytes); zero-width space U+200B; ZWJ U+200D; NBSP U+00A0; RTL override U+202E; emoji có surrogate pair |
| `whitespace` | Khoảng trắng đầu/cuối, chỉ toàn khoảng trắng, tab, xuống dòng, khoảng trắng toàn khổ U+3000 |
| `length` | Chuỗi dài 255, 256, 1024 ký tự (dựng lúc gọi, không lưu sẵn) |
| `csv-formula` | `=1+1`, `+1+1`, `-1+1`, `@SUM(1,1)`, `=HYPERLINK("http://example.com")` |

### 4.4. API (`dashboard/routes/dataGenerateRoutes.js`, ≤ 150 dòng)

**`POST /api/data/generate`**. Body tối đa 16KB. Không ghi đĩa.

```json
{ "type": "persona", "count": 10, "seed": "demo-1", "options": { "gender": "female", "carrier": "viettel" } }
```

- **200:** `{ "ok": true, "type", "count", "seed", "records": [...], "generatedAt" }`
- **400:** `{ "ok": false, "error": "<tiếng Việt>", "field": "count" }`. Các trường hợp: thiếu hoặc sai `type`; `count` ∉ số nguyên [1, 500] (gồm `0`, `501`, `1.5`, `"10"`, `null`); tuỳ chọn sai (bảng 4.1); body không phải JSON.
- **413:** body > 16KB.

**`GET /api/data/payloads?category=<nhóm|all>`**

- **200:** `{ "ok": true, "categories": [...6], "payloads": [...] }`
- **400:** nhóm không tồn tại.

**`GET /api/data/dynamic-preview`** (đã có, [`dataRoutes.js:152-166`](../dashboard/routes/dataRoutes.js#L152-L166)): thêm các khoá `vn_cccd`, `vn_mst`, `vn_phone`, `vn_name`, `vn_email`. Cách thực hiện: import `resolveVnPlaceholder` từ `core/utils/vnData/index.js` vào `dataRoutes.js`, gọi 5 lần trong handler `dynamic-preview` (+≤ 6 dòng đã khai ở mục 5).

### 4.5. UI — modal "Sinh dữ liệu kiểm thử Việt Nam" (`#/data`)

- **Nút mở:** `#data-vn-gen-open-btn` ("Sinh dữ liệu VN") trong `.view-subnav.data-subnav`, **ngoài** `#data-subnav-actions` (khối này bị ẩn ở chế độ "Tạo mới"), nên hiện ở cả 2 chế độ.
- **Modal:** `dialog#data-vn-gen-modal.app-modal`, theo chuẩn modal ([DASHBOARD_AI_PROMPT.md §3](../ai/dashboard/DASHBOARD_AI_PROMPT.md)): `.app-modal-box` + `.app-modal-body`. Khi mở, focus vào tiêu đề `#data-vn-gen-title`.
- **Chế độ** (`role="tablist"`): "Định danh VN" (`data-vn-mode="identity"`) · "Payload biên" (`data-vn-mode="payload"`).
- **Định danh VN:**
  - Form: `#data-vn-type`, `#data-vn-count` (mặc định 10), `#data-vn-seed`, và các trường tuỳ chọn hiện theo `type` (bảng 4.1).
  - Nút `#data-vn-generate-btn`.
  - Bảng xem trước `#data-vn-preview`: tiêu đề cột dính, cuộn bên trong; kèm dòng "Seed: …".
- **Payload biên:** chọn nhóm `#data-vn-payload-category`, bảng `id | nhóm | giá trị | mô tả | Sao chép`. Giá trị hiển thị monospace; ký tự vô hình hiện kèm nhãn mã (`U+200B`).
- **Chân modal:** `#data-vn-filename`, `#data-vn-save-btn` ("Lưu thành dataset mới"), `#data-vn-copy-btn` ("Sao chép JSON"), `#data-vn-close-btn`. Kèm ghi chú INV-3 một dòng.
- **Trạng thái:**

  | Trạng thái | Hiển thị |
  | --- | --- |
  | Trống | Hướng dẫn |
  | Đang sinh / đang lưu | Nút tắt + spinner; khoá form khi đang lưu |
  | Lỗi | Thông báo `role="alert"`, giữ nguyên bản xem trước |
  | Chưa lưu | Badge "Chưa lưu" |
  | Đã lưu | Toast + tên file trong danh sách bên trái |

- **Chưa lưu (dirty):** có bản ghi định danh chưa lưu và chưa sao chép thành công. Esc, nút Đóng hoặc ✕ khi đang dirty sẽ mở `dialog#data-vn-confirm`. Hộp này dùng `confirmDialog()` với 2 nút "Ở lại" / "Bỏ và đóng".
- **Chống phản hồi muộn:** `const seq = ++this.seq`, và kết quả chỉ được áp khi `this.alive && seq === this.seq`. Đóng modal, đổi `type`/chế độ hoặc `destroy()` đều huỷ request (`AbortController`).
- **Sau khi lưu:** gọi lại hàm nạp danh sách dataset đang dùng (Phase 0 xác định tên hàm legacy) và phát `STUDIO_EVENTS:DATASET_UPDATED`.
- **File JS:**
  - `vnDataGeneratorModal.js` (vòng đời, sự kiện, request, dirty, seq; ≤ 150 dòng)
  - `vnDataPreview.js` (dựng option theo type, bảng xem trước, bảng payload; ≤ 150 dòng)

  Style đặt trong `styles/views/data.css`, chỉ dùng token có sẵn (`--surface`, `--line`, `--accent`, `--muted`, `--text`).

---

## 5. Danh Mục File

| Loại | File | Ngân sách dòng |
| --- | --- | --- |
| Mới | `core/utils/vnData/{seededRandom,vnCodes,vnIdentity,vnNames,edgePayloads,index}.js` | ≤ 150 mỗi file |
| Mới | `core/utils/vnData/{seededRandom,vnIdentity,vnNames,edgePayloads,index}.test.js` | — |
| Mới | `dashboard/routes/dataGenerateRoutes.js` | ≤ 150 |
| Mới | `tests/dashboard-api/data-generate.test.js` | — |
| Mới | `dashboard/public/js/views/data/vnDataGeneratorModal.js`, `vnDataPreview.js` | ≤ 150 mỗi file |
| Mới | `tests/dashboard/data-vn-generator.spec.js`, `data-vn-generator-layout.spec.js` | — |
| Sửa | `core/utils/dataManager.js` (nhánh `default` gọi `resolveVnPlaceholder`) | +≤ 3 |
| Sửa | `core/utils/commonUtils.js` (export mới; D3: `generateRandomVNPhone` dùng bộ sinh mới) | +≤ 8 |
| Sửa | `core/utils/dataManager.test.js`, `core/utils/commonUtils.test.js` (thêm test) | — |
| Sửa | `dashboard/routes/dataRoutes.js` (thêm khoá `vn_*` vào `dynamic-preview`) | +≤ 6 |
| Sửa | `dashboard/server.js` (require + gọi `handleDataGenerateRoutes` trước `handleDataRoutes`) | +2 |
| Sửa | `dashboard/public/templates/data.html` (nút, modal, hộp xác nhận) | — |
| Sửa | `dashboard/public/js/views/data/dataSlice.js` (`init` / `destroy` controller) | +≤ 6 |
| Sửa | `dashboard/public/styles/views/data.css` | — |

---

## 6. Chiến Lược Kiểm Thử — AC → TC

Mỗi TC ứng với đúng 1 test. Level ghi đúng cách test chạy: gọi hàm = `unit`, HTTP = `integration`, Playwright = `e2e` (bài học đóng PLAN-18). ★ = critical (reviewer chạy lại).

### P19A-AC-01 — CCCD đúng cấu trúc, lặp lại được theo seed, không trùng

| TC | Nội dung | Level |
| --- | --- | --- |
| TC-01 | `createRng`: cùng seed → cùng dãy; khác seed → khác; `int(min,max)` ra đủ cả `min` và `max` trong 10.000 lần, không vượt biên | unit |
| TC-02 ★ | 1.000 CCCD (seed cố định): 12 chữ số; `PPP` thuộc danh sách Phụ lục A viết tay trong test; `C` đúng với birthYear 1900, 1999, 2000, 2099 × nam/nữ; không trùng | unit |
| TC-03 | Tuỳ chọn sai trả `VnDataError`: `provinceCode` = `003`, `000`, `097`, `79`; `birthYear` = 1899, năm sau; `gender` = `x`. Mỗi lỗi có `field` đúng | unit |

### P19A-AC-02 — MST 10/13 số đúng checksum

| TC | Nội dung | Level |
| --- | --- | --- |
| TC-04 ★ | Oracle checksum viết tay: `0100109106`, `0300588569` hợp lệ; đổi 1 chữ số thì không hợp lệ; 1.000 MST sinh ra đều qua oracle; không số nào có S mod 11 = 0 | unit |
| TC-05 | MST 13 số khớp `^\d{10}-\d{3}$`, hậu tố 001–999 (không có 000), 10 số đầu qua oracle | unit |

### P19A-AC-03 — SĐT, họ tên, persona nhất quán

| TC | Nội dung | Level |
| --- | --- | --- |
| TC-06 | 1.000 SĐT khớp `^0\d{9}$`, đầu số thuộc Phụ lục B đúng nhà mạng; `carrier` lạ → lỗi | unit |
| TC-07 | Họ tên ở dạng NFC; tên đệm/tên đúng giới tính; `diacritics:false` chỉ còn `[A-Za-z ]`; `Đ` thành `D` | unit |
| TC-08 | Persona: giới tính khớp `C`, năm sinh khớp `YY` và `birthDate`; email `@example.com`, phần trước `@` chỉ ASCII; 500 persona không trùng CCCD/SĐT/email | unit |
| TC-09 | `generateRecords` BVA `count`: 0, 1, 500, 501, 1.5, `"10"`, `null`; `type` lạ; cùng seed → `records` giống hệt; seed edge cases: `""` → `VnDataError`, `"Café"` (unicode) → hành vi xác định, chuỗi 1000 ký tự → hành vi xác định | unit |

### P19A-AC-04 — Payload biên

| TC | Nội dung | Level |
| --- | --- | --- |
| TC-10 | Đủ 6 nhóm; danh sách `id` khớp danh sách viết tay trong test; nhóm `length` dài đúng 255/256/1024; NFC ≠ NFD về bytes nhưng bằng nhau sau `normalize('NFC')` | unit |

### P19A-AC-05 — Dùng được lúc chạy test

| TC | Nội dung | Level |
| --- | --- | --- |
| TC-11 | `resolveDynamicValues` thay đúng 5 placeholder `vn_*` (lồng trong object/array); `{{vn_unknown}}` giữ nguyên; `{{random_phone}}` vẫn như cũ | unit |
| TC-12 | `commonUtils` export 5 hàm mới; `withLocalOverrides` vẫn cho bản local thắng; D3: `generateRandomVNPhone()` ra đầu số thuộc Phụ lục B | unit |
| TC-13 | INV-1: đọc mã nguồn 19a (`core/utils/vnData/*.js`, `dataGenerateRoutes.js`, 2 file view), không có `require`/`import` tới `core/ai` hoặc `/api/ai` | unit |

### P19A-AC-06 — API

| TC | Nội dung | Level |
| --- | --- | --- |
| TC-14 ★ | `POST /api/data/generate` persona 10 với seed → 200, trả seed; gọi lại cùng seed → giống hệt | integration |
| TC-15 ★ | Bảng 400/413: các giá trị `count` ở 4.4, `type` lạ, `provinceCode` `003`, `birthYear` 1899, body không phải JSON, body > 16KB. Mỗi lỗi có `field` | integration |
| TC-16 | `GET /api/data/payloads`: `xss` chỉ trả xss; không truyền → đủ 6 nhóm; nhóm lạ → 400 | integration |
| TC-17 | `GET /api/data/dynamic-preview` có 5 khoá `vn_*` đúng định dạng | integration |
| TC-18 | Sinh không ghi đĩa: danh sách `data/` trước và sau giống nhau; `GET /api/ai/audit` không tăng | integration |

> **Ghi chú concurrent:** Test API ghi file (`TC-19`) dùng tên `plan19a-<workerID>-<ts>` và chạy `--workers=1` để tránh race condition trên `DATA_DIR` cố định.
| TC-19 ★ | LIFE-01: sinh persona → `create-dataset` với `content` → `GET /api/data/dataset` đọc lại y hệt → tạo lại cùng tên bị 400 và file không đổi → xoá | integration |

### P19A-AC-07 — Giao diện

| TC | Nội dung | Level |
| --- | --- | --- |
| TC-20 ★ | UI-02 / LIFE-01: mở `#/data` → "Sinh dữ liệu VN" → CCCD, 10 bản, seed `demo` → 10 dòng đúng regex → lưu `plan19a-e2e-<ts>.json` → file có trong danh sách và trên đĩa → xoá | e2e |
| TC-21 | UI-01: option của `#data-vn-type`, `carrier`, nhóm payload khớp danh sách viết tay ở mục 4.1/4.3 (không đọc từ module) | e2e |
| TC-22 | ASYNC-03: request sinh thứ nhất bị trễ (`page.route`), bấm sinh lần 2 → chỉ hiện kết quả lần 2, phản hồi muộn bị bỏ | e2e |
| TC-23 | ASYNC-02: đổi `type` khi request đang chờ → phản hồi cũ không vẽ vào form mới; request cũ bị huỷ | e2e |
| TC-24 | ASYNC-01: khi đang lưu, form, nút sinh và tên file bị khoá; sau 200, trạng thái sạch và đúng bản đã lưu | e2e |
| TC-25 ★ | ASYNC-04: `create-dataset` trả 400 (trùng tên) → báo lỗi, giữ bản xem trước và tên file → đổi tên → lưu thành công | e2e |
| TC-26 | ASYNC-05: chỉ báo thành công sau 200; route trả 500 → không có toast thành công, badge "Chưa lưu" còn | e2e |
| TC-27 ★ | UI-05: đóng khi dirty → hộp xác nhận; "Ở lại" giữ dữ liệu; "Bỏ và đóng" xoá; sau khi lưu thì đóng không hỏi | e2e |
| TC-28 | UI-04: đổi chế độ nhanh Định danh → Payload → Định danh → chỉ panel định danh hiện, `aria-selected` đúng | e2e |
| TC-29 ★ | OWN-01..04: (a) OWN-01: gọi `init()` 2 lần liên tiếp → listener count không tăng gấp đôi (idempotent); gọi `init()` rồi `init()` với instance khác → mỗi instance có disposer riêng. (b) OWN-02: disposer của lần mount cũ không gỡ được listener của lần mount mới. (c) OWN-03: gọi `destroy()` 2 lần → không lỗi. (d) OWN-04: 20 vòng chuyển `#/data` ↔ view khác, mở modal, bấm sinh 1 lần → đúng 1 request, không tích luỹ listener | e2e |
| TC-30 | OWN-05: rời view khi request sinh đang chờ → phản hồi về không sửa DOM, 0 lỗi console | e2e |
| TC-31 ★ | An toàn hiển thị: xem nhóm `xss` → không có sự kiện `dialog`, không có `img[onerror]` trong DOM, chuỗi hiện đúng nguyên văn | e2e |
| TC-32…39 | UI-03: 1920×1080, 1440×900, 1280×800, 390×844 × Light/Dark. Không tràn ngang; bảng cuộn bên trong; focus tiêu đề khi mở; Esc kích hoạt chặn đóng; 0 lỗi console; không có `undefined`/`null`/TODO trên UI | e2e |

**Cộng:** 7 AC, 39 TC (13 unit, 6 integration, 20 e2e), 10 critical.

---

## 7. Ánh Xạ Gate Scenarios (đủ 16 — cả 4 nhóm `applies: true`)

| Gate | TC | Level tối thiểu |
| --- | --- | --- |
| ASYNC-01 | TC-24 | integration ✓ (e2e) |
| ASYNC-02 | TC-23 | integration ✓ |
| ASYNC-03 | TC-22 | integration ✓ |
| ASYNC-04 | TC-25 | integration ✓ |
| ASYNC-05 | TC-26, TC-19 | integration ✓ |
| OWN-01..04 | TC-29 | integration ✓ |
| OWN-05 | TC-30 | integration ✓ |
| UI-01 | TC-21 | e2e ✓ |
| UI-02 | TC-20 | e2e ✓ |
| UI-03 | TC-32…39 | e2e ✓ |
| UI-04 | TC-28 | e2e ✓ |
| UI-05 | TC-27 | e2e ✓ |
| LIFE-01 | TC-19, TC-20 | integration ✓ |

**Design anchors cho evidence map:**

| Anchor | Vị trí |
| --- | --- |
| `capture_identity` | `const seq = ++this.seq;` |
| `completion_guard` | `if (!this.alive \|\| seq !== this.seq) return;` |
| `disposer_guard` | `if (this.disposed) return;` |
| `registry` | `const MODES` trong `vnDataPreview.js` |
| `inventory` | Mục 4.1/4.3 của file này (`origin: approved_spec`) |

---

## 8. Kế Hoạch Triển Khai (~4 ngày công)

### Phase 0 — Chuẩn bị (0.5 ngày)

- [ ] 0.1 Chốt D1–D6.
- [ ] 0.2 Baseline trên HEAD hiện tại. Ghi số pass/fail và số phần tử DOM ban đầu của TC-13 `templates-performance-a11y`:
  - `node --test core/utils/*.test.js`
  - `npm run test:dashboard:api`
  - `npx playwright test -c playwright.dashboard.config.js`
  - `npm run check:framework`
  - `npm run check:dashboard-features`
- [ ] 0.3 Tìm hàm legacy dùng để nạp lại danh sách dataset sau khi lưu (trong `app.js`, quanh `openDataManager`). Ghi tên hàm vào mục 4.5.
- [ ] 0.4 Soạn `.delivery/phases/plan-19a.json` (7 AC, 39 TC, 16 scenario; chạy `gates/contract.py`) và khung `plan-19a-evidence-map.json`. **BA duyệt hash, không tự duyệt.**
- **Exit:** D1–D6 đã chốt; baseline đã ghi; contract đã nộp duyệt.

### Phase 1 — Lõi sinh dữ liệu (1 ngày)

- [ ] 1.1 Viết `seededRandom.js`, `vnCodes.js`, `vnIdentity.js`, `vnNames.js`, `edgePayloads.js`, `index.js` kèm test colocated (TC-01…TC-10).
- [ ] 1.2 `dataManager.js`: nhánh `default` gọi `resolveVnPlaceholder` (TC-11).
- [ ] 1.3 `commonUtils.js`: 5 export mới; D3 (TC-12). TC-13 (quét import).
- **Exit:**
  - `node --test core/utils/vnData/*.test.js core/utils/dataManager.test.js core/utils/commonUtils.test.js` pass.
  - `npm run check:framework` pass.
  - File mới ≤ 150 dòng, không exemption.

### Phase 2 — API (0.5 ngày)

- [ ] 2.1 Viết `dataGenerateRoutes.js`, đăng ký trong `server.js` trước `handleDataRoutes`; thêm khoá `vn_*` vào `dynamic-preview`.
- [ ] 2.2 Viết `tests/dashboard-api/data-generate.test.js` (TC-14…TC-19). File tạm tên `plan19a-*`, xoá ở `after`.
- **Exit:** `npm run test:dashboard:api` pass (bằng baseline + test mới); `npm run check:dashboard-features` pass.

### Phase 3 — Giao diện (1.5 ngày)

- [ ] 3.1 Markup trong `data.html`: nút, modal, hộp xác nhận; style trong `data.css`.
- [ ] 3.2 Viết `vnDataPreview.js` và `vnDataGeneratorModal.js`; gắn vào `dataSlice.js` (init trước lệnh `return` sớm, destroy trong `unmount`).
- [ ] 3.3 Viết E2E `data-vn-generator.spec.js` (TC-20…TC-31) và `data-vn-generator-layout.spec.js` (TC-32…TC-39).
- **Exit:**
  - Dashboard E2E không có test nào chuyển từ pass sang fail so với baseline.
  - Soát ảnh 4 viewport × 2 theme; 0 lỗi console.
  - DOM ban đầu tăng ≤ 60 phần tử (ghi số cụ thể).
  - Modularity không có vi phạm mới.

### Phase 4 — Gate 4 & bàn giao (0.5 ngày)

- [ ] 4.1 Commit code. Trên HEAD sạch, chạy toàn bộ lệnh ở 0.2.
- [ ] 4.2 `record-gate-run.py` tạo receipt `plan19a-node` và `plan19a-e2e` vào `.gate-artifacts/`. Sau đó `python .delivery/build-phase-evidence.py --map .delivery/phases/plan-19a-evidence-map.json --receipt … --output .gate-artifacts/plan19a-evidence.json`.
- [ ] 4.3 Chạy `verify-gate.py --gate 3|4` cục bộ. Phần chờ người khác:
  - BA duyệt hash;
  - reviewer độc lập điền `reviews.gate3/gate4` và chạy lại 10 TC ★ trên cùng SHA;
  - chạy `master.ps1 gate`.
- [ ] 4.4 `npm run presync:drift:strict` trước khi sync vệ tinh (D3 làm đổi `commonUtils.js`).
- [ ] 4.5 **Kiểm tra ảnh hưởng D3 trên vệ tinh:** `grep -rn 'generateRandomVNPhone\|0[3578]\\d{8}\|prefixes.*09.*03.*07' tests/` trong mỗi repo vệ tinh; liệt kê test bị ảnh hưởng và ghi vào release notes.
- [ ] 4.6 Chỉ ghi bài học mới đã xác nhận vào `ai/dashboard/AI_LESSONS.md`, hoặc `.ai/learning/candidates.md` nếu còn chỗ dưới trần 50 dòng.

---

## 9. Định Nghĩa Hoàn Thành

- [ ] 39/39 TC PASS trong JUnit; 16/16 gate scenario có bằng chứng.
- [ ] CCCD, MST, SĐT qua oracle độc lập; seed tái hiện được; không trùng trong một lần sinh.
- [ ] 0 token: TC-13 và TC-18 pass.
- [ ] Không có đường ghi file mới; lưu chỉ qua `create-dataset`.
- [ ] 4 viewport × 2 theme đã soát; 0 lỗi console; không có vi phạm modularity mới.
- [ ] BA duyệt hash contract; `master.ps1 gate` PASS; có review độc lập và rerun critical.

---

## 10. Rủi Ro Còn Lại

- CCCD, MST hợp lệ về cấu trúc có thể trùng người hoặc doanh nghiệp thật (INV-3). Chỉ dùng cho môi trường test.
- Dải đầu số nhà mạng có thể thay đổi. Phụ lục B cần rà lại khi có thông báo mới; có chuyển mạng giữ số.
- `DATA_DIR` cố định ở thư mục framework: test ghi file chạy song song có thể va nhau. Tên file có timestamp, xoá ở `after`.
- D3 đổi hành vi `generateRandomVNPhone` ở mọi vệ tinh sau khi sync. Test nào hard-code đầu số cũ sẽ lộ ra.
- CarThings vẫn dùng `generateRandomVNIDCard` cục bộ (sai cấu trúc). Đổi sang `generateVnCccd` là việc của repo CarThings.

---

## Phụ Lục A — Mã tỉnh CCCD (63 mã; BA đối chiếu nguồn chính thức ở Phase 0)

`001` Hà Nội · `002` Hà Giang · `004` Cao Bằng · `006` Bắc Kạn · `008` Tuyên Quang · `010` Lào Cai · `011` Điện Biên · `012` Lai Châu · `014` Sơn La · `015` Yên Bái · `017` Hòa Bình · `019` Thái Nguyên · `020` Lạng Sơn · `022` Quảng Ninh · `024` Bắc Giang · `025` Phú Thọ · `026` Vĩnh Phúc · `027` Bắc Ninh · `030` Hải Dương · `031` Hải Phòng · `033` Hưng Yên · `034` Thái Bình · `035` Hà Nam · `036` Nam Định · `037` Ninh Bình · `038` Thanh Hóa · `040` Nghệ An · `042` Hà Tĩnh · `044` Quảng Bình · `045` Quảng Trị · `046` Thừa Thiên Huế · `048` Đà Nẵng · `049` Quảng Nam · `051` Quảng Ngãi · `052` Bình Định · `054` Phú Yên · `056` Khánh Hòa · `058` Ninh Thuận · `060` Bình Thuận · `062` Kon Tum · `064` Gia Lai · `066` Đắk Lắk · `067` Đắk Nông · `068` Lâm Đồng · `070` Bình Phước · `072` Tây Ninh · `074` Bình Dương · `075` Đồng Nai · `077` Bà Rịa – Vũng Tàu · `079` TP. Hồ Chí Minh · `080` Long An · `082` Tiền Giang · `083` Bến Tre · `084` Trà Vinh · `086` Vĩnh Long · `087` Đồng Tháp · `089` An Giang · `091` Kiên Giang · `092` Cần Thơ · `093` Hậu Giang · `094` Sóc Trăng · `095` Bạc Liêu · `096` Cà Mau

## Phụ Lục B — Đầu số di động (3 nhà mạng; BA xác nhận ở Phase 0)

| Nhà mạng | Đầu số |
| --- | --- |
| Viettel | 032, 033, 034, 035, 036, 037, 038, 039, 086, 096, 097, 098 |
| VinaPhone | 081, 082, 083, 084, 085, 088, 091, 094 |
| MobiFone | 070, 076, 077, 078, 079, 089, 090, 093 |
