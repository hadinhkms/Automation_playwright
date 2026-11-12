# Test case — REQ-005 Quản lý hồ sơ cá nhân

## Bảng truy vết

| Test case | AC | Mô tả | Ưu tiên | Automation | Spec |
|---|---|---|---|---|---|
| TC-017 | AC-015 AC-016 AC-017 AC-019 | Hoàn thiện hồ sơ gồm thông tin cá nhân, tiêu chí tìm việc và CV trên desktop | P1 | Có | tests/e2e/desktop/complete_profile_setup-bdd.spec.js |
| TC-018 | AC-015 AC-016 AC-017 AC-019 | Hoàn thiện hồ sơ gồm thông tin cá nhân, tiêu chí tìm việc và CV trên mobile web | P1 | Có | tests/e2e/mobile-web/complete_profile_setup-bdd.mobile.spec.js |
| TC-019 | AC-018 | Thêm đủ bảy mục nội dung hồ sơ trên desktop | P2 | Có | tests/e2e/desktop/setting_user_profile-bdd.spec.js |
| TC-020 | AC-018 | Thêm đủ bảy mục nội dung hồ sơ trên mobile web | P2 | Có | tests/e2e/mobile-web/setting_user_profile-bdd.mobile.spec.js |
| TC-021 | AC-019 | Tải lên và chuyển đổi CV tại trang Hồ sơ trên desktop | P1 | Có | tests/e2e/desktop/upload_cv_profile-bdd.spec.js |
| TC-022 | AC-019 | Tải lên và chuyển đổi CV tại trang Hồ sơ trên mobile web | P1 | Có | tests/e2e/mobile-web/upload_cv_profile-bdd.mobile.spec.js |
| TC-046 | AC-015 AC-016 AC-019 | Hoàn thiện hồ sơ và chuyển đổi CV | P2 | Có | tests/e2e/desktop/hoan-thien-ho-so-chuyen-doi-cv.spec.js |
| TC-047 | AC-017 | Xác minh OTP khi bật tìm kiếm hồ sơ | P2 | Có | tests/e2e/desktop/xac-minh-otp-tim-kiem-ho-so.spec.js |
| TC-170 | AC-070 | Chuẩn hóa kỹ năng: ẩn nút Thêm khi trùng thư viện, thêm skill mới, lưu tên chuẩn trên desktop | P1 | Có | tests/e2e/desktop/chuan-hoa-ky-nang-ho-so-js-8828.spec.js |
| TC-171 | AC-070 | Chuẩn hóa kỹ năng: ẩn nút Thêm khi trùng thư viện, thêm skill mới, lưu tên chuẩn trên mobile web | P1 | Có | tests/e2e/mobile-web/chuan-hoa-ky-nang-ho-so-js-8828.mobile.spec.js |
| TC-175 | AC-074 | AI gợi ý kỹ năng: có job title thì hiện khu vực gợi ý, tối đa 5 chip đúng thứ tự trên desktop | P1 | Có | tests/e2e/desktop/goi-y-ky-nang-ai-js-8837.spec.js |
| TC-176 | AC-074 | AI gợi ý kỹ năng: chưa có job title thì không hiện khu vực gợi ý, không gọi API gợi ý trên desktop | P1 | Có | tests/e2e/desktop/goi-y-ky-nang-ai-js-8837.spec.js |
| TC-177 | AC-075 | AI gợi ý kỹ năng: chọn chip thì skill lên đầu, chip kế bù chỗ, lưu được vào hồ sơ trên desktop | P1 | Có | tests/e2e/desktop/goi-y-ky-nang-ai-js-8837.spec.js |
| TC-178 | AC-076 | AI gợi ý kỹ năng: chọn chip trùng skill vừa thêm thì không tạo trùng, số lượng giữ nguyên trên desktop | P1 | Có | tests/e2e/desktop/goi-y-ky-nang-ai-js-8837.spec.js |
| TC-179 | AC-077 | AI gợi ý kỹ năng: chạm 20/20 vẫn hiện gợi ý nhưng không thêm được, mở lại khi đủ 20 thì không còn gợi ý trên desktop | P1 | Có | tests/e2e/desktop/goi-y-ky-nang-ai-js-8837.spec.js |
| TC-180 | AC-074 | AI gợi ý kỹ năng: có job title thì hiện khu vực gợi ý, tối đa 5 chip đúng thứ tự trên mobile web | P1 | Có | tests/e2e/mobile-web/goi-y-ky-nang-ai-js-8837.mobile.spec.js |
| TC-181 | AC-075 | AI gợi ý kỹ năng: chọn chip thì skill lên đầu, chip kế bù chỗ, lưu được vào hồ sơ trên mobile web | P1 | Có | tests/e2e/mobile-web/goi-y-ky-nang-ai-js-8837.mobile.spec.js |


