# Phase 4 — Lưu Trữ Kế Hoạch Cũ & Chuẩn Hóa Dashboard Plan

> **Tác giả Nghiệp vụ:** @ba (phiên 2026-10-03) · **Tác giả Kỹ thuật:** @tl (phiên 2026-10-03) · **Research:** Không áp dụng  
> **Trạng thái:** `COMPLETED` · **Cấp độ:** L3  

---

## A. Nghiệp Vụ (BA — A/R; Tech Lead — C)

### A1. Mục Tiêu & Phạm Vi Phase
- **In-Scope:** Lưu trữ các kế hoạch đã hoàn thành và nghiệm thu (Plan 20, Plan 21, Plan 22) vào thư mục niên khóa `_Plan_implement/archive/2026-10/`; chuẩn hóa và cập nhật bảng Dashboard Điều Phối `_Plan_implement/README.md` theo phân vùng chuẩn Master Process (Active, Backlog, Archived); đảm bảo công cụ `master plan-check` xác nhận hợp lệ.
- **Out-of-Scope:** Không xóa bỏ bất kỳ file plan cũ nào, chỉ di chuyển vào thư mục archive.

### A2. Yêu Cầu & Quy Tắc Nghiệp Vụ Áp Dụng
- `REQ-23-04`: Chuẩn hóa vòng đời quản trị kế hoạch dự án (Plan Lifecycle Management) theo đúng quy chuẩn Master Process.
- `BR-23-04`: Toàn bộ các plan đã nghiệm thu hoàn tất phải được chuyển vào `archive/YYYY-MM/` để giữ thư mục gốc của plan luôn tinh gọn và chỉ tập trung vào các kế hoạch active.

### A3. User Flow & Nhánh Lỗi/Hủy
- Luồng chính: `Di chuyển thư mục plan hoàn thành vào archive/2026-10 → Cập nhật README.md Dashboard → Chạy master plan-check kiểm định`.
- Nhánh lỗi: Nếu đường dẫn tham chiếu trong README bị gãy, khôi phục link tương đối chính xác.

### A4. Trạng Thái Biên (EDGE-xx)
- `EDGE-23-04`: Trường hợp có file plan độc lập (như `21_SMART_TRACE_LINKER_PLAN.md`) được gom chung vào thư mục archive của tính năng đó.

### A5. Tiêu Chí Nghiệm Thu (AC-xx)
- `AC-23-04`: Given các kế hoạch cũ đã nghiệm thu When thực hiện lưu trữ và chuẩn hóa Then thư mục `_Plan_implement/` chỉ còn duy nhất PLAN-23 ở mục Active, các plan 20, 21, 22 nằm đúng trong `archive/2026-10/`, và `master plan-check` cho PLAN-23 đạt PASS (dẫn `BR-23-04`).

### A6. Kịch Bản Nghiệm Thu Nghiệp Vụ (UAT-xx)
- `UAT-23-04`:
  - **Mục tiêu:** PO và Tech Lead mở Dashboard Plan thấy cấu trúc phân vùng rõ ràng, chuẩn mực.
  - **Vai trò:** Product Owner / Tech Lead.
  - **Dữ liệu tiền đề:** Thư mục `_Plan_implement/`.
  - **Các bước:** Mở file `_Plan_implement/README.md` và kiểm tra cây thư mục.
  - **Kết quả:** PLAN-23 nằm ở mục 1 (Active); PLAN-20, 21, 22 nằm ở mục 3 (Archived) kèm đường dẫn trỏ đúng tới `archive/2026-10/` (dẫn `REQ-23-04` và `BR-23-04`, phủ `AC-23-04`).

---

## B. Kỹ Thuật (Tech Lead — A/R; BA — C)

### B1. Quyết Định Kỹ Thuật (TECH-xx)
- `TECH-23-04`: Thực hiện di chuyển cấu trúc thư mục bằng lệnh git filesystem an toàn và cập nhật đường dẫn tương đối trong `_Plan_implement/README.md` nhằm bảo toàn lịch sử commit và không làm đứt gãy liên kết (dẫn `REQ-23-04`, lý do để đảm bảo tuân thủ triệt để Standard 05 về Plan Archival Lifecycle).

