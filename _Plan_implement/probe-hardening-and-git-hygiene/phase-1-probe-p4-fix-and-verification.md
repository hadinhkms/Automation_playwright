# Phase 1 — Khắc Phục Probe P4 False Positive & Kiểm Định Probes

> **Tác giả Nghiệp vụ:** @ba (phiên 2026-10-03) · **Tác giả Kỹ thuật:** @tl (phiên 2026-10-03) · **Research:** Không áp dụng  
> **Trạng thái:** `DRAFT` · **Cấp độ:** L3  

---

## A. Nghiệp Vụ (BA — A/R; Tech Lead — C)

### A1. Mục Tiêu & Phạm Vi Phase
- **In-Scope:** Tinh chỉnh cơ chế quét Probe P4 trong script `.master_process/scripts/audit-probes.ps1` nhằm loại bỏ hiện tượng bắt nhầm (false positive) chuỗi khóa giả lập test trong lịch sử các file tài liệu markdown (`_Plan_implement`, `*.md`); đảm bảo Probe P4 vượt qua kiểm tra với mã thoát 0 trong khi vẫn duy trì 100% khả năng phát hiện secret thật trong mã nguồn ứng dụng.
- **Out-of-Scope:** Không làm suy yếu quy tắc quét secret đối với các định dạng mã nguồn thực thi (`.js`, `.ts`, `.py`, `.json`, `.env`).

### A2. Yêu Cầu & Quy Tắc Nghiệp Vụ Áp Dụng
- `REQ-24-01`: Probe P4 phải phân định chính xác giữa secret thật trong mã nguồn và dữ liệu kiểm thử / tài liệu kế hoạch.
- `BR-24-01`: Mọi công cụ kiểm tra tự động phải đạt tỷ lệ false alarm bằng 0 để bảo đảm độ tin cậy của quy trình CI/CD.

### A3. User Flow & Nhánh Lỗi/Hủy
- Luồng chính: `Kỹ sư chạy lệnh mp:probes P4 → Probe quét lịch sử git loại trừ tài liệu kế hoạch → Kết quả trả về PASS (exit code 0)`.
- Nhánh lỗi: Nếu phát hiện secret thật trong mã nguồn thực thi, dừng quy trình và in cảnh báo đỏ kèm commit SHA vi phạm.

### A4. Trạng Thái Biên (EDGE-xx)
- `EDGE-24-01`: Khóa giả lập test dạng tuần tự `AKIA1234567890ABCDEF` trong tài liệu kế hoạch cũ không được coi là secret rò rỉ.

### A5. Tiêu Chí Nghiệm Thu (AC-xx)
- `AC-24-01`: Given kho mã nguồn có commit cũ chứa ví dụ minh họa khóa test trong file markdown When chạy Probe P4 Then công cụ trả về kết quả đạt PASS và exit code 0 mà không báo lỗi false positive (dẫn `BR-24-01`).

### A6. Kịch Bản Nghiệm Thu Nghiệp Vụ (UAT-xx)
- `UAT-24-01`:
  - **Mục tiêu:** Kỹ sư QA xác nhận lệnh kiểm tra Probe P4 hoạt động chuẩn xác và xanh 100%.
  - **Vai trò:** Senior QA Engineer.
  - **Dữ liệu tiền đề:** Kho mã nguồn `_Automation-Project`.
  - **Các bước:** Chạy lệnh `node scripts/run-mp.js probes P4 .`.
  - **Kết quả:** Lệnh thoát với Exit Code 0, không có thông báo `POTENTIAL SECRETS FOUND` đối với commit tài liệu markdown cũ (dẫn `REQ-24-01` và `BR-24-01`, phủ `AC-24-01`).

---

## B. Kỹ Thuật (Tech Lead — A/R; BA — C)

### B1. Quyết Định Kỹ Thuật (TECH-xx)
- `TECH-24-01`: Thêm pathspec loại trừ `":(exclude)_Plan_implement"` và `":(exclude)*.md"` vào câu lệnh `git log` trong Probe P4 của `.master_process/scripts/audit-probes.ps1`, đồng thời bổ sung bộ lọc bỏ qua mẫu khóa mẫu phổ biến nhằm triệt tiêu báo động giả mà vẫn giữ nguyên an toàn mã nguồn (dẫn `REQ-24-01`, lý do để bảo đảm chỉ quét mã nguồn ứng dụng thực tế).

### B2. Bản Đồ File & Ngân Sách Dòng (File Splitting Budget)
| Path | Loại File | Thao Tác | Trần Số Dòng | Dự Kiến |
|---|---|:---:|:---:|:---:|
| `.master_process/scripts/audit-probes.ps1` | script | Sửa | 160 | 145 |
| `tests/dashboard-api/master-process.test.js` | test | Sửa | 250 | 180 |

### B3. Contract & Schemas
- Lệnh chạy: `powershell -ExecutionPolicy Bypass -File .master_process/scripts/audit-probes.ps1 -ProbeId P4 .`.
- Mã thoát mong đợi: 0 (PASS).

### B4. Quản Lý Phụ Thuộc (Dependencies)
- Không có phụ thuộc ngoài mới (dẫn IMP-24-01).

### B5. Yêu Cầu Phi Chức Năng (NFR)
- Thời gian thực thi Probe P4 dưới 2 giây.

### B6. Rủi Ro Kỹ Thuật & Cách Chặn
- Nguy cơ bỏ sót secret thật nếu loại trừ quá rộng: Chỉ loại trừ thư mục `_Plan_implement` và phần mở rộng `.md`, giữ nguyên toàn bộ thư mục code và config.

---

## C. Ma Trận Kiểm Thử (BA + Tech Lead; QA — C)

| AC ID | TC ID | Mức | Critical? | File Test Dự Kiến | Ca Biên / Ghi Chú |
|---|---|:---:|:---:|---|---|
| `AC-24-01` | `TC-24-01` | `unit` | Yes | `tests/dashboard-api/master-process.test.js` | Kiểm tra Probe P4 trả về 0 khi quét lịch sử git dự án |

---

## D. Phạm Vi Dev Được Tự Quyết (Local Decisions)
- Dev được tự quyết thứ tự áp dụng pathspec và regex lọc trong PowerShell script.

---

## E. Câu Hỏi Mở & Giả Định (Open Questions)
- 0 câu hỏi chặn (zero blocking questions).

---

## F. Tiêu Chí Ra Phase (Exit Criteria)
- [ ] `.master_process/scripts/audit-probes.ps1` được cập nhật pathspec an toàn.
- [ ] Lệnh `node scripts/run-mp.js probes P4 .` đạt PASS (Exit code 0).
- [ ] Bổ sung test `TC-24-01` vào `tests/dashboard-api/master-process.test.js`.

---

## G. Soát Chéo (Cross-Review Signatures)
- Nghiệp vụ soát bởi Tech Lead: ✔ @tl (phiên 2026-10-03)
- Kỹ thuật soát bởi BA: ✔ @ba (phiên 2026-10-03)

---

## H. Nhật Ký Thay Đổi Kế Hoạch (Plan Deviation Requests - PDR)
| PDR ID | Loại | Nội Dung Plan Gốc | Đề Xuất Thực Tế | Ảnh Hưởng | Trạng Thái |
|---|:---:|---|---|---|:---:|
| PDR-24-01 | TECH | Quét toàn bộ file trong git log | Loại trừ markdown tài liệu kế hoạch | Khắc phục false positive | APPROVED |

---

## I. Bằng Chứng Thực Nghiệm (Evidence Block)
- Sẽ ghi nhận output của Probe P4 sau khi thực thi.
