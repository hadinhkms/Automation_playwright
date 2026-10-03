# Phase 2 — Tích Hợp Giao Diện Studio & Trình Soạn Thảo (Code Editor)

> **Tác giả Nghiệp vụ:** @ba · **Tác giả Kỹ thuật:** @tl · **Research:** Không áp dụng  
> **Trạng thái:** `COMPLETED` · **Cấp độ:** `L3`  
> **Nằm trong:** [Plan 21 Overview](plan-21-overview.md)

---

## A. Nghiệp Vụ (BA — A/R; Tech Lead — C)

### A1. Mục Tiêu & Phạm Vi Phase
- **In-Scope:**
  - Tích hợp nút bấm thông minh trên giao diện người dùng:
    1. **Code Editor Toolbar (`<textarea id="script-spec-editor">` trong `builder.html`, view BDD Test Studio `#/builder`):** Khi xem/sửa bất kỳ file `.spec.js` nào chưa có tag `@REQ-xxx`, thanh công cụ trên đầu editor hiển thị nút nổi bật: `✦ Liên kết Requirement` (phím tắt `Alt+Shift+L`, tránh xung đột `Ctrl+Shift+R` là hard-reload của trình duyệt; trước khi gắn phải grep `app.js`/`keydown` xác nhận chưa có handler trùng tổ hợp — hiện không có `altKey` nào trong `app.js`). Nhãn nút phụ thuộc `mode` do `POST /api/qa/smart-link` trả về: `link` → `✦ Liên kết Requirement`; `reverse_sync` → `✦ Đồng bộ kịch bản mới vào REQ-xxx` (kèm badge số test mới, ẩn Apply nếu `newTests` rỗng); `conflict` → nút bị khoá kèm tooltip cảnh báo `REQ_CONFLICT`.
    2. **Bảng Vấn đề QA (`#/qa`):** Cạnh mỗi lỗi `spec-khong-truy-vet` trong danh sách findings (`findingRows.js`), bổ sung nút hành động nhanh `✦ Phân loại REQ`.
  - Xây dựng Modal trực quan **Smart Trace Linker Preview (`#qa-smart-linker-modal`)**:
    - Được lazy-mount linh hoạt vào `document.body` qua `smartLinkerHelper.js` khi người dùng bấm nút lần đầu (không nhồi cứng vào `index.html` hay `qa.html`, đảm bảo độc lập với view đang kích hoạt và giữ ngân sách DOM ban đầu $< 1,500$ elements).
    - **Tab 1 — Ghép vào Requirement có sẵn:** Hiển thị thẻ các REQ tương thích xếp theo Match Score (kèm badge % màu xanh/vàng), lý do đề xuất, và diff danh sách `AC-yyy` / `TC-zzz` sẽ được chèn thêm.
    - **Tab 2 — Tạo Requirement mới:** Hiển thị form xem trước với ID kế tiếp tự sinh (`REQ-xxx` 3 chữ số), tiêu đề trích xuất, và các tiêu chí Given/When/Then.
    - Nút **"Xác nhận & Cập nhật (1-Click Apply)":** Gọi API apply, tự động cập nhật nội dung editor đang mở (nếu đang ở màn hình BDD Builder), làm mới bảng QA Trace và hiện thông báo thành công.
- **Out-of-Scope:**
  - Không thay đổi logic chạy test của Playwright runner.

