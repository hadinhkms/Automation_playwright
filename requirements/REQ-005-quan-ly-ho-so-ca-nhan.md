---
id: REQ-005
title: Quản lý hồ sơ cá nhân của người tìm việc
status: Inferred
version: 1.1
risk: high
owner: QA
test_cases: test-cases/REQ-005-quan-ly-ho-so-ca-nhan.md
---

# REQ-005 — Quản lý hồ sơ cá nhân của người tìm việc

| Thuộc tính | Giá trị |
|---|---|
| Mã | REQ-005 |
| Phiên bản | 1.1 |
| Vai trò | Người tìm việc đã đăng nhập |
| Nguồn dựng | Automation hiện có, dựng ngược theo AI_PROMPTS.md mục 3.4 |
| Trạng thái tổng thể | Inferred |

## Bối cảnh nghiệp vụ

Trang "Hồ sơ của tôi" là nơi người tìm việc hoàn thiện hồ sơ để nhà tuyển dụng tìm thấy mình. Hồ sơ
gồm ba nhóm dữ liệu tách biệt:

1. **Thông tin cá nhân** — tỉnh thành, quận huyện, ngày sinh, giới tính.
2. **Tiêu chí tìm việc** — vị trí mong muốn, ngành nghề, địa điểm, mức lương, cấp bậc, hình thức làm việc, số năm kinh nghiệm.
3. **Nội dung hồ sơ** — bảy mục: Giới thiệu bản thân, Kinh nghiệm làm việc, Học vấn, Kỹ năng, Thành tựu, Chứng chỉ, Ngoại ngữ.

Ngoài ra người dùng có thể tải lên một file CV và để hệ thống chuyển đổi nội dung file đó thành dữ
liệu hồ sơ, thay vì gõ tay từng mục.

Việc cho phép nhà tuyển dụng tìm thấy hồ sơ là một hành động có kiểm soát: nó cần xác minh bằng mã.

## Acceptance criteria

### AC-015 — Cập nhật thông tin cá nhân

**Given** tôi đã đăng nhập và đang ở trang Hồ sơ của tôi
**When** tôi mở phần chỉnh sửa thông tin cá nhân, điền tỉnh thành, quận huyện, ngày sinh, giới tính và lưu
**Then** thông tin cá nhân phải được lưu vào hồ sơ

- Trạng thái: Inferred — spec lưu xong là kết thúc bước, không đọc lại để đối chiếu giá trị đã lưu.
- Nguồn: tests/e2e/desktop/complete_profile_setup-bdd.spec.js, tests/e2e/mobile-web/complete_profile_setup-bdd.mobile.spec.js

### AC-016 — Khai báo tiêu chí tìm việc

**Given** tôi đang ở phần Tiêu chí tìm việc
**When** tôi thêm một vị trí công việc mong muốn và điền kinh nghiệm, số năm, vị trí, ngành nghề, địa điểm, mức lương, cấp bậc, hình thức làm việc rồi lưu
**Then** tiêu chí tìm việc phải được lưu vào hồ sơ

- Trạng thái: Inferred — không đọc lại để đối chiếu.
- Quan hệ cần làm rõ: tập dữ liệu này trùng một phần với onboarding ở REQ-002.
- Nguồn: tests/e2e/desktop/complete_profile_setup-bdd.spec.js, tests/e2e/mobile-web/complete_profile_setup-bdd.mobile.spec.js

### AC-017 — Bật cho phép tìm kiếm hồ sơ phải qua bước xác minh

**Given** tôi đã điền tiêu chí tìm việc
**When** tôi bật tính năng cho phép nhà tuyển dụng tìm kiếm hồ sơ và bấm Tiếp tục
**Then** hệ thống phải yêu cầu nhập mã xác minh gồm bốn chữ số
**And** sau khi nhập mã và tải lên CV, tôi bấm Cho phép tìm kiếm thì hồ sơ được công khai cho nhà tuyển dụng

- Trạng thái: Inferred — có bước chờ trạng thái tải xong nhưng không có assertion nào xác nhận hồ sơ đã ở trạng thái công khai.
- Đây là ràng buộc quyền riêng tư: hồ sơ **không** tự động công khai, người dùng phải chủ động bật và xác minh.
- Nguồn: tests/e2e/desktop/complete_profile_setup-bdd.spec.js, tests/e2e/mobile-web/complete_profile_setup-bdd.mobile.spec.js

