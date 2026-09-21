# Known Engineering Pitfalls & Bugs Lessons

> [!CAUTION]
> Danh sách các "cạm bẫy" kỹ thuật, lỗi lặp đi lặp lại hoặc các bài học xương máu đã được kiểm chứng trong dự án này.
> AI và Kỹ sư phải kiểm tra danh sách này trước khi triển khai các module nhạy cảm.

## Danh Sách Pitfalls

### `[PITFALL-001]` Xử lý Race Condition khi Search / Filter
- **Hiện tượng:** Khi user gõ nhanh, kết quả request cũ trả về sau đè lên kết quả request mới.
- **Giải pháp bắt buộc:** Sử dụng AbortController để cancel request trước đó hoặc dùng debounce tối thiểu 300ms.
- **Phạm vi áp dụng:** Toàn bộ ô tìm kiếm và filter bảng dữ liệu.

### `[PITFALL-002]` Idempotency cho Thao Tác Tạo Dữ Liệu (Create / Submit)
- **Hiện tượng:** Click nút nhiều lần hoặc network lag tạo duplicate records.
- **Giải pháp bắt buộc:** Disable nút với trạng thái `loading`, bổ sung request token / idempotency key phía client/server.
