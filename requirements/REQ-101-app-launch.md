# REQ-101: Mở App Native Và Hiển Thị Màn Hình Đầu (Android & iOS)

> **Mã Yêu Cầu:** `REQ-101` · **Phạm Vi:** App native — khởi động · **Trạng Thái:** `Approved`
> **Tài Liệu Mẫu:** Mẫu truy vết cho app native (dải số `REQ-1xx`), một spec dùng chung cho Android và iOS (PLAN-25 S-03)

---

## 1. Mô Tả Nghiệp Vụ
App cần test (APK, app đã cài, hoặc app iOS trên máy Mac) phải mở được lên màn hình đầu, vẽ được giao diện và quay lại đúng trạng thái sau khi người dùng chuyển sang app khác. Đây là smoke tối thiểu trước mọi luồng nghiệp vụ native.

---

## 2. Tiêu Chí Nghiệm Thu (Acceptance Criteria)

### AC-101: App lên tiền cảnh
- **Điều kiện:** Phiên Appium tạo thành công với app cần test (package Android hoặc bundle id iOS).
- **Hành vi mong đợi:** App cần test nằm ở tiền cảnh trong vòng 30 giây; có ảnh bằng chứng màn hình đầu.

### AC-102: Màn hình đầu có giao diện
- **Điều kiện:** App đã ở tiền cảnh.
- **Hành vi mong đợi:** Cây giao diện (page source) có phần tử gốc của nền tảng (`hierarchy` trên Android, `XCUIElementTypeApplication` trên iOS).

### AC-103: Quay lại sau khi chạy nền
- **Điều kiện:** App đang ở tiền cảnh, bị đưa xuống nền 3 giây.
- **Hành vi mong đợi:** App tự trở lại tiền cảnh, đúng package / bundle id ban đầu.
