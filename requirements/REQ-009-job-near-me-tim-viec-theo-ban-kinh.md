---
id: REQ-009
title: Job Near Me v1.1 – Tìm việc làm theo bán kính quanh vị trí
status: Confirmed
version: 1.0
risk: medium
owner: BA / Product / QA
test_cases: test-cases/REQ-009-job-near-me-tim-viec-theo-ban-kinh.md
---

# REQ-009 — Job Near Me v1.1: Tìm việc làm theo bán kính quanh vị trí

| Thuộc tính | Giá trị |
|---|---|
| Mã | REQ-009 |
| Phiên bản | 1.0 (đồng bộ theo Jira JS-8781 và kết quả kiểm thử thủ công 02–05/11/2026 trên QC) |
| Vai trò | Người tìm việc (khách vãng lai và đã đăng nhập) |
| Nền tảng | Desktop / Mobile web (Mobile App ngoài phạm vi automation của repo này) |
| Nguồn tài liệu | Jira JS-8781, PRD "Job Near Me v1.1" (Confluence), Figma Handoff JS Web 2026 |
| Trạng thái tổng thể | Confirmed |

## 1. Tổng quan

Job Near Me (JNM) giúp người tìm việc lọc việc làm trong một bán kính quanh một vị trí. v1.1 bổ sung
điểm vào ở Home Desktop và cải thiện bộ lọc bán kính trên Desktop, Mobile Web.

| User story | Nội dung |
|---|---|
| US1 — Entry point Home Desktop | Dropdown "Địa điểm" ở Home có lựa chọn đầu tiên "Khám phá việc làm gần tôi"; chọn sẽ sang trang tìm kiếm và tự mở pop-up JNM |
| US2 — Auto-fill | Pop-up tự điền vị trí và bán kính lần áp dụng gần nhất |
| US3 — Radius | Chọn bán kính có sẵn 5/10/15km (mặc định 5km) hoặc nhập bán kính tuỳ chỉnh 1–999km; chỉ một lựa chọn được bật tại một thời điểm |
| US4 — Vị trí hiện tại | Nút "Vị trí hiện tại" điền địa chỉ từ GPS của thiết bị |
| US5 — Nhập địa điểm | Nhập địa điểm, chọn một gợi ý mới được phép áp dụng |
| US6 — Áp dụng, đóng, bỏ lọc | "Áp dụng" lọc danh sách việc làm; đóng pop-up không lưu thay đổi; "Bỏ lọc vị trí" bỏ bộ lọc bán kính |
| US7 — Lịch sử | Lưu tối đa 5 địa điểm đã áp dụng (mới → cũ); "Xoá lịch sử" xoá toàn bộ, không ảnh hưởng bộ lọc hiện tại |

## 2. Acceptance criteria

### AC-060 — Lọc việc làm theo bán kính từ điểm vào Home
*(US1, US3, US5, US6)*
- **Given** người tìm việc ở trang chủ Desktop
- **When** chọn "Khám phá việc làm gần tôi" trong dropdown "Địa điểm", nhập địa điểm, chọn một gợi ý, chọn bán kính có sẵn và bấm "Áp dụng"
- **Then** hệ thống chuyển sang trang tìm kiếm, pop-up JNM tự mở, sau khi áp dụng thì danh sách việc làm được lọc theo vị trí đã chọn
- **And** mọi việc làm hiển thị có khoảng cách không vượt quá bán kính đã chọn; thanh tìm kiếm hiển thị bán kính đang áp dụng.
- **Trạng thái:** Confirmed.
- **Spec kiểm chứng:** `job_near_me_radius_filter-bdd.spec.js`.

