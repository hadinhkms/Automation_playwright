# Phase 19a — Bộ Sinh Dữ Liệu Kiểm Thử Việt Nam & Thư Viện Payload Biên

> **Tác giả Nghiệp vụ:** @ba (phiên init) · **Tác giả Kỹ thuật:** @tl (phiên init) · **Research:** RES-01  
> **Trạng thái:** `COMPLETED` · **Cấp độ:** `L2`  

---

## A. Nghiệp Vụ (BA — A/R; Tech Lead — C)

### A1. Mục Tiêu & Phạm Vi Phase
- **In-Scope:**
  - Xây dựng module sinh dữ liệu định danh Việt Nam hoàn toàn bằng thuật toán xác định (seeded PRNG Mulberry32): CCCD 12 số, MST doanh nghiệp (10 số) và đơn vị phụ thuộc (13 số), Số điện thoại (10 số), Họ tên tiếng Việt chuẩn NFC, và Persona nhất quán.
  - Xây dựng thư viện 6 nhóm payload kiểm thử biên (XSS, SQLi, Unicode, Whitespace, Length, CSV Formula) với ID ổn định.
  - Tích hợp 5 placeholder động `{{vn_cccd}}`, `{{vn_mst}}`, `{{vn_phone}}`, `{{vn_name}}`, `{{vn_email}}` vào `resolveDynamicValues` và export các hàm tiện ích sang `commonUtils`.
  - Triển khai endpoints API: `POST /api/data/generate`, `GET /api/data/payloads`, cập nhật `GET /api/data/dynamic-preview`.
  - Triển khai giao diện Test Data Studio (`#/data`): Modal "Sinh dữ liệu VN" với 2 tab (Định danh VN & Payload biên), hỗ trợ xem trước, sao chép JSON và lưu thành dataset mới.
- **Out-of-Scope:**
  - Tuyệt đối không sử dụng AI (0 token, tuân thủ nguyên tắc INV-1).
  - Không tạo endpoint ghi đĩa mới; việc lưu trữ chỉ sử dụng endpoint `create-dataset` có sẵn (INV-4).
  - Không sửa `core/local/commonUtils.local.js` thuộc phạm vi repo dự án vệ tinh CarThings.
  - Ma trận biên tự động (BVA Matrix) và chuẩn hóa BDD Specification thuộc phạm vi PLAN-19b.

### A2. Yêu Cầu & Quy Tắc Nghiệp Vụ Áp Dụng
- `REQ-19A-01`: Bộ sinh định danh Việt Nam bằng thuật toán thuần bao gồm CCCD 12 số, MST 10/13 số, SĐT 10 số, Họ tên NFC và Persona nhất quán.
- `REQ-19A-02`: Thư viện 6 nhóm payload kiểm thử biên có ID ổn định, hiển thị an toàn và cho phép sao chép nhanh vào clipboard.
- `REQ-19A-03`: Tích hợp các placeholder `{{vn_*}}` vào hệ thống dataset sẵn có và mở rộng bộ export tiện ích của `commonUtils`.
- `REQ-19A-04`: Giao diện modal Test Data Studio tại view `#/data` hỗ trợ chọn tham số, xem trước trực quan, kiểm soát dirty guard và lưu dataset mới.
- `BR-19A-01`: Quy chuẩn định danh CCCD 12 số tuân thủ danh mục 63 mã tỉnh (Phụ lục A), mã thế kỷ/giới tính (Thế kỷ 20: Nam 0, Nữ 1; Thế kỷ 21: Nam 2, Nữ 3) và 2 chữ số năm sinh; CCCD không có chữ số kiểm tra checksum.
- `BR-19A-02`: Thuật toán checksum MST 10 số áp dụng vector trọng số `W = [31, 29, 23, 19, 17, 13, 7, 5, 3]` với công thức $N_{10} = 10 - (S \bmod 11)$, loại bỏ trường hợp $S \bmod 11 = 0$; MST 13 số có định dạng `<MST10>-<001..999>`. Theo TT 86/2024/TT-BTC, cá nhân dùng số CCCD làm MST nên không sinh loại MST cá nhân riêng.
- `BR-19A-03`: Tính xác định & Chống trùng lặp (Determinism & Uniqueness): Cùng `seed` và tham số đầu vào bắt buộc sinh ra dữ liệu giống hệt nhau; không trùng giá trị định danh trong cùng một lần sinh; seed rỗng hoặc không truyền thì server tự sinh và trả về client.
- `BR-19A-04`: An toàn dữ liệu & 0 Token AI (INV-1..6): 100% mã nguồn không import `core/ai`; dữ liệu chỉ dùng cho môi trường test (INV-3); mọi giá trị hiển thị trên UI bằng `textContent` chống XSS (INV-5); lưu trữ chỉ qua `create-dataset` (INV-4).
- `BR-19A-05`: Quản lý trạng thái & Vòng đời giao diện (UI Lifecycle): Hiển thị dirty guard cảnh báo khi đóng modal với dữ liệu chưa lưu; khóa form và hiển thị spinner khi đang xử lý; áp dụng sequence counter (`seq`) và `AbortController` triệt tiêu late response.