## Chi tiết

### TC-017 và TC-018 — Hoàn thiện hồ sơ và bật cho phép tìm kiếm

- **Precondition**: đã đăng nhập qua fixture xác thực, đã đóng modal onboarding.
- **Dữ liệu**: `data/userProfileData.json` phần thông tin cá nhân và tiêu chí tìm việc; file CV tại `data/TemplateCV.pdf`; mã xác minh bốn chữ số cố định của môi trường test.
- **Các bước**: vào trang Hồ sơ của tôi, mở Tiêu chí tìm việc, sửa thông tin cá nhân và lưu, thêm vị trí công việc mới, điền tiêu chí tìm việc và lưu, bật cho phép tìm kiếm hồ sơ, bấm Tiếp tục, nhập mã xác minh, tải lên CV, bấm Cho phép tìm kiếm.
- **Expected result thực tế đang kiểm**:
  - Trang chủ hiển thị ở bước điều kiện đầu — Ẩn trong Page Object.
  - Trạng thái đang tải toàn cục biến mất sau bước cuối — Có chờ tường minh.
  - Thông tin cá nhân, tiêu chí tìm việc, trạng thái công khai hồ sơ có đúng như đã nhập — **Không kiểm chứng**. Không có bước nào đọc lại.
- **Điểm yếu**: test case này chạm tới bốn acceptance criterion cùng lúc nhưng không có assertion nào ở tầng spec. Khi nó đỏ, việc xác định hỏng ở đâu phải làm thủ công qua ảnh chụp.
- **Ghi chú**: đây là test case duy nhất phủ ràng buộc quyền riêng tư tại AC-017.

### TC-019 và TC-020 — Thêm bảy mục nội dung hồ sơ

- **Precondition**: đã đăng nhập, đã đóng modal chặn màn hình.
- **Dữ liệu**: `data/userProfileData.json` cung cấp nội dung cho từng mục.
- **Các bước**: vào trang Hồ sơ của tôi, lần lượt thêm và lưu Kinh nghiệm làm việc, Giới thiệu bản thân, Học vấn, Thành tựu, Kỹ năng, Chứng chỉ, Ngoại ngữ.
- **Expected result thực tế đang kiểm**:
  - Không có assertion nào ở tầng spec. Toàn bộ kịch bản là chuỗi thao tác điền và lưu, kết thúc bằng một ảnh chụp màn hình.
  - Mỗi mục lưu thành công — **Không kiểm chứng**.
- **Đánh giá**: ở trạng thái hiện tại, test case này chỉ chứng minh "các form mở ra và bấm lưu được", không chứng minh dữ liệu vào hồ sơ. Xếp P2 vì giá trị phát hiện lỗi thấp cho tới khi bổ sung bước đọc lại.
- **Trùng lặp cần biết**: bảy mục này cũng được điền trong TC-011 và TC-012 như một phần của luồng ứng tuyển bằng hồ sơ trực tuyến.

### TC-021 và TC-022 — Tải lên và chuyển đổi CV

