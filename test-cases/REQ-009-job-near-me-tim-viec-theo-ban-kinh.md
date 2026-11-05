# Test case — REQ-009 Job Near Me v1.1: Tìm việc làm theo bán kính quanh vị trí

## Bảng truy vết

| Test case | AC | Mô tả | Ưu tiên | Automation | Spec |
|---|---|---|---|---|---|
| TC-160 | AC-060 | Khách vãng lai mở "Khám phá việc làm gần tôi" từ Home và lọc việc làm trong bán kính đã chọn | P0 | Có | tests/e2e/desktop/job_near_me_radius_filter-bdd.spec.js |
| TC-161 | AC-061 | Pop-up tự điền vị trí và bán kính lần trước, lưu lịch sử, nhập bán kính tuỳ chỉnh và bỏ lọc vị trí | P1 | Có | tests/e2e/desktop/job_near_me_radius_filter-bdd.spec.js |
| TC-162 | AC-062 | Khách vãng lai mở Job Near Me từ Home mobile, dùng "Vị trí hiện tại" và lọc việc làm trong bán kính | P1 | Có | tests/e2e/mobile-web/job_near_me_radius_filter-bdd.mobile.spec.js |

## Chi tiết

### TC-160 — Khách vãng lai mở "Khám phá việc làm gần tôi" từ Home và lọc việc làm trong bán kính đã chọn

- **Loại:** Chức năng / E2E | **Ưu tiên:** P0 | **Kỹ thuật:** User journey (happy path regression)
- **Automation:** Có
- **Spec:** `tests/e2e/desktop/job_near_me_radius_filter-bdd.spec.js`
- **Tiền điều kiện:** Khách vãng lai truy cập trang chủ Desktop (chưa đăng nhập).
- **Dữ liệu kiểm thử:** `data/jobNearMeData.json` (địa điểm "Chợ Bến Thành", bán kính 10km).

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Mở trang chủ | Trang chủ hiển thị |
| 2 | Mở dropdown "Địa điểm", chọn "Khám phá việc làm gần tôi" | Chuyển sang trang tìm kiếm, pop-up "Khám phá việc làm gần tôi" tự mở |
| 3 | Nhập "Chợ Bến Thành", chọn gợi ý, chọn 10km | Ô địa điểm điền gợi ý đã chọn, nút 10km được bật |
| 4 | Bấm "Áp dụng" | Pop-up đóng, thanh tìm kiếm hiển thị "(10km)", danh sách việc làm có khoảng cách ≤ 10km |

### TC-161 — Pop-up tự điền vị trí và bán kính lần trước, lưu lịch sử, nhập bán kính tuỳ chỉnh và bỏ lọc vị trí

- **Loại:** Chức năng / E2E | **Ưu tiên:** P1 | **Kỹ thuật:** User journey (happy path regression)
- **Automation:** Có
- **Spec:** `tests/e2e/desktop/job_near_me_radius_filter-bdd.spec.js`
- **Tiền điều kiện:** Khách vãng lai đã áp dụng lọc "Chợ Bến Thành" – 10km trên trang tìm kiếm.
- **Dữ liệu kiểm thử:** `data/jobNearMeData.json` (bán kính có sẵn 10km, bán kính tuỳ chỉnh 25km).

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Mở lại pop-up từ thanh tìm kiếm | Ô địa điểm = địa điểm lần trước, 10km được bật, địa điểm có trong "Lịch sử tìm kiếm" |
| 2 | Nhập bán kính tuỳ chỉnh 25 | Các nút 5/10/15km bị bỏ chọn, ô tuỳ chỉnh = 25 |
| 3 | Bấm "Áp dụng" | Thanh tìm kiếm hiển thị "(25km)", danh sách việc làm có khoảng cách ≤ 25km |
| 4 | Mở lại pop-up | Tự điền địa điểm và bán kính tuỳ chỉnh 25 |
| 5 | Bấm "Bỏ lọc vị trí" | Pop-up đóng, bộ lọc bán kính bị bỏ, chip bán kính biến mất |
| 6 | Mở lại pop-up | Địa điểm vẫn còn trong "Lịch sử tìm kiếm" |

### TC-162 — Khách vãng lai mở Job Near Me từ Home mobile, dùng "Vị trí hiện tại" và lọc việc làm trong bán kính

- **Loại:** Chức năng / E2E | **Ưu tiên:** P1 | **Kỹ thuật:** User journey (happy path regression)
- **Automation:** Có
- **Spec:** `tests/e2e/mobile-web/job_near_me_radius_filter-bdd.mobile.spec.js`
- **Tiền điều kiện:** Khách vãng lai ở trang chủ Mobile Web, trình duyệt đã cấp quyền vị trí (toạ độ giả lập quanh Q1, TP.HCM).
- **Dữ liệu kiểm thử:** `data/jobNearMeData.json` (toạ độ GPS, bán kính 15km).

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Mở trang chủ Mobile Web | Trang chủ hiển thị |
| 2 | Chạm "Việc làm gần tôi" | Chuyển sang trang tìm kiếm, bottom sheet "Khám phá việc làm gần tôi" mở |
| 3 | Bấm "Vị trí hiện tại", chọn 15km | Ô địa điểm được điền địa chỉ hiện tại, nút 15km được bật |
| 4 | Bấm "Áp dụng" | Thanh tìm kiếm hiển thị "(15km)", danh sách việc làm có khoảng cách ≤ 15km |

## Ứng viên automation

| TC đề xuất | AC liên quan | Vì sao đáng automation | Ưu tiên |
|---|---|---|---|
| BVA ô bán kính tuỳ chỉnh (0/00/000, 999, 9999, ký tự không phải số) | AC-061 | Logic validate thuần FE, ổn định, dễ hồi quy khi đổi component | P1 |
| Lịch sử tối đa 5 địa điểm, đẩy địa điểm cũ nhất (FIFO) và chọn lại lên đầu | AC-061 | Từng có lỗi thứ tự (BUG-01), dễ hồi quy | P1 |
| "Xoá lịch sử" xoá toàn bộ, giữ bộ lọc đang áp dụng | AC-061 | Thao tác phá huỷ dữ liệu, cần chặn hồi quy | P2 |
| GPS bị từ chối: giữ nguyên địa điểm/bán kính, không treo loading | AC-062 | Mô phỏng được bằng quyền trình duyệt, chạy nhanh | P2 |
| Đóng pop-up bằng X không lưu thay đổi chưa áp dụng | AC-061 | Rule US6 dễ vỡ khi refactor state | P2 |

Không nên automation: tracking Mixpanel (phụ thuộc bên thứ ba, đã kiểm thủ công), so khớp layout với Figma (kiểm tra thị giác), Mobile App (ngoài phạm vi repo).
