# Critical User Journeys (QA Focus)

> [!IMPORTANT]
> Các luồng nghiệp vụ sống còn của sản phẩm.
> Mọi bản build hoặc release đều bắt buộc phải vượt qua kiểm thử của các journey này.

## Danh Sách Critical Journeys

### 1. [Journey-01] Authentication & Session Management
- **Mô tả:** Đăng nhập, refresh token, giữ phiên làm việc và đăng xuất.
- **Tiêu chuẩn kiểm thử:** Không bị logout vô cớ khi reload; token hết hạn tự động điều hướng về login kèm thông báo.
- **E2E Test Spec:** `tests/e2e/auth.spec.ts`

### 2. [Journey-02] Core Business Transaction Flow
- **Mô tả:** Luồng tạo, cập nhật và hoàn tất giao dịch chính của ứng dụng.
- **Tiêu chuẩn kiểm thử:** Dữ liệu lưu toàn vẹn, tính toán chính xác số liệu, không phát sinh trùng lặp.