- **Precondition**: đã đăng nhập, đang ở trang Hồ sơ của tôi.
- **Dữ liệu**: file CV tại `data/TemplateCV.pdf`.
- **Các bước**: bấm tải lên CV và chọn file, xác nhận đính kèm, chờ hệ thống báo chuyển đổi thành công rồi áp dữ liệu vào hồ sơ, chuyển sang Tiêu chí tìm việc.
- **Expected result thực tế đang kiểm**:
  - Việc kiểm tra kết quả chuyển đổi và áp dữ liệu — Ẩn trong Page Object. Đây là bước nghiệp vụ quan trọng nhất của test case nhưng không audit được từ spec.
  - Chuyển sang Tiêu chí tìm việc được — Ẩn trong Page Object.
- **Ghi chú độ ổn định**: thời gian chờ đặt bốn phút vì bước nhận dạng nội dung CV tốn thời gian.

### TC-170 và TC-171 — Chuẩn hóa kỹ năng khi thêm vào hồ sơ (JS-8828)

- **Precondition**: tài khoản ứng viên mới tạo qua authSetup, đã đăng nhập, hồ sơ chưa có kỹ năng.
- **Dữ liệu**: `data/skillNormalizationData.json` — "  reactjs  " → "ReactJS", "restful  api" → "RESTful API", "  QA Regression Skill  " (không có trong thư viện).
- **Các bước**:
  1. Vào Hồ sơ của tôi, mở modal Kỹ năng (Desktop) / trang Kỹ năng → chạm ô tìm kiếm mở bottom sheet "Thêm kỹ năng" (Mobile Web).
  2. Tìm "  reactjs  " → chọn "ReactJS"; tìm "restful  api" → chọn "RESTful API".
  3. Tìm "  QA Regression Skill  " → bấm "Thêm mới: QA Regression Skill".
  4. Lưu ("Lưu thông tin" / "Lưu kỹ năng"), tải lại trang Hồ sơ.
- **Expected result (đều có assertion)**:
  - Bước 2: gợi ý skill thư viện hiển thị, **không** có nút "Thêm mới"; bộ đếm "Đã chọn x/20" tăng 1 mỗi lần chọn.
  - Bước 3: nút "Thêm mới: QA Regression Skill" (đã trim) hiển thị; thêm xong chip xuất hiện, bộ đếm tăng 1.
  - Bước 4: request lưu hồ sơ trả 2xx; sau khi tải lại, hồ sơ có "ReactJS", "RESTful API", "QA Regression Skill" và không có "reactjs".
- **Không phủ (kiểm thủ công)**: event Mixpanel "Skills Saved", trạng thái mạng chậm (BUG-01), giới hạn 20 skill.

### TC-175 → TC-181 — AI gợi ý kỹ năng theo job title (JS-8837)

- **Precondition chung**: tài khoản ứng viên mới tạo qua authSetup, đã đăng nhập. Job goal đặt qua API với job title "Kế toán" (trừ TC-176). Hồ sơ chưa có kỹ năng (trừ TC-179: đặt sẵn 18 kỹ năng tự nhập qua API).
- **Dữ liệu**: `data/aiSuggestedSkillData.json`. Tên skill gợi ý **không** ghi cứng: mọi kỳ vọng về chip đọc từ response API gợi ý của chính lần mở modal (danh sách gợi ý đổi theo từng lần gọi).
- **Môi trường**: QC. Tính năng chỉ có trên QC sau khi JS-8837 được merge (dự kiến release 2026-11-12).