### A3. User Flow & Nhánh Lỗi/Hủy
- Luồng chính (Happy Path):
  1. Người dùng truy cập view `#/data`, bấm nút "Sinh dữ liệu VN" (`#data-vn-gen-open-btn`).
  2. Modal hiển thị, tự động focus vào tiêu đề, mặc định mở tab "Định danh VN".
  3. Người dùng chọn loại dữ liệu (`type`), số lượng (`count` từ 1..500), nhập `seed` tùy chọn và các bộ lọc (giới tính, nhà mạng, tỉnh thành).
  4. Bấm "Sinh dữ liệu" -> Gửi request tới `POST /api/data/generate` -> Hiển thị bảng xem trước kèm thông tin `seed`.
  5. Người dùng nhập tên file dataset và bấm "Lưu thành dataset mới" (hoặc bấm "Sao chép JSON").
  6. Dataset được tạo thành công qua `POST /api/data/create-dataset`, toast thông báo hiển thị, danh sách dataset bên trái tự động làm mới.
- Luồng rẽ nhánh & xử lý lỗi (Alternative / Error Path):
  - Người dùng nhập tham số sai (ví dụ: `count = 0` hoặc `501`, mã tỉnh không tồn tại) -> Server trả lỗi 400 kèm trường `field`, giao diện hiển thị thông báo lỗi `role="alert"` và highlight trường vi phạm.
  - Người dùng bấm Esc hoặc nút Đóng khi có dữ liệu chưa lưu -> Hiển thị hộp thoại xác nhận `confirmDialog` ("Ở lại" để tiếp tục, "Bỏ và đóng" để hủy thay đổi).
  - Lưu trùng tên dataset -> Endpoint trả về 400, modal giữ nguyên dữ liệu xem trước và tên file để người dùng sửa tên và lưu lại mà không bị mất dữ liệu.
  - Người dùng chuyển nhanh giữa các tab hoặc đóng modal trong lúc request đang bay -> Kích hoạt `AbortController.abort()`, sequence counter bỏ qua kết quả muộn, không render lỗi vào DOM.

### A4. Trạng Thái Biên (EDGE-xx)
- `EDGE-19A-01`: Tham số `count` chạm biên tối đa 500 bản ghi hoặc tối thiểu 1 bản ghi -> Render mượt mà, bộ nhớ không vượt quá 100KB, không có giá trị trùng lặp.
- `EDGE-19A-02`: Tham số `seed` chứa chuỗi Unicode đặc biệt (ví dụ: `"Café"`) hoặc chuỗi dài 1000 ký tự -> Hàm băm seed chuyển đổi an toàn sang uint32 mà không văng lỗi ngoại lệ.
- `EDGE-19A-03`: Xem nhóm payload `xss` hoặc `unicode` trong tab Payload biên -> Render nguyên văn chuỗi bằng `textContent`, không kích hoạt `alert(1)`, ký tự vô hình hiển thị kèm mã nhận diện `U+200B`.
- `EDGE-19A-04`: Mạng trễ hoặc người dùng bấm "Sinh dữ liệu" liên tiếp -> Kỹ thuật sequence counter (`seq`) chỉ vẽ kết quả của lần bấm cuối cùng, triệt tiêu race condition.

### A5. Tiêu Chí Chấp Nhận (AC-xx)
- `AC-19A-01`: Sinh CCCD 12 số đúng cấu trúc 63 tỉnh thành, thế kỷ/giới tính và năm sinh; vượt qua bộ kiểm tra oracle độc lập (kiểm chứng `BR-19A-01`, `BR-19A-03`).
- `AC-19A-02`: Sinh MST 10 số và 13 số thỏa mãn công thức checksum vector trọng số; kiểm tra chính xác với các MST công khai (kiểm chứng `BR-19A-02`, `BR-19A-03`).
- `AC-19A-03`: Sinh SĐT đúng đầu số 3 nhà mạng lớn, họ tên chuẩn NFC và Persona liên kết nhất quán giữa CCCD/năm sinh/giới tính/email (kiểm chứng `BR-19A-01`, `BR-19A-03`).
- `AC-19A-04`: Thư viện 6 nhóm payload biên đầy đủ danh mục, hiển thị an toàn và cho phép sao chép (kiểm chứng `BR-19A-04`).
- `AC-19A-05`: Tích hợp 5 placeholder `{{vn_*}}` vào `resolveDynamicValues` và export 5 hàm tiện ích sang `commonUtils` với 0 token AI (kiểm chứng `BR-19A-04`).
- `AC-19A-06`: API endpoints xử lý chính xác các trường hợp biên, từ chối tham số không hợp lệ với mã 400/413 và không ghi đĩa tùy tiện (kiểm chứng `BR-19A-03`, `BR-19A-04`).
- `AC-19A-07`: Giao diện modal Test Data Studio đáp ứng đầy đủ dirty guard, sequence guard, phím tắt Esc/Tab, responsive 4 viewports và vòng đời sạch (kiểm chứng `BR-19A-04`, `BR-19A-05`).

