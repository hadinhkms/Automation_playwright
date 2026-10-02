# Phase 3 — Đồng Bộ Ngược (Reverse Sync), Xử Lý Biên & Kiểm Thử Toàn Diện

> **Tác giả Nghiệp vụ:** @ba · **Tác giả Kỹ thuật:** @tl · **Research:** Không áp dụng  
> **Trạng thái:** `COMPLETED` · **Cấp độ:** `L3`  
> **Nằm trong:** [Plan 21 Overview](plan-21-overview.md)

---

## A. Nghiệp Vụ (BA — A/R; Tech Lead — C)

### A1. Mục Tiêu & Phạm Vi Phase
- **In-Scope:**
  - Hỗ trợ cơ chế **Đồng bộ ngược (Reverse Sync)** theo tinh thần `AI_PROMPTS.md §3.3` (gắn truy vết) và `§3.5` (tài liệu phải đồng bộ 100% với automation; §3.5 nguyên văn nói về ghi nhận business rule mới, plan này mở rộng sang test case mới — cần bổ sung 1 đoạn mô tả vào `AI_PROMPTS.md` khi release):
    - Khi một spec ĐÃ CÓ tag `@REQ-xxx`, nhưng người dùng vừa bổ sung thêm các kịch bản test mới (`test()`) trong file đó:
    - Nhận diện test đã có trong tài liệu bằng **TC title chuẩn hoá** (bỏ dấu, lowercase, bỏ tag `@...`) hoặc tag `TC-zzz` trong title nếu có; đổi tên test được coi là test mới (hiện cảnh báo, không tự xoá TC cũ — C-3).
    - Nút thông minh tự động chuyển sang chế độ `✦ Đồng bộ kịch bản mới vào REQ-xxx`.
    - Tự động trích xuất các test case mới chưa có trong tài liệu và append vào đúng file `requirements/` & `test-cases/` mà không tạo trùng lặp.
  - Xử lý triệt để các trường hợp biên (Edge Cases):
    - Spec có nhiều khối `test.describe()`.
    - Spec chứa test case không có bước `test.step()` (suy luận từ title và assertion).
    - An toàn XSS và ký tự đặc biệt trong tiêu đề test (chứa dấu ngoặc kép, ký tự tiếng Việt, HTML tags).
  - Kiểm thử toàn diện Gate 4 (ma trận `async_state`, `router_ui`, `lifecycle_integration` theo `AGENTS.md §4`, JUnit ID ổn định, receipt `record-gate-run.py`, kiểm định bằng `npm run mp:gate`):
    - Xây dựng suite kiểm thử E2E tự động `tests/dashboard/qa-smart-linker.spec.js`.
    - Xác nhận toàn bộ hệ sinh thái test của dự án đạt 100% Green.
- **Out-of-Scope:**
  - Không thay đổi các kịch bản E2E mẫu của dự án (`tests/e2e/`).

### A2. Yêu Cầu & Quy Tắc Nghiệp Vụ Áp Dụng
- `REQ-21-05`: Khi spec đã có `@REQ-xxx`, hệ thống phải tự động nhận diện các `test()` đã có trong tài liệu để bỏ qua, chỉ trích xuất và đề xuất thêm các kịch bản mới phát sinh. Các test case mới khi ghi tài liệu tuân thủ chuẩn `TC-zzz` (3 chữ số) và cập nhật tiêu đề test theo quy ước `TC-zzz - AC-yyy <mô tả>` nếu người dùng chọn auto-tagging.
- `REQ-21-06`: Toàn bộ quy trình đồng bộ phải tuân thủ tuyệt đối quy tắc Hub-to-Spoke: Thư mục `requirements/` và `test-cases/` thuộc quyền sở hữu của vệ tinh (`FORBIDDEN_SYNC_MODULES`), Hub chỉ cung cấp công cụ tự động hóa.
- `BR-21-05`: Tránh trùng lặp định danh: Trước khi thêm `AC-yyy` hoặc `TC-zzz`, hệ thống phải đọc số thứ tự lớn nhất hiện có trong file để sinh mã tiếp theo chuẩn 3 chữ số (`AC-001`, `TC-001`), không được ghi đè số cũ.
- `BR-21-06`: An toàn dữ liệu: Mọi thao tác ghi file tài liệu phải được ghi nhận vào nhật ký sự kiện hoặc có file backup phục hồi nhanh.

