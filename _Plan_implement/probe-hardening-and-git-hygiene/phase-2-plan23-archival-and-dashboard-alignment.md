# Phase 2 — Lưu Trữ Plan 23 Vào Archive & Chuẩn Hóa Dashboard

> **Tác giả Nghiệp vụ:** @ba (phiên 2026-10-03) · **Tác giả Kỹ thuật:** @tl (phiên 2026-10-03) · **Research:** Không áp dụng  
> **Trạng thái:** `COMPLETED` · **Cấp độ:** L3  

---

## A. Nghiệp Vụ (BA — A/R; Tech Lead — C)

### A1. Mục Tiêu & Phạm Vi Phase
- **In-Scope:** Lưu trữ kế hoạch đã hoàn thành 100% (PLAN-23: Khắc phục lỗ hổng hệ thống và chuẩn hóa plan) vào thư mục niên khóa `_Plan_implement/archive/2026-10/system-hardening-and-remediation/` theo đúng quy chuẩn Standard 05; cập nhật bảng Dashboard Điều Phối `_Plan_implement/README.md` đưa PLAN-23 vào danh sách lưu trữ và chuyển PLAN-24 thành kế hoạch hoạt động; cập nhật kiểm thử tự động xác nhận tính toàn vẹn của cấu trúc lưu trữ.
- **Out-of-Scope:** Không xóa bỏ bất kỳ tài liệu hay bằng chứng thực nghiệm nào của Plan 23.

### A2. Yêu Cầu & Quy Tắc Nghiệp Vụ Áp Dụng
- `REQ-24-02`: Đảm bảo quy trình kết thúc vòng đời kế hoạch (Plan Archival Lifecycle) được thực hiện nghiêm túc khi một plan đã hoàn thành toàn bộ các phase và nghiệm thu Gate 4.
- `BR-24-02`: Thư mục gốc `_Plan_implement/` chỉ chứa kế hoạch đang thực thi hoặc mới lập, không để tồn đọng các kế hoạch đã hoàn tất nhằm duy trì không gian làm việc tinh gọn.

### A3. User Flow & Nhánh Lỗi/Hủy
- Luồng chính: `Di chuyển thư mục Plan 23 vào archive/2026-10/ → Cập nhật Dashboard README.md → Cập nhật test TC-23-04 / TC-24-02 → Xác nhận test suite passed`.
- Nhánh lỗi: Nếu liên kết markdown bị đứt gãy, điều chỉnh lại đường dẫn tương đối chính xác.

### A4. Trạng Thái Biên (EDGE-xx)
- `EDGE-24-02`: Toàn bộ 4 file phase và 1 file overview của Plan 23 phải được di chuyển đồng thời để không làm đứt gãy quan hệ liên kết nội bộ.

### A5. Tiêu Chí Nghiệm Thu (AC-xx)
- `AC-24-02`: Given Plan 23 đã hoàn tất nghiệm thu When thực hiện lưu trữ Then thư mục `archive/2026-10/system-hardening-and-remediation/` chứa đầy đủ 5 file của Plan 23, và `_Plan_implement/README.md` hiển thị PLAN-23 ở mục lưu trữ kèm ngày hoàn thành (dẫn `BR-24-02`).

### A6. Kịch Bản Nghiệm Thu Nghiệp Vụ (UAT-xx)
- `UAT-24-02`:
  - **Mục tiêu:** PO mở Dashboard thấy PLAN-23 được lưu trữ gọn gàng và PLAN-24 đang hoạt động.
  - **Vai trò:** Product Owner / Tech Lead.
  - **Dữ liệu tiền đề:** Thư mục `_Plan_implement/`.
  - **Các bước:** Kiểm tra cây thư mục và file `_Plan_implement/README.md`.
  - **Kết quả:** PLAN-23 nằm ở mục 3 (Archived Plans) với trạng thái ĐÃ NGHIỆM THU, PLAN-24 nằm ở mục 1 (Active) (dẫn `REQ-24-02` và `BR-24-02`, phủ `AC-24-02`).

---

## B. Kỹ Thuật (Tech Lead — A/R; BA — C)

### B1. Quyết Định Kỹ Thuật (TECH-xx)
- `TECH-24-02`: Di chuyển thư mục bằng lệnh filesystem bảo toàn lịch sử commit, cập nhật các đường dẫn tương đối trong `README.md` và điều chỉnh assertion trong test `qa-spec-studio.test.js` để bao quát cả Plan 23 trong kho lưu trữ (dẫn `REQ-24-02`, lý do để bảo đảm tuân thủ nguyên tắc không hồi quy kiểm thử).

### B2. Bản Đồ File & Ngân Sách Dòng (File Splitting Budget)
| Path | Loại File | Thao Tác | Trần Số Dòng | Dự Kiến |
|---|---|:---:|:---:|:---:|
| `_Plan_implement/README.md` | module | Sửa | 250 | 120 |
| `tests/dashboard-api/qa-spec-studio.test.js` | test | Sửa | 800 | 410 |