### A6. Kịch Bản UAT (UAT-xx)
- `UAT-19A-01`: Kiểm thử luồng sinh 10 bản ghi Persona, kiểm tra tính nhất quán giữa CCCD, giới tính và email, sau đó lưu thành dataset mới và kiểm tra sự xuất hiện trên giao diện (dẫn `REQ-19A-01`, `REQ-19A-04`, `BR-19A-01`, `BR-19A-03`, `BR-19A-05`).
- `UAT-19A-02`: Kiểm thử tra cứu và sao chép payload biên XSS/Unicode trên giao diện modal, xác nhận nội dung dán vào đúng nguyên văn và không gây lỗi thực thi script (dẫn `REQ-19A-02`, `REQ-19A-04`, `BR-19A-04`).
- `UAT-19A-03`: Kiểm thử khả năng tái lập dữ liệu nhờ Seed trong test script tự động sử dụng placeholder `{{vn_cccd}}` và hàm `generateVnCccd` (dẫn `REQ-19A-03`, `BR-19A-03`, `BR-19A-04`).

---

## B. Kỹ Thuật (Tech Lead — A/R; BA — C)

### B1. Quyết Định Kỹ Thuật (TECH-xx)
- `TECH-19A-01`: Sử dụng thuật toán Mulberry32 làm bộ sinh số giả ngẫu nhiên theo seed (PRNG) nhằm đảm bảo tính xác định (determinism) và tốc độ thực thi cao (dẫn `REQ-19A-01`, `BR-19A-03`, `IMP-19A-02`). Lý do: Phương án PRNG thuần Javascript hoạt động nhất quán giữa Node.js và trình duyệt mà không cần cài đặt thêm thư viện phụ thuộc bên ngoài.
- `TECH-19A-02`: Phân rã mã nguồn thành các module chuyên biệt dưới thư mục `core/utils/vnData/` với trần số dòng $\le 150$ dòng/file nhằm tuân thủ nghiêm ngặt quy định kiến trúc modular (dẫn `REQ-19A-01`, `BR-19A-04`, `IMP-19A-01`). Lý do: Đảm bảo tính đơn nhiệm cho từng module (RNG, danh mục mã, thuật toán định danh, từ điển tên, payload biên), giúp việc kiểm thử bằng oracle độc lập đạt độ tin cậy tuyệt đối.
- `TECH-19A-03`: Tái sử dụng luồng lưu trữ có sẵn `POST /api/data/create-dataset` cho chức năng lưu dataset từ modal nhằm bảo đảm an toàn tệp tin (dẫn `REQ-19A-04`, `BR-19A-04`, `IMP-19A-03`). Lý do: Phương án này tận dụng trọn vẹn cơ chế kiểm tra trùng lặp, sao lưu tệp và kiểm soát kích thước dữ liệu sẵn có của Hub mà không mở thêm bề mặt tấn công ghi đĩa mới.
- `TECH-19A-04`: Áp dụng cơ chế Sequence Counter (`seq`) kết hợp `AbortController` trong `vnDataGeneratorModal.js` nhằm triệt tiêu hoàn toàn race condition và phản hồi muộn (dẫn `REQ-19A-04`, `BR-19A-05`, `IMP-19A-04`). Lý do: Giúp giao diện luôn giữ trạng thái đồng bộ chuẩn xác với hành động mới nhất của người dùng khi chuyển tab hoặc yêu cầu sinh dữ liệu liên tục.

### B2. Bản Đồ File & Ngân Sách Dòng

