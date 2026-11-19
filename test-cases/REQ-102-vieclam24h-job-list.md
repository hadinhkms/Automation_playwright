# Ma Trận Test Case: REQ-102 - Vieclam24h.QA Màn Hình Đầu

> **Mã Yêu Cầu Liên Quan:** `REQ-102`
> **Module:** App native Vieclam24h.QA — màn hình đầu (chỉ đọc)
> **Screen:** `pages/native/screens/JobListScreen.js` (locator Android lấy bằng Inspector; ô iOS còn trống)

---

## 1. Bảng Ma Trận Truy Vết (Traceability Matrix)

| Mã TC | AC Liên Quan | Độ Ưu Tiên | Mô Tả Kịch Bản | Nền tảng | Automation | File Kịch Bản |
|:---:|:---:|:---:|---|:---:|:---:|---|
| TC-104 | AC-104 | P1 | Màn hình đầu có danh sách việc làm, ô tìm kiếm, biểu tượng thông báo | android | yes | tests/native/shared/job-list/job-list.native.js |
| TC-105 | AC-105 | P2 | Có mục "Khám phá việc làm gần tôi" | android | yes | tests/native/shared/job-list/job-list.native.js |

Spec nằm ở `shared` để khi có bản iOS chỉ cần bổ sung ô `ios` trong Screen. App khác (Calculator, Settings iOS) thì spec tự bỏ qua (`skip`), không báo lỗi.

---

## 2. Chi Tiết Kịch Bản Kiểm Thử

### TC-104: Màn hình đầu đủ thành phần chính
- **Tiền điều kiện:** Điện thoại Android có app `com.vieclam24h.qa` (hồ sơ "Vieclam24h QA"), chế độ "App đã cài", noReset.
- **Dữ liệu kiểm thử:** Không nhập dữ liệu.

| Bước | Thao tác | Kết quả mong đợi |
|:---:|---|---|
| 1 | Mở app; nếu có hộp thoại "Không thể tải dữ liệu…" thì bấm "Thử lại sau" | Hộp thoại đóng |
| 2 | Chờ danh sách việc làm (tối đa 30 giây) | `list-jobs` hiển thị |
| 3 | Đọc ô tìm kiếm, kiểm tra biểu tượng thông báo | Chữ gợi ý "Tìm công việc tại đây...", biểu tượng hiển thị |

### TC-105: Mục việc làm gần tôi
| Bước | Thao tác | Kết quả mong đợi |
|:---:|---|---|
| 1 | Đọc tiêu đề mục | "Khám phá việc làm gần tôi" |
