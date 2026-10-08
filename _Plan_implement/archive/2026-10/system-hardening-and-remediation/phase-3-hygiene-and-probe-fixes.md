# Phase 3 — Vệ Sinh Mã Nguồn, Chống Rác Workspace & Sửa Probes

> **Tác giả Nghiệp vụ:** @ba (phiên 2026-10-03) · **Tác giả Kỹ thuật:** @tl (phiên 2026-10-03) · **Research:** Không áp dụng  
> **Trạng thái:** `COMPLETED` · **Cấp độ:** L3  

---

## A. Nghiệp Vụ (BA — A/R; Tech Lead — C)

### A1. Mục Tiêu & Phạm Vi Phase
- **In-Scope:** Dọn dẹp thư mục tạm `.tmp-workspace-*` trong `tests/dashboard/`; bổ sung cleanup teardown trong test harness để ngăn chặn việc để lại file rác; khắc phục hiện tượng false positive trong Probe P5 của Master Process đối với cú pháp đánh dấu hoãn thực thi kịch bản của Playwright; phân loại và gắn định danh truy vết phù hợp cho 7 spec mẫu desktop trong `tests/e2e/desktop/`.
- **Out-of-Scope:** Không xóa lịch sử git lớn (giữ lại theo quy chế team).

### A2. Yêu Cầu & Quy Tắc Nghiệp Vụ Áp Dụng
- `REQ-23-03`: Giữ cho workspace luôn sạch sẽ, các kịch bản kiểm tra chất lượng (probes) đánh giá chính xác và độ bao phủ truy vết rõ ràng.
- `BR-23-03`: Mọi thư mục tạm sinh ra trong quá trình chạy test bắt buộc phải được tự động dọn dẹp sạch sẽ sau khi test kết thúc.

### A3. User Flow & Nhánh Lỗi/Hủy
- Luồng chính: `Xóa thư mục tạm còn sót → Bổ sung hook teardown → Tinh chỉnh regex Probe P5 → Kiểm tra npm run qa:check`.
- Nhánh lỗi: Nếu dọn dẹp thư mục tạm gặp lỗi khóa file trên Windows, dùng cơ chế retry với độ trễ ngắn.

### A4. Trạng Thái Biên (EDGE-xx)
- `EDGE-23-03`: Test suite bị ngắt đột ngột (crash/SIGINT) vẫn đảm bảo thư mục tạm được đánh dấu hoặc xóa trong lần chạy kế tiếp.

### A5. Tiêu Chí Nghiệm Thu (AC-xx)
- `AC-23-03`: Given workspace có thư mục tạm When hoàn tất dọn dẹp và chạy lại test Then không còn thư mục `.tmp-workspace-*` rác và `npm run qa:check` không báo lỗi cấu trúc (dẫn `BR-23-03`).

### A6. Kịch Bản Nghiệm Thu Nghiệp Vụ (UAT-xx)
- `UAT-23-03`:
  - **Mục tiêu:** Đảm bảo mã nguồn và thư mục test luôn ngăn nắp, probe không báo lỗi giả.
  - **Vai trò:** Senior QA Engineer.
  - **Dữ liệu tiền đề:** Thư mục `tests/dashboard/` và script probe.
  - **Các bước:** Chạy lệnh kiểm tra `git status` và chạy lệnh quét probe `node scripts/run-mp.js probes P5 .`.
  - **Kết quả:** Workspace sạch sẽ, không còn thư mục tạm mồ côi (dẫn `REQ-23-03` và `BR-23-03`, phủ `AC-23-03`).

---

## B. Kỹ Thuật (Tech Lead — A/R; BA — C)

### B1. Quyết Định Kỹ Thuật (TECH-xx)
- `TECH-23-03`: Tinh chỉnh toán tử so khớp trong script probe P5 từ không phân biệt hoa thường sang phân biệt hoa thường (`-cmatch`) kết hợp ngoại lệ hợp lệ cho các kịch bản tạm hoãn của Playwright nhằm loại bỏ triệt để báo động giả (dẫn `REQ-23-03`, lý do để đảm bảo tính khách quan của công cụ kiểm định).

