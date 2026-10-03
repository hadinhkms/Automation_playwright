# QA & Testing Conventions

> [!NOTE]
> Quy chuẩn viết test tự động (Unit, Integration, E2E) trong dự án này.

## 1. Nguyên Tắc Kiểm Thử
- **Không dùng `sleep` cứng:** Luôn dùng explicit waits (`waitFor`, `waitForResponse`, `toBeVisible`).
- **Test ID Convention:** Sử dụng thuộc tính `data-testid="..."` cho các phần tử tương tác trong E2E test.
- **Tính độc lập:** Mỗi test case phải tự khởi tạo hoặc dọn dẹp dữ liệu (test fixture), không phụ thuộc vào thứ tự chạy của test khác.
- **Không hard-code link/domain:** URL/domain thuộc cấu hình môi trường (`dashboardConfig.json` → `environments.<env>` → `core/config/env.js`). Script dùng path tương đối với `baseURL`, `env.apiBaseURL` hoặc key `*URL` riêng cho domain phụ. Chi tiết: `ai/shared/AI_PROMPTS.md` §4; được `npm run check:framework` kiểm tra tự động.

## 2. Cấu Trúc File Test
- Unit test: Nằm cạnh file mã nguồn (`[name].test.ts` hoặc trong `__tests__/`).
- E2E test: Tập trung tại thư mục `tests/` hoặc `e2e/`.

## 3. Quy Chuẩn Kiểm Thử API & Tính Năng Mới (Mandatory Non-200 Prevention)
- **Kiểm thử bao phủ 100% Endpoints mới:** Mọi page, dialog hoặc tính năng mới thêm vào phải được test toàn bộ endpoint API (GET, POST, PUT, DELETE) bằng cả API test tự động lẫn click UI thực tế trên browser.
- **Phân định rõ HTTP Status:** 
  - Lệnh chẩn đoán, quét mã nguồn, audit, hay probes hoàn tất thực thi BẮT BUỘC trả về HTTP 200 kèm payload kết quả (kể cả khi công cụ kết thúc với exit code 1 do phát hiện cảnh báo/lỗi).
  - Tuyệt đối không trả về HTTP 400 cho các lệnh chạy thành công có phát hiện. HTTP 400 chỉ dành cho request cú pháp sai hoặc dữ liệu đầu vào không hợp lệ; HTTP 403 cho vi phạm quyền/whitelist; HTTP 409 cho xung đột Mutex.
- **Nghiệm thu thực tế:** Không đóng phase khi chưa assert mã 200 cho toàn bộ nút thao tác của tính năng mới trên rendered DOM.

## 4. Quy Chuẩn Chụp Ảnh Bằng Chứng (Evidence & Screenshots)
- **Không hard-code / Không gọi screenshot trực tiếp:** Spec và Page Object không gọi `page.screenshot()` trực tiếp, luôn dùng `this.capture()` hoặc `ScreenshotHelper`.
- **Chụp khi mở page cần test (Page Entry):** Khi điều hướng đến trang cần kiểm thử, sau khi assert trạng thái sẵn sàng thì chụp đúng 1 ảnh xác lập bối cảnh ban đầu (`precondition_*` hoặc `<feature>_page_opened`).
- **Chụp sau mỗi thao tác active (Active Action):** Kể từ khi mở trang, cứ mỗi 1 thao tác active (click nút, chọn dropdown, submit, toggle, nhập xong form...) làm thay đổi trạng thái UI thì phải capture lại 1 ảnh kết quả sau thao tác.
- **Nghiêm cấm ảnh trùng kề nhau (Anti-Duplicate):** Tuyệt đối không để 2 ảnh trùng lặp kế bên nhau. Không đặt 2 lệnh capture liên tiếp nếu UI không có thay đổi thực tế. Nếu một ảnh đồng thời thỏa mãn nhiều mốc evidence thì chỉ chụp một lần duy nhất.
- **Độ ổn định trước khi capture:** Chờ skeleton loader, spinner và animation kết thúc trước khi capture; không capture trạng thái loading trung gian chớp nhoáng.
- **Chế độ chụp modal/fullpage:** Khi có popup/modal hiển thị, chỉ chụp viewport để tập trung vào modal; khi không có modal, chụp full page.

