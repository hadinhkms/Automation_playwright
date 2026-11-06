# Test case — REQ-003 Ứng tuyển việc làm bằng CV hoặc hồ sơ trực tuyến

## Bảng truy vết

| Test case | AC | Mô tả | Ưu tiên | Automation | Spec |
|---|---|---|---|---|---|
| TC-009 | AC-008 AC-010 AC-011 | Ứng tuyển bằng file CV trên desktop | P0 | Có | tests/e2e/desktop/apply_job_with_CV_flow-bdd.spec.js |
| TC-010 | AC-008 AC-010 AC-011 | Ứng tuyển bằng file CV trên mobile web | P0 | Có | tests/e2e/mobile-web/apply_job_with_CV_flow-bdd.mobile.spec.js |
| TC-011 | AC-009 AC-010 AC-011 | Ứng tuyển bằng hồ sơ trực tuyến trên desktop | P1 | Có | tests/e2e/desktop/apply_job_with_profile_flow-bdd.spec.js |
| TC-012 | AC-009 AC-010 AC-011 | Ứng tuyển bằng hồ sơ trực tuyến trên mobile web | P1 | Có | tests/e2e/mobile-web/apply_job_with_profile_flow-bdd.mobile.spec.js |
| TC-036 | AC-008 | Tải lên file CV sai định dạng hoặc quá dung lượng | P1 | Có | tests/e2e/desktop/tai-len-cv-sai-dinh-dang.spec.js |
| TC-037 | AC-011 | Kiểm tra trạng thái việc làm đã nộp (Nộp lại hồ sơ hoặc Đã ứng tuyển) | P0 | Có | tests/e2e/desktop/kiem-tra-trang-thai-viec-lam-da-ung-tuyen.spec.js |
| TC-042 | AC-008 AC-009 | Hồ sơ trực tuyến chưa hoàn thiện bị chặn nộp, nộp bằng CV thành công không cần đủ 7 mục hồ sơ | P2 | Có | tests/e2e/desktop/kiem-thu-chu-trinh-xac-thuc-otp-va-dieu-kien-hoan-thien-ho-so.spec.js |
| TC-043 | AC-011 | Kiểm thử quy tắc kiểm soát tần suất nộp lại hồ sơ cho cùng một công việc (chặn nộp lại trong ngày, mở khóa khi sang ngày mới) | P2 | Có | tests/e2e/desktop/kiem-thu-quy-tac-kiem-soat-tan-suat-nop-lai-ho-so-cho-cung-mot-cong-viec.spec.js |
| TC-044 | AC-010 | Nộp hồ sơ hàng loạt (Bulk Apply) kèm các điều kiện biên | P2 | Có | tests/e2e/desktop/nop-ho-so-hang-loat-bulk-apply.spec.js |


## Chi tiết

### TC-009 và TC-010 — Ứng tuyển bằng file CV

- **Precondition**: đã đăng nhập qua fixture xác thực, đã đóng modal onboarding và các modal chặn màn hình.
- **Dữ liệu**: đường dẫn file CV lấy từ `data/applyJobData.json`; mã OTP lấy từ `data/users.json`.
- **Các bước**: mở trang tìm việc, mở chi tiết việc làm đầu tiên (mở ở tab mới), bấm Ứng tuyển ngay, chọn ứng tuyển bằng CV, tải file CV lên, bấm Tiếp tục, nộp hàng loạt, mở danh sách đã ứng tuyển.
- **Expected result thực tế đang kiểm**:
  - Trang chủ và logo hiển thị ở bước điều kiện đầu — Có assertion.
  - Danh sách việc làm đã ứng tuyển hiển thị ở bước cuối — Ẩn trong Page Object.
  - Hồ sơ nộp thành công — **Không kiểm chứng** ở tầng spec.
  - Nộp hàng loạt có kết quả — **Không kiểm chứng**.
- **Ghi chú kiến trúc**: việc làm mở ở tab mới, và tab đó được đóng lại sau mỗi test. Nếu bước mở tab hỏng, lỗi sẽ xuất hiện ở chỗ khác chứ không tại nguyên nhân.
- **Ghi chú độ ổn định**: thời gian chờ mười phút cho cả kịch bản, đánh dấu chạy chậm.

