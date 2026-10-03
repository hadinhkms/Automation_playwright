# Kế Hoạch 21: Bộ Liên Kết Truy Vết Thông Minh (Smart Trace Linker: 1-Click Spec to Requirement)

> **Plan ID:** `PLAN-21-SMART-TRACE-LINKER-2026-10-02` · **Cấp độ:** `L3` · **Phiên bản:** `1.0.0`  
> **Trạng thái:** `COMPLETED` · **Mục tiêu:** 1-Click Spec to Requirement Linking, Heuristic Matching song ngữ Việt/Anh, Atomic Document Apply & Zero Spec-Gaps.

---

## 1. Bối Cảnh & Mục Tiêu

### 1.1. Bối Cảnh & Nỗi Đau (Pain Points)
Trong quy trình phát triển kiểm thử tự động tại hệ thống Studio & Playwright Engine:
1. **Rào cản truy vết thủ công**: Khi kỹ sư QA tạo hoặc ghi kịch bản kiểm thử mới (`.spec.js`), quy chuẩn dự án (`AGENTS.md`, `AI_PROMPTS.md §3`) bắt buộc phải gắn tag `@REQ-xxx` và liên kết với tài liệu `requirements/` và `test-cases/`.
2. **Quy trình rời rạc tốn thời gian**: Kỹ sư phải tra cứu thủ công xem tính năng đã có REQ chưa, nếu có thì tự mở 2 file markdown thêm AC/TC, nếu chưa thì tạo file mới, rồi quay lại sửa code spec.
3. **Dễ sai sót định danh**: Lỗi gõ sai định danh (`REQ-1`, `REQ-01` thay vì chuẩn `REQ-001`) dẫn tới việc `scripts/qa-trace.js` bắt lỗi `RE_NEAR_MISS` và báo `spec-khong-truy-vet` hàng loạt trên CI/CD.
4. **Thiếu cơ chế đồng bộ ngược (Reverse Sync)**: Khi một spec đã có REQ nhưng được bổ sung thêm các `test()` mới, không có cách nào tự động trích xuất các test case mới vào tài liệu mà không phải sao chép thủ công.

### 1.2. Mục Tiêu Nghiệm Thu Tổng Thể
- **1-Click Smart Trace Linker trên BDD Studio & QA View**:
  - Tự động phân tích spec đang mở hoặc vừa tạo, trích xuất ý định kiểm thử (intent).
  - So khớp với toàn bộ Requirement hiện có trong workspace (hỗ trợ Heuristic song ngữ Việt - Anh).
  - Đề xuất 2 nhánh xử lý trực quan: **Ghép vào REQ có sẵn (Match $\ge 70\%$)** hoặc **Khởi tạo REQ mới (New Scaffold)**.
  - Cập nhật nguyên tử cả 3 file (`.spec.js`, `requirements/`, `test-cases/`) bằng 1 cú click với cơ chế snapshot rollback an toàn.
  - Hỗ trợ **Đồng bộ ngược (Reverse Sync)** khi spec đã có tag REQ nhưng phát sinh thêm test case mới.
- **Tiêu chuẩn chất lượng**:
  - Không tốn token LLM ở chế độ Heuristic mặc định.
  - Giữ nguyên ngân sách DOM ban đầu $< 1,500$ elements (Lazy-mount modal).
  - An toàn tương tranh với `withWriteLock`.
  - 100% Green toàn bộ test suite (`npm run check:framework`, `npm run qa:check`, `npm run test:dashboard:regression`, `npm run presync:drift`).

---

## 2. Cấu Trúc Phase & Phân Rã Công Việc (WBS)

```text
Phase 1: Backend Smart Matcher, Scaffold Engine & Linker API
   ├── Thuật toán so khớp Heuristic / Semantic song ngữ Việt - Anh
   ├── Khởi tạo bản thảo ghép REQ có sẵn & scaffold REQ mới
   ├── API POST /api/qa/smart-link (quét, tính specHash & xếp hạng)
   └── API POST /api/qa/smart-link/apply (bọc withWriteLock, ghi đĩa nguyên tử)
         │
         ▼
Phase 2: Studio UI & Code Editor Integration
   ├── Nút "✦ Liên kết Requirement" trên Code Editor Toolbar (`#/builder`, `builder-view`)
   ├── Nút "✦ Phân loại REQ" trong bảng Vấn đề (`#/qa`, `findingRows.js`)
   ├── Modal Smart Linker Preview Lazy-Mounted vào document.body
   └── Khai báo @import vào Master Cascade CSS (dashboard/public/styles.css)
         │
         ▼
Phase 3: Reverse Sync, Edge Cases & Verification
   ├── Cơ chế đồng bộ ngược khi spec đã có @REQ nhưng thêm test case mới
   ├── Xử lý edge cases: multi-describe, spec thiếu test.step, ký tự đặc biệt XSS
   ├── Suite kiểm thử E2E Playwright tests/dashboard/qa-smart-linker.spec.js
   └── Kiểm định Cổng Gate 4 (npm run mp:gate) và bảo toàn Hub-to-Spoke