### AC-018 — Thêm và lưu từng mục nội dung hồ sơ

**Given** tôi đang ở trang Hồ sơ của tôi
**When** tôi lần lượt thêm Giới thiệu bản thân, Kinh nghiệm làm việc, Học vấn, Kỹ năng, Dự án/thành tựu, Chứng chỉ/bằng cấp, Ngoại ngữ và lưu từng mục
**Then** mỗi mục phải được lưu độc lập vào hồ sơ

- Trạng thái: Confirmed — toàn bộ các mục được lưu độc lập theo từng modal/form con.
- Ràng buộc quan sát được: mỗi mục là một form riêng, mở ra, điền, lưu, đóng lại; các mục có thể hiển thị badge "Chớp hỗ trợ" hoặc "Đề xuất".
- Nguồn: tests/e2e/desktop/setting_user_profile-bdd.spec.js, tests/e2e/mobile-web/setting_user_profile-bdd.mobile.spec.js

### AC-019 — Tải lên CV và chuyển đổi thành dữ liệu hồ sơ

**Given** tôi đang ở trang Hồ sơ của tôi
**When** tôi tải lên một file CV (PDF, DOC, DOCX tối đa 5MB) tại banner "Tải ngay CV lên để điền nhanh hồ sơ" và xác nhận
**Then** hệ thống phải báo chuyển đổi thành công
**And** dữ liệu đọc được từ CV phải được tự động điền vào các mục tương ứng trong hồ sơ
**And** sau đó tôi chuyển sang phần Tiêu chí tìm việc được

- Trạng thái: Confirmed — hệ thống hỗ trợ trích xuất thông tin tự động từ file CV để điền nhanh vào hồ sơ.
- Ràng buộc quan sát được: chuyển đổi là bước tốn thời gian, cần chờ quá trình OCR/AI xử lý.
- Nguồn: tests/e2e/desktop/upload_cv_profile-bdd.spec.js, tests/e2e/mobile-web/upload_cv_profile-bdd.mobile.spec.js

### AC-070 — Chuẩn hóa kỹ năng khi thêm vào hồ sơ (Skill Normalization v1.1 – JS-8828)

**Given** tôi đang mở modal Kỹ năng (Desktop) hoặc bottom sheet "Thêm kỹ năng" (Mobile Web) tại trang Hồ sơ của tôi
**When** tôi nhập keyword trùng một skill trong thư viện sau khi chuẩn hóa (bỏ khoảng trắng đầu/cuối, gộp khoảng trắng liên tiếp, không phân biệt hoa/thường)
**Then** hệ thống không hiển thị nút "Thêm mới: <keyword>", chỉ gợi ý skill thư viện để tôi chọn
**And** khi keyword không khớp chính xác skill nào, nút "Thêm mới: <keyword đã chuẩn hóa>" hiển thị và thêm được skill tự nhập
**And** sau khi lưu, hồ sơ hiển thị skill thư viện theo đúng tên chuẩn (vd. "ReactJS", không phải "reactjs") và skill tự nhập ở dạng đã chuẩn hóa khoảng trắng

- Trạng thái: Confirmed — kiểm thử thủ công checklist JS-8828 (2026-11-02 → 11-03) và automation TC-170/TC-171.
- Không chuẩn hóa dấu tiếng Việt và dấu câu: "ke toan" ≠ "Kế Toán", "NodeJS" ≠ "Node.js" → vẫn hiện nút Thêm.
- Skill manual đã có trong danh sách chọn: nút "Thêm mới" có thể vẫn hiện nhưng bấm không tạo bản ghi trùng (PO chốt, 2026-11-03).
- Phạm vi: chỉ modal/trang Kỹ năng trong Hồ sơ của tôi. Màn "Hoàn thiện hồ sơ" (bước Kỹ năng) nằm ngoài v1.1, giữ hành vi "Nhấn Enter để thêm" (PO chốt Q11, 2026-11-03).
- Tracking "Skills Saved" (dictionary_skill / manual_skill) chỉ kiểm thủ công: Mixpanel SDK không nạp trong trình duyệt Playwright.
- Lỗi đã biết: khi API gợi ý chậm, nút "Thêm mới" hiện trong lúc chờ kết quả kể cả với skill thư viện (BUG-01 của JS-8828).
- Nguồn: tests/e2e/desktop/chuan-hoa-ky-nang-ho-so-js-8828.spec.js, tests/e2e/mobile-web/chuan-hoa-ky-nang-ho-so-js-8828.mobile.spec.js

