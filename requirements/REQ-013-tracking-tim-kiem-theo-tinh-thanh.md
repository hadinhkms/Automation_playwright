---
id: REQ-013
title: Tracking tìm kiếm theo tỉnh thành – province_number và filter_version (JS-8939)
status: Confirmed
version: 1.0
risk: medium
owner: PO / Data / QA
test_cases: test-cases/REQ-013-tracking-tim-kiem-theo-tinh-thanh.md
---

# REQ-013 — Tracking tìm kiếm theo tỉnh thành (JS-8939)

| Thuộc tính | Giá trị |
|---|---|
| Mã | REQ-013 |
| Phiên bản | 1.0 (Jira JS-8939 + solution PO chốt qua Google Chat, kiểm thử trên QC 05/11/2026) |
| Vai trò | Người tìm việc (khách vãng lai; người đã đăng nhập chưa kiểm) |
| Nền tảng | Desktop web (Mobile Web đã verify thủ công, chưa automation) |
| Nguồn tài liệu | Jira JS-8939; báo cáo `evidence/JS-8939/REPORT_JS-8939_2026-11-05.md`; review tracking Plan 17 Hub QA |
| Trạng thái tổng thể | Confirmed cho AC-071..AC-073; hành vi reload còn Needs confirmation |

## 1. Tổng quan

Event Mixpanel `Job Search Performed` mang property `province_number`, `filter_version`, `district_number`.
Data cần phân biệt: không chọn tỉnh, chọn Toàn quốc, chọn tỉnh cụ thể; và biết user đang dùng danh sách
"Tỉnh/thành cũ" (63 tỉnh) hay "Tỉnh/thành sau sáp nhập" (34 tỉnh).

## 2. Acceptance criteria

### AC-071 — Không chọn tỉnh thì không ghi nhận tỉnh và phiên bản filter
- **Given** khách vãng lai ở trang tìm việc, chưa chọn tỉnh thành
- **When** bấm Tìm kiếm
- **Then** `Job Search Performed` có `province_number` = null, `filter_version` = null, `district_number` = null.
- **Trạng thái:** Confirmed.

### AC-072 — Danh sách tỉnh/thành cũ ghi nhận số tỉnh đã chọn và phiên bản 1.0
- **Given** khách vãng lai ở trang tìm việc
- **When** chọn "Tỉnh/thành cũ" → Hà Nội → Áp dụng → Tìm kiếm
- **Then** `Job Search Performed` bắn đúng 1 lần với `province_number` = 1, `filter_version` = "1.0", `district_number` = 0.
- **Trạng thái:** Confirmed.

### AC-073 — Toàn quốc ghi nhận tổng số tỉnh của phiên bản danh sách
- **Given** khách vãng lai ở trang tìm việc
- **When** chọn "Tỉnh/thành sau sáp nhập" → Toàn quốc → Áp dụng → Tìm kiếm
- **Then** `Job Search Performed` bắn đúng 1 lần với `province_number` = 34, `filter_version` = "2.0".
- **And** với danh sách cũ, Toàn quốc ghi nhận `province_number` = 63, `filter_version` = "1.0".
- **Trạng thái:** Confirmed theo solution PO (thay cho mô tả gốc "Toàn quốc = 0"); nhánh danh sách cũ verify thủ công.

## 3. Quy tắc và giá trị

| Trường hợp | province_number | filter_version | Test case |
|---|---|---|---|
| Không chọn tỉnh | null | null | TC-172 |
| Danh sách cũ, chọn N tỉnh | N | "1.0" | TC-173 |
| Danh sách mới, Toàn quốc | 34 | "2.0" | TC-174 |
| Danh sách cũ, Toàn quốc | 63 | "1.0" | Thủ công (report JS-8939) |

## 4. Open questions

- [ ] Q-013-01 (PO): reload sau khi chọn Toàn quốc ở danh sách mới thì UI và tracking về danh sách cũ (`63 / "1.0"`).
  Ticket kỳ vọng giữ đúng phiên bản. Chấp nhận hay cần sửa? — **Needs confirmation**, chưa automation.
- [ ] Q-013-02 (PO/Data): `Job Search Performed` bắn cả khi load/reload trang. Có tính là một lượt search không?
- [ ] Q-013-03 (Dev): `Search Filter Applied` có cần trên web không (hiện không bắn khi bấm Áp dụng)?
- [ ] Q-013-04 (PO): `filter_version` là chuỗi `"1.0"` hay số `1`?
- [ ] Q-013-05 (Data): `province_number` mã hoá Toàn quốc bằng tổng số tỉnh; cân nhắc thêm `province_scope`.

Chi tiết review thiết kế tracking: `D:/_QA_Test_Automation/_Plan_implement/plan-17-tracking-analytics/evidence/pilot-JS-8939.md`.