| Path | Loại File | Trần Số Dòng | Ghi Chú |
|---|---|:---:|---|
| `core/utils/vnData/seededRandom.js` | utils | 150 | Thuật toán Mulberry32 PRNG và hàm tạo seed |
| `core/utils/vnData/vnCodes.js` | utils | 150 | Danh mục 63 mã tỉnh, đầu số SĐT, trọng số MST |
| `core/utils/vnData/vnIdentity.js` | utils | 150 | Thuật toán sinh CCCD, checksum MST, sinh SĐT |
| `core/utils/vnData/vnNames.js` | utils | 150 | Từ điển họ tên tiếng Việt NFC và hàm toAscii |
| `core/utils/vnData/edgePayloads.js` | utils | 150 | Danh mục 6 nhóm payload kiểm thử biên |
| `core/utils/vnData/index.js` | utils | 150 | Điều phối sinh dữ liệu, Persona, resolve placeholder |
| `core/utils/vnData/seededRandom.test.js` | test | 400 | Unit test kiểm thử PRNG Mulberry32 |
| `core/utils/vnData/vnIdentity.test.js` | test | 600 | Unit test định danh CCCD, MST, SĐT kèm oracle |
| `core/utils/vnData/vnNames.test.js` | test | 400 | Unit test họ tên NFC, chuẩn hóa không dấu |
| `core/utils/vnData/edgePayloads.test.js` | test | 400 | Unit test danh mục payload biên và tính bất biến |
| `core/utils/vnData/index.test.js` | test | 600 | Unit test Persona, tính chống trùng lặp, placeholder |
| `dashboard/routes/dataGenerateRoutes.js` | module | 150 | Route API sinh dữ liệu và truy vấn payload biên |
| `tests/dashboard-api/data-generate.test.js` | test | 600 | Integration test kiểm thử các API endpoints mới |
| `dashboard/public/js/views/data/vnDataGeneratorModal.js` | component | 150 | Controller quản lý modal, vòng đời, dirty guard |
| `dashboard/public/js/views/data/vnDataPreview.js` | component | 150 | Component render bảng xem trước và payload biên |
| `tests/dashboard/data-vn-generator.spec.js` | test | 800 | E2E functional tests Playwright cho modal |
| `tests/dashboard/data-vn-generator-layout.spec.js` | test | 800 | E2E layout tests (4 viewports, Light/Dark, a11y) |
| `core/utils/dataManager.js` | utils | 150 | Tích hợp nhánh default resolveVnPlaceholder (+≤3 dòng) |
| `core/utils/commonUtils.js` | utils | 150 | Export các hàm sinh dữ liệu VN và D3 (+≤8 dòng) |
| `core/utils/dataManager.test.js` | test | 500 | Bổ sung unit test cho placeholder vn_* |
| `core/utils/commonUtils.test.js` | test | 500 | Bổ sung unit test cho export vnData mới |
| `dashboard/routes/dataRoutes.js` | module | 200 | Bổ sung các khóa vn_* vào dynamic-preview (+≤6 dòng) |
| `dashboard/server.js` | module | 250 | Đăng ký route dataGenerateRoutes (+2 dòng) |
| `dashboard/public/js/views/data/dataSlice.js` | component | 150 | Gắn controller modal vào view dataSlice (+≤6 dòng) |
| `dashboard/public/templates/data.html` | component | 150 | Thêm markup nút mở và dialog modal sinh dữ liệu |
| `dashboard/public/styles/views/data.css` | component | 150 | Định kiểu CSS cho modal và bảng xem trước |

### B3. Schemas & Hợp Đồng Dữ Liệu
- **Request `POST /api/data/generate`**:
  ```json
  {
    "type": "persona",
    "count": 10,
    "seed": "alpha-01",
    "options": {
      "gender": "female",
      "carrier": "viettel",
      "provinceCode": "001",
      "birthYear": 1995,
      "diacritics": true
    }
  }
  ```
- **Response 200 Success**:
  ```json
  {
    "ok": true,
    "type": "persona",
    "count": 10,
    "seed": "alpha-01",
    "records": [
      {
        "fullName": "Nguyễn Thị Mai",
        "gender": "female",
        "birthDate": "1995-06-15",
        "cccd": "001195000123",
        "phone": "0981234567",
        "email": "mai.nguyen9501@example.com"
      }
    ],
    "generatedAt": "2026-10-01T21:00:00.000Z"
  }
  ```
- **Response 400 Error**:
  ```json
  {
    "ok": false,
    "error": "Tham số count không hợp lệ (phải từ 1 đến 500)",
    "field": "count"
  }
  ```

### B4. Yêu Cầu Phi Chức Năng (NFR) & Phụ Thuộc
- NFR-01: Hiệu năng sinh dữ liệu: 500 bản ghi sinh trong thời gian dưới 50ms, bộ nhớ sử dụng dưới 100KB (dẫn `IMP-19A-01`).
- NFR-02: Hoàn toàn không sử dụng mô hình AI và không thêm thư viện ngoài (0 token AI, 0 npm dependencies) (dẫn `IMP-19A-02`).
- NFR-03: Tuân thủ quy chuẩn định danh Việt Nam và Thông tư 86/2024/TT-BTC về quản lý mã số thuế (dẫn `RES-01`).
- NFR-04: An toàn bảo mật: Dữ liệu hiển thị an toàn bằng textContent, phòng chống triệt để XSS và CSV Injection (dẫn `IMP-19A-03`).
- NFR-05: Khả năng tiếp cận: Đạt chuẩn WCAG 2.1 AA, hỗ trợ đầy đủ điều hướng phím Tab/Esc và thuộc tính ARIA (dẫn `IMP-19A-04`).

