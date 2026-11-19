# REQ-102: Vieclam24h.QA — Màn Hình Đầu Có Danh Sách Việc Làm (chỉ đọc)

> **Mã Yêu Cầu:** `REQ-102` · **Phạm Vi:** App native Vieclam24h.QA (`com.vieclam24h.qa`) — màn hình đầu · **Trạng Thái:** `Approved`
> **Nguồn:** UAT-401 của PLAN-25 P4: Screen `pages/native/screens/JobListScreen.js` lấy bằng Inspector trên Dashboard

---

## 1. Mô Tả Nghiệp Vụ
Sau khi mở app, người tìm việc thấy ô tìm kiếm, biểu tượng thông báo và danh sách việc làm gợi ý. Bản QA có thể mở kèm hộp thoại "Không thể tải dữ liệu…"; người dùng bấm "Thử lại sau" để đóng. Kịch bản chỉ đọc: không đăng nhập, không ứng tuyển, không tạo dữ liệu.

---

## 2. Tiêu Chí Nghiệm Thu (Acceptance Criteria)

### AC-104: Màn hình đầu đủ thành phần chính
- **Điều kiện:** App `com.vieclam24h.qa` ở tiền cảnh, hộp thoại lỗi (nếu có) đã đóng.
- **Hành vi mong đợi:** Danh sách việc làm (`list-jobs`) hiển thị; ô tìm kiếm có chữ gợi ý "Tìm công việc tại đây..."; biểu tượng thông báo (`ic-notification`) hiển thị; có ảnh bằng chứng.

### AC-105: Mục việc làm gần tôi
- **Điều kiện:** Như AC-104.
- **Hành vi mong đợi:** Có tiêu đề "Khám phá việc làm gần tôi".
