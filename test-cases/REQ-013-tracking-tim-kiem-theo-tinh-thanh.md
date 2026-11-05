# Test case — REQ-013 Tracking tìm kiếm theo tỉnh thành (JS-8939)

## Bảng truy vết

| Test case | AC | Mô tả | Ưu tiên | Automation | Spec |
|---|---|---|---|---|---|
| TC-172 | AC-071 | Không chọn tỉnh rồi Tìm kiếm: province_number, filter_version, district_number = null | P1 | Có | tests/e2e/desktop/tracking-tim-kiem-tinh-thanh-js-8939.spec.js |
| TC-173 | AC-072 | Danh sách cũ, Hà Nội: province_number 1, filter_version "1.0", bắn đúng 1 lần | P1 | Có | tests/e2e/desktop/tracking-tim-kiem-tinh-thanh-js-8939.spec.js |
| TC-174 | AC-073 | Danh sách sau sáp nhập, Toàn quốc: province_number 34, filter_version "2.0", bắn đúng 1 lần | P1 | Có | tests/e2e/desktop/tracking-tim-kiem-tinh-thanh-js-8939.spec.js |

## Chi tiết

Chung cho mọi TC:
- **Loại:** Tracking | **Kỹ thuật:** Equivalence partitioning theo phạm vi tỉnh (không chọn / cụ thể / toàn quốc)
- **Capabilities:** tracking
- **Tiền điều kiện:** Khách vãng lai, Desktop, môi trường QC.
- **Cách kiểm:** bắt request `api-eu.mixpanel.com/track` bằng `startMixpanelCapture` +
  `expectMixpanelEvent` (`core/deep-testing/mixpanel-capture.js`); chỉ xét event phát sinh sau thao tác.
- **Dữ liệu:** `data/js8939TrackingData.json`.

### TC-172 — Không chọn tỉnh rồi Tìm kiếm

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Mở trang tìm việc | Trang hiển thị |
| 2 | Không chọn tỉnh, bấm Tìm kiếm | `Job Search Performed`: `province_number`, `filter_version`, `district_number` = null |

### TC-173 — Danh sách cũ, Hà Nội

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Mở bộ lọc tỉnh, chọn "Tỉnh/thành cũ", tick Hà Nội | Hà Nội được chọn |
| 2 | Áp dụng → Tìm kiếm | `Job Search Performed` đúng 1 lần: `province_number` 1, `filter_version` "1.0", `district_number` 0, `action` "province" |

### TC-174 — Danh sách sau sáp nhập, Toàn quốc

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Mở bộ lọc tỉnh, chọn "Tỉnh/thành sau sáp nhập", tick Toàn quốc | Toàn quốc được chọn |
| 2 | Áp dụng → Tìm kiếm | `Job Search Performed` đúng 1 lần: `province_number` 34, `filter_version` "2.0", `district_number` 0 |

## Case không automation

| Hành vi | Lý do | Bù đắp |
|---|---|---|
| Reload sau Toàn quốc (mới) | Q-013-01 chưa chốt kỳ vọng | Verify thủ công, report JS-8939 |
| Danh sách cũ, Toàn quốc = 63 | Trùng kỹ thuật với TC-174, giữ suite gọn | Verify thủ công, report JS-8939 |
| Mobile Web 414/360 | Chưa có Page Object mobile cho picker 2 phiên bản | Verify thủ công, report JS-8939 |
