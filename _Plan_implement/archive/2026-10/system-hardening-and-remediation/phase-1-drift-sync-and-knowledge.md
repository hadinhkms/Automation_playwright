# Phase 1 — Đồng Bộ Hub Anti-Drift & Cập Nhật Tri Thức

> **Tác giả Nghiệp vụ:** @ba (phiên 2026-10-03) · **Tác giả Kỹ thuật:** @tl (phiên 2026-10-03) · **Research:** Không áp dụng  
> **Trạng thái:** `COMPLETED` · **Cấp độ:** L3  

---

## A. Nghiệp Vụ (BA — A/R; Tech Lead — C)

### A1. Mục Tiêu & Phạm Vi Phase
- **In-Scope:** Đồng bộ cam kết Hub giữa `.ai/process-lock.json` và Hub Master Process hiện hành commit `20caf25453867e319ccb5efdf98933f794aaf983`; bổ sung template `.ai/knowledge/domain/research-sources.md` mà không làm thay đổi các file tri thức riêng của dự án con.
- **Out-of-Scope:** Không chỉnh sửa cấu trúc `contract.json` (được thực hiện ở Phase 2).

### A2. Yêu Cầu & Quy Tắc Nghiệp Vụ Áp Dụng
- `REQ-23-01`: Đưa toàn bộ hệ sinh thái dự án con về trạng thái cam kết chuẩn với Master Hub.
- `BR-23-01`: Quá trình đồng bộ template không được phép ghi đè bất kỳ file tri thức nào đã có chỉnh sửa riêng từ phía dự án.

### A3. User Flow & Nhánh Lỗi/Hủy
- Luồng chính: `Kiểm tra drift hiện tại (mp:drift) → Chạy sync an toàn (mp:sync) → Xác nhận trạng thái IN_SYNC`.
- Nhánh lỗi: Nếu phát hiện file xung đột không thể tự động gộp, dừng tiến trình và cảnh báo người dùng.

### A4. Trạng Thái Biên (EDGE-xx)
- `EDGE-23-01`: File `research-sources.md` chưa từng tồn tại trong dự án con được tạo mới an toàn với template gốc.

### A5. Tiêu Chí Nghiệm Thu (AC-xx)
- `AC-23-01`: Given hệ thống đang bị `DRIFT_DETECTED` When chạy quy trình đồng bộ Then lệnh `npm run mp:drift` trả về exit code 0 và trạng thái `IN_SYNC` (dẫn `BR-23-01`).

### A6. Kịch Bản Nghiệm Thu Nghiệp Vụ (UAT-xx)
- `UAT-23-01`:
  - **Mục tiêu:** Kỹ sư QA xác nhận dự án đạt chuẩn liên kết Hub không bị lệch phiên bản.
  - **Vai trò:** Tech Lead / QA Engineer.
  - **Dữ liệu tiền đề:** Dự án con tại `D:\_Automation-Project` và Hub `.master_process`.
  - **Các bước:** Chạy lệnh `node scripts/run-mp.js check-drift .`.
  - **Kết quả:** Hiển thị `Hub Sync Status: IN_SYNC` và kết thúc với exit code 0 (dẫn `REQ-23-01` và `BR-23-01`, phủ `AC-23-01`).

---

## B. Kỹ Thuật (Tech Lead — A/R; BA — C)

### B1. Quyết Định Kỹ Thuật (TECH-xx)
- `TECH-23-01`: Sử dụng công cụ `master.py sync .` kết hợp cập nhật trường `hub_commit` trong file khóa phiên bản `.ai/process-lock.json` nhằm đảm bảo tính toàn vẹn 3-way merge của Master Process (dẫn `REQ-23-01`, lý do để tự động hóa việc ghim SHA256 và giữ nguyên file đã custom).

### B2. Bản Đồ File & Ngân Sách Dòng (File Splitting Budget)
| Path | Loại File | Thao Tác | Trần Số Dòng | Dự Kiến |
|---|---|:---:|:---:|:---:|
| `.ai/process-lock.json` | module | Sửa | 250 | 45 |
| `.ai/knowledge/domain/research-sources.md` | utils | Tạo | 150 | 40 |
| `tests/dashboard-api/master-process.test.js` | test | Sửa | 800 | 120 |

### B3. Contract & Schemas
- Cấu trúc `.ai/process-lock.json`: Cập nhật `hub_commit` thành `20caf25453867e319ccb5efdf98933f794aaf983`.

### B4. Quản Lý Phụ Thuộc (Dependencies)
- Không có.

### B5. Yêu Cầu Phi Chức Năng (NFR)
- Thời gian chạy `mp:drift` và `mp:sync` không vượt quá 3 giây.

### B6. Rủi Ro Kỹ Thuật & Cách Chặn
- Nguy cơ ghi đè mất `AGENTS.md` hoặc `manifest.json`: Chặn bằng cơ chế snapshot và kiểm tra cờ `--dry-run` trước khi áp dụng.

---

## C. Ma Trận Kiểm Thử (BA + Tech Lead; QA — C)

| AC ID | TC ID | Mức | Critical? | File Test Dự Kiến | Ca Biên / Ghi Chú |
|---|---|:---:|:---:|---|---|
| `AC-23-01` | `TC-23-01` | `integration` | Yes | `tests/dashboard-api/master-process.test.js` | Kiểm tra GET /api/mp/status trả về IN_SYNC sau khi sync |

---

## D. Phạm Vi Dev Được Tự Quyết (Local Decisions)
- Dev được tự quyết thứ tự chạy lệnh đồng bộ CLI hoặc cập nhật lockfile trực tiếp trước khi verify.

---

## E. Câu Hỏi Mở & Giả Định (Open Questions)
- 0 câu hỏi chặn (zero blocking questions).

---

## F. Tiêu Chí Ra Phase (Exit Criteria)
- [x] `npm run mp:drift` trả về exit code 0 (`Hub Sync Status: IN_SYNC`).
- [x] File `.ai/knowledge/domain/research-sources.md` được tạo thành công.
- [x] 100% test trong `tests/dashboard-api/master-process.test.js` pass.

---

## G. Soát Chéo (Cross-Review Signatures)
- Nghiệp vụ soát bởi Tech Lead: ✔ @tl (phiên 2026-10-03)
- Kỹ thuật soát bởi BA: ✔ @ba (phiên 2026-10-03)

---

## H. Nhật Ký Thay Đổi Kế Hoạch (Plan Deviation Requests - PDR)
| PDR ID | Loại | Nội Dung Plan Gốc | Đề Xuất Thực Tế | Ảnh Hưởng | Trạng Thái |
|---|:---:|---|---|---|:---:|
| PDR-23-01 | TECH | Chạy sync tự động | Sync kèm kiểm tra dry-run | Không ảnh hưởng | APPROVED |

---

## I. Bằng Chứng Thực Nghiệm (Evidence Block)
- **Lệnh 1:** `node scripts/run-mp.js check-drift .`
  - Exit code: 0
  - Output: `Hub Sync Status: IN_SYNC`, `Bound Hub Commit: 20caf25453867e319ccb5efdf98933f794aaf983`
- **Lệnh 2:** `node --test tests/dashboard-api/master-process.test.js`
  - Exit code: 0 (5/5 passed, duration 3.9s)
  - Assertion: `body.drift_status === 'IN_SYNC'` PASS
- **Lệnh 3:** `npm run mp:doctor` -> `DOCTOR: PASS`
