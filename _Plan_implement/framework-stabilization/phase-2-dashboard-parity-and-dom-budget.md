# Phase 2 — Đồng Bộ Thiết Kế Dashboard & Tối Ưu Ngân Sách DOM

> **Tác giả Nghiệp vụ:** @ba · **Tác giả Kỹ thuật:** @tl · **Research:** Không áp dụng  
> **Trạng thái:** `READY_FOR_EXECUTION` · **Cấp độ:** `L3`  
> **Nằm trong:** [Plan 20 Overview](plan-20-overview.md)

---

## A. Nghiệp Vụ (BA — A/R; Tech Lead — C)

### A1. Mục Tiêu & Phạm Vi Phase
- **In-Scope:**
  - Khắc phục toàn diện 5 test UI bị fail trong `playwright.dashboard.config.js`:
    1. Bổ sung 2 token còn thiếu vào hệ thống thiết kế: `--warning-subtle` và `--accent-subtle` trong `tokens.css`.
    2. Khử toàn bộ 8 vị trí fallback màu cứng trong [dashboard/public/styles/views/qa.css](file:///d:/_Automation-Project/dashboard/public/styles/views/qa.css).
    3. Chuẩn hóa màu viền `spinner` và viền hộp trong `qa.css` về biến `--line` chuẩn, loại bỏ viền hairline màu nhạt.
    4. Tối ưu cơ chế nạp giao diện ban đầu (On-demand Lazy Template Mount) tại `dashboard/public/app.js` để đưa số lượng phần tử DOM khi mở trang từ **4,641 phần tử** xuống **dưới 1,500 phần tử** theo đúng quy định Plan 09 §8.
    5. Cập nhật thông điệp nhắc nhở trong trình đọc tài liệu QA để khớp với kiểm thử `qa-document-reader.spec.js`.
- **Out-of-Scope:**
  - Không sửa luồng Git Sync hay Hub-to-Spoke (thuộc Phase 3).
  - Không cấu hình GitHub Actions (thuộc Phase 3).

### A2. Yêu Cầu & Quy Tắc Nghiệp Vụ Áp Dụng
- `REQ-20-03`: Toàn bộ giao diện Studio tuân thủ 100% Design Tokens chuẩn, tuyệt đối không sử dụng mã màu hardcoded hoặc fallback che giấu token thiếu.
- `REQ-20-04`: Giao diện ban đầu của Dashboard phải đạt chuẩn hiệu năng cao, số node DOM khi mở trang dưới 1,500 để đảm bảo render tức thì (< 300ms) trên mọi thiết bị.
- `BR-20-03`: Quy tắc token màu: Mọi thành phần hiển thị trạng thái cảnh báo (`warning`) hoặc điểm nhấn (`accent`) dạng nền nhẹ phải dùng biến `--warning-subtle` và `--accent-subtle`.
- `BR-20-04`: Quy tắc Lazy Mount: Khi Dashboard mở ra, chỉ view mặc định (`#/suites` hoặc view đầu tiên) được chèn template HTML vào DOM. Các view khác (`#/qa`, `#/builder`, `#/data`...) chỉ mount khi người dùng nhấp chọn tab.

### A3. Tiêu Chí Nghiệm Thu (AC-xx)
- `AC-20-05`: Test [qa-view-design-parity.spec.js](file:///d:/_Automation-Project/tests/dashboard/qa-view-design-parity.spec.js) PASS 100% cả 4 tiêu chí: không thiếu token, không có fallback màu, không có viền hairline trắng, chuyển đổi dark/light mode hoàn hảo.
- `AC-20-06`: Test [templates-performance-a11y.spec.js:L66](file:///d:/_Automation-Project/tests/dashboard/templates-performance-a11y.spec.js#L66) PASS tiêu chí TC-13: `document.getElementsByTagName('*').length < 1500`.
- `AC-20-07`: Test [qa-document-reader.spec.js:L473](file:///d:/_Automation-Project/tests/dashboard/qa-document-reader.spec.js#L473) PASS tiêu chí kiểm tra thông báo bản thảo không lưu.
- `AC-20-08`: Bộ test `playwright.dashboard.config.js` đạt kết quả tối thiểu **154/154 PASS** (0 test fail).

### A4. Kịch Bản Nghiệm Thu Nghiệp Vụ (UAT-xx)
- `UAT-20-02`:
  - **Mục tiêu:** Kiểm tra trải nghiệm UI/UX mượt mà, theme màu chuẩn sắc thái và tốc độ mở trang nhanh vượt trội.
  - **Persona:** Lead QA / Designer review giao diện Studio.
  - **Thao tác:** Mở Dashboard trên trình duyệt, chuyển đổi qua lại giữa Light Theme và Dark Theme, kiểm tra các badge Warning, Accent và Spinner trên tab QA.
  - **Kỳ vọng:** Màu sắc hiển thị sắc nét, viền bo đồng nhất với màu nền hệ thống, không có hiện tượng chớp nháy (FOUC) hay giật lag khi chuyển đổi.

---

## B. Kỹ Thuật (Tech Lead — A/R; BA — C)

### B1. Quyết Định Kỹ Thuật (TECH-xx)
- `TECH-20-05`: Bổ sung định nghĩa token trong `dashboard/public/styles/tokens.css`:
  - Light mode:
    ```css
    --warning-subtle: rgba(245, 158, 11, 0.12);
    --accent-subtle: rgba(99, 102, 241, 0.12);
    ```
  - Dark mode:
    ```css
    --warning-subtle: rgba(245, 158, 11, 0.20);
    --accent-subtle: rgba(99, 102, 241, 0.22);
    ```
- `TECH-20-06`: Thay thế toàn bộ `var(--color, #hex)` trong `dashboard/public/styles/views/qa.css` thành `var(--color)`. Đổi `borderTop: rgb(243, 244, 246)` thành `border-top-color: var(--line)`.
- `TECH-20-07`: Sửa đổi cơ chế `mountAllViews()` trong `dashboard/public/app.js`:
  - Thay vì append toàn bộ 14 HTML templates vào DOM ngay khi init, lưu trữ các template HTML trong bộ nhớ cache JS (`templateRegistry`).
  - Khi routing tới view tương ứng: Kiểm tra container của view đó, nếu rỗng mới tiến hành parse và mount template HTML vào DOM (On-demand Lazy Mounting).
- `TECH-20-08`: Trong `dashboard/public/js/views/qa/reqAnalyzerHelper.js` hoặc component bản thảo, đảm bảo chuỗi văn bản cảnh báo chứa đầy đủ cụm từ `'KHÔNG được lưu lại'`.

### B2. Bản Đồ File & Ngân Sách Dòng (File Splitting Budget)

| Path | Loại File | Thao Tác | Trần Số Dòng | Dự Kiến |
|---|---|:---:|:---:|:---:|
| `dashboard/public/styles/tokens.css` | Stylesheet | Sửa | 300 | 250 |
| `dashboard/public/styles/views/qa.css` | Stylesheet | Sửa | 800 | 650 |
| `dashboard/public/app.js` | Core UI Monolith | Sửa | Tái cấu trúc Lazy Mount | Hiện tại |
| `dashboard/public/js/views/qa/reqAnalyzerHelper.js` | Helper | Sửa | 350 | 280 |

### B3. Checklist Thực Thi & Bằng Chứng Nghiệm Thu
1. [ ] Cập nhật `tokens.css` bổ sung 2 token subtle.
2. [ ] Dọn sạch 8 vị trí fallback màu cứng và viền hairline trong `qa.css`.
3. [ ] Tối ưu hóa hàm mount template trong `app.js` theo cơ chế Lazy Mount on-demand.
4. [ ] Đo đạc `initialDomCount` trong trình duyệt đảm bảo `< 1500` nodes.
5. [ ] Chuẩn hóa thông điệp bản thảo BDD.
6. [ ] Chạy `npx playwright test --config=playwright.dashboard.config.js` -> Đạt 100% Green (154/154 passed).
