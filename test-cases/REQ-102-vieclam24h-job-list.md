# Ma Trận Test Case: REQ-102 - Vieclam24h.QA Màn Hình Đầu

> **Mã Yêu Cầu Liên Quan:** `REQ-102`
> **Module:** App native Vieclam24h.QA — màn hình đầu (chỉ đọc)
> **Screen:** `pages/native/screens/JobListScreen.js` (locator Android lấy bằng Inspector; iOS lấy từ page source `com.vieclam24h.qa` 2.29.0 trên iPhone thật, 2026-11-24)

---

## 1. Bảng Ma Trận Truy Vết (Traceability Matrix)

| Mã TC | AC Liên Quan | Độ Ưu Tiên | Mô Tả Kịch Bản | Nền tảng | Automation | File Kịch Bản |
|:---:|:---:|:---:|---|:---:|:---:|---|
| TC-106 | AC-106 | P1 | Khởi động lạnh, màn hình đầu không có hộp thoại "Không thể tải dữ liệu…" (`@smoke`) | both | yes | tests/native/shared/job-list/job-list.native.js |
| TC-104 | AC-104 | P1 | Màn hình đầu có danh sách việc làm, ô tìm kiếm, biểu tượng thông báo | both | yes | tests/native/shared/job-list/job-list.native.js |
| TC-105 | AC-105 | P2 | Có mục "Khám phá việc làm gần tôi" | both | yes | tests/native/shared/job-list/job-list.native.js |

Spec nằm ở `shared`, Screen có đủ locator Android và iOS. App khác (Calculator, Settings iOS) thì spec tự bỏ qua (`skip`), không báo lỗi.

---

## 2. Chi Tiết Kịch Bản Kiểm Thử

### TC-106: Màn hình đầu không báo lỗi hệ thống
- **Tiền điều kiện:** App `com.vieclam24h.qa` đã cài (Android hoặc iOS), hồ sơ "Vieclam24h QA".
- **Dữ liệu kiểm thử:** Không nhập dữ liệu.

| Bước | Thao tác | Kết quả mong đợi |
|:---:|---|---|
| 1 | Tắt hẳn app rồi mở lại (`terminateApp` + `activateApp`) | App lên tiền cảnh |
| 2 | Chờ danh sách việc làm hoặc hộp thoại lỗi (tối đa 30 giây), chờ thêm 5 giây cho hộp thoại đến muộn | Một trong hai xuất hiện |
| 3 | Chụp ảnh `first_screen`, kiểm tra hộp thoại "Không thể tải dữ liệu…" | Không có hộp thoại |

Lần chạy đầu trên iPhone thật (2026-11-24, iOS 27.2.1, app 2.29.0): **FAIL 3/3 lần khởi động lạnh**, hộp thoại xuất hiện mỗi lần, danh sách việc vẫn tải phía sau.

### TC-104: Màn hình đầu đủ thành phần chính
- **Tiền điều kiện:** Điện thoại Android hoặc iPhone có app `com.vieclam24h.qa` (hồ sơ "Vieclam24h QA"), chế độ "App đã cài", noReset.
- **Dữ liệu kiểm thử:** Không nhập dữ liệu.

| Bước | Thao tác | Kết quả mong đợi |
|:---:|---|---|
| 1 | Mở app; nếu có hộp thoại "Không thể tải dữ liệu…" thì bấm "Thử lại sau" | Hộp thoại đóng |
| 2 | Chờ danh sách việc làm (tối đa 30 giây) | `list-jobs` (Android) / `list-job` (iOS) hiển thị |
| 3 | Đọc ô tìm kiếm, kiểm tra biểu tượng thông báo | Chữ gợi ý "Tìm công việc tại đây...", biểu tượng hiển thị |

### TC-105: Mục việc làm gần tôi
| Bước | Thao tác | Kết quả mong đợi |
|:---:|---|---|
| 1 | Đọc tiêu đề mục | "Khám phá việc làm gần tôi" |