| TC | Các bước | Expected result (đều có assertion) |
|---|---|---|
| TC-175 (Desktop), TC-180 (Mobile Web) | Vào Hồ sơ của tôi → mở modal/trang Kỹ năng | API gợi ý được gọi theo job title của Job goal; khu vực "Chớp gợi ý kỹ năng cho vị trí công việc" hiện kèm job title, ở trạng thái mở rộng, nằm phía trên ô tìm kiếm; chip = tối đa 5 skill đầu của response, đúng thứ tự, không trùng; bộ đếm "Đã chọn 0/20"; request impression ghi đúng các skill đang hiện và cùng session với lần gọi gợi ý |
| TC-176 (Desktop) | Không đặt job title → mở modal Kỹ năng | Không có khu vực gợi ý; không có request nào tới API gợi ý; bộ đếm "Đã chọn 0/20" |
| TC-177 (Desktop), TC-181 (Mobile Web) | Mở modal/trang Kỹ năng → chọn chip thứ 2 → chọn chip thứ 1 → lưu ("Lưu thông tin" / "Lưu thay đổi") → tải lại Hồ sơ | Sau lần chọn 1: skill đứng đầu danh sách đã chọn, bộ đếm 1/20, chip thứ 6 của response xuất hiện ở cuối, request selected ghi đúng skill và session; sau lần chọn 2: bộ đếm 2/20, skill mới đứng đầu; request lưu trả 2xx, modal đóng; sau tải lại, hồ sơ hiển thị cả 2 skill |
| TC-178 (Desktop) | Mở modal → tìm và chọn từ thư viện đúng skill đang ở chip thứ 1 (chưa lưu) → mở lại khu vực gợi ý → bấm chip đó | Trước khi bấm: bộ đếm 1/20, chip vẫn còn; sau khi bấm: bộ đếm vẫn 1/20, skill chỉ xuất hiện 1 lần và đứng đầu, chip trùng biến mất, chip kế tiếp bù để đủ 5 |
| TC-179 (Desktop) | Hồ sơ 18/20 → mở modal → chọn 2 chip → bấm thêm 1 chip → lưu → tải lại → mở lại modal | Khi mở: 18/20 và đủ 5 chip; sau 2 lần chọn: 20/20, khu vực gợi ý vẫn hiện 5 chip; bấm thêm: bộ đếm vẫn 20/20, skill không vào danh sách, chip vẫn còn; mở lại khi đã lưu 20/20: không có khu vực gợi ý |

- **Không phủ (kiểm thủ công)**: màu đỏ của bộ đếm và toast khi đủ 20; animation khi chọn chip; thu gọn/mở rộng khu vực gợi ý; job title không có skill; API gợi ý lỗi; hết pool gợi ý; event Mixpanel (Skills Opened / Skills Saved / add_new_skill); giá trị `source` / `platform` gửi API log; luồng Ứng tuyển với hồ sơ. Kết quả kiểm thủ công 2026-11-10: `evidence/JS-8837/RESULT.md`.
- **Mobile Web**: chỉ phủ hiển thị và chọn + lưu; chip trùng và giới hạn 20 là logic chung, chỉ chạy trên Desktop.

## Ứng viên automation cho REQ-005

| Test case đề xuất | AC liên quan | Vì sao đáng automation | Ưu tiên |
|---|---|---|---|
| Đọc lại hồ sơ và đối chiếu từng giá trị vừa lưu | AC-015 AC-016 AC-018 | Hiện không test case nào chứng minh dữ liệu được lưu | P0 |
| Nhập sai mã xác minh khi bật cho phép tìm kiếm | AC-017 | Ràng buộc quyền riêng tư, nhánh negative đang trống | P0 |
| Sửa và xóa một mục hồ sơ đã lưu | AC-018 | Toàn bộ chiều sửa và xóa chưa được phủ | P1 |
| Tải lên CV sai định dạng hoặc file hỏng | AC-019 | Validation ổn định, rẻ để automation | P1 |
| Tắt lại cho phép tìm kiếm hồ sơ | AC-017 | Chiều ngược của một ràng buộc quyền riêng tư | P1 |
| Chuyển đổi CV khi hồ sơ đã có dữ liệu | AC-019 | Làm rõ ghi đè hay gộp, rủi ro mất dữ liệu người dùng | P1 |
| Bỏ trống trường bắt buộc trong từng mục hồ sơ | AC-018 | Cần chốt trường bắt buộc trước khi automation | P2 |


### TC-046 — Kiểm thử tính hoàn thiện hồ sơ, logic chuyển đổi CV và đồng bộ hai chiều với Onboarding