### TC-011 và TC-012 — Ứng tuyển bằng hồ sơ trực tuyến

- **Precondition**: như trên.
- **Dữ liệu**: `data/applyJobData.json` cung cấp nội dung cho cả bảy mục hồ sơ.
- **Các bước**: mở chi tiết việc làm, bấm Ứng tuyển ngay, chọn ứng tuyển bằng hồ sơ, điền và lưu lần lượt Giới thiệu bản thân, Kinh nghiệm làm việc, Học vấn, Kỹ năng, Thành tựu, Chứng chỉ, Ngoại ngữ, nộp hồ sơ, xác nhận hoàn tất, nộp hàng loạt, mở danh sách đã ứng tuyển.
- **Expected result thực tế đang kiểm**:
  - Trang chủ và logo hiển thị — Có assertion.
  - **Thông báo nộp hồ sơ thành công hiển thị — Có assertion.** Đây là test case duy nhất trong nhóm ứng tuyển có bằng chứng trực tiếp về việc nộp thành công.
  - Danh sách đã ứng tuyển hiển thị — Ẩn trong Page Object.
  - Từng mục hồ sơ lưu đúng nội dung — **Không kiểm chứng**.
- **Giá trị hồi quy**: đây là kịch bản dài nhất trong repo, chạm tới cả bảy mục hồ sơ lẫn luồng nộp. Nó đáng giữ ở mức ưu tiên cao dù chậm.

## Ứng viên automation cho REQ-003

| Test case đề xuất | AC liên quan | Vì sao đáng automation | Ưu tiên |
|---|---|---|---|
| Ứng tuyển lại việc làm đã nộp | AC-011 | Quy tắc chống trùng, ảnh hưởng trực tiếp nhà tuyển dụng | P0 |
| Xác nhận đúng việc làm vừa nộp có trong danh sách | AC-011 | Hiện chỉ kiểm danh sách hiển thị, không kiểm đúng bản ghi | P0 |
| Tải lên CV sai định dạng hoặc quá dung lượng | AC-008 | Validation ổn định, rẻ để automation | P1 |
| Nộp hồ sơ trực tuyến khi thiếu mục bắt buộc | AC-009 | Cần chốt mục bắt buộc trước, sau đó rất đáng phủ | P1 |
| Bỏ qua gợi ý nộp hàng loạt | AC-010 | Nhánh từ chối hiện hoàn toàn trống | P2 |
| Ứng tuyển việc làm đã hết hạn | AC-008 | Khó dựng dữ liệu ổn định, cân nhắc kiểm thủ công | P2 |


### TC-036 — Tải lên file CV sai định dạng hoặc quá dung lượng

- **Loại:** Chức năng | **Ưu tiên:** P1 | **Kỹ thuật:** Phân tích giá trị biên / Negative Validation
- **Automation:** Có
- **Tiền điều kiện:** Người dùng đã đăng nhập và đang ở popup chọn phương thức ứng tuyển bằng CV
- **Dữ liệu kiểm thử:** File không hợp lệ hoặc sai định dạng cho phép
- > *Ghi chú nghiệp vụ:* Đảm bảo hệ thống chặn file sai extension và hiển thị hướng dẫn định dạng hợp lệ.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Tải lên file sai định dạng hoặc không hợp lệ | Hệ thống hiển thị thông báo lỗi định dạng file không được hỗ trợ |
| 2 | Kiểm tra nút tiếp tục | Hệ thống không cho phép tiếp tục luồng nộp hồ sơ |


### TC-037 — Kiểm tra trạng thái việc làm đã nộp (Nộp lại hồ sơ hoặc Đã ứng tuyển)

