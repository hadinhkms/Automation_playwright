# Permission Patterns & Data Scope Guidelines

> **Mặc định của Hub, chưa phải quy ước đã duyệt của dự án.** Bootstrap (Prompt 10) đối chiếu với code và design thật: giữ, sửa hoặc bỏ từng mục, rồi xóa dòng này.

> [!IMPORTANT]
> Quy chuẩn thiết kế kiến trúc phân quyền, tách biệt rành mạch giữa Quyền Thao Tác (Feature Permission) và Phạm Vi Dữ Liệu (Data Scope).

## 1. Tách Biệt Feature Permission vs Data Scope
- **Feature Permission (Thao tác):** Xác định người dùng ĐƯỢC PHÉP làm hành động gì (Ví dụ: `CREATE_ORDER`, `APPROVE_REQUEST`, `EXPORT_REPORT`, `DELETE_USER`). Quản lý qua vai trò (Roles) hoặc quyền năng (Permissions).
- **Data Scope (Phạm vi nhìn thấy):** Xác định người dùng được thực hiện thao tác đó TRÊN TẬP DỮ LIỆU NÀO:
  - `SCOPE_GLOBAL / HQ`: Nhìn thấy và tác động lên toàn bộ dữ liệu hệ sinh thái.
  - `SCOPE_BRANCH / ORG`: Chỉ nhìn thấy và tác động trong chi nhánh / tổ chức của mình.
  - `SCOPE_SELF`: Chỉ nhìn thấy và tác động lên tài nguyên do chính mình tạo ra (`created_by == current_user_id`).

## 2. Tư Duy Phân Cấp (HQ vs Branch / Parent - Child Mindset)
- **Nhánh Chính (HQ / Headquarter):**
  - Đóng vai trò giám sát tổng thể mạng lưới.
  - Được xem dashboard hợp nhất, tổng số lượng nhánh con, phiên bản và trạng thái đồng bộ toàn hệ thống.
- **Nhánh Con (Branch / Workspace Con):**
  - Vận hành cục bộ tinh gọn theo nguyên tắc tối thiểu cần biết (**Need-to-know**).
  - Áp dụng triệt để cách ly dữ liệu (**Data Isolation**): Không hiển thị danh sách nhánh con khác, không truy vấn dữ liệu chéo tổ chức.
  - Chỉ nhận trạng thái đồng bộ (`Sync Status`) và cấu hình ủy quyền từ HQ.

## 3. Nguyên Tắc An Toàn Nghiệp Vụ (Zero Trust BA Guard)
- **Frontend chỉ để phục vụ UX:** Việc ẩn nút bấm hoặc làm mờ giao diện chỉ giúp người dùng không bối rối, không phải là cơ chế bảo mật.
- **Ràng buộc Backend bắt buộc:** Mọi Business Rule (`BR-xx`) về quyền hạn phải khẳng định rõ: "Backend API bắt buộc xác thực lại User ID, Org ID và Scope trước khi thực hiện thao tác ghi/đọc, không tin tưởng tham số do client gửi lên".
