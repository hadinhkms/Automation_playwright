# Ma Trận Test Case: REQ-101 - Mở App Native Và Hiển Thị Màn Hình Đầu

> **Mã Yêu Cầu Liên Quan:** `REQ-101`
> **Module:** App native — khởi động
> **Showcase:** Mẫu truy vết cho app native: một spec trong `tests/native/shared/` chạy trên cả Android và iOS

---

## 1. Bảng Ma Trận Truy Vết (Traceability Matrix)

| Mã TC | AC Liên Quan | Độ Ưu Tiên | Mô Tả Kịch Bản | Nền tảng | Automation | File Kịch Bản |
|:---:|:---:|:---:|---|:---:|:---:|---|
| TC-101 | AC-101 | P1 | App mở lên tiền cảnh và chụp ảnh màn hình đầu | both | yes | tests/native/shared/app-launch/app-launch.native.js |
| TC-102 | AC-102 | P1 | Màn hình đầu có cây giao diện | both | yes | tests/native/shared/app-launch/app-launch.native.js |
| TC-103 | AC-103 | P2 | App quay lại tiền cảnh sau 3 giây chạy nền | both | yes | tests/native/shared/app-launch/app-launch.native.js |

`Nền tảng`: `android` | `ios` | `both`. Kết quả gần nhất theo từng nền tảng xem ở Dashboard → Báo cáo → App native.

---

## 2. Chi Tiết Kịch Bản Kiểm Thử

### TC-101: App mở lên tiền cảnh
- **Tiền điều kiện:** Thiết bị sẵn sàng (Android: `adb devices`; iOS: Mac host phản hồi, simulator đã khai báo).
- **Dữ liệu kiểm thử:** Hồ sơ app trong `core/native/app-profiles.json` (Android: Calculator OPPO; iOS: `com.apple.Preferences`).

| Bước | Thao tác | Kết quả mong đợi |
|:---:|---|---|
| 1 | Tạo phiên Appium với app cần test | Phiên tạo thành công |
| 2 | Chờ app lên tiền cảnh (tối đa 30 giây) | Package / bundle id ở tiền cảnh đúng với app cần test |
| 3 | Chụp ảnh `foreground` | Có file `TC-101_app_launch_foreground_*.png` trong thư mục của lượt chạy |

### TC-102: Màn hình đầu có cây giao diện
| Bước | Thao tác | Kết quả mong đợi |
|:---:|---|---|
| 1 | Lấy page source | Có `<hierarchy` (Android) hoặc `<XCUIElementTypeApplication` (iOS) |

### TC-103: Quay lại sau khi chạy nền
| Bước | Thao tác | Kết quả mong đợi |
|:---:|---|---|
| 1 | `mobile: backgroundApp` 3 giây | App xuống nền rồi tự trở lại |
| 2 | Chờ app lên tiền cảnh | Package / bundle id đúng như lúc đầu |