- **Loại:** Chức năng | **Ưu tiên:** P0 | **Kỹ thuật:** Ràng buộc chống trùng lặp / Trạng thái việc làm
- **Automation:** Có
- **Spec:** `tests/e2e/desktop/kiem-tra-trang-thai-viec-lam-da-ung-tuyen.spec.js`
- **Tiền điều kiện:** Người dùng đã đăng nhập và đã ứng tuyển thành công 1 việc làm bất kỳ (automation tự nộp bằng CV ở bước Given vì tài khoản test mới chưa có đơn nào)
- **Dữ liệu kiểm thử:** Việc làm đầu tiên trong kết quả tìm kiếm, file CV `data/TemplateCV.pdf`
- > *Ghi chú nghiệp vụ:* Tránh ứng viên vô tình nộp trùng lặp và xác thực trạng thái ghi nhận hồ sơ của nhà tuyển dụng. Nộp bằng CV vì hồ sơ trực tuyến của tài khoản mới còn thiếu mục bắt buộc. Tài khoản chưa có đơn nào khi mở trang "Việc làm đã ứng tuyển" bị chuyển về trang chủ.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Mở "Việc làm đã ứng tuyển" từ menu tài khoản cá nhân | Trang danh sách việc làm đã ứng tuyển hiển thị |
| 2 | Kiểm tra danh sách | Việc làm vừa nộp hiển thị trong danh sách với trạng thái hồ sơ đã nộp thành công |


### TC-042 — Hồ sơ trực tuyến chưa hoàn thiện bị chặn nộp, nộp bằng CV thành công không cần đủ 7 mục hồ sơ

- **Loại:** Chức năng / Tích hợp | **Ưu tiên:** P2 | **Kỹ thuật:** Luồng kiểm thử liên hoàn / Rẽ nhánh ngoại lệ
- **Automation:** Có
- **Spec:** `tests/e2e/desktop/kiem-thu-chu-trinh-xac-thuc-otp-va-dieu-kien-hoan-thien-ho-so.spec.js`
- **Tiền điều kiện:** Tài khoản ứng viên mới tạo qua API (SĐT đã xác thực, Hồ sơ trực tuyến còn thiếu mục bắt buộc) đã đăng nhập, mở trang chi tiết một việc làm chưa ứng tuyển.
- **Dữ liệu kiểm thử:**
  - File CV tải lên: `TemplateCV.pdf`
  - Hồ sơ trực tuyến: tài khoản mới, chưa điền Giới thiệu / Kinh nghiệm / Học vấn
> *Ghi chú nghiệp vụ:* Thiết kế lại 2026-11-06 theo hành vi QC. Kiểm chứng Q-1: nộp bằng file CV không phụ thuộc 7 mục hồ sơ trực tuyến; nộp bằng Hồ sơ trực tuyến yêu cầu hoàn thiện hồ sơ. Phần OTP chống spam (Q-3) được bỏ khỏi TC này vì tài khoản tạo qua API luôn có SĐT đã xác thực nên popup OTP không xuất hiện; luồng OTP khi ứng tuyển được phủ bởi TC-016 / TC-038 (khách vãng lai).

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Bấm "Ứng tuyển ngay" | Modal ứng tuyển hiển thị 2 phương thức: Hồ sơ trực tuyến và CV; không bật popup OTP (SĐT đã xác thực) |
| 2 | Chọn nộp bằng Hồ sơ trực tuyến | Hệ thống yêu cầu hoàn thiện hồ sơ (CTA "Hoàn thành hồ sơ"), chưa cho nộp ngay |
| 3 | Bấm "Hoàn thành hồ sơ" | Form hồ sơ mở ra với các mục bắt buộc còn trống cần bổ sung (Giới thiệu / Kinh nghiệm / Học vấn...), hồ sơ chưa được nộp |
| 4 | Mở lại tin tuyển dụng, bấm "Ứng tuyển ngay", chọn nộp bằng CV và tải lên file CV hợp lệ | Ứng tuyển thành công ("Ứng tuyển thành công!") dù hồ sơ trực tuyến chưa đủ 7 mục |
| 5 | Mở lại trang chi tiết việc làm vừa nộp | Nút ứng tuyển chuyển trạng thái "Đã ứng tuyển" / "Nộp lại hồ sơ" |


