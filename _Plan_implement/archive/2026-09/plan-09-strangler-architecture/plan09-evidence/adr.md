# Architecture Decision Records (ADRs) — Plan 09

> **Dự án:** QA Automation Engine & Dashboard Studio  
> **Phạm vi:** Tái cấu trúc phân tách mô-đun (L4 Refactoring)  
> **Trạng thái:** ACCEPTED  
> **Ngày phê duyệt:** 2026-09-10

---

## ADR TECH-01: Backend CommonJS và Frontend ES6 Modules (ESM)

- **Bối cảnh:** Toàn bộ hệ sinh thái dự án Node.js hiện đang sử dụng CommonJS (`require`). Nếu chuyển `package.json` sang `"type": "module"`, tất cả các script test, core fixtures và runners hiện tại sẽ bị gãy vỡ import.
- **Quyết định:**
  - Backend (`dashboard/server.js`, `dashboard/routes/`) giữ nguyên **CommonJS** (`require` / `module.exports`).
  - Frontend (`dashboard/public/js/`) áp dụng thuần **ES6 Modules** (`import` / `export`) được trình duyệt hỗ trợ gốc (`type="module"` trên thẻ `<script>`).
  - Đường dẫn tệp nhạy cảm trên Windows luôn đi kèm cờ `{ windowsHide: true }` khi khởi tạo subprocess và kiểm tra path traversal trước mọi thao tác đọc/ghi.
- **Hệ quả:** Không cần cài đặt Webpack/Babel hay bundler bên ngoài, giữ nguyên 100% bản sắc kỹ thuật Vanilla của dự án.

---

## ADR TECH-02: Strangler Fig Pattern & Vòng Đời Đơn Chủ Quyền (Single Ownership)

- **Bối cảnh:** Không thể refactor 15.738 dòng của `app.js` trong một commit duy nhất mà không làm sập giao diện.
- **Quyết định:**
  - Áp dụng mẫu hình Strangler Fig với cờ chuyển tiếp `MIGRATED_SLICES` trong `runtimeConfig.js`.
  - Mọi view module phải triển khai vòng đời 5 bước: `prepare → mount → activate → deactivate → dispose`.
  - Áp dụng **Navigation Generation Counter** (`currentNavGen++`): Chỉ cho phép lượt điều hướng mới nhất được mount vào DOM, triệt tiêu race condition $A \rightarrow B \rightarrow A$.
  - Triển khai **Dirty State Guard**: Kiểm tra thay đổi chưa lưu trước khi cho phép chuyển view.
  - **Đơn chủ quyền (Single Ownership):** Tuyệt đối không cho phép legacy code và module mới cùng lắng nghe một sự kiện.
- **Hệ quả:** Hệ thống luôn Always-Green qua từng commit chuyển đổi; không có downtime.

---

## ADR TECH-03: Window Bridge & Bảo Vệ Hàm Toàn Cục Tránh ReferenceError

- **Bối cảnh:** Mã nguồn sinh HTML động bằng string template chứa các lời gọi hàm toàn cục như `onclick="cloneDataRow(${idx})"`. Khi bóc tách sang ESM, các hàm bị cô lập khỏi đối tượng `window`, gây lỗi `Uncaught ReferenceError`.
- **Quyết định:**
  - Xây dựng module cầu nối `dashboard/public/js/core/windowBridge.js`.
  - Cung cấp cơ chế đăng ký an toàn: `registerWindowActions(actionsMap)` với allowlist chặt chẽ.
  - Bọc khối `try...catch` ghi log lỗi thân thiện thay vì làm crash toàn bộ giao diện.
- **Hệ quả:** 100% các nút bấm cũ trong bảng dữ liệu tiếp tục chạy trơn tru mà không cần sửa hàng nghìn dòng HTML template.

---

## ADR TECH-04: Phân Cấp State & Event Bus Contract Độc Lập Với Session Dài Hạn

- **Bối cảnh:** Biến toàn cục bị gán chéo giữa các studio dẫn đến rò rỉ dữ liệu hoặc cập nhật sai màn hình.
- **Quyết định:**
  - **Global Shared State (Tối giản):** Chỉ lưu 3 thông số dùng chung (`activeTab`, `currentTheme`, `frameworkStatus`).
  - **Local Slice State (Cô lập):** Mọi state chuyên biệt thuộc quyền sở hữu độc quyền của từng Feature Slice.
  - **Event Envelope chuẩn:** `{ type, version: 1, entityId, revision, source }` thông qua `STUDIO_EVENTS`.
  - **Session độc lập view:** Tiến trình chạy test Playwright và stream SSE log chạy độc lập với view; người dùng chuyển tab không làm ngắt phiên chạy test ngầm; khi rời tab chỉ hủy UI listener, tiến trình backend tiếp tục thực thi.
- **Hệ quả:** Các phân hệ hoàn toàn tách rời nhau; đóng tab không làm mất phiên test.

---

## ADR TECH-05: Giữ Nguyên Thứ Tự CSS Cascade & Khử Bỏ Phụ Thuộc Lồng Nhau

- **Bối cảnh:** Tách `styles.css` (19.463 dòng) nếu đảo lộn thứ tự rule sẽ làm hỏng độ ưu tiên (Specificity & Cascade) dẫn đến vỡ giao diện hoặc mất màu Dark/Light theme.
- **Quyết định:**
  - Bóc tách theo đúng thứ tự xuất hiện ban đầu: `tokens.css` $\rightarrow$ `base.css` $\rightarrow$ `components/` $\rightarrow$ `views/`.
  - Tránh tạo chuỗi `@import` lồng nhau nhiều tầng; sử dụng `<link>` có thứ tự trong HTML hoặc 1 master bundle `main.css`.
  - Giữ lại file `dashboard/public/styles.css` làm proxy `@import './styles/main.css';` trong giai đoạn chuyển tiếp.
- **Hệ quả:** Giao diện đồng nhất 100% pixel-by-pixel trên cả 4 độ phân giải và 2 chế độ màu.

---

## ADR TECH-06: Cơ Chế Chuyển Tiếp Policy Cho `master.ps1 audit`

- **Bối cảnh:** Công cụ kiểm tra `master.ps1 audit dashboard` quét toàn bộ tệp trong thư mục và trả về `exit 1` nếu có bất kỳ file nào vượt ngưỡng dòng. Trong các Phase trung gian (Phase 1 đến Phase 3), file `app.js` (15.738 dòng) vẫn chưa được phân tách xong nên audit tổng thể sẽ luôn exit 1.
- **Quyết định:**
  - **Không dùng `--no-verify`** để lách luật.
  - **Không nới lỏng giới hạn dòng toàn cục** trong `config/quality-policy.json`.
  - **Cơ chế chuyển tiếp:**
    - Trong Phase 1, 2, 3: Tiến hành audit tập trung vào **các file mới được tạo ra** (Scoped Audit / Staged Files): đảm bảo 100% file mới sinh ra tuân thủ $\le 150-200$ dòng.
    - Tại Gate 4 (Phase 6): Bắt buộc toàn bộ thư mục `dashboard/` vượt qua `master.ps1 audit dashboard` với **exit code 0 (0 vi phạm)** sau khi `app.js` được dọn sạch hoàn toàn.
- **Hệ quả:** Đảm bảo tính trung thực tuyệt đối của quy trình, không làm giả kết quả kiểm toán.