### A2. Yêu Cầu & Quy Tắc Nghiệp Vụ Áp Dụng
- `REQ-21-03`: Nút thông minh trên Code Editor chỉ hiển thị hoặc được kích hoạt khi file đang mở là một Playwright Test Spec (`.spec.js` hoặc `.spec.ts`).
- `REQ-21-04`: Giao diện phải mang tính gợi ý thông minh, người dùng luôn có toàn quyền chuyển đổi giữa việc "Ghép vào REQ có sẵn" hoặc "Tạo REQ mới" trước khi bấm áp dụng.
- `BR-21-03`: Đảm bảo tính nhất quán của Editor State: Khi người dùng bấm "Áp dụng", code trong Code Editor (`<textarea id="script-spec-editor">` trong `builder.html`) phải được cập nhật tức thì với tag `@REQ-xxx`: giữ `selectionStart/End` và `scrollTop` (dịch con trỏ theo số ký tự chèn trước nó), và nếu nội dung editor đã khác bản gửi đi (`specHash` lệch / user gõ thêm trong lúc apply) thì **không ghi đè**, hiện cảnh báo và yêu cầu phân tích lại. Nút Apply bị khoá (disabled) trong lúc request đang chạy để chặn double-submit. Khi server trả `409 BATCH_LOCKED` (đang có batch fixer/luồng ghi khác; server không xếp hàng) modal giữ nguyên, hiện thông báo "Đang có thao tác ghi khác, thử lại sau vài giây" và mở lại nút Apply; `409 SPEC_CHANGED` yêu cầu phân tích lại; `500 APPLY_FAILED` báo đã rollback và cho phép retry. Mọi chuỗi lỗi hiển thị qua bảng thông điệp, không in `message` thô/`undefined`.
- `BR-21-04`: Thiết kế giao diện tuân thủ 100% tokens hệ thống (`tokens.css`), hỗ trợ hoàn hảo cả Dark Mode và Light Mode, responsive trên mọi kích thước màn hình.

### A3. Tiêu Chí Nghiệm Thu (AC-xx)
- `AC-21-04`: Mở file spec chưa có `@REQ-xxx` trong BDD Builder view (`#/builder`) -> Nút `✦ Liên kết Requirement` xuất hiện rõ ràng trên thanh toolbar; click vào mở modal `#qa-smart-linker-modal` trong $< 300\text{ms}$.
- `AC-21-05`: Modal hiển thị đầy đủ 2 tab (Ghép có sẵn & Tạo mới); chọn một REQ có sẵn hiển thị diff các AC/TC sẽ được thêm; chuyển tab Tạo mới hiển thị cấu trúc file scaffold dự kiến với mã REQ 3 chữ số chuẩn.
- `AC-21-06b`: Gate 4 UI: kiểm thử `ASYNC-01..05` (gõ khi apply pending, đổi file khi response về muộn, apply lỗi → retry được, apply gặp `BATCH_LOCKED` → báo bận và retry được), `UI-01..05` (focus trap & Esc đóng modal, chuyển tab nhanh, đổi file A-B-A, dirty guard) và quét DOM không có `undefined`/`null`/lỗi thô, 0 console error; tiêu đề test chứa HTML/dấu ngoặc kép được render bằng `textContent`/escape.
- `AC-21-06`: Click nút "Xác nhận & Cập nhật" -> Modal đóng lại, hiển thị toast thông báo thành công, file spec trên editor và đĩa được chèn tag `@REQ-xxx`, cây tài liệu và số liệu Traceability tự động làm mới tức thì.

### A4. Kịch Bản Nghiệm Thu Nghiệp Vụ (UAT-xx)
- `UAT-21-02`:
  - **Mục tiêu:** Kỹ sư hoàn thành kịch bản test mới trên web editor và liên kết requirement thành công chỉ với 1 click.
  - **Persona:** Automation QA Lead.
  - **Thao tác:** Soạn thảo spec mới trong tab Kịch bản BDD (`#/builder`) -> Bấm `✦ Liên kết Requirement` -> Xem danh sách gợi ý -> Chọn "Ghép vào REQ-001" -> Bấm "Xác nhận & Cập nhật".
  - **Kỳ vọng:** Spec được tự động gắn `@REQ-001`, file `requirements/REQ-001.md` và `test-cases/REQ-001.md` được ghi nhận AC/TC mới, chỉ số "Vấn đề nghiêm trọng" giảm về 0.

---

## B. Kỹ Thuật (Tech Lead — A/R; BA — C)

