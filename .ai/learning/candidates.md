# Learning Candidates (Pending Gate 0.5 Review)

> [!NOTE]
> Đây là nơi chứa các bài học, quan sát, quy tắc mới được AI và các Role trích xuất sau khi hoàn thành Feature, Bug fix, Review hoặc QA.
> Các candidate ở đây CHƯA PHẢI LÀ STANDARD cho đến khi được Knowledge Curator duyệt qua Gate 0.5.

<!-- Mẫu ứng viên học hỏi:
### [LEARN-026] Chuẩn Hóa Dropdown Kỹ Năng Tùy Chỉnh / Hệ Thống & Bẫy Selector Nút Lưu Tại Actions-Button
- **Nguồn trích xuất:** TASK-PROFILE-AND-APPLY-SKILL-BEHAVIOR-FIX (REQ-005 & REQ-001)
- **Role quan sát:** Senior Automation QA Engineer (Gate 4)
- **Quan sát (Observation):**
  1. Giao diện mới của dropdown Kỹ năng (Skill) trên Hồ sơ cá nhân và Modal Ứng tuyển không còn sử dụng thẻ `<li role="listitem">` truyền thống. Khi nhập kỹ năng mới chưa có trong từ điển hệ thống, UI hiển thị item dạng `Thêm mới: <tên kỹ năng>`. Với kỹ năng đã có trong từ điển, UI hiển thị item dạng checkbox kèm nhãn text. Việc kịch bản cũ chỉ chờ `getByRole('listitem')` hoặc text tuyệt đối khiến Playwright bị treo timeout 30s.
  2. Trong container chứa các nút hành động của form hồ sơ `[data-test-id="common__actions-button"]`, nút đầu tiên là `Hủy` (Cancel), nút thứ hai mới là `Lưu` (Save). Nếu viết selector dạng `locator('[data-test-id="common__actions-button"] button').first()` hoặc `.or()` không lọc text thì Playwright sẽ click trúng nút `Hủy`, kích hoạt popup cảnh báo `Có thay đổi chưa được lưu` và chặn toàn bộ các tương tác kế tiếp.
  3. Kịch bản ứng tuyển qua Hồ sơ gồm chuỗi thao tác lưu 7 section và capture fullpage evidence trên môi trường QC có thời gian thực thi > 10 phút. Cần cấu hình `test.setTimeout(900000)` trước `test.slow()` để tránh bị runner ngắt giữa chừng.
- **Bằng chứng (Evidence):** `pages/desktop/UserProfilePage.js`, `pages/desktop/JobApplyPage.js`, `pages/mobile-web/MobileUserProfilePage.js`, `tests/e2e/desktop/setting_user_profile-bdd.spec.js`, `tests/e2e/desktop/apply_job_with_profile_flow-bdd.spec.js`
- **Đề xuất phân loại:** APPROVED STANDARD
- **Phạm vi đề xuất:** PROJECT
- **Đề xuất Owner duyệt:** Principal QA / Automation Lead
- **Trạng thái:** PENDING
- **Nguyên tắc rút ra:**
  1. Xử lý dropdown kỹ năng bằng selector đa tầng: tìm option `text=/Thêm mới:\s*<skill>/i`, fallback sang exact match hoặc partial match, và dự phòng phím `Enter` nếu dropdown không xuất hiện.
  2. Tuyệt đối không chọn nút Save chung chung bằng `.first()` trong `common__actions-button`; luôn lọc tường minh qua text: `.filter({ hasText: /Lưu/i })` hoặc `getByRole('button', { name: /Lưu/i })`.
  3. Với các luồng composite dài trên QC, luôn chủ động tăng timeout phù hợp trước khi gọi `test.slow()`.

