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

### `[PITFALL-003]` Co Ép Phần Tử (Flex-Shrink Clipping) Trong Khung Cuộn Accordion
- **Lý do:** CSS Flexbox mặc định `flex-shrink: 1` sẽ bóp nghẹt chiều cao các khối con khi mở rộng danh sách cuộn.
- **DO:** Luôn khai báo `flex-shrink: 0; min-height: fit-content;` trên các card accordion hoặc collapsible block.
- **DON'T:** Để flex item tự co ép chiều cao trong container `overflow-y: auto`.

### `[PITFALL-004]` Khóa Chết Modal Khi Kích Hoạt Đa Phân Hệ (Cross-Module Modal)
- **Lý do:** Gắn event listener của modal dùng chung bên trong hàm khởi tạo riêng của một tab khiến mở từ tab khác bị đơ.
- **DO:** Tự đóng gói hàm listener riêng (`initPomModalControls()`), bảo vệ bằng flag idempotent, gọi ngay khi mở modal.
- **DON'T:** Đăng ký listener của popup chung bên trong controller riêng của một view.

### `[PITFALL-005]` Treo Tiến Trình Codegen & Zombie Session
- **Lý do:** Đóng browser từ Windows hoặc tràn pipe buffer stdout/stderr làm Playwright treo và backend trả về 409 Conflict.
- **DO:** Dùng `taskkill /pid ${pid} /T /F` trên Windows; tự động thu dọn session cũ khi khởi chạy mới thay vì chặn 409; luôn gắn listener đọc stream stdout/stderr.
- **DON'T:** Dùng kill thông thường hoặc bỏ qua stream output của tiến trình con.

### `[PITFALL-006]` Mù Tri Thức Đa Phân Hệ Do Cache Vĩnh Viễn (Cross-Module Cache Stale)
- **Lý do:** Biến cache datasets nạp 1 lần lúc startup và bị chặn bởi `if (!cache.length)` khiến BDD không thấy data mới tạo từ tab khác.
- **DO:** Luôn nạp dữ liệu tươi (`forceReload = true`) khi chuyển tab hoặc mở accordion; cập nhật cache chung ngay khi tạo/xóa file.
- **DON'T:** Tin tưởng mảng cache tĩnh trong bộ nhớ giữa các phân hệ độc lập.