### TC-043 — Kiểm thử quy tắc kiểm soát tần suất nộp lại hồ sơ cho cùng một công việc

- **Loại:** Chức năng / Tích hợp | **Ưu tiên:** P2 | **Kỹ thuật:** Phân tích giá trị biên / Temporal boundary
- **Automation:** Có
- **Spec:** `tests/e2e/desktop/kiem-thu-quy-tac-kiem-soat-tan-suat-nop-lai-ho-so-cho-cung-mot-cong-viec.spec.js`
- **Tiền điều kiện:** Tài khoản ứng viên đã nộp thành công công việc `JOB_BOUNDARY_102` (automation: việc làm đầu tiên trong kết quả tìm kiếm, nộp bằng CV).
- **Dữ liệu kiểm thử:** Job ID: `JOB_BOUNDARY_102`, mốc thời gian cùng ngày vs khác ngày.
> *Ghi chú nghiệp vụ:* Kịch bản hợp nhất từ các kiểm thử quy tắc ứng tuyển lại trước đây. Kiểm chứng quy định Q-4: Trong 1 ngày chỉ được ứng tuyển 1 việc làm đó tối đa 1 lần; cho phép nộp lại khi bước sang ngày mới. **Cập nhật 2026-11-06:** bỏ bước nộp lại thực tế sang ngày mới (cũ: bước 4) — giới hạn 1 lần/ngày kiểm tra ở server, đồng hồ giả của trình duyệt không mô phỏng được ngày mới; kịch bản dừng ở bước 3.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Mở lại trang chi tiết `JOB_BOUNDARY_102` trong cùng một ngày nộp | Nút ứng tuyển hiển thị trạng thái 'Đã ứng tuyển' / 'Nộp lại hồ sơ' kèm ghi chú đã nộp hôm nay |
| 2 | Cố tình bấm nộp lại hồ sơ trong cùng ngày | Hệ thống chặn thao tác và thông báo: 'Mỗi ngày chỉ được ứng tuyển 1 lần cho công việc này' |
| 3 | Chuyển mốc thời gian sang ngày tiếp theo (khác ngày nộp trước) và mở lại tin tuyển dụng | Hệ thống mở khóa cho phép thực hiện nộp hồ sơ lại |


### TC-044 — Kiểm thử luồng nộp hồ sơ hàng loạt (Bulk Apply) kèm các điều kiện biên

- **Loại:** Chức năng / Tích hợp | **Ưu tiên:** P2 | **Kỹ thuật:** Phân tích giá trị biên / Xử lý danh sách
- **Automation:** Có
- **Spec:** `tests/e2e/desktop/nop-ho-so-hang-loat-bulk-apply.spec.js`
- **Tiền điều kiện:** Vừa ứng tuyển thành công 1 việc làm, popup gợi ý danh sách việc làm tương tự (5 công việc) hiển thị.
- **Dữ liệu kiểm thử:** Danh sách 5 việc làm tương tự, trong đó có 1 việc làm đã được nộp trong ngày.
> *Ghi chú nghiệp vụ:* Kịch bản hợp nhất từ các kiểm thử nộp hàng loạt trước đây theo quyết định Q-2, Q-3, Q-4. Kiểm tra việc chọn tất cả, bỏ chọn tất cả, lọc trừ các việc làm đã nộp trong ngày và kích hoạt OTP nếu tài khoản chưa xác thực.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Bỏ chọn tất cả checkbox việc làm trong danh sách gợi ý | Nút 'Nộp hồ sơ hàng loạt' bị vô hiệu hóa hoặc báo lỗi yêu cầu chọn ít nhất 1 việc |
| 2 | Chọn lại tất cả 5 việc làm (bao gồm việc đã từng nộp trong ngày) | Hệ thống tự động nhận diện hoặc đánh dấu việc đã nộp trong ngày |
| 3 | Nhấn 'Nộp hồ sơ hàng loạt' | Hệ thống xử lý nộp cho các việc hợp lệ, bỏ qua việc đã nộp và hiển thị báo cáo chi tiết |