- **Loại:** Chức năng / Tích hợp | **Ưu tiên:** P2 | **Kỹ thuật:** Phân tích giá trị biên / Luồng kiểm thử liên hoàn
- **Automation:** Có
- **Tiền điều kiện:** Người dùng đã đăng nhập, đang ở trang Hồ sơ của tôi.
- **Dữ liệu kiểm thử:**
  - Mục Thông tin cá nhân đầy đủ: Họ tên, Ngày sinh, Giới tính, Địa chỉ, Email, SĐT
  - 6 mục nội dung hồ sơ: Học vấn, Kinh nghiệm, Kỹ năng, Ngoại ngữ, Dự án, Chứng chỉ
  - File CV chuyển đổi chứa Kỹ năng ('Python, React') và Kinh nghiệm làm việc mới
  - Tiêu chí tìm việc thay đổi: Địa điểm TP.HCM, Ngành nghề Marketing
> *Ghi chú nghiệp vụ:* Kịch bản hợp nhất từ các kiểm thử hoàn thiện hồ sơ và chuyển đổi CV trước đây theo các quyết định Q-2, Q-3, Q-4. Kiểm chứng: 'Thông tin cá nhân' là mục duy nhất bắt buộc để hồ sơ đạt chuẩn 'Hoàn thiện', cơ chế chuyển đổi CV gộp ở cấp độ trường (ghi đè trường có sẵn, thêm mới trường trống) và dữ liệu tiêu chí tìm việc tự động đồng bộ hai chiều với Onboarding.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Điền đủ 6 mục hồ sơ nhưng bỏ trống mục 'Thông tin cá nhân' | Hồ sơ ở trạng thái 'Chưa hoàn thiện', khóa tính năng bật tìm kiếm hồ sơ |
| 2 | Nhập và lưu mục 'Thông tin cá nhân' | Trạng thái hồ sơ được công nhận là 'Hoàn thiện' thành công |
| 3 | Tải lên file CV mới và kích hoạt tính năng 'Chuyển đổi CV thành hồ sơ' | Trường Kỹ năng đã có bị ghi đè, trường Kinh nghiệm làm việc mới được bổ sung |
| 4 | Cập nhật tiêu chí tìm việc mới tại trang Hồ sơ và kiểm tra lại luồng gợi ý | Dữ liệu tiêu chí tìm việc được đồng bộ hai chiều chính xác 100% |


### TC-047 — Kiểm thử chu trình xác minh bảo mật (OTP Email / SĐT) khi kích hoạt tính năng Cho phép tìm kiếm hồ sơ

- **Loại:** Chức năng / Tích hợp | **Ưu tiên:** P2 | **Kỹ thuật:** Ràng buộc bảo mật / Xác thực OTP
- **Automation:** Có
- **Tiền điều kiện:** Hồ sơ người dùng đã đạt trạng thái hoàn thiện.
- **Dữ liệu kiểm thử:**
  - Tài khoản chưa xác thực Email: mã OTP động từ email (mã sai: 1111)
  - Tài khoản chưa xác thực SĐT: mã OTP mặc định test = 1111
> *Ghi chú nghiệp vụ:* Kịch bản hợp nhất từ các kiểm thử xác minh OTP bảo mật trước đây theo quyết định Q-1. Đảm bảo ràng buộc bảo mật quyền riêng tư: khi bật công tắc 'Cho phép tìm kiếm hồ sơ', hệ thống gửi OTP tương ứng theo kênh chưa xác thực (Email dùng OTP động, SĐT dùng OTP test 1111).

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Dùng tài khoản chưa xác thực Email, bật công tắc 'Cho phép tìm kiếm hồ sơ' | Hệ thống yêu cầu OTP gửi qua Email |
| 2 | Thử nhập mã OTP '1111' | Hệ thống báo lỗi OTP không chính xác (vì Email dùng mã động, không nhận 1111) |
| 3 | Nhập mã OTP chính xác từ Email | Xác minh thành công, công tắc Cho phép tìm kiếm hồ sơ chuyển sang Bật |
| 4 | Dùng tài khoản chưa xác thực SĐT, bật tìm kiếm hồ sơ và nhập OTP test '1111' | Hệ thống chấp nhận mã 1111, kích hoạt tìm kiếm hồ sơ thành công |