### B1. Quyết Định Kỹ Thuật (TECH-xx)
- `TECH-21-04`: Tái sử dụng hệ thống UI primitives hiện có (`.modal`, `.hero-stat-card`, `.qa-chip`, `.view-subtab`) trong `tokens.css` và `qa.css`, không tạo thêm các class màu ad-hoc.
- `TECH-21-05`: Xây dựng hai file độc lập trong `dashboard/public/js/views/qa/` (trần 250 dòng/file theo role `module` của `quality-policy.json`): `smartLinkerModal.js` có `ensureModalMounted()` nạp HTML modal vào `document.body` khi cần, và `smartLinkerHelper.js` điều phối API/editor/lỗi, giữ `qaSlice.js` và `app.js` trong ngân sách dòng. Không dùng `master-process-disable-size-check`.
- `TECH-21-13`: Phase 2 phụ thuộc hợp đồng Phase 1 (gồm `mode`, `delta`, `diskHash`, `BATCH_LOCKED`); UI chỉ dựa vào trường `mode` để chọn nhãn nút/tab, không tự suy luận lại từ nội dung spec.
- `TECH-21-06`: Trong `app.js` (khu vực BDD editor), bổ sung observer lắng nghe sự kiện đổi script/file đang mở để cập nhật trạng thái hiển thị của nút `qa-btn-smart-link-spec`.
- `TECH-21-11`: Đồng bộ CSS Master Cascade: Khai báo `@import url('./styles/views/smartLinker.css');` tại [dashboard/public/styles.css](file:///d:/_Automation-Project/dashboard/public/styles.css) để vượt qua bộ kiểm thử [css-parity.spec.js](file:///d:/_Automation-Project/tests/dashboard/css-parity.spec.js).

### B2. Bản Đồ File & Ngân Sách Dòng (File Splitting Budget)

| Path | Loại File | Thao Tác | Trần Số Dòng | Dự Kiến |
|---|---|:---:|:---:|:---:|
| `dashboard/public/styles/views/smartLinker.css` | Stylesheet | Tạo mới | 400 | 220 |
| `dashboard/public/styles.css` (hiện 36 dòng) | Master Cascade CSS | Sửa | 45 | 38 (+1 dòng import) |
| `dashboard/public/js/views/qa/smartLinkerHelper.js` | Điều phối: trigger, gọi API, editor sync, lỗi | Tạo mới | 250 | 200 |
| `dashboard/public/js/views/qa/smartLinkerModal.js` | Lazy-mount modal, tab, render (`textContent`), focus trap | Tạo mới | 250 | 200 |
| `dashboard/public/templates/builder.html` (hiện 856 dòng) | Template HTML | Sửa | 870 | 860 (+3 dòng nút toolbar) |
| `dashboard/public/js/views/qa/batch/findingRows.js` (hiện 124 dòng) | Finding Actions | Sửa | 145 | 135 (+10 dòng nút action) |
| `dashboard/public/app.js` (hiện 17,635 dòng) | BDD Editor Glue | Sửa | +30 dòng glue (C-4) | +25 |
| `dashboard/public/js/views/qa/qaSlice.js` (hiện 2,558 dòng) | QA View Slice | Sửa | +20 dòng glue (C-4) | +15 |

### B3. Checklist Thực Thi & Bằng Chứng Nghiệm Thu
1. [x] Tạo file CSS mới `dashboard/public/styles/views/smartLinker.css` và đăng ký `@import` vào `dashboard/public/styles.css`; xác nhận `npm test -- tests/dashboard/css-parity.spec.js` đạt 100% PASS.
2. [x] Bổ sung nút `✦ Liên kết Requirement` vào toolbar editor trong `dashboard/public/templates/builder.html` và gắn sự kiện trong `app.js`.
3. [x] Bổ sung nút hành động `✦ Phân loại REQ` trong `dashboard/public/js/views/qa/batch/findingRows.js` cho finding `spec-khong-truy-vet`.
4. [x] Tạo `smartLinkerModal.js` (lazy-mount, tab, render an toàn) và `smartLinkerHelper.js` (gọi API `/api/qa/smart-link` và `/api/qa/smart-link/apply`, xử lý `mode`, `SPEC_CHANGED`, `BATCH_LOCKED`, `APPLY_FAILED`); mỗi file ≤ 250 dòng.
5. [x] Chạy kiểm thử ma trận `ASYNC-*`/`UI-*` (AC-21-06b) và xác nhận DOM ban đầu duy trì $< 1,500$ elements trên `tests/dashboard/templates-performance-a11y.spec.js`.
6. [x] Kiểm tra hiển thị responsive trên 1920x1080 và 390x844 (Dark / Light mode).
