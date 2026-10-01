# Phase 1 — Lõi Trích Ràng Buộc & Ma Trận Giá Trị Biên (0 Token)

> **Tác giả Nghiệp vụ:** @ba (phiên init) · **Tác giả Kỹ thuật:** @tl (phiên init) · **Research:** Không áp dụng  
> **Trạng thái:** `DRAFT` · **Cấp độ:** `L3`  

---

## A. Nghiệp Vụ (BA — A/R; Tech Lead — C)

### A1. Mục Tiêu & Phạm Vi Phase
- **In-Scope:**
  - Xây dựng module trích xuất ràng buộc số nguyên và độ dài chuỗi từ câu đặc tả tiếng Việt/Anh chuẩn NFC (`qaBoundaryExtract.js`).
  - Xây dựng module sinh ma trận phân vùng tương đương (EP) và 7 điểm giá trị biên (BVA) xác định (`qaBoundaryMatrix.js`).
  - Đảm bảo 100% không sử dụng AI (0 token, tuân thủ nguyên tắc bất biến INV-1).
  - Vượt qua kiểm thử 34 câu corpus dương tính (Phụ lục A) và 10 câu corpus âm tính (Phụ lục B).
- **Out-of-Scope:**
  - Không gọi AI Gateway (thuộc Phase 2).
  - Không tạo endpoint API hoặc giao diện UI (thuộc Phase 2 và Phase 3).
  - Các định dạng số thập phân, tiền tệ, ngày giờ đưa vào danh sách `unrecognized`, không sinh số đoán.

### A2. Yêu Cầu & Quy Tắc Nghiệp Vụ Áp Dụng
- `REQ-19B-01`: Trích xuất ràng buộc số nguyên và độ dài chuỗi từ câu đặc tả tiếng Việt/Anh chuẩn NFC.
- `REQ-19B-02`: Tính toán ma trận phân vùng tương đương và các điểm biên xác định (7 điểm cho khoảng 2 phía).
- `BR-19B-01`: BVA chạy hoàn toàn bằng luật xác định, tốn 0 token AI (INV-1); câu không khớp mẫu thì đưa vào `unrecognized`, tuyệt đối không đoán số (INV-2).
- `BR-19B-02`: Chuẩn hoá văn bản trước khi trích xuất (NFC, dấu khoảng trắng, ký hiệu `≥ ≤ – —`), xử lý dấu phân cách hàng nghìn (`1.000` -> 1000).
- `BR-19B-03`: Quy chuẩn 7 điểm biên hai phía $[a, b]$: $a-1$ (sai), $a$ (đúng), $a+1$ (đúng), nominal (đúng), $b-1$ (đúng), $b$ (đúng), $b+1$ (sai); với `length` không sinh giá trị âm.

### A3. User Flow & Nhánh Lỗi/Hủy
- Luồng chính: Input văn bản -> Tách dòng & câu -> Loại trừ mẫu không áp dụng -> Khớp regex -> Sinh constraint -> Sinh ma trận biên -> Trả kết quả.
- Nhánh lỗi: Câu chứa từ phủ định/lỗi -> Bật cờ `needsReview: true`; văn bản rỗng -> trả mảng rỗng.

### A4. Trạng Thái Biên (EDGE-xx)
- `EDGE-19B-01`: Ràng buộc một phía (chỉ min hoặc chỉ max) bổ sung giá trị 0 ngầm định (`implicitMin: true`) cho trường kiểu độ dài.
- `EDGE-19B-02`: Ràng buộc đúng $n$ chữ số sinh 3 điểm biên $n-1$, $n$, $n+1$.

### A5. Tiêu Chí Nghiệm Thu (AC-xx)
- `AC-19B-01`: Trích ràng buộc chính xác trên 34 câu corpus dương tính và 10 câu âm tính (dẫn `BR-19B-01`, `BR-19B-02`).
- `AC-19B-02`: Sinh đầy đủ ma trận phân vùng và 7 điểm biên cho các loại ràng buộc (dẫn `BR-19B-03`).

### A6. Kịch Bản Nghiệm Thu Nghiệp Vụ (UAT-xx) (Bắt buộc cho L2+)
- `UAT-19B-01`:
  - **Mục tiêu nghiệp vụ:** Xác minh khả năng phân tích giá trị biên tự động 0 token từ tài liệu nghiệp vụ.
  - **Vai trò / Persona:** Senior QA Engineer / Business Analyst.
  - **Dữ liệu tiền đề:** Đoạn văn bản đặc tả gồm điều kiện độ tuổi từ 18 đến 60 và mật khẩu 8 đến 32 ký tự.
  - **Các bước thao tác:** Gọi hàm phân tích biên với văn bản đặc tả mẫu.
  - **Kết quả mong đợi:** Nhận diện đúng 2 trường dữ liệu, mỗi trường có đủ 7 điểm biên phân vùng hợp lệ/không hợp lệ.
  - **Truy vết:** Dẫn `REQ-19B-01`, `BR-19B-01` và phủ `AC-19B-01`, `AC-19B-02`.

