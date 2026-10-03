# Kế Hoạch 24: Khắc Phục Probe P4, Lưu Trữ Kế Hoạch 23 & Chuẩn Hóa Git Hygiene — Plan Overview

> **Plan ID:** `PLAN-24-PROBE-FIX-PLAN-ARCHIVE-GIT-HYGIENE-2026-10-03` · **Baseline:** `20caf254` · **Cấp độ:** L3  
> **Trạng thái:** `DRAFT` · **Research:** Không áp dụng (L1/L2)  
> **Nguồn gốc:** Đợt audit toàn diện hệ sinh thái ngày 2026-10-03 sau khi hoàn tất Plan 23.

---

## 1. Bối Cảnh & Mục Tiêu Kinh Doanh
- **Bối cảnh:** Sau khi hoàn thành xuất sắc 4 phase của Plan 23 (Drift IN_SYNC, Contract SHA256 pin, dọn dẹp workspace tạm và sửa Probe P5), đợt thẩm tra chiều sâu phát hiện 3 vấn đề ("chỗ lủng") kỹ thuật mới:
  1. **Probe P4 False Positive:** Lệnh `npm run mp:probes` báo lỗi Exit 1 do Probe P4 quét trúng commit cũ `db3d7415` có chứa chuỗi giả lập test `AKIA1234567890ABCDEF` trong tài liệu markdown đã xóa.
  2. **Plan 23 Chưa Lưu Trữ:** Plan 23 đã hoàn tất 100% nhưng vẫn nằm ở thư mục root active, chưa được chuyển vào `_Plan_implement/archive/2026-10/` theo chuẩn Standard 05.
  3. **Probe P6 & Git Hygiene:** Workspace đang ở trạng thái dirty do các thay đổi của Plan 23 chưa được đóng gói vào commit SHA chính thức, khiến Probe P6 báo `DIRTY WORKSPACE`.
- **Mục tiêu:**
  - Sửa Probe P4 loại trừ tài liệu và khóa giả lập, đưa `npm run mp:probes` (cả 6 probes P1-P6) về trạng thái 100% Green.
  - Lưu trữ Plan 23 vào `_Plan_implement/archive/2026-10/system-hardening-and-remediation/` và cập nhật Dashboard Plan.
  - Đóng gói commit sạch sẽ, xác nhận Probe P6 PASS và bảo đảm 100% Green toàn bộ test suite.

---

## 2. WBS & Dependency Graph

| Phase | Tên Giai Đoạn | File Chi Tiết | Phụ Thuộc | Chủ Trì | Trạng Thái |
|---|---|---|---|:---:|:---:|
| 1 | Khắc Phục Probe P4 False Positive & Kiểm Định Probes | [phase-1-probe-p4-fix-and-verification.md](phase-1-probe-p4-fix-and-verification.md) | — | @ba / @tl | `DRAFT` |
| 2 | Lưu Trữ Plan 23 Vào Archive & Chuẩn Hóa Dashboard | [phase-2-plan23-archival-and-dashboard-alignment.md](phase-2-plan23-archival-and-dashboard-alignment.md) | Phase 1 | @ba / @tl | `DRAFT` |
| 3 | Đóng Chu Trình Git Hygiene & Nghiệm Thu Sẵn Sàng Gate 4 | [phase-3-git-hygiene-and-gate4-readiness.md](phase-3-git-hygiene-and-gate4-readiness.md) | Phase 2 | @ba / @tl | `DRAFT` |

```text
Phase 1 (Probe P4 Fix) ──► Phase 2 (Plan 23 Archival) ──► Phase 3 (Git Hygiene & Gate 4)
```

---

## 3. Research Impact
> Research: Không áp dụng (L1/L2). Kế hoạch xử lý probe hệ thống và vệ sinh workspace.

---

## 4. Điều Kiện Mang Theo
| Mục | Loại | Xử lý trong plan |
|---|---|---|
| U-1 | P1 | Bảo tồn tuyệt đối tính năng bảo vệ secret của Probe P4 đối với mã nguồn sản phẩm thực tế. |
| U-2 | P2 | Tất cả các phase con phải tuân thủ nghiêm ngặt chuẩn cấu trúc §A–§I và vượt qua `master plan-check`. |

---

## 5. Danh Mục Điểm Chưa Rõ Từ Plan Gốc
| ID | Điểm chưa rõ | Vị trí trong plan gốc | Người xác nhận | Trạng thái |
|---|---|---|---|:---:|
| GAP-1 | Khóa giả lập `AKIA1234567890ABCDEF` có cần loại trừ trực tiếp trong probe không | Probe P4 | Tech Lead | `RESOLVED` (Loại trừ pathspec markdown tài liệu và mẫu khóa giả lập phổ biến) |

---

## 6. Checklist Trạng Thái Tổng Thể
- [ ] Gate 1 — Phase files đạt `master plan-check` và có chữ ký chéo
- [ ] Gate 2 — Probe P4 và P6 đạt PASS
- [ ] Gate 3 — Thực thi hoàn tất 3 phase không gây hồi quy
- [ ] Gate 4 — Toàn bộ suite 585 unit + 181 dashboard tests Green 100%
