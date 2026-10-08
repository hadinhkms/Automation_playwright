# REQ-001: Xác Thực & Quản Lý Đăng Nhập Người Dùng (SauceDemo Showcase)

> **Mã Yêu Cầu:** `REQ-001` · **Phạm Vi:** Xác Thực & Phân Quyền · **Trạng Thái:** `Approved`  
> **Tài Liệu Mẫu:** Trình diễn Traceability Matrix cho Hub Automation Engine

---

## 1. Mô Tả Nghiệp Vụ
Hệ thống quản lý xác thực người dùng trên nền tảng thương mại điện tử SauceDemo. Đảm bảo người dùng hợp lệ có thể truy cập danh mục sản phẩm, đồng thời ngăn chặn các tài khoản bị khóa hoặc thông tin không hợp lệ.

---

## 2. Tiêu Chí Nghiệm Thu (Acceptance Criteria)

### AC-001: Đăng nhập thành công với tài khoản hợp lệ
- **Điều kiện:** Người dùng cung cấp tên đăng nhập và mật khẩu chính xác (tài khoản tiêu chuẩn `standard_user`).
- **Hành vi mong đợi:**
  - Hệ thống xác thực danh tính thành công.
  - Chuyển hướng người dùng vào trang danh mục hàng hóa (`/inventory.html`).
  - Hiển thị danh sách sản phẩm và menu điều hướng đầy đủ.

### AC-002: Chặn đăng nhập với tài khoản bị khóa
- **Điều kiện:** Người dùng sử dụng tài khoản có trạng thái khóa (`locked_out_user`).
- **Hành vi mong đợi:**
  - Hệ thống từ chối quyền truy cập.
  - Giữ người dùng ở lại trang đăng nhập.
  - Hiển thị thông báo lỗi rõ ràng: `Epic sadface: Sorry, this user has been locked out.`

### AC-003: Kiểm tra tính hợp lệ dữ liệu đăng nhập
- **Điều kiện:** Người dùng nhấn nút Đăng nhập khi để trống tên đăng nhập hoặc mật khẩu.
- **Hành vi mong đợi:**
  - Hệ thống ngăn chặn việc gửi yêu cầu xác thực rỗng.
  - Hiển thị thông báo lỗi yêu cầu nhập đầy đủ: `Epic sadface: Username is required`.