## Nghiệp vụ và độ phủ Automation

| Nhánh nghiệp vụ | Tình trạng | Test Case / Ghi chú |
|---|---|---|
| Hoàn thiện hồ sơ qua chuyển đổi CV | **Đã phủ** | TC-037 (tests/e2e/desktop/hoan-thien-ho-so-chuyen-doi-cv.spec.js) |
| Xác minh OTP kích hoạt tìm kiếm hồ sơ | **Đã phủ** | TC-038 (tests/e2e/desktop/xac-minh-otp-tim-kiem-ho-so.spec.js) |
| Chu trình bảo mật OTP (Email & SĐT) kích hoạt hồ sơ | **Đã phủ** | TC-048 (tests/e2e/desktop/kiem-thu-chu-trinh-xac-minh-bao-mat-otp-email-sdt-khi-kich-h.spec.js) |
| Sửa và xóa một mục hồ sơ đã lưu | Chưa phủ | Kiểm tra chỉnh sửa/xóa các bản ghi kinh nghiệm, học vấn |
| Chuẩn hóa kỹ năng — ẩn nút Thêm khi trùng thư viện (JS-8828) | **Đã phủ** | TC-170 (Desktop), TC-171 (Mobile Web) |
| Tắt lại cho phép tìm kiếm hồ sơ | Chưa phủ | Kiểm tra trạng thái hồ sơ khi tắt toggle tìm kiếm |

## Open questions

1. Mã xác minh bốn chữ số khi bật tìm kiếm hồ sơ được gửi qua đâu — SMS hay email? — **Đã chốt (Hà Đinh, 2026-09-24):** gửi qua email và Số điện thoại, nhưng đối với những tài khoản nào chưa xác nhận cả 2 thông tin là email và số điện thoại thì sẽ phải OTP. nếu thiếu xác thực email thì OTP sẽ gửi qua email, OTP này không phải là 1111 ở môi trường  QC/STG, còn nếu số điện thoại chưa xác thực thì otp nó sẽ là 1111 ờ môi trường QC/STG
2. Tiêu chí tìm việc ở đây và tiêu chí khai ở onboarding (REQ-002) có đồng bộ với nhau không? — **Đã chốt (Hà Đinh, 2026-09-24):** có
3. Khi chuyển đổi CV, dữ liệu mới ghi đè hay gộp với dữ liệu hồ sơ đang có? — **Đã chốt (Hà Đinh, 2026-09-24):** gộp với dữ liệu đang có, nhưng ở dạng là trường chứ không phải cộng thông tin vào trường đang có data, ví dụ nếu kỹ năng hay kinh nghiệm làm việc đã có thì sẽ ghi đè, còn nếu chưa có thì ghi thêm
4. Trong bảy mục nội dung hồ sơ, mục nào bắt buộc để hồ sơ được coi là hoàn thiện? — **Đã chốt (Hà Đinh, 2026-09-24):** Thông tin cá nhân, Kinh nghiệm, Giới thiệu bản thân, Học vấn.
5. Tên gọi các mục hồ sơ trên giao diện mới? — **Đã chốt (Khảo sát QC 2026-10-03):** Các mục trên UI thực tế gồm: Thông tin cá nhân, Giới thiệu bản thân, Kinh nghiệm làm việc, Học vấn, Kỹ năng, Dự án/thành tựu, Chứng chỉ/bằng cấp, Ngoại ngữ. Banner "Tải ngay CV lên để điền nhanh hồ sơ" được đặt nổi bật ở đầu trang.

## Change log

| Version | Ngày | Thay đổi |
|---|---|---|
| 1.1 | 2026-11-05 | Thêm AC-070 Chuẩn hóa kỹ năng (Skill Normalization v1.1 – JS-8828) |
