# Learning Candidates (Pending Gate 0.5 Review)

> [!NOTE]
> Đây là nơi chứa các bài học, quan sát, quy tắc mới được AI và các Role trích xuất sau khi hoàn thành Feature, Bug fix, Review hoặc QA.
> Các candidate ở đây CHƯA PHẢI LÀ STANDARD cho đến khi được Knowledge Curator duyệt qua Gate 0.5.

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
### [LEARN-028] Quy Tắc Validation Ô Input SĐT SMS OTP (JS-8819) & Tương Tác Controlled Input Trong Modal
- **Nguồn trích xuất:** Ticket JS-8819 (Cải thiện SMS OTP: kiểm tra đầu số SĐT & countdown)
- **Role quan sát:** Senior Automation QA Engineer (Gate 4)
- **Quan sát & Nguyên tắc:**
  1. Ô input SĐT của Seeker giới hạn cứng `maxLength = 10` và tự động cắt từ ký tự thứ 11 (kể cả khi paste số 11 chữ số hoặc mã vùng `+84`/`84`), đồng thời hiển thị dòng cảnh báo `"Số điện thoại không hợp lệ"` bên dưới ô input là **hành vi chủ đích của đội phát triển (By Design)**, không phải bug.
  2. Khi kiểm thử ô input SĐT React trong HeadlessUI modal (`[role="dialog"]`), luôn scope locator vào `dialog`, xóa giá trị cũ bằng `click()` + `Control+A` + `Backspace` trước khi `pressSequentially()`, và dùng `.getByText(/Số điện thoại không hợp lệ/i)` thay vì nối chuỗi CSS với `text=`.
- **Trạng thái:** PENDING

### [CAND-20261030-CHOP-ONBOARDING] Chớp Web – test luồng đăng nhập/onboarding trên QC
- **Role quan sát:** Senior QA (Gate 4)
- **Quan sát & Nguyên tắc:**
  1. Onboarding seeker nằm trong `#common__modal`; dropdown ngành nghề render qua portal `[data-test-id="common__select-dropdown"]` → chọn option ngoài modal. Trên mobile picker toàn màn hình không có nút Đóng (chạm vùng trống để thoát); màn đồng ý DLCN phải cuộn hết mới bật "Đồng ý".
  2. Kiểm tra "hội thoại mới" của chatbot bằng `conversation_id` trong `POST apigw/api/v1/chatbot/chats`, không dựa vào UI. Tracking chatbot không phát ra phía client trên QC → không kết luận tracking qua network.
- **Trạng thái:** PENDING

### [CAND-20261102-APPBOX-CHECKLIST] Checklist Appbox trong Jira issue property
- **Quan sát:** [2026-11-02] Checklist Appbox lưu ở issue property `com.appbox.ai.checklist-ticket-checklist(_0)` (compress-json); mark DONE = `done:true` + status Completed `241b6786-…` + cập nhật section/stats, sửa tại chỗ và verify round-trip; mỗi property Jira ≤ 32.768 byte (PUT 400 nếu vượt) → đo byte trước khi ghi, đừng ghi header/stats trước data; status khác: Blocked `9433c363-…`, Skipped `4ae1bba0-…` (isDone). Headless lặp nhiều lần trên QC bị chặn autocomplete/reverse-geocode (reCAPTCHA) → chuyển sang browser thật. QC giới hạn ~3 lần gửi OTP/SĐT → dùng user mới cho mỗi luồng login.
- **Trạng thái:** PENDING
- **Đề xuất Curator:** REJECTED — ngoài phạm vi repo automation (thao tác Jira/Appbox); đã lưu vào memory cá nhân của agent. Cần Owner ký duyệt trong promotion-log.

### [CAND-20261103-OTP-PASTE-TRUSTED] Paste OTP bằng ClipboardEvent giả có isTrusted=false
- **Role quan sát:** Senior QA (Gate 4) — JS-8873 (2026-11-03): paste OTP do script tạo (`new ClipboardEvent`) có `isTrusted=false`; component OTP có nhánh riêng cho paste trusted 4 số → không kết luận bug paste từ event giả, phải xác nhận trên thiết bị/Playwright `page.keyboard` với clipboard thật.
- **Trạng thái:** PENDING
- **Đề xuất Curator:** giữ PENDING (1 evidence, Severity NORMAL).

### [CAND-20261106-REACT-DOM-REMOVE] Xoá node React để đóng popup làm hỏng router (404 → redirect)
- **Role quan sát:** Senior QA (Gate 4) — TC-094 (2026-11-06): `el.remove()` trên `.ReactModalPortal`/`.mbep-popup` (BasePage.closeAllPopupsIfVisible, auto-handler) làm hỏng cây React → điều hướng client-side kế tiếp render 404 "Không tìm thấy trang" ~6s rồi redirect về `/tim-kiem-viec-lam-nhanh`, ghi đè bộ lọc → dễ báo nhầm bug sản phẩm. Chỉ ẩn (`style.display='none'`), không remove node React; repro "bug" phải chạy không can thiệp DOM. Ngành ở Home là `<a href="/viec-lam-...-oN.html">` (không còn trong heading).
- **Trạng thái:** PENDING
- **Severity:** HIGH
- **Đề xuất Curator:** RESOLVED — cùng nguyên nhân gốc với lesson 2026-11-05 "Shared popup helpers close or corrupt feature modals"; đã mở rộng lesson đó (triệu chứng 404/redirect, helper chung nay chỉ ẩn). Cần Owner ký duyệt trong promotion-log.
- **Merged Into (đề xuất):** ai/shared/TEST_AUTOMATION_LESSONS.md

