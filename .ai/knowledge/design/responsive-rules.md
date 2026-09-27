# Responsive Breakpoints & Mobile Ergonomics

> **Mặc định của Hub, chưa phải quy ước đã duyệt của dự án.** Bootstrap (Prompt 10) đối chiếu với code và design thật: giữ, sửa hoặc bỏ từng mục, rồi xóa dòng này.

> [!IMPORTANT]
> Quy chuẩn tương thích hiển thị đa thiết bị từ màn hình di động hẹp (390px) đến máy trạm siêu rộng (2560px).

## 1. Ma Trận Điểm Ngắt (Responsive Breakpoints)

| Breakpoint | Chiều rộng | Thiết bị mục tiêu | Quy tắc bố cục chính |
|---|---|---|---|
| `sm` (Mobile) | `390px - 640px` | Smartphone cầm tay | 1 cột duy nhất, không tràn ngang, bottom sheet thay modal |
| `md` (Tablet) | `768px - 1024px` | iPad / Tablet | Tối đa 2 cột, sidebar có thể thu gọn (collapsible) |
| `lg` (Desktop) | `1024px - 1440px` | Laptop tiêu chuẩn | Bố cục 2-3 cột hoàn chỉnh, fixed header |
| `2xl` (Wide) | `1440px - 2560px` | Màn hình ngoài HD/4K | Giới hạn max-width container (1600px) hoặc mở rộng dashboard |

## 2. Tiện Dụng Cảm Ứng Trên Di Động (Touch Ergonomics)
- **Kích thước vùng chạm (Touch Target):** Mọi nút bấm, link hoặc icon có thể bấm được trên mobile phải đạt tối thiểu `44x44px` (tính cả padding) để ngón tay dễ thao tác.
- **Tránh phụ thuộc Hover:** Tuyệt đối không giấu thông tin quan trọng hoặc nút tác vụ chỉ hiện khi hover chuột; trên thiết bị cảm ứng không có trạng thái hover.
- **Khoảng cách an toàn (Thumb Zone):** Đưa các tác vụ chính (Save, Next, Action bar) về nửa dưới màn hình để ngón tay cái dễ chạm tới.

## 3. Chống Tràn Ngang (Zero Horizontal Scrollbar)
- Mọi bảng dữ liệu trên mobile phải hỗ trợ cuộn nội bộ trong container (`overflow-x: auto`) hoặc tự chuyển sang dạng danh sách thẻ (Card View).
- Text dài phải có `break-words` hoặc `truncate` kèm tooltip để không phá vỡ khung giao diện.