### A3. Tiêu Chí Nghiệm Thu (AC-xx)
- `AC-21-07`: Spec đã có `@REQ-001` nhưng thêm 2 `test()` mới -> Bấm nút hiển thị chế độ Reverse Sync, chỉ liệt kê đúng 2 test case mới cần bổ sung vào `REQ-001`.
- `AC-21-08`: Suite kiểm thử E2E [tests/dashboard/qa-smart-linker.spec.js](../../tests/dashboard/qa-smart-linker.spec.js) PASS 100% cả 6 tiêu chí: (1) Quét gợi ý khớp có sẵn; (2) Scaffold tạo REQ mới; (3) Reverse Sync; (4) An toàn XSS; (5) Nút hiện đúng trên spec chưa có `@REQ` và modal mở < 300ms (AC-21-04); (6) Apply lỗi giữa chừng → rollback, UI báo lỗi và retry được.
- `AC-21-09`: Toàn bộ các lệnh kiểm tra tiêu chuẩn hoàn thành với mã thoát 0:
  - `npm run check:framework` -> PASS
  - `npm run qa:check` -> 0 finding major
  - `npm run test:dashboard:api` -> 100% PASS
  - `npm run presync:drift` -> Đồng bộ an toàn

### A4. Kịch Bản Nghiệm Thu Nghiệp Vụ (UAT-xx)
- `UAT-21-03`:
  - **Mục tiêu:** Kỹ sư cập nhật thêm test case vào spec cũ và đồng bộ ngược vào tài liệu thành công.
  - **Persona:** Senior QA Automation Engineer.
  - **Thao tác:** Trong workspace fixture (`fixtureWorkspace.js`, đã có `REQ-001` và bản sao `saucedemo_login.spec.js` gắn `@REQ-001`), viết thêm kịch bản kiểm thử quên mật khẩu -> Bấm `✦ Đồng bộ kịch bản mới` -> Xác nhận.
  - **Kỳ vọng:** `requirements/REQ-001.md` được tự động bổ sung tiêu chí quên mật khẩu, ma trận truy vết ghi nhận ngay lập tức mà không cần gõ markdown bằng tay.

---

## B. Kỹ Thuật (Tech Lead — A/R; BA — C)

### B1. Quyết Định Kỹ Thuật (TECH-xx)
- `TECH-21-07`: `detectSpecDelta(root, specPath, specContent)` đã được **chuyển sang Phase 1** (`specDeltaService.js`) vì `/smart-link` trả `mode = "reverse_sync"` và nút UI Phase 2 phụ thuộc vào nó. Phase 3 chỉ mở rộng/xác minh các edge case của hàm này (multi-describe, test không có `test.step`, XSS/ký tự đặc biệt, đổi tên test → cảnh báo, không xoá TC cũ) và kiểm thử E2E toàn luồng.
- `TECH-21-08`: Xây dựng kịch bản kiểm thử E2E Playwright cô lập trong `tests/dashboard/qa-smart-linker.spec.js`, tạo workspace tạm độc lập bằng `fixtureWorkspace.js` để kiểm thử toàn diện cả 2 nhánh (Existing Match & New Scaffold).

### B2. Bản Đồ File & Ngân Sách Dòng (File Splitting Budget)

| Path | Loại File | Thao Tác | Trần Số Dòng | Dự Kiến |
|---|---|:---:|:---:|:---:|
| `dashboard/services/specDeltaService.js` | Service Module (tạo ở Phase 1) | Sửa | 200 | 190 (nếu chạm trần thì tách `specDeltaNormalize.js`) |
| `tests/dashboard-api/smartTraceLinker.test.js` | Unit Test | Sửa | 800 (role test) | 500 |
| `tests/dashboard/qa-smart-linker.spec.js` | E2E Test Suite | Tạo mới | 350 | 280 |

### B3. Checklist Thực Thi & Bằng Chứng Nghiệm Thu
1. [x] Hoàn thiện edge case của `detectSpecDelta()` (đã có từ Phase 1) và bổ sung test cho Reverse Sync: đổi tên test, multi-describe, test không có `test.step`, tiêu đề chứa HTML/dấu ngoặc kép.
2. [x] Xây dựng test suite E2E `tests/dashboard/qa-smart-linker.spec.js`.
3. [x] Chạy `npx playwright test --config=playwright.dashboard.config.js tests/dashboard/qa-smart-linker.spec.js` (dùng config dashboard, không dùng config mặc định).
4. [x] Xác nhận toàn bộ suite `npm run test:dashboard:regression` và `npm run presync:drift` đạt 100% Green.
5. [x] Xuất JUnit, chạy `python .master_process/scripts/record-gate-run.py`, kiểm định bằng `npm run mp:gate` (hoặc `powershell -ExecutionPolicy Bypass -File .master_process/master.ps1 gate`); rerun độc lập critical TC trên cùng commit SHA.
6. [x] Bổ sung mô tả Reverse Sync vào `ai/shared/AI_PROMPTS.md`. Đây là file do Hub sở hữu và đồng bộ sang vệ tinh (`FORBIDDEN_SYNC_MODULES` chỉ cấm `data, tests, pages, requirements, test-cases`, nên `ai/shared/` vẫn là nội dung sync): sửa ở Hub trước, chạy `npm run presync:drift` để xác nhận không ghi đè nội dung vệ tinh, rồi mới sync; không sửa riêng ở vệ tinh. Cập nhật tài liệu tổng thể, sẵn sàng release.
