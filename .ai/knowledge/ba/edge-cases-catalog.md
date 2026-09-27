# Edge Cases & Anomaly Scenarios Catalog

> **Mặc định của Hub, chưa phải quy ước đã duyệt của dự án.** Bootstrap (Prompt 10) đối chiếu với code và design thật: giữ, sửa hoặc bỏ từng mục, rồi xóa dòng này.

> [!IMPORTANT]
> Danh mục các kịch bản biên và trạng thái bất thường bắt buộc BA phải mô tả trước khi khóa hợp đồng Gate 2.

## 1. Các Trạng Thái Dữ Liệu Biên (Data Edge States)
- `EDGE-EMPTY`: Khi danh sách hoặc tài nguyên chưa có bản ghi nào (Khởi tạo lần đầu). Bắt buộc chỉ định thông điệp hướng dẫn và nút tạo mới.
- `EDGE-PARTIAL`: Khi một tác vụ xử lý hàng loạt chỉ thành công một phần (Ví dụ: 8/10 file được tag, 2 file lỗi). Bắt buộc quy định: Hiển thị danh sách file lỗi, lý do lỗi và nút `Thử lại các mục thất bại (Retry Failed)`.
- `EDGE-BOUNDARY`: Giá trị cực tiểu (0, chuỗi rỗng), giá trị cực đại (chuỗi 255 ký tự, 10.000 bản ghi), số âm, ký tự unicode đặc biệt.

## 2. Các Trạng Thái Tương Tác Đồng Thời & Xung Đột (Concurrency & State)
- `EDGE-CONCURRENT-EDIT`: Hai người dùng hoặc hai tab cùng chỉnh sửa một tài nguyên. Bắt buộc quy định:
  - Cơ chế Optimistic Locking (dựa vào `updated_at` hoặc `version`).
  - Phản ứng hệ thống khi phát hiện xung đột: Báo toast cảnh báo "Dữ liệu đã được cập nhật bởi phiên khác", không ghi đè mất dữ liệu âm thầm.
- `EDGE-STALE-REVISION`: Client gửi dữ liệu cũ lên sau khi dữ liệu mới đã được lưu. Phải áp dụng quy tắc Revision Guard.

## 3. Các Trạng Thái Hạ Tầng & Ngoại Lệ Mạng (Infra & Network)
- `EDGE-NETWORK-TIMEOUT`: Yêu cầu gửi đi nhưng quá thời gian chờ đã định (ghi giá trị trong `engineering/project-profile.md`) mà không có phản hồi từ máy chủ. Giao diện phải thông báo timeout, không treo spinner vĩnh viễn, cho phép thử lại an toàn.
- `EDGE-RATE-LIMIT`: Khi gọi API bên thứ ba (ví dụ dịch vụ AI, lưu trữ đám mây, cổng thanh toán) bị vượt hạn mức (HTTP 429). Hệ thống phải hiển thị thông báo thân thiện kèm thời gian chờ dự kiến.