### B3. Contract & Schemas
- Vị trí lưu trữ: `_Plan_implement/archive/2026-10/system-hardening-and-remediation/`.

### B4. Quản Lý Phụ Thuộc (Dependencies)
- Không có phụ thuộc ngoài mới (dẫn IMP-24-02).

### B5. Yêu Cầu Phi Chức Năng (NFR)
- 100% link tương đối trong `_Plan_implement/README.md` trỏ đúng file tồn tại trên đĩa.

### B6. Rủi Ro Kỹ Thuật & Cách Chặn
- Nguy cơ gãy link tương đối: Chạy test tự động quét và xác nhận toàn bộ link trước khi đóng phase.

---

## C. Ma Trận Kiểm Thử (BA + Tech Lead; QA — C)

| AC ID | TC ID | Mức | Critical? | File Test Dự Kiến | Ca Biên / Ghi Chú |
|---|---|:---:|:---:|---|---|
| `AC-24-02` | `TC-24-02` | `unit` | Yes | `tests/dashboard-api/qa-spec-studio.test.js` | Kiểm định tính toàn vẹn của thư mục archive Plan 23 và link Dashboard |

---

## D. Phạm Vi Dev Được Tự Quyết (Local Decisions)
- Dev được tự quyết định nội dung mô tả chi tiết của Plan 24 trong bảng Dashboard.

---

## E. Câu Hỏi Mở & Giả Định (Open Questions)
- 0 câu hỏi chặn (zero blocking questions).

---

## F. Tiêu Chí Ra Phase (Exit Criteria)
- [x] Thư mục `system-hardening-and-remediation` được chuyển vào `_Plan_implement/archive/2026-10/`.
- [x] `_Plan_implement/README.md` được cập nhật đồng bộ.
- [x] Test `TC-24-02` trong `tests/dashboard-api/qa-spec-studio.test.js` đạt PASS.

---

## G. Soát Chéo (Cross-Review Signatures)
- Nghiệp vụ soát bởi Tech Lead: ✔ @tl (phiên 2026-10-03)
- Kỹ thuật soát bởi BA: ✔ @ba (phiên 2026-10-03)

---

## H. Nhật Ký Thay Đổi Kế Hoạch (Plan Deviation Requests - PDR)
| PDR ID | Loại | Nội Dung Plan Gốc | Đề Xuất Thực Tế | Ảnh Hưởng | Trạng Thái |
|---|:---:|---|---|---|:---:|
| PDR-24-02 | TECH | Giữ Plan 23 ở root | Chuyển Plan 23 vào archive niên khóa | Tinh gọn cấu trúc | APPROVED |

---

## I. Bằng Chứng Thực Nghiệm (Evidence Block)
- **Kiểm định di chuyển Archive Plan 23:**
  ```powershell
  PS D:\_Automation-Project> git status --short
  R  _Plan_implement/system-hardening-and-remediation/phase-1-drift-sync-and-knowledge.md -> _Plan_implement/archive/2026-10/system-hardening-and-remediation/phase-1-drift-sync-and-knowledge.md
  R  _Plan_implement/system-hardening-and-remediation/phase-2-gate4-contract-and-evidence-realignment.md -> _Plan_implement/archive/2026-10/system-hardening-and-remediation/phase-2-gate4-contract-and-evidence-realignment.md
  R  _Plan_implement/system-hardening-and-remediation/phase-3-hygiene-and-probe-fixes.md -> _Plan_implement/archive/2026-10/system-hardening-and-remediation/phase-3-hygiene-and-probe-fixes.md
  R  _Plan_implement/system-hardening-and-remediation/phase-4-plan-archive-and-standardization.md -> _Plan_implement/archive/2026-10/system-hardening-and-remediation/phase-4-plan-archive-and-standardization.md
  R  _Plan_implement/system-hardening-and-remediation/plan-23-overview.md -> _Plan_implement/archive/2026-10/system-hardening-and-remediation/plan-23-overview.md
  ```
- **Kiểm định Test Contract TC-24-02:**
  ```powershell
  PS D:\_Automation-Project> node --test tests/dashboard-api/qa-spec-studio.test.js
  # Subtest: TC-24-02: Plan 23 archival verification and dashboard links integrity
  ok 9 - TC-24-02: Plan 23 archival verification and dashboard links integrity
  # tests 9 | pass 9 | fail 0
  ```
- **Kiểm định Dashboard API Suites (TC-24-01 + TC-24-02):**
  ```powershell
  PS D:\_Automation-Project> node --test tests/dashboard-api/master-process.test.js tests/dashboard-api/qa-spec-studio.test.js
  # tests 15 | suites 2 | pass 15 | fail 0
  ```

