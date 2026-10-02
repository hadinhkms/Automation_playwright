# Ma Trận Test Case: REQ-001 - Xác Thực Người Dùng SauceDemo

> **Mã Yêu Cầu Liên Quan:** `REQ-001`  
> **Module:** Authentication & Access Control  
> **Showcase:** Mẫu truy vết chuẩn cho Hub Automation Engine

---

## 1. Bảng Ma Trận Truy Vết (Traceability Matrix)

| Mã TC | AC Liên Quan | Độ Ưu Tiên | Mô Tả Kịch Bản | Automation | File Kịch Bản |
|:---:|:---:|:---:|---|:---:|---|
| TC-001 | AC-001 | P1 | Đăng nhập thành công với tài khoản tiêu chuẩn | yes | tests/e2e/desktop/saucedemo_login.spec.js |
| TC-002 | AC-002 | P2 | Chặn đăng nhập và báo lỗi khi tài khoản bị khóa | yes | tests/e2e/desktop/saucedemo_login.spec.js |
| TC-003 | AC-003 | P2 | Báo lỗi yêu cầu thông tin khi để trống dữ liệu | yes | tests/e2e/desktop/saucedemo_login.spec.js |

---

## 2. Chi Tiết Kịch Bản Kiểm Thử

### TC-001: Đăng nhập thành công với tài khoản hợp lệ (Standard User)
- **Tiền điều kiện:** Người dùng mở trình duyệt chưa xác thực tại trang SauceDemo.
- **Dữ liệu kiểm thử:** `standard_user` / `secret_sauce`.

| Bước | Thao tác | Kết quả mong đợi |
|:---:|---|---|
| 1 | Mở trang đăng nhập `https://www.saucedemo.com` | Trang đăng nhập hiển thị đầy đủ form |
| 2 | Nhập username hợp lệ và password hợp lệ | Các trường nhận đúng giá trị |
| 3 | Nhấn nút "Login" | Chuyển hướng thành công đến `/inventory.html` |

### TC-002: Đăng nhập thất bại với tài khoản bị khóa (Locked Out User)
- **Tiền điều kiện:** Tài khoản đã bị khóa quyền trên hệ thống.
- **Dữ liệu kiểm thử:** `locked_out_user` / `secret_sauce`.

| Bước | Thao tác | Kết quả mong đợi |
|:---:|---|---|
| 1 | Mở trang đăng nhập `https://www.saucedemo.com` | Trang đăng nhập hiển thị đầy đủ form |
| 2 | Nhập username bị khóa và password | Form nhận dữ liệu |
| 3 | Nhấn nút "Login" | Hiển thị lỗi `Epic sadface: Sorry, this user has been locked out.` |

### TC-003: Kiểm tra thông báo lỗi khi để trống trường thông tin
- **Tiền điều kiện:** Form đăng nhập rỗng.

| Bước | Thao tác | Kết quả mong đợi |
|:---:|---|---|
| 1 | Mở trang đăng nhập `https://www.saucedemo.com` | Form đăng nhập hiển thị |
| 2 | Để trống cả 2 trường và nhấn nút "Login" | Hiển thị cảnh báo `Epic sadface: Username is required` |
