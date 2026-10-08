# Phase 1 — Cô Lập Môi Trường E2E Smoke & Dọn Rác Test Runner

> **Tác giả Nghiệp vụ:** @ba · **Tác giả Kỹ thuật:** @tl · **Research:** Không áp dụng  
> **Trạng thái:** `COMPLETED` · **Cấp độ:** `L3`  
> **Nằm trong:** [Plan 20 Overview](plan-20-overview.md)

---

## A. Nghiệp Vụ (BA — A/R; Tech Lead — C)

### A1. Mục Tiêu & Phạm Vi Phase
- **In-Scope:**
  - Chấm dứt sự phụ thuộc vào live website `https://example.com` bằng cách tạo trang HTML fixture tĩnh độc lập tại `data/fixtures/sample-app.html`.
  - Cập nhật [pages/desktop/SamplePage.js](file:///d:/_Automation-Project/pages/desktop/SamplePage.js) và [pages/mobile/SampleMobilePage.js](file:///d:/_Automation-Project/pages/mobile/SampleMobilePage.js) để nạp trang HTML nội bộ qua giao thức file hoặc local server, có đầy đủ `<h1>`, `<p>`, và `<a>`.
  - Khắc phục triệt để việc runner Playwright Dashboard quét nhầm thư mục rác: bổ sung `testIgnore` trong [playwright.dashboard.config.js](file:///d:/_Automation-Project/playwright.dashboard.config.js).
  - Thu gom và xóa sạch 5 thư mục `.tmp-workspace-*` đang tồn đọng trong `tests/dashboard/`.
  - Nâng cấp `fixtureWorkspace.js` cơ chế tự động dọn dẹp an toàn khi tiến trình test kết thúc bất thường.
- **Out-of-Scope:**
  - Không sửa CSS của Dashboard (thuộc Phase 2).
  - Không cấu hình GitHub Actions (thuộc Phase 3).

### A2. Yêu Cầu & Quy Tắc Nghiệp Vụ Áp Dụng
- `REQ-20-01`: Bộ test khởi đầu (Starter Suite) của Hub phải chạy được 100% offline, không phụ thuộc vào kết nối mạng bên ngoài.
- `REQ-20-02`: Runner kiểm thử Dashboard không bao giờ được quét và thực thi các file test nằm trong thư mục tạm sinh ra trong quá trình kiểm thử.
- `BR-20-01`: Trang HTML fixture phải có cấu trúc chuẩn ngữ nghĩa HTML5: 1 thẻ `<h1>`, các thẻ `<p>` mô tả và liên kết `<a>` hành động.
- `BR-20-02`: Mọi thư mục tạm sinh ra từ fixture phải được đăng ký hook dọn dẹp (`process.on('exit')`) để không để lại rác trên đĩa khi test crash.

### A3. User Flow & Nhánh Lỗi
- **Luồng chạy test**: Kỹ sư chạy lệnh `npm run suite:desktop` -> Playwright khởi động browser -> Mở trang fixture cục bộ -> Xác thực `h1` hiển thị thành công trong < 100ms -> Chạy tiếp các bước Given/When/Then -> Đóng test với kết quả 100% PASS.
- **Nhánh xử lý lỗi**: Nếu đường dẫn file HTML cục bộ không tìm thấy -> Fallback về data URI chuẩn HTML đã nhúng sẵn trong Page Object để đảm bảo test không bao giờ bị fail oan do đường dẫn file.

### A4. Tiêu Chí Nghiệm Thu (AC-xx)
- `AC-20-01`: Lệnh `npm run suite:desktop` chạy 7 test, kết quả **7/7 PASS**, thời gian thực thi giảm từ > 49s xuống < 15s.
- `AC-20-02`: Lệnh `npm run suite:smoke` chạy thành công trên cả 3 profile Desktop, Mobile Chrome, Mobile Safari mà không gặp bất kỳ lỗi timeout nào.
- `AC-20-03`: `playwright.dashboard.config.js` có thuộc tính `testIgnore` bao gồm `**/.tmp-workspace-*/**` và `**/test-results/**`.
- `AC-20-04`: Thư mục `tests/dashboard/` hoàn toàn sạch bóng các folder `.tmp-workspace-*`.

### A5. Kịch Bản Nghiệm Thu Nghiệp Vụ (UAT-xx)
- `UAT-20-01`:
  - **Mục tiêu:** Xác minh bộ test starter chạy mượt mà ngay cả khi ngắt kết nối mạng Internet.
  - **Persona:** Automation QA Engineer mới gia nhập dự án.
  - **Thao tác:** Chạy `npm run suite:desktop` trong môi trường không mạng hoặc mạng yếu.
  - **Kỳ vọng:** Tất cả các test Given-When-Then trong `sample_demo.spec.js`, `sample_cleanup_fixture.spec.js` và `sample_pages_fixture.spec.js` đều PASS ngay lần chạy đầu tiên.

---

## B. Kỹ Thuật (Tech Lead — A/R; BA — C)

### B1. Quyết Định Kỹ Thuật (TECH-xx)
- `TECH-20-01`: Tạo trang HTML fixture tĩnh độc lập tại `data/fixtures/sample-app.html`. Sử dụng `pathToFileURL` để sinh URL `file:///` an toàn trên cả Windows và Linux (CI).
- `TECH-20-02`: Bổ sung cơ chế fallback nội tại trong `SamplePage.js`: Nếu tham số URL truyền vào là `https://example.com` (giá trị legacy cũ), tự động trỏ về trang fixture cục bộ.
- `TECH-20-03`: Trong `playwright.dashboard.config.js`, thêm `testIgnore: ['**/.tmp-workspace-*/**', '**/test-results/**']` để chặn Playwright khớp các file `.spec.js` sinh động trong workspace ảo.
- `TECH-20-04`: Trong `tests/dashboard/support/fixtureWorkspace.js`, đăng ký process exit handlers:
  ```javascript
  const clean = () => { try { if (fs.existsSync(tmpRoot)) fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (_) {} };
  process.on('exit', clean);
  process.on('SIGINT', clean);
  ```

### B2. Bản Đồ File & Ngân Sách Dòng (File Splitting Budget)

| Path | Loại File | Thao Tác | Trần Số Dòng | Dự Kiến |
|---|---|:---:|:---:|:---:|
| `data/fixtures/sample-app.html` | HTML Fixture | Tạo mới | 50 | 35 |
| `pages/desktop/SamplePage.js` | Page Object | Sửa | 60 | 40 |
| `pages/mobile/SampleMobilePage.js` | Page Object | Sửa | 60 | 40 |
| `playwright.dashboard.config.js` | Config | Sửa | 50 | 35 |
| `tests/dashboard/support/fixtureWorkspace.js` | Test Helper | Sửa | 70 | 60 |

### B3. Checklist Thực Thi & Bằng Chứng Nghiệm Thu
1. [x] Tạo `data/fixtures/sample-app.html` chứa layout HTML5 cơ bản (h1, p, a).
2. [x] Cập nhật `SamplePage.js` và `SampleMobilePage.js` hỗ trợ load file fixture cục bộ.
3. [x] Bổ sung `testIgnore` trong `playwright.dashboard.config.js`.
4. [x] Xóa sạch các thư mục `.tmp-workspace-*` còn sót trong `tests/dashboard/`.
5. [x] Cập nhật `fixtureWorkspace.js` với process exit handler.
6. [x] Chạy `npm run suite:desktop` -> Bằng chứng 7/7 PASS.
7. [x] Chạy `npm run suite:smoke` -> Bằng chứng toàn bộ PASS.