---

## B. Kỹ Thuật (Tech Lead — A/R; BA — C)

### B1. Quyết Định Kỹ Thuật (TECH-xx)
- `TECH-19B-01`: Áp dụng regex nhiều tầng kết hợp chuẩn hoá NFC để trích xuất ràng buộc tiếng Việt (dẫn `REQ-19B-01`, lý do vì giải thuật thuần đạt thời gian thực thi < 1ms và không tốn token AI).
- `TECH-19B-02`: Thiết lập 7 điểm biên xác định cho khoảng hai phía và khử trùng lặp (dẫn `REQ-19B-02`, phương án nhằm tối ưu độ phủ kiểm thử biên theo tiêu chuẩn ISTQB).

### B2. Bản Đồ File & Ngân Sách Dòng (File Splitting Budget)
| Path | Loại File | Thao Tác (Tạo/Sửa) | Trần Số Dòng | Dự Kiến |
|---|---|:---:|:---:|:---:|
| `dashboard/services/qaBoundaryExtract.js` | Service | Tạo | 200 | 180 |
| `dashboard/services/qaBoundaryMatrix.js` | Service | Tạo | 200 | 170 |
| `dashboard/services/qaBoundaryExtract.test.js` | Test | Tạo | 800 | 350 |
| `dashboard/services/qaBoundaryMatrix.test.js` | Test | Tạo | 800 | 250 |

### B3. Contract & Schemas
- `extractConstraints(text)`: `{ constraints: Array<Constraint>, unrecognized: Array<{line, text}> }`
- `buildMatrix(constraint)`: `{ partitions: Array, values: Array, invalidTypes: Array }`

### B4. Quản Lý Phụ Thuộc (Dependencies)
- Không có.

### B5. Yêu Cầu Phi Chức Năng (NFR)
- Thời gian phản hồi < 5ms cho văn bản 20.000 ký tự; tiêu thụ bộ nhớ bổ sung < 2MB.

### B6. Rủi Ro Kỹ Thuật & Cách Chặn
- Rủi ro câu điều kiện phủ định làm đảo chiều biên: chặn bằng cờ `needsReview: true` để người dùng rà soát lại (D1).

---

## C. Ma Trận Kiểm Thử (BA + Tech Lead; QA — C)

| AC ID | TC ID | Mức (unit/integration/e2e) | Critical? | File Test Dự Kiến | Ca Biên / Ghi Chú |
|---|---|:---:|:---:|---|---|
| `AC-19B-01` | `TC-01` | `unit` | Yes | `dashboard/services/qaBoundaryExtract.test.js` | 34 câu corpus dương tính Phụ lục A |
| `AC-19B-01` | `TC-02` | `unit` | Yes | `dashboard/services/qaBoundaryExtract.test.js` | 10 câu corpus âm tính Phụ lục B |
| `AC-19B-01` | `TC-03` | `unit` | No | `dashboard/services/qaBoundaryExtract.test.js` | Đa dòng, chuẩn hoá NFC, dấu nghìn 1.000 |
| `AC-19B-02` | `TC-04` | `unit` | Yes | `dashboard/services/qaBoundaryMatrix.test.js` | Khoảng 2 phía [18,60], khử trùng [1,2] |
| `AC-19B-02` | `TC-05` | `unit` | No | `dashboard/services/qaBoundaryMatrix.test.js` | Một phía: max 50 (implicit 0), min 8 |
| `AC-19B-02` | `TC-06` | `unit` | No | `dashboard/services/qaBoundaryMatrix.test.js` | invalidTypes theo kind và sample string |

---

## D. Phạm Vi Dev Được Tự Quyết (Local Decisions)
- Cấu trúc các biến regex phụ và thứ tự stopwords tiếng Việt.

---

## E. Câu Hỏi Mở & Giả Định (Open Questions)
- 0 câu hỏi chặn (zero blocking).

---

## F. Tiêu Chí Ra Phase (Exit Criteria)
- [ ] 6/6 TC unit tests PASS trên `node --test`.
- [ ] 100% corpus A (34 câu) và corpus B (10 câu) đạt kỳ vọng.
- [ ] Không có file nào vượt trần số dòng quy định.

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
_(Chờ thực thi Phase 1)_
