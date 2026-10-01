# Phase 2 — Chuẩn Hoá AC Given-When-Then & AI Gateway

> **Tác giả Nghiệp vụ:** @ba (phiên init) · **Tác giả Kỹ thuật:** @tl (phiên init) · **Research:** Không áp dụng  
> **Trạng thái:** `DRAFT` · **Cấp độ:** `L3`  

---

## A. Nghiệp Vụ (BA — A/R; Tech Lead — C)

### A1. Mục Tiêu & Phạm Vi Phase
- **In-Scope:**
  - Xây dựng module trích xuất khối AC và kiểm chứng scenario BDD bằng luật thuần (`bddCriteriaRules.js`).
  - Xây dựng AI task kết nối AI Gateway chuẩn hoá AC sang Given-When-Then tiếng Việt (`formatBddCriteria.js`).
  - Triển khai endpoint API HTTP: `POST /api/qa/boundary-matrix` (0 token) và `POST /api/ai/format-bdd`.
  - Giữ nguyên 100% mã định danh AC, cấm AI tự ý sửa mã hoặc tạo AC giả (INV-3, D4).
- **Out-of-Scope:**
  - Không tự động ghi đè nội dung file REQ trên đĩa (người dùng sao chép thủ công, D2).
  - Không triển khai giao diện tab modal (thuộc Phase 3).

### A2. Yêu Cầu & Quy Tắc Nghiệp Vụ Áp Dụng
- `REQ-19B-03`: Bóc tách khối AC, kiểm định cấu trúc kịch bản BDD và xuất Markdown tương thích scanner `tools/qa/lib/sources.js`.
- `REQ-19B-04`: Cung cấp API endpoint HTTP cho tính năng Ma trận biên và Chuẩn hoá BDD có abort signal và chặn cross-site.
- `BR-19B-04`: Giữ nguyên 100% mã định danh AC đầu vào (D4); không đổi mã, không bịa mã; AC mới đề xuất đặt ở mục riêng với `acId: null` (INV-3).
- `BR-19B-05`: Tuyệt đối không trả kết quả giả khi AI lỗi, timeout hoặc sai cấu trúc; trả mã lỗi HTTP 502 kèm chi tiết (INV-4, D5).
- `BR-19B-06`: Giới hạn kích thước dữ liệu đầu vào: BVA ≤ 20.000 ký tự, BDD ≤ 8.000 ký tự; vượt trần trả mã lỗi 413, không cắt ngầm văn bản (D7).

### A3. User Flow & Nhánh Lỗi/Hủy
- Luồng chính: Input văn bản REQ -> Trích danh sách AC -> Xây prompt -> Gọi AI Gateway -> Kiểm tra schema & giữ mã AC -> Sinh Markdown BDD.
- Nhánh lỗi: AI Gateway timeout/lỗi -> Báo lỗi 502 -> Không trả trường markdown; Client huỷ -> Gửi AbortSignal huỷ request.

### A4. Trạng Thái Biên (EDGE-xx)
- `EDGE-19B-03`: Đầu vào không có AC nào hoặc mã AC viết sai quy cách (`AC_8`, `AC_012`) -> cảnh báo warning, không nhận diện là AC hợp lệ.
- `EDGE-19B-04`: Header Origin lạ từ bên ngoài -> Bị chặn 403 bởi middleware bảo mật.

### A5. Tiêu Chí Nghiệm Thu (AC-xx)
- `AC-19B-03`: Endpoint BVA trả kết quả chính xác 0 token và chặn vượt độ dài 413 (dẫn `BR-19B-06`).
- `AC-19B-04`: Endpoint BDD qua Gateway trả kết quả chuẩn và xử lý ngắt/lỗi nghiêm ngặt (dẫn `BR-19B-05`, `BR-19B-06`).
- `AC-19B-05`: Giữ nguyên toàn bộ mã AC đầu vào và chuẩn hoá các bước Given-When-Then (dẫn `BR-19B-04`).
- `AC-19B-06`: Markdown BDD tương thích tuyệt đối với công cụ quét scanner kiểm thử (dẫn `BR-19B-04`).