```

| Phase | File Đặc Tả Chi Tiết | Trọng Tâm Xử Lý | Trạng Thái |
|---|---|---|:---:|
| **1** | [phase-1-backend-smart-matcher-and-linker-api.md](phase-1-backend-smart-matcher-and-linker-api.md) | Thuật toán Heuristic song ngữ, API `/smart-link` & `/apply`, Write Lock | `COMPLETED` |
| **2** | [phase-2-studio-ui-and-editor-integration.md](phase-2-studio-ui-and-editor-integration.md) | BDD Editor Toolbar, Modal Lazy-Mount, QA Finding Actions, CSS Cascade | `COMPLETED` |
| **3** | [phase-3-reverse-sync-and-e2e-verification.md](phase-3-reverse-sync-and-e2e-verification.md) | Reverse Sync Delta, Suite E2E Playwright, Cổng Gate 4 `npm run mp:gate` | `COMPLETED` |

---

## 3. Ma Trận Quyết Định Kỹ Thuật (Design Decisions)

| Mã | Quyết Định | Giải Pháp Lựa Chọn | Lý Do & Lợi Ích |
|---|---|---|---|
| **D1** | Thuật toán so khớp Offline | Sử dụng Heuristic token overlap có trọng số theo tầng kết hợp từ điển đồng nghĩa Việt - Anh rút gọn thay vì Jaccard thuần. | Đạt độ chính xác $\ge 75\%$ ngay cả với spec tiếng Anh (`saucedemo_login.spec.js`) ghép vào REQ tiếng Việt; 0 token chi phí; phản hồi $< 100\text{ms}$. |
| **D2** | An toàn ghi đĩa nguyên tử | Dựng nội dung 3 file trong bộ nhớ bằng hàm thuần (`buildTestCaseDocument` tách từ `appendTestCasesToDocument`, vì hàm gốc tự `writeFileSync` và chỉ xử lý file TC), snapshot vào `.dashboard-backups/` rồi `writeAtomic` của `qaBatchManifest.js`. Thứ tự ghi: TC → REQ → Spec. | Tránh tình trạng gãy dữ liệu (spec có tag nhưng tài liệu chưa ghi) và rollback được cả 3 file nếu lỗi đĩa. |
| **D3** | Khóa ghi tương tranh | Bọc toàn bộ logic ghi của `POST /api/qa/smart-link/apply` trong `withWriteLock(root, ...)`. Hàm này không xếp hàng: bận → `409 BATCH_LOCKED` ngay, UI báo bận và cho thử lại. | Ngăn race condition với batch fix hoặc API ghi khác mà không treo request. |
| **D4** | Kiến trúc Modal UI | `smartLinkerHelper.js` thực hiện dynamic lazy-mount `#qa-smart-linker-modal` vào `document.body` khi click lần đầu. | Không phụ thuộc vào việc view QA đã mở hay chưa; không làm tăng số lượng phần tử DOM ban đầu của `index.html` (đạt chuẩn DOM Budget $< 1,500$ nodes). |
| **D5** | Chuẩn hóa định danh | Bắt buộc regex `^REQ-\d{3}$` và padding 3 chữ số (`REQ-001`, `AC-001`, `TC-001`). | Tuân thủ 100% quy ước của `scripts/lib/qaTrace.js`, loại bỏ hoàn toàn nguy cơ sinh ra mã sai quy chuẩn (`RE_NEAR_MISS`). |
| **D6** | Phân quyền Hub-to-Spoke | `smartTraceLinkerService.js` chỉ thao tác trên workspace hiện tại (`context.root`), không sync tài liệu nghiệp vụ sang Hub. | Giữ vững nguyên tắc bất biến Hub Engine không sở hữu tài liệu vệ tinh (`FORBIDDEN_SYNC_MODULES`). |

---

## 4. Tiêu Chuẩn Nghiệm Thu Cổng (Quality Gates)

- **Gate 1 (Plan & Architecture Verification)**:
  - Tất cả các phase có file đặc tả chi tiết, phân công `@ba` / `@tl`, bảng ngân sách dòng không vượt trần.
  - Loại bỏ hoàn toàn sự nhầm lẫn giữa view Suites và view BDD Builder.
- **Gate 2 (Contract & Schema Lock)**:
  - Khóa hợp đồng API cho cả `POST /api/qa/smart-link` và `POST /api/qa/smart-link/apply`.
  - Quy định chặt chẽ cơ chế kiểm tra `specHash` chống ghi đè khi editor state bị lệch.
- **Gate 3 (Code Review & Budget Guard)**:
  - File mới theo `quality-policy.json`: mỗi file service trong `dashboard/services/` $\le 200$ dòng (chia thành `smartTraceLinkerService`, `smartLinkSpecParser`, `smartLinkMatcher`, `smartLinkDrafter`, `smartLinkApply`, `specDeltaService`), mỗi file UI `smartLinkerHelper.js`/`smartLinkerModal.js` $\le 250$ dòng, `smartLinker.css` $\le 400$ dòng, test $\le 800$ dòng.
  - `npm run check:framework` phải xanh sau mỗi file mới; không dùng `master-process-disable-size-check`.
  - File hiện có đã chạm trần (`app.js`, `qaSlice.js`, `qaRoutes.js`) chỉ thêm glue/delegate $\le 30$ dòng.
  - Không thêm bất kỳ chú thích `// master-process-disable-size-check:` nào.
- **Gate 4 (QA Verification & Receipts)**:
  - Chạy `npm run test:dashboard:api`: Pass 100% cả test cũ lẫn test mới `smartTraceLinker.test.js`.
  - Chạy E2E: `npx playwright test --config=playwright.dashboard.config.js tests/dashboard/qa-smart-linker.spec.js` PASS 100%.
  - Ma trận Acceptance Scenarios: `ASYNC-01..05`, `UI-01..05`, `LIFE-01` theo `AGENTS.md §4`.
  - Xuất JUnit report và chạy `python .master_process/scripts/record-gate-run.py`.
  - Kiểm định cổng đạt chuẩn bằng `npm run mp:gate` (hoặc `powershell -ExecutionPolicy Bypass -File .master_process/master.ps1 gate`).
