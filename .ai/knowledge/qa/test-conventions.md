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