### A6. Kịch Bản Nghiệm Thu Nghiệp Vụ (UAT-xx) (Bắt buộc cho L2+)
- `UAT-19B-02`:
  - **Mục tiêu nghiệp vụ:** Chuẩn hoá các tiêu chí nghiệm thu tự do sang kịch bản BDD chuẩn mực để phục vụ tự động hoá.
  - **Vai trò / Persona:** Business Analyst.
  - **Dữ liệu tiền đề:** Tài liệu yêu cầu chứa 3 tiêu chí nghiệm thu mẫu (đánh số 1, 2, 3).
  - **Các bước thao tác:** Gửi yêu cầu chuẩn hoá BDD qua API Gateway.
  - **Kết quả mong đợi:** Nhận văn bản Markdown chứa đủ 3 mã AC với các bước Given-When-Then tiếng Việt rõ ràng, giữ nguyên mã AC gốc.
  - **Truy vết:** Dẫn `REQ-19B-03`, `BR-19B-04` và phủ `AC-19B-04`, `AC-19B-05`.

---

## B. Kỹ Thuật (Tech Lead — A/R; BA — C)

### B1. Quyết Định Kỹ Thuật (TECH-xx)
- `TECH-19B-03`: Tách riêng hàm kiểm định cấu trúc BDD thuần `bddCriteriaRules.js` độc lập với task AI (dẫn `REQ-19B-03`, lý do nhằm kiểm thử unit test xác định mà không cần mock AI).
- `TECH-19B-04`: Định vị endpoint tại `dashboard/routes/qaSpecRoutes.js` và `aiFastWinsRoutes.js` (dẫn `REQ-19B-04`, phương án để tuân thủ hạn mức dòng code và kiến trúc modular).

### B2. Bản Đồ File & Ngân Sách Dòng (File Splitting Budget)
| Path | Loại File | Thao Tác (Tạo/Sửa) | Trần Số Dòng | Dự Kiến |
|---|---|:---:|:---:|:---:|
| `core/ai/tasks/bddCriteriaRules.js` | Module | Tạo | 150 | 140 |
| `core/ai/tasks/formatBddCriteria.js` | Module | Tạo | 150 | 140 |
| `core/ai/tasks/index.js` | Module | Sửa | 250 | 60 |
| `dashboard/routes/qaSpecRoutes.js` | Module | Tạo | 100 | 70 |
| `dashboard/routes/aiFastWinsRoutes.js` | Module | Sửa | 250 | 130 |
| `dashboard/server.js` | Module | Sửa | 250 | 220 |
| `core/ai/tasks/bddCriteriaRules.test.js` | Test | Tạo | 800 | 300 |
| `core/ai/tasks/formatBddCriteria.test.js` | Test | Tạo | 800 | 250 |
| `tests/dashboard-api/qa-spec-studio.test.js` | Test | Tạo | 800 | 450 |

### B3. Contract & Schemas
- `POST /api/qa/boundary-matrix`: req `{ requirementText }` -> res `{ ok: true, source: 'rule', constraints, unrecognized }`
- `POST /api/ai/format-bdd`: req `{ requirementText, title? }` -> res `{ ok: true, acIds, scenarios, proposals, openQuestions, markdown }`

### B4. Quản Lý Phụ Thuộc (Dependencies)
- Không có.

### B5. Yêu Cầu Phi Chức Năng (NFR)
- AI Timeout 45s, xử lý AbortSignal kịp thời giải phóng kết nối socket; payload rỗng trả 400 lập tức.

### B6. Rủi Ro Kỹ Thuật & Cách Chặn
- Rủi ro AI tự ý đổi mã AC hoặc sinh AC ma: chặn bằng hàm `validateScenarios` bắt buộc 100% khớp danh sách mã AC đầu vào (D4).