### B5. Điểm Nóng Rủi Ro & Biện Pháp Kiểm Soát
- **Nguy cơ trùng lặp PII thật:** Dữ liệu dù hợp lệ về cấu trúc vẫn có thể trùng số thật. Kiểm soát: Đặt cảnh báo INV-3 rõ ràng trên UI và JSDoc, email cố định tên miền `@example.com` theo RFC 2606.
- **Race Condition & Phản hồi muộn:** Người dùng bấm liên tiếp hoặc mạng chập chờn. Kiểm soát: Khóa nút sinh khi đang xử lý và dùng Sequence Counter + AbortController.
- **Xung đột tệp tin tạm trong `DATA_DIR`:** Khi test API/E2E chạy song song. Kiểm soát: Đặt tên tệp theo mẫu `plan19a-<timestamp>-<rand>.json` và dọn dẹp ở hook `after`.
- **Vi phạm ngân sách số dòng mã:** Thêm code vào các tệp có sẵn. Kiểm soát: Tuân thủ nghiêm ngặt chỉ tiêu dòng ghi trong §B2, tách toàn bộ logic mới vào thư mục `core/utils/vnData/`.

### B6. Bản Đồ Không Gian Trạng Thái
- Modal States: `CLOSED` $\rightarrow$ `OPEN_EMPTY` $\rightarrow$ `GENERATING` $\rightarrow$ `PREVIEW_DIRTY` $\rightarrow$ `SAVING` $\rightarrow$ `SAVED` $\rightarrow$ `CLOSED`.
- Dirty State Guard: Nếu `state == PREVIEW_DIRTY`, sự kiện đóng modal kích hoạt `CONFIRM_DIALOG` ("Ở lại" giữ nguyên trạng thái, "Bỏ và đóng" chuyển về `CLOSED`).

---

## C. Chiến Lược Kiểm Thử (BA + Tech Lead; QA — C)