### AC-061 — Tự điền lần áp dụng trước, lịch sử, bán kính tuỳ chỉnh và bỏ lọc vị trí
*(US2, US3, US6, US7)*
- **Given** người tìm việc đã áp dụng lọc bán kính với một địa điểm
- **When** mở lại pop-up JNM
- **Then** pop-up tự điền địa điểm và bán kính lần trước, địa điểm đó có trong "Lịch sử tìm kiếm"
- **And** nhập bán kính tuỳ chỉnh thì các bán kính có sẵn bị bỏ chọn; áp dụng thì danh sách được lọc lại theo bán kính mới
- **And** bấm "Bỏ lọc vị trí" thì bộ lọc bán kính bị bỏ, pop-up đóng, lịch sử tìm kiếm vẫn được giữ.
- **Trạng thái:** Confirmed.
- **Spec kiểm chứng:** `job_near_me_radius_filter-bdd.spec.js`.

### AC-062 — Lọc việc làm quanh vị trí hiện tại trên Mobile Web
*(US4, US3, US6 – Mobile Web)*
- **Given** người tìm việc ở trang chủ Mobile Web và trình duyệt đã cấp quyền vị trí
- **When** chạm "Việc làm gần tôi", bấm "Vị trí hiện tại", chọn bán kính và bấm "Áp dụng"
- **Then** ô địa điểm được điền địa chỉ tương ứng vị trí hiện tại, danh sách việc làm được lọc quanh vị trí đó và mọi việc làm nằm trong bán kính đã chọn.
- **Trạng thái:** Confirmed.
- **Spec kiểm chứng:** `job_near_me_radius_filter-bdd.mobile.spec.js`.

## 3. Business rule đã xác nhận khi kiểm thử

| Quy tắc | Trạng thái | Nguồn |
|---|---|---|
| Khách vãng lai dùng được JNM; địa điểm/bán kính lần trước và lịch sử vẫn còn sau khi tải lại trang | Confirmed | Kiểm thử thủ công 02–03/11/2026; TC-161 |
| Phải chọn gợi ý địa điểm mới bật "Áp dụng"; sửa chữ sau khi chọn thì "Áp dụng" tắt lại | Confirmed | Kiểm thử thủ công Flow 16 |
| Bán kính tuỳ chỉnh chỉ nhận số, tối đa 3 chữ số; 0 báo lỗi "Giá trị từ 1-999" và tắt "Áp dụng" | Confirmed | Kiểm thử thủ công Flow 22–24 |
| Chọn lại địa điểm từ lịch sử rồi áp dụng thì địa điểm đó lên đầu lịch sử, không tạo bản ghi trùng | Confirmed | Re-test 03/11/2026 sau fix |
| Mobile Web có nút "Bỏ lọc vị trí" (khác giả định ban đầu chỉ có trên Desktop) | Needs confirmation (Q7) | Kiểm thử thủ công Flow 19, 30 |
| Lịch sử trống vẫn hiển thị tiêu đề "Lịch sử tìm kiếm" và trạng thái rỗng | Needs confirmation (Q-HIST) | Kiểm thử thủ công Flow 02, 21 |

## 4. Nghiệp vụ và độ phủ automation

Automation chỉ phủ các luồng happy path E2E để chạy regression. Phần còn lại (BVA ô bán kính,
lịch sử tối đa 5, xoá lịch sử, GPS bị từ chối, tracking Mixpanel, i18n) đã kiểm thử thủ công theo
checklist Jira JS-8781 và nằm ở mục "Ứng viên automation" của file test case.

## 5. Open questions

| Mã | Câu hỏi | Người chịu trách nhiệm |
|---|---|---|
| Q7 | Mobile Web có cần nút "Bỏ lọc vị trí" và event "Remove Radius Filter" không? | PO |
| Q-HIST | Khi lịch sử trống có ẩn hoàn toàn khu vực "Lịch sử tìm kiếm" không? | PO / Design |
| Q-Enter | Nhấn Enter ở ô bán kính tuỳ chỉnh có áp dụng bộ lọc không? | PO |

## Change log

| Ngày | Phiên bản | Nội dung |
|---|---|---|
| 2026-11-05 | 1.0 | Tạo mới từ JS-8781 và kết quả kiểm thử; thêm AC-060..AC-062 |