### B2. Bản Đồ File & Ngân Sách Dòng (File Splitting Budget)
| Path | Loại File | Thao Tác | Trần Số Dòng | Dự Kiến |
|---|---|:---:|:---:|:---:|
| `tests/dashboard/support/fixtureWorkspace.js` | utils | Sửa | 150 | 70 |
| `.master_process/scripts/audit-probes.ps1` | module | Sửa | 250 | 145 |
| `tests/e2e/desktop/sample_demo.spec.js` | test | Sửa | 800 | 45 |

### B3. Contract & Schemas
- Không thay đổi API hay Database schema.

### B4. Quản Lý Phụ Thuộc (Dependencies)
- Không có.

### B5. Yêu Cầu Phi Chức Năng (NFR)
- Dọn dẹp file tạm tức thời, không làm chậm thời gian thực thi test (> 100ms).

### B6. Rủi Ro Kỹ Thuật & Cách Chặn
- Quyền ghi file tạm trên Windows (EPERM): Xử lý bằng `fs.rmSync(path, { recursive: true, force: true, maxRetries: 3 })`.

---

## C. Ma Trận Kiểm Thử (BA + Tech Lead; QA — C)

| AC ID | TC ID | Mức | Critical? | File Test Dự Kiến | Ca Biên / Ghi Chú |
|---|---|:---:|:---:|---|---|
| `AC-23-03` | `TC-23-03` | `e2e` | Yes | `tests/e2e/desktop/sample_demo.spec.js` | Xác nhận chạy test xong không để lại thư mục rác |

---

## D. Phạm Vi Dev Được Tự Quyết (Local Decisions)
- Dev được tự quyết định số lần retry khi xóa thư mục tạm trên môi trường Windows.

---

## E. Câu Hỏi Mở & Giả Định (Open Questions)
- 0 câu hỏi chặn (zero blocking questions).

---

## F. Tiêu Chí Ra Phase (Exit Criteria)
- [x] Thư mục `tests/dashboard/.tmp-workspace-*` bị xóa hoàn toàn.
- [x] Script teardown được bổ sung vào fixture workspace.
- [x] Probe P5 không còn bắt nhầm cú pháp tạm hoãn test.

---

## G. Soát Chéo (Cross-Review Signatures)
- Nghiệp vụ soát bởi Tech Lead: ✔ @tl (phiên 2026-10-03)
- Kỹ thuật soát bởi BA: ✔ @ba (phiên 2026-10-03)

---

## H. Nhật Ký Thay Đổi Kế Hoạch (Plan Deviation Requests - PDR)
| PDR ID | Loại | Nội Dung Plan Gốc | Đề Xuất Thực Tế | Ảnh Hưởng | Trạng Thái |
|---|:---:|---|---|---|:---:|
| PDR-23-03 | TECH | Xóa thư mục thủ công | Tự động hóa qua fixture teardown | Nâng cao độ bền | APPROVED |

---

## I. Bằng Chứng Thực Nghiệm (Evidence Block)
- **Lệnh 1:** `Remove-Item -Recurse -Force tests/dashboard/.tmp-workspace-*`
  - Kết quả: Đã xóa hoàn toàn thư mục tạm mồ côi; thư mục `tests/dashboard/` sạch sẽ 100%.
- **Lệnh 2:** `tests/dashboard/support/fixtureWorkspace.js`
  - Đã tích hợp hàm tự dọn `cleanupStaleWorkspaces()` (quét dọn các folder > 30s) và cơ chế `rmSync` với `maxRetries: 5, retryDelay: 100`.
- **Lệnh 3:** `node scripts/run-mp.js probes P5 .`
  - Exit code: 0
  - Output: `[*] Running Probe P5: Unticketed TODO/FIXME probe on D:\_Automation-Project` (PASS, 0 lỗi).
- **Lệnh 4:** `npx playwright test tests/e2e/desktop/sample_demo.spec.js --project="Desktop Smoke Tests"`
  - Exit code: 0 (1/1 passed, duration 2.8s). Không để lại file rác.
- **Lệnh 5:** `npm run qa:check`
  - Exit code: 0 (Kiểm tra cú pháp 8 sample spec mẫu hợp lệ, 0 finding mức major).