| AC ID | TC ID | Mức (unit/integration/e2e) | Critical? | File Test Dự Kiến | Ca Biên / Ghi Chú |
|---|---|:---:|:---:|---|---|
| `AC-19A-01` | `TC-01` | unit | No | `core/utils/vnData/seededRandom.test.js` | PRNG Mulberry32: cùng seed ra cùng dãy, biên min/max |
| `AC-19A-01` | `TC-02` | unit | Yes | `core/utils/vnData/vnIdentity.test.js` | 1.000 CCCD qua oracle 63 tỉnh và mã thế kỷ/giới tính |
| `AC-19A-01` | `TC-03` | unit | No | `core/utils/vnData/vnIdentity.test.js` | Tùy chọn CCCD sai trả về VnDataError kèm tên trường field |
| `AC-19A-02` | `TC-04` | unit | Yes | `core/utils/vnData/vnIdentity.test.js` | 1.000 MST 10 số qua oracle checksum; kiểm tra 2 MST công khai |
| `AC-19A-02` | `TC-05` | unit | No | `core/utils/vnData/vnIdentity.test.js` | MST 13 số định dạng NNNNNNNNNN-NNN, hậu tố 001-999 |
| `AC-19A-03` | `TC-06` | unit | No | `core/utils/vnData/vnIdentity.test.js` | 1.000 SĐT khớp 10 số và thuộc danh mục đầu số 3 nhà mạng |
| `AC-19A-03` | `TC-07` | unit | No | `core/utils/vnData/vnNames.test.js` | Họ tên chuẩn NFC, tên đệm đúng giới tính, toAscii chuyển Đ sang D |
| `AC-19A-03` | `TC-08` | unit | No | `core/utils/vnData/index.test.js` | Persona liên kết nhất quán CCCD/năm sinh/email, 500 bản ghi không trùng |
| `AC-19A-03` | `TC-09` | unit | No | `core/utils/vnData/index.test.js` | BVA tham số count (0, 1, 500, 501), seed Unicode đặc biệt |
| `AC-19A-04` | `TC-10` | unit | No | `core/utils/vnData/edgePayloads.test.js` | 6 nhóm payload biên đầy đủ ID, Unicode NFC vs NFD, chuỗi độ dài |
| `AC-19A-05` | `TC-11` | unit | No | `core/utils/dataManager.test.js` | resolveDynamicValues thay thế đúng 5 placeholder vn_* lồng nhau |
| `AC-19A-05` | `TC-12` | unit | No | `core/utils/commonUtils.test.js` | commonUtils export 5 hàm mới và cập nhật generateRandomVNPhone |
| `AC-19A-05` | `TC-13` | unit | No | `core/utils/vnData/index.test.js` | Kiểm tra tĩnh (quét AST/import) không có import tới core/ai |
| `AC-19A-06` | `TC-14` | integration | Yes | `tests/dashboard-api/data-generate.test.js` | POST /api/data/generate persona trả về 200 kèm seed tái lập |
| `AC-19A-06` | `TC-15` | integration | Yes | `tests/dashboard-api/data-generate.test.js` | Kiểm tra phản hồi lỗi 400 và 413 khi body > 16KB hoặc sai field |
| `AC-19A-06` | `TC-16` | integration | No | `tests/dashboard-api/data-generate.test.js` | GET /api/data/payloads lọc theo category và trả đủ 6 nhóm |
| `AC-19A-06` | `TC-17` | integration | No | `tests/dashboard-api/data-generate.test.js` | GET /api/data/dynamic-preview chứa đầy đủ 5 khóa vn_* |
| `AC-19A-06` | `TC-18` | integration | No | `tests/dashboard-api/data-generate.test.js` | Sinh dữ liệu không ghi đĩa và không làm tăng audit AI |
| `AC-19A-06` | `TC-19` | integration | Yes | `tests/dashboard-api/data-generate.test.js` | LIFE-01: Sinh persona -> create-dataset -> đọc lại -> dọn dẹp |
| `AC-19A-07` | `TC-20` | e2e | Yes | `tests/dashboard/data-vn-generator.spec.js` | UI-02/LIFE-01: Mở modal -> sinh CCCD -> lưu dataset -> xác nhận |
| `AC-19A-07` | `TC-21` | e2e | No | `tests/dashboard/data-vn-generator.spec.js` | UI-01: Tùy chọn type, carrier, category khớp danh mục đặc tả |
| `AC-19A-07` | `TC-22` | e2e | No | `tests/dashboard/data-vn-generator.spec.js` | ASYNC-03: Request sinh trễ, bấm sinh lần 2 -> chỉ nhận kết quả lần 2 |
| `AC-19A-07` | `TC-23` | e2e | No | `tests/dashboard/data-vn-generator.spec.js` | ASYNC-02: Đổi type khi request đang chờ -> hủy request cũ |
| `AC-19A-07` | `TC-24` | e2e | No | `tests/dashboard/data-vn-generator.spec.js` | ASYNC-01: Khóa form và nút khi đang lưu dataset |
| `AC-19A-07` | `TC-25` | e2e | Yes | `tests/dashboard/data-vn-generator.spec.js` | ASYNC-04: Lưu trùng tên báo lỗi 400, giữ nguyên bản xem trước |
| `AC-19A-07` | `TC-26` | e2e | No | `tests/dashboard/data-vn-generator.spec.js` | ASYNC-05: Chỉ báo thành công sau mã 200, xử lý lỗi 500 an toàn |
| `AC-19A-07` | `TC-27` | e2e | Yes | `tests/dashboard/data-vn-generator.spec.js` | UI-05: Đóng khi dirty hiển thị confirmDialog, ở lại giữ nguyên dữ liệu |
| `AC-19A-07` | `TC-28` | e2e | No | `tests/dashboard/data-vn-generator.spec.js` | UI-04: Chuyển tab Định danh <-> Payload hiển thị đúng panel và aria |
| `AC-19A-07` | `TC-29` | e2e | Yes | `tests/dashboard/data-vn-generator.spec.js` | OWN-01..04: init idempotent, gỡ listener khi destroy, 20 vòng lặp |
| `AC-19A-07` | `TC-30` | e2e | No | `tests/dashboard/data-vn-generator.spec.js` | OWN-05: Rời view khi request đang chờ, không lỗi console |
| `AC-19A-07` | `TC-31` | e2e | Yes | `tests/dashboard/data-vn-generator.spec.js` | An toàn hiển thị: Xem nhóm XSS không kích hoạt script |
| `AC-19A-07` | `TC-32` | e2e | No | `tests/dashboard/data-vn-generator-layout.spec.js` | UI-03: Viewport 1920x1080 Light Mode |
| `AC-19A-07` | `TC-33` | e2e | No | `tests/dashboard/data-vn-generator-layout.spec.js` | UI-03: Viewport 1920x1080 Dark Mode |
| `AC-19A-07` | `TC-34` | e2e | No | `tests/dashboard/data-vn-generator-layout.spec.js` | UI-03: Viewport 1440x900 Light Mode |
| `AC-19A-07` | `TC-35` | e2e | No | `tests/dashboard/data-vn-generator-layout.spec.js` | UI-03: Viewport 1440x900 Dark Mode |
| `AC-19A-07` | `TC-36` | e2e | No | `tests/dashboard/data-vn-generator-layout.spec.js` | UI-03: Viewport 1280x800 Light Mode |
| `AC-19A-07` | `TC-37` | e2e | No | `tests/dashboard/data-vn-generator-layout.spec.js` | UI-03: Viewport 1280x800 Dark Mode |
| `AC-19A-07` | `TC-38` | e2e | No | `tests/dashboard/data-vn-generator-layout.spec.js` | UI-03: Viewport 390x844 Mobile Light Mode |
| `AC-19A-07` | `TC-39` | e2e | No | `tests/dashboard/data-vn-generator-layout.spec.js` | UI-03: Viewport 390x844 Mobile Dark Mode |