---

## C. Ma Trận Kiểm Thử (BA + Tech Lead; QA — C)

| AC ID | TC ID | Mức (unit/integration/e2e) | Critical? | File Test Dự Kiến | Ca Biên / Ghi Chú |
|---|---|:---:|:---:|---|---|
| `AC-19B-03` | `TC-07` | `integration` | Yes | `tests/dashboard-api/qa-spec-studio.test.js` | BVA API 200, source rule, 0 token AI |
| `AC-19B-03` | `TC-08` | `integration` | No | `tests/dashboard-api/qa-spec-studio.test.js` | 400 khi rỗng, 413 khi > 20.000 ký tự |
| `AC-19B-04` | `TC-09` | `unit` | No | `core/ai/tasks/formatBddCriteria.test.js` | buildBddPrompts chứa luật giữ nguyên mã |
| `AC-19B-04` | `TC-10` | `integration` | Yes | `tests/dashboard-api/qa-spec-studio.test.js` | BDD API 200 với FakeAiProvider |
| `AC-19B-04` | `TC-11` | `integration` | Yes | `tests/dashboard-api/qa-spec-studio.test.js` | Fake provider thiếu AC -> 502 MISSING_AC |
| `AC-19B-04` | `TC-12` | `integration` | No | `tests/dashboard-api/qa-spec-studio.test.js` | Provider 500/timeout -> 502 không markdown |
| `AC-19B-04` | `TC-13` | `integration` | No | `tests/dashboard-api/qa-spec-studio.test.js` | AbortSignal ghi nhận huỷ request |
| `AC-19B-04` | `TC-14` | `integration` | No | `tests/dashboard-api/qa-spec-studio.test.js` | Chặn Origin lạ trả 403 |
| `AC-19B-05` | `TC-15` | `unit` | Yes | `core/ai/tasks/bddCriteriaRules.test.js` | validateScenarios bắt lỗi thiếu/thừa/lặp |
| `AC-19B-05` | `TC-16` | `unit` | No | `core/ai/tasks/bddCriteriaRules.test.js` | extractAcBlocks bóc tách các định dạng AC |
| `AC-19B-06` | `TC-17` | `unit` | No | `core/ai/tasks/bddCriteriaRules.test.js` | renderBddMarkdown xuất đúng Gherkin format |
| `AC-19B-06` | `TC-18` | `integration` | Yes | `tests/dashboard-api/qa-spec-studio.test.js` | Ghép markdown vào REQ fixture, scanner đọc đủ |

---

## D. Phạm Vi Dev Được Tự Quyết (Local Decisions)
- Cấu trúc các log debug nội bộ và thứ tự các helper parsing phụ trợ.

---

## E. Câu Hỏi Mở & Giả Định (Open Questions)
- 0 câu hỏi chặn (zero blocking).

---

## F. Tiêu Chí Ra Phase (Exit Criteria)
- [ ] 12/12 TC (4 unit, 8 integration) PASS.
- [ ] Không có trường hợp nào trả trường `markdown` khi `ok: false`.
- [ ] Zero vi phạm hạn mức dòng file theo quy định.

---

## G. Soát Chéo (Cross-Review Signatures)
- Nghiệp vụ soát bởi Tech Lead: ✔ @tl (phiên init)
- Kỹ thuật soát bởi BA (không đổi nghiệp vụ): ✔ @ba (phiên init)

---

## H. Nhật Ký Thay Đổi Kế Hoạch (Plan Deviation Requests - PDR)
| PDR ID | Loại (BUSINESS / TECH) | Nội Dung Plan Gốc | Đề Xuất Thực Tế | Ảnh Hưởng (AC / File) | Trạng Thái (PENDING / APPROVED / REJECTED) |
|---|:---:|---|---|---|:---:|

---

## I. Bằng Chứng Thực Nghiệm (Evidence Block)
_(Chờ thực thi Phase 2)_
