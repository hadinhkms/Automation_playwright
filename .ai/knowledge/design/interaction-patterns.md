# Interaction Patterns & UX Ergonomics

> **Mặc định của Hub, chưa phải quy ước đã duyệt của dự án.** Bootstrap (Prompt 10) đối chiếu với code và design thật: giữ, sửa hoặc bỏ từng mục, rồi xóa dòng này.

> [!IMPORTANT]
> Quy chuẩn hành vi tương tác, phản hồi trạng thái, chống thao tác nhầm, công thái học Studio/Workspace và giảm tải nhận thức.

## 1. Trạng Thái Nút Bấm & Thao Tác Bất Đồng Bộ
- **Click Guard:** Khi kích hoạt tác vụ API, nút bấm lập tức chuyển sang `isLoading = true`, vô hiệu hóa click (`disabled`) và hiển thị spinner để chống double submit.
- **Visual Feedback:** Không bao giờ để người dùng chờ đợi mà không có phản hồi thị giác trong vòng 100ms.

## 2. Thao Tác Nguy Hiểm (Destructive Actions)
- Xóa vĩnh viễn, ghi đè dữ liệu, reset cấu hình bắt buộc hiển thị **Confirmation Modal**.
- Nút xác nhận xóa phải dùng `--color-danger` (Đỏ), nút Hủy phải ở vị trí mặc định dễ bấm.
- Modal phải tự động focus vào nút Hủy để tránh bấm nhầm phím Space/Enter.

## 3. Kiểm Tra Dữ Liệu & Báo Lỗi (Validation UX)
- **Inline Error:** Lỗi trường nhập liệu hiển thị ngay dưới ô input (`text-danger`, `12px`), không chỉ dựa vào màu sắc (phải kèm text rõ nguyên nhân và cách khắc phục).
- **Toast Notifications:** Thông báo kết quả tác vụ xuất hiện ở góc trên bên phải (hoặc dưới giữa trên mobile), tự động biến mất sau 3000ms; cho phép bấm đóng thủ công.

## 4. Công Thái Học Không Gian Làm Việc Chuyên Sâu (Studio & Workspace UX)
- **Floating Action Bar:** Các tác vụ hàng loạt (Bulk update, Bulk delete, Export) gom vào thanh nổi dưới chân màn hình (`z-floating`, backdrop-blur, shadow nổi bật).
- **Thanh kéo (Slider / Timeline):** Hiển thị giá trị hiện tại khi kéo (tooltip), điều khiển được bằng bàn phím (mũi tên, Home/End), vùng chạm ≥ 44px trên mobile.
- **Tab & Filter Transitions:** Chuyển đổi giữa các tab không reload toàn bộ trang, giữ nguyên vị trí cuộn trang (preserve scroll position).
- **Undo / Redo Affordance:** Khi thực hiện thao tác quan trọng, hiển thị toast kèm nút `Hoàn tác (Undo)` trong 5 giây.

## 5. Trạng Thái Biên Cao Cấp (Empty & Error States)
- **Empty State Chuẩn 3 Lớp:**
  1. Icon minh họa kích thước `48x48px` với nền tròn mờ tinh tế.
  2. Tiêu đề ngắn gọn và thông điệp giải thích lý do danh sách rỗng.
  3. Nút hành động chính (Primary CTA) dẫn trực tiếp vào luồng tạo mới.
- **Loading State:** Sử dụng Skeleton Shimmer cùng kích thước với dữ liệu thật để tránh hiện tượng nhảy khung hình (CLS).