---

## D. Phạm Vi Dev Được Tự Quyết (Local Decisions)
- Thứ tự sắp xếp các cột trong bảng xem trước Persona (mặc định: Họ tên, Giới tính, Ngày sinh, CCCD, SĐT, Email).
- Điều chỉnh kích thước và độ cao cuộn tối đa của bảng xem trước (`max-height: 360px` hoặc `420px`).
- Lựa chọn icon SVG hiển thị trên nút "Sao chép" của từng dòng payload biên.
- Bổ sung thêm các mô tả ngữ cảnh chi tiết cho từng payload biên trong `edgePayloads.js`.

---

## E. Câu Hỏi Mở & Giả Định (Open Questions)
- Hiện tại có 0 câu hỏi chặn (zero blocking questions).
- Giả định: Danh mục 63 mã tỉnh tại Phụ lục A và đầu số viễn thông tại Phụ lục B đã được xác nhận làm căn cứ kiểm thử chuẩn mực cho hệ thống.

---

## F. Tiêu Chí Ra Phase (Exit Criteria)
- [x] 100% (39/39) test cases đạt kết quả PASS với báo cáo JUnit đầy đủ.
- [x] Toàn bộ 16 kịch bản Gate Scenarios (ASYNC, OWN, UI, LIFE) đều có test case kiểm chứng đạt chuẩn.
- [x] Kiểm thử oracle độc lập cho CCCD, MST, SĐT pass 100%, không tái sử dụng logic generator.
- [x] Quét tĩnh xác nhận 0 token AI (INV-1), không có import nào tới `core/ai`.
- [x] Tuân thủ giới hạn dòng mã (Component $\le 150$, Service $\le 200$, Module $\le 250$, Utils $\le 150$).
- [x] Kiểm tra hiển thị responsive 4 viewport trên 2 theme (Light/Dark), không có lỗi console.

---

## G. Soát Chéo (Cross-Review Signatures)
- Nghiệp vụ soát bởi Tech Lead: ✔ @tl (phiên hoàn tất Phase 19a)
- Kỹ thuật soát bởi BA (không đổi nghiệp vụ): ✔ @ba (phiên hoàn tất Phase 19a)

---

## H. Nhật Ký Thay Đổi Kế Hoạch (Plan Deviation Requests - PDR)

| PDR ID | Loại (BUSINESS / TECH) | Nội Dung Plan Gốc | Đề Xuất Thực Tế | Ảnh Hưởng (AC / File) | Trạng Thái (PENDING / APPROVED / REJECTED) |
|---|:---:|---|---|---|:---:|
| — | — | Không có sai lệch so với kế hoạch ban đầu | — | — | APPROVED |

---

## I. Bằng Chứng Thực Nghiệm (Evidence Block)

### 1. Báo Cáo Kiểm Thử Tự Động (Test Receipts)
- **Framework Check:**
  - Lệnh: `npm run check:framework`
  - Kết quả: `Framework checks passed (8 specs, 4 page objects).` (Status 0).
- **Unit & Contract API Tests (Node Test Runner):**
  - Lệnh: `node --test core/utils/vnData/*.test.js core/utils/dataManager.test.js core/utils/commonUtils.test.js tests/dashboard-api/data-generate.test.js`
  - Kết quả: `31/31 passed` (TC-01..TC-19, TC-10..TC-13, 100% PASS, 0 fail, duration ~915ms).
- **Dashboard E2E Tests (Playwright Chromium):**
  - Lệnh: `npx playwright test tests/dashboard/data-vn-generator.spec.js -c playwright.dashboard.config.js`
  - Kết quả: `12/12 passed` (TC-20..TC-31, 100% PASS, duration ~28.3s).
- **Responsive Layout & Theme Tests (Playwright Chromium):**
  - Lệnh: `npx playwright test tests/dashboard/data-vn-generator-layout.spec.js -c playwright.dashboard.config.js`
  - Kết quả: `8/8 passed` (TC-32..TC-39, 4 viewports `1920x1080`, `1440x900`, `1280x800`, `390x844` x 2 themes Light & Dark, 100% PASS, duration ~18.8s).
- **Tổng cộng kiểm thử:** `39/39 test cases (TC-01 .. TC-39) PASS 100%`.