### B2. Bản Đồ File & Ngân Sách Dòng (File Splitting Budget)
| Path | Loại File | Thao Tác | Trần Số Dòng | Dự Kiến |
|---|---|:---:|:---:|:---:|
| `_Plan_implement/README.md` | module | Sửa | 250 | 120 |
| `tests/dashboard-api/qa-spec-studio.test.js` | test | Sửa | 800 | 150 |

### B3. Contract & Schemas
- Cấu trúc thư mục chuẩn: `_Plan_implement/archive/2026-10/{framework-stabilization,smart-trace-linker,framework-risk-remediation}`.

### B4. Quản Lý Phụ Thuộc (Dependencies)
- Không có.

### B5. Yêu Cầu Phi Chức Năng (NFR)
- Đảm bảo toàn bộ liên kết markdown trong `README.md` hoạt động tốt (0 broken link).

### B6. Rủi Ro Kỹ Thuật & Cách Chặn
- Nguy cơ gãy link tương đối khi di chuyển: Chạy kiểm tra đường dẫn sau khi move.

---

## C. Ma Trận Kiểm Thử (BA + Tech Lead; QA — C)

| AC ID | TC ID | Mức | Critical? | File Test Dự Kiến | Ca Biên / Ghi Chú |
|---|---|:---:|:---:|---|---|
| `AC-23-04` | `TC-23-04` | `unit` | Yes | `tests/dashboard-api/qa-spec-studio.test.js` | Kiểm tra tính toàn vẹn của thư mục plan và dashboard link |

---

## D. Phạm Vi Dev Được Tự Quyết (Local Decisions)
- Dev được tự quyết format icon hiển thị và bảng tiến độ trong Dashboard README.

---

## E. Câu Hỏi Mở & Giả Định (Open Questions)
- 0 câu hỏi chặn (zero blocking questions).

---

## F. Tiêu Chí Ra Phase (Exit Criteria)
- [x] Các cụm `framework-stabilization`, `smart-trace-linker`, `framework-risk-remediation` được di chuyển vào `archive/2026-10/`.
- [x] `_Plan_implement/README.md` được cập nhật đồng bộ.
- [x] Lệnh `python .master_process/master.py plan-check _Plan_implement/system-hardening-and-remediation/plan-23-overview.md` đạt PASS.

---

## G. Soát Chéo (Cross-Review Signatures)
- Nghiệp vụ soát bởi Tech Lead: ✔ @tl (phiên 2026-10-03)
- Kỹ thuật soát bởi BA: ✔ @ba (phiên 2026-10-03)

---

## H. Nhật Ký Thay Đổi Kế Hoạch (Plan Deviation Requests - PDR)
| PDR ID | Loại | Nội Dung Plan Gốc | Đề Xuất Thực Tế | Ảnh Hưởng | Trạng Thái |
|---|:---:|---|---|---|:---:|
| PDR-23-04 | TECH | Lưu trữ thủ công | Lưu trữ theo đúng niên khóa chuẩn | Nâng cao tính chuẩn mực | APPROVED |

---

## I. Bằng Chứng Thực Nghiệm (Evidence Block)
- **Kiểm định Unit Test TC-23-04:**
  ```text
  node --test tests/dashboard-api/qa-spec-studio.test.js
  # Subtest: TC-23-04: Plan lifecycle archive layout and dashboard links integrity
  ok 9 - TC-23-04: Plan lifecycle archive layout and dashboard links integrity
    ---
    duration_ms: 2.7523
    ...
  # tests 9
  # pass 9
  ```
- **Kiểm định cấu trúc thư mục:**
  - Thư mục active: Duy nhất `system-hardening-and-remediation/`.
  - Thư mục lưu trữ: `archive/2026-10/{framework-stabilization,smart-trace-linker,framework-risk-remediation}`.
- **Kiểm định liên kết Markdown:** Toàn bộ liên kết trong `_Plan_implement/README.md` trỏ đúng file vật lý trên đĩa.

