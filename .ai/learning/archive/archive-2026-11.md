# Cold Archive


### [LEARN-027] Kiểm Thử Cơ Chế Phục Hồi HTTP 431 (?_restore=1), Cookie Bloat & Client URL Guard
- **Nguồn trích xuất:** Ticket JS-8865 (Fix HTTP 431 Request Header Or Cookie Too Large)
- **Role quan sát:** Senior Automation QA Engineer (Gate 4)
- **Quan sát & Nguyên tắc:**
  1. Với cơ chế self-healing URL dài qua `?_restore=1` và `sessionStorage`, kiểm thử tự động cần intercept tracking network để xác nhận 0 request analytics và assert `<meta name="robots" content="noindex, nofollow">` trên trang restore.
  2. Cookie bloat phòng ngừa bằng cách kiểm tra context cookies không tồn tại các cookie tìm kiếm cũ và `sv_p_r` $\le$ 200 ký tự.
  3. URL vượt ngưỡng API $\ge$ 8 KB (~750 quận): Xác nhận client chặn thành công Search API request và hiển thị đúng Toast warning thay vì để server 431.
- **Trạng thái:** LOCALIZED
- **Moved To:** tests/e2e/desktop/kiem-thu-chuyen-sau-http-431-restore-search-url-js-8865.spec.js:129
- **Ghi chú Curator (2026-11-06):** ý 3 đã lỗi thời — 750 ID 10 chữ số (~8,3 KB) bị nginx trả 414; spec dùng ~7,7 KB (xem CAND-20261105-JS8865-THRESHOLDS).

### [CAND-20261102-ZALO-OTP-REQUEST] Request OTP seeker không chứa chữ "otp" (JS-8873)
- **Role quan sát:** Senior QA (Gate 4) — JS-8873 Zalo OTP (2026-11-02)
- **Quan sát & Nguyên tắc:** Request OTP seeker đi qua `GET /<nonce>?phone=…&platform=…&m=s[&channel=zalo]` cùng origin (không chứa chữ "otp") → chặn/mock phải match `?phone=`, nếu không sẽ gửi OTP thật. Response dạng text `1|seconds|request_id|expiredAt` / `0|CODE|message|reason|duration|seconds|expiredAt`.
- **Trạng thái:** LOCALIZED
- **Moved To:** core/utils/zaloOtpMock.js:7

### [CAND-20261105-PROVINCE-PICKER] Picker tỉnh thành /tim-kiem-viec-lam-nhanh (UI 11/2026)
- **Role quan sát:** Senior QA (Gate 4) — UI picker tỉnh thành `/tim-kiem-viec-lam-nhanh` (2026-11-05): trigger là `[data-test-id="location-search__anchor"]` (div role=button, label đổi thành tên tỉnh sau Áp dụng → không neo theo text "Lọc theo tỉnh thành"); panel = `dialog "Chọn địa điểm"` multi-select checkbox, quận/huyện mở bằng button "Xem quận huyện của <Tỉnh>", phải bấm "Áp dụng" rồi "Tìm kiếm". Accessible name checkbox có icon glyph đứng đầu → regex neo ranh giới non-letter, không dùng `^`.
- **Trạng thái:** LOCALIZED
- **Moved To:** pages/desktop/JobSearchPage.js:33

### [CAND-20261105-JS8865-THRESHOLDS] Ngưỡng 431/414 trên QC cho JS-8865
- **Role quan sát:** Senior QA (Gate 4) — JS-8865 regression (2026-11-05): trên QC, context sạch thì URL ≥ ~7,2 KB → 431 → `?_restore=1` → toast "Kết quả sẽ tốt hơn khi chọn ít khu vực" (vượt giới hạn Search API `get-job-list`); URL > ~8,2 KB → nginx 414 (không tái hiện được). Muốn test khôi phục có kết quả thì URL ~6 KB + cookie đệm ~1,5 KB. Trang không kết quả của `/tim-kiem-viec-lam-nhanh` không có `<h1>` → check ready bằng khung search.
- **Trạng thái:** LOCALIZED
- **Moved To:** tests/e2e/desktop/kiem-thu-chuyen-sau-http-431-restore-search-url-js-8865.spec.js:129

### [CAND-20261106-MOBILE-FIXTURE-SHORTCUTS] Shortcut fixture mobile-web không resolve được Mobile*.js
- **Role quan sát:** Senior QA (Gate 4) — Mobile fixtures (2026-11-06): shortcut `{ homePage, loginPopup, onboardingPopup, ... }` trên mobile-web luôn lỗi `[PageContainer 10/10]` vì PageContainer tìm `<Tên>Page.js` còn file mobile là `Mobile<Tên>.js` → `core/fixtures/custom/pageObjects.fixture.js` khởi tạo trực tiếp class Mobile* khi platform mobile. Assertion dạng `a.or(b).or(c)` (vd. `.or(logo)`, `.or(otpModalTitle)`) vừa vô nghĩa vừa dễ strict-mode → assert đúng phần tử chứng minh kết quả.
- **Trạng thái:** LOCALIZED
- **Moved To:** core/fixtures/custom/pageObjects.fixture.js:12

### [CAND-20261106-PROFILE-APPLY-UI-2026-11] Luồng CV / modal ứng tuyển / sheet kỹ năng mobile (UI 11/2026)
- **Role quan sát:** Senior QA (Gate 4) — Profile/Apply UI 11/2026 (2026-11-06): (1) Upload CV → màn "Kiểm tra thông tin" → "Thêm vào Hồ sơ của tôi" áp dữ liệu ngay, KHÔNG còn toast "Chuyển đổi thành công" → xác nhận bằng nội dung CV trên Hồ sơ. (2) Modal ứng tuyển bằng hồ sơ: nút chốt "Hoàn thành hồ sơ" (không còn "Lưu"). (3) Mobile kỹ năng: ô trên trang readonly → chạm mở sheet có ô thật + nút "Lưu kỹ năng"; sau đó màn skills-v2 phải đóng (Lưu chớp nhoáng/back) → dùng `toPass` thay vì kiểm tra 1 lần.
- **Trạng thái:** LOCALIZED
- **Moved To:** pages/desktop/profile/ProfileCvHelper.js:105
- **Liên quan:** pages/desktop/JobApplyPage.js:75, pages/desktop/profile/ProfileSectionsHelper.js:96