### 2. Giới Hạn Kích Thước File (File Size Limits)
| Tên File | Loại | Giới Hạn | Thực Tế | Đánh Giá |
|---|---|:---:|:---:|:---:|
| `core/utils/vnData/seededRandom.js` | Utils | $\le 150$ | 62 dòng | PASS |
| `core/utils/vnData/vnCodes.js` | Constants | $\le 150$ | 31 dòng | PASS |
| `core/utils/vnData/vnIdentity.js` | Utils | $\le 150$ | 138 dòng | PASS |
| `core/utils/vnData/vnNames.js` | Utils | $\le 150$ | 71 dòng | PASS |
| `core/utils/vnData/edgePayloads.js` | Utils | $\le 150$ | 67 dòng | PASS |
| `core/utils/vnData/index.js` | Module Coordination | $\le 250$ | 150 dòng | PASS |
| `dashboard/routes/dataGenerateRoutes.js` | Routes | $\le 200$ | 88 dòng | PASS |
| `dashboard/public/js/views/data/vnDataPreview.js` | UI Component | $\le 150$ | 102 dòng | PASS |
| `dashboard/public/js/views/data/vnDataGeneratorModal.js` | UI Component | $\le 150$ | 133 dòng | PASS |
| `tests/dashboard/data-vn-generator.spec.js` | E2E Test | $\le 800$ | 282 dòng | PASS |
| `tests/dashboard/data-vn-generator-layout.spec.js` | E2E Test | $\le 800$ | 85 dòng | PASS |

### 3. Master Process Compliance Check
- Lệnh: `python D:\_Master_Process\master.py doctor "d:\_Automation-Project"`
- Kết quả: `MODULARITY: scanned=305 violations=0 exempted=40 | DOCTOR: PASS`
- Lệnh: `python D:\_Master_Process\master.py plan-check "_Plan_implement\19a_VN_TEST_DATA_GENERATOR_PLAN.md"`
- Kết quả: `Checked 1 phase files: 0 errors, 0 warnings.`

### 4. Git Commits
- Commit `9e78e25`: Standardize plan to Master Process v4.2 (§A–§I).
- Commit `66eeef3`: Phase 1: Implement core VN data generator, edge payloads, and unit tests (TC-01..TC-13).
- Commit `76c29c7`: Phase 2: Implement VN data generate and payload endpoints (TC-14..TC-19).
- Commit `2299706`: Phase 3: Implement VN test data studio modal and E2E test suites (TC-20..TC-39).

---

## Phụ Lục A — Danh Mục Mã Tỉnh CCCD (63 Tỉnh Thành)

`001` Hà Nội · `002` Hà Giang · `004` Cao Bằng · `006` Bắc Kạn · `008` Tuyên Quang · `010` Lào Cai · `011` Điện Biên · `012` Lai Châu · `014` Sơn La · `015` Yên Bái · `017` Hòa Bình · `019` Thái Nguyên · `020` Lạng Sơn · `022` Quảng Ninh · `024` Bắc Giang · `025` Phú Thọ · `026` Vĩnh Phúc · `027` Bắc Ninh · `030` Hải Dương · `031` Hải Phòng · `033` Hưng Yên · `034` Thái Bình · `035` Hà Nam · `036` Nam Định · `037` Ninh Bình · `038` Thanh Hóa · `040` Nghệ An · `042` Hà Tĩnh · `044` Quảng Bình · `045` Quảng Trị · `046` Thừa Thiên Huế · `048` Đà Nẵng · `049` Quảng Nam · `051` Quảng Ngãi · `052` Bình Định · `054` Phú Yên · `056` Khánh Hòa · `058` Ninh Thuận · `060` Bình Thuận · `062` Kon Tum · `064` Gia Lai · `066` Đắk Lắk · `067` Đắk Nông · `068` Lâm Đồng · `070` Bình Phước · `072` Tây Ninh · `074` Bình Dương · `075` Đồng Nai · `077` Bà Rịa – Vũng Tàu · `079` TP. Hồ Chí Minh · `080` Long An · `082` Tiền Giang · `083` Bến Tre · `084` Trà Vinh · `086` Vĩnh Long · `087` Đồng Tháp · `089` An Giang · `091` Kiên Giang · `092` Cần Thơ · `093` Hậu Giang · `094` Sóc Trăng · `095` Bạc Liêu · `096` Cà Mau

---

## Phụ Lục B — Danh Mục Đầu Số Di Động (3 Nhà Mạng Chính)

| Nhà Mạng | Danh Sách Đầu Số |
|---|---|
| Viettel | 032, 033, 034, 035, 036, 037, 038, 039, 086, 096, 097, 098 |
| VinaPhone | 081, 082, 083, 084, 085, 088, 091, 094 |
| MobiFone | 070, 076, 077, 078, 079, 089, 090, 093 |
