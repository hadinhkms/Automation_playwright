# QA & Testing Conventions

> [!NOTE]
> Quy chuẩn viết test tự động (Unit, Integration, E2E) trong dự án này.

## 1. Nguyên Tắc Kiểm Thử
- **Không dùng `sleep` cứng:** Luôn dùng explicit waits (`waitFor`, `waitForResponse`, `toBeVisible`).
- **Test ID Convention:** Sử dụng thuộc tính `data-testid="..."` cho các phần tử tương tác trong E2E test.
- **Tính độc lập:** Mỗi test case phải tự khởi tạo hoặc dọn dẹp dữ liệu (test fixture), không phụ thuộc vào thứ tự chạy của test khác.

## 2. Cấu Trúc File Test
- Unit test: Nằm cạnh file mã nguồn (`[name].test.ts` hoặc trong `__tests__/`).
- E2E test: Tập trung tại thư mục `tests/` hoặc `e2e/`.

## 3. Quy Chuẩn Kiểm Thử API & Tính Năng Mới (Mandatory Non-200 Prevention)
- **Kiểm thử bao phủ 100% Endpoints mới:** Mọi page, dialog hoặc tính năng mới thêm vào phải được test toàn bộ endpoint API (GET, POST, PUT, DELETE) bằng cả API test tự động lẫn click UI thực tế trên browser.
- **Phân định rõ HTTP Status:** 
  - Lệnh chẩn đoán, quét mã nguồn, audit, hay probes hoàn tất thực thi BẮT BUỘC trả về HTTP 200 kèm payload kết quả (kể cả khi công cụ kết thúc với exit code 1 do phát hiện cảnh báo/lỗi).
  - Tuyệt đối không trả về HTTP 400 cho các lệnh chạy thành công có phát hiện. HTTP 400 chỉ dành cho request cú pháp sai hoặc dữ liệu đầu vào không hợp lệ; HTTP 403 cho vi phạm quyền/whitelist; HTTP 409 cho xung đột Mutex.
- **Nghiệm thu thực tế:** Không đóng phase khi chưa assert mã 200 cho toàn bộ nút thao tác của tính năng mới trên rendered DOM.

