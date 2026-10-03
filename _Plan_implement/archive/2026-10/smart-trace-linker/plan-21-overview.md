# Kế Hoạch 21: Bộ Liên Kết Truy Vết Thông Minh (Smart Trace Linker: 1-Click Spec to Requirement) — Plan Overview

> **Plan ID:** `PLAN-21-SMART-TRACE-LINKER-2026-10-02` · **Baseline Commit:** `Current` · **Cấp độ:** `L3`  
> **Trạng thái:** `COMPLETED` · **Nguồn gốc:** [21_SMART_TRACE_LINKER_PLAN.md](21_SMART_TRACE_LINKER_PLAN.md)

---

## 1. Bối Cảnh & Mục Tiêu

### 1.1. Bối Cảnh
- Trong chu trình phát triển kiểm thử tự động (Automation Testing), kỹ sư QA thường bắt đầu bằng việc viết hoặc record một test script mới (`.spec.js`) để kiểm tra nhanh tính năng.
- Tuy nhiên, quy chuẩn của dự án (`AGENTS.md`, `AI_PROMPTS.md §3`) bắt buộc mọi spec phải gắn tag truy vết `@REQ-xxx` và ánh xạ đầy đủ về `requirements/REQ-xxx-*.md` và `test-cases/REQ-xxx-*.md`.
- Hiện tại, kỹ sư phải thực hiện thủ công nhiều bước:
  1. Mở thư mục `requirements/` để tìm xem có requirement nào phù hợp chưa.
  2. Nếu có, mở file `requirements/` thêm `AC-yyy`, mở file `test-cases/` thêm dòng `TC-zzz`.
  3. Nếu chưa có, tạo thủ công 2 file markdown mới với ID kế tiếp (`REQ-xxx` 3 chữ số).
  4. Quay lại file spec, chèn tag `@REQ-xxx` vào `test.describe()`.
- Quá trình thủ công này gây tốn thời gian, dễ sai sót định danh, và dẫn tới lỗi phổ biến `spec-khong-truy-vet` khi chạy `npm run qa:check`.

### 1.2. Mục Tiêu
- Trang bị tính năng **Smart Trace Linker (Nút bấm thông minh)** ngay trên Dashboard Studio:
  - Cho phép quét nội dung script vừa viết bằng 1 cú click.
  - Tự động so khớp với toàn bộ các Requirement hiện có trong dự án:
    - **Nhánh 1 (Khớp REQ có sẵn, score $\ge 70\%$):** Đề xuất ghép vào REQ tương thích nhất, tự sinh `AC-yyy` và `TC-zzz` bổ sung.
    - **Nhánh 2 (Không khớp / Nghiệp vụ mới):** Tự động scaffold bộ tài liệu mới `requirements/REQ-<next>-<slug>.md` và `test-cases/REQ-<next>-<slug>.md`.
  - Cung cấp Modal Preview trực quan và nút **"Áp dụng (1-Click Apply)"** tự động patch tag `@REQ-xxx` vào spec và ghi đĩa đồng bộ.
  - Tương thích 100% cả offline (Heuristic Engine song ngữ Việt/Anh) lẫn nâng cao (AI Semantic Engine).

---

## 2. WBS & Đồ Thị Phụ Thuộc (Dependency Graph)

| Phase | Tên Giai Đoạn | File Chi Tiết | Phụ Thuộc | Chủ Trì | Trạng Thái |
|---|---|---|---|---|:---:|
| 1 | Backend Smart Matcher & Linker API | [phase-1-backend-smart-matcher-and-linker-api.md](phase-1-backend-smart-matcher-and-linker-api.md) | Không | @ba / @tl | `COMPLETED` |
| 2 | Studio UI & Code Editor Integration | [phase-2-studio-ui-and-editor-integration.md](phase-2-studio-ui-and-editor-integration.md) | Phase 1 | @ba / @tl | `COMPLETED` |
| 3 | Reverse Sync, Edge Cases & Verification | [phase-3-reverse-sync-and-e2e-verification.md](phase-3-reverse-sync-and-e2e-verification.md) | Phase 2 | @ba / @tl | `COMPLETED` |

> `detectSpecDelta` (backend Reverse Sync) được hiện thực ở Phase 1 để `/smart-link` trả `mode = "reverse_sync"`; Phase 2 dựng nút theo `mode`; Phase 3 hoàn thiện edge case và E2E.

```text
Phase 1: Backend Smart Matcher & Linker API
   ├── Thuật toán so khớp Heuristic / Semantic song ngữ giữa Spec và REQ hiện có
   ├── API POST /api/qa/smart-link (quét, tính specHash & xếp hạng)
   └── API POST /api/qa/smart-link/apply (bọc withWriteLock, ghi đĩa nguyên tử)
         │
         ▼
Phase 2: Studio UI & Code Editor Integration
   ├── Nút "✦ Liên kết Requirement" trên Code Editor Toolbar (`#/builder`, `builder-view`)
   ├── Nút "✦ Phân loại REQ" trong bảng Vấn đề (`#/qa`, `findingRows.js`)
   ├── Modal Smart Linker Preview Lazy-Mounted (Dual-Branch: Ghép có sẵn vs Tạo mới)
   └── Đồng bộ CSS Master Cascade (`dashboard/public/styles.css`)
         │
         ▼
Phase 3: Reverse Sync, Edge Cases & Verification
   ├── Xử lý multi-describe, reverse sync khi spec đã có REQ nhưng thêm test mới
   ├── Unit tests, API Contract tests & Playwright E2E tests
   └── Hub-to-Spoke Compatibility (`npm run presync:drift`) & Cổng Gate 4 (`npm run mp:gate`)
```

---

## 3. Quy Tắc Bất Biến & Ràng Buộc Kỹ Thuật (Constraints)

| Mã | Loại | Mô Tả Quy Tắc |
|---|---|---|
| **C-1** | Zero Token First | Mặc định chạy Heuristic Engine offline (Jaccard/Cosine token similarity, AST parsing, token extraction) không tốn token LLM; chỉ gọi AI khi người dùng cấu hình explicit key. |
| **C-2** | Atomic Disk Update | Việc cập nhật đồng thời spec, requirement và test case phải có cơ chế snapshot và ghi an toàn (`writeAtomic`), rollback sạch sẽ nếu lỗi giữa chừng. Nội dung 3 file được dựng trong bộ nhớ (hàm thuần) trước, rồi mới ghi TC → REQ → spec; không gọi hàm tự ghi đĩa (`appendTestCasesToDocument`) trực tiếp trong luồng apply. |
| **C-3** | Non-Destructive | Tuyệt đối không ghi đè hoặc làm mất các test case/AC hiện có trong requirement; chỉ nối thêm (append) mục mới. |
| **C-4** | Budget Constraint | File tạo mới theo `quality-policy.json`: CSS < 400 dòng, **mỗi Service ≤ 200 dòng** (chia nhiều module), mỗi file JS UI ≤ 250 dòng, test ≤ 800 dòng. File hiện có đã vượt ngân sách (`app.js`, `qaSlice.js`, `qa.css`, `qaInferenceService.js`) **chỉ được thêm tối đa ~30 dòng glue/delegate**, toàn bộ logic mới nằm ở file mới. |
| **C-5** | Reuse First | Không viết lại logic có sẵn: dựng nội dung TC dùng `buildTestCaseDocument` (tách thuần từ `appendTestCasesToDocument`, giữ nguyên hành vi API cũ); sinh scaffold dùng `synthesizeScaffoldContents`; ghi nguyên tử và đường dẫn snapshot dùng `writeAtomic`/`snapshotPath` của `qaBatchManifest.js` (`.dashboard-backups/`). |
| **C-6** | Path & Identifier Safety | Mọi `specPath` phải nằm trong `tests/**` của workspace root (chặn path traversal `..`, symlink escape); mọi `reqId` phải khớp chuẩn 3 chữ số `^REQ-\d{3}$` (để không bị `qaTrace.js` bắt lỗi `RE_NEAR_MISS`). |
| **C-7** | Gate 4 Matrix | Áp dụng ma trận `async_state` (ASYNC-01..05), `router_ui` (UI-01..05) và `lifecycle_integration` (LIFE-01) theo `AGENTS.md §4`; xuất JUnit + receipt qua `python .master_process/scripts/record-gate-run.py`, kiểm định bằng `npm run mp:gate`. |
| **C-8** | Concurrency Lock | Tuyệt đối mọi thao tác ghi đĩa trong `applySmartLink` phải được bọc trong `withWriteLock(root, ...)` từ `qaBatchSessionStore.js` để tránh xung đột với batch fixer hoặc luồng sửa đổi song song. `withWriteLock` không xếp hàng: đang bận trả ngay `409 BATCH_LOCKED`, API chuyển nguyên lỗi và UI cho phép thử lại. |
| **C-9** | Modal Lazy-Mount | Modal `#qa-smart-linker-modal` được `smartLinkerHelper.js` khởi tạo lazy-mount on-demand vào `document.body` khi trigger lần đầu; tuyệt đối không chèn trực tiếp làm phình DOM ban đầu của `index.html` (đảm bảo `< 1,500` nodes của `templates-performance-a11y.spec.js`) và không phụ thuộc vào việc `qa.html` đã được nạp hay chưa. |

---

## 4. Bảng Kiểm Tra Tiến Độ Toàn Diện (Checklist)

- [x] **Phase 1**: Backend Smart Matcher & Linker API
  - [x] Tách `buildTestCaseDocument` khỏi `appendTestCasesToDocument` (không hồi quy `/api/qa/append-testcases`).
  - [x] Xây dựng các service ≤ 200 dòng/file: `smartTraceLinkerService.js` (facade), `smartLinkSpecParser.js`, `smartLinkMatcher.js`, `smartLinkDrafter.js`, `smartLinkApply.js`, `specDeltaService.js` (parse spec, rank REQ song ngữ, scaffold draft, `specHash`/`diskHash`, `mode` link/reverse_sync/conflict).
  - [x] Khai báo route `POST /api/qa/smart-link` và `POST /api/qa/smart-link/apply` (bọc `withWriteLock`) trong `qaRoutes.js`.
  - [x] Viết unit & contract test trong `tests/dashboard-api/smartTraceLinker.test.js` (thư mục mà `npm run test:dashboard:api` thực sự quét).
- [x] **Phase 2**: Studio UI & Code Editor Integration
  - [x] Xây dựng modal độc lập và stylesheet `dashboard/public/styles/views/smartLinker.css`; khai báo `@import` vào `dashboard/public/styles.css`.
  - [x] Tích hợp nút `✦ Liên kết Requirement` trên toolbar editor `<textarea id="script-spec-editor">` trong `builder.html` / `app.js` (view BDD Builder `#/builder`).
  - [x] Bổ sung nút hành động `✦ Phân loại REQ` trong `dashboard/public/js/views/qa/batch/findingRows.js` cho finding `spec-khong-truy-vet`.
  - [x] Hiện thực `smartLinkerModal.js` (lazy-mount, preview 2 nhánh) và `smartLinkerHelper.js` (Apply 1-click, xử lý `BATCH_LOCKED`/`SPEC_CHANGED`/`APPLY_FAILED`), mỗi file ≤ 250 dòng.
- [x] **Phase 3**: Reverse Sync, Edge Cases & Verification
  - [x] Hỗ trợ chế độ đồng bộ ngược (Reverse Sync) khi spec đã có `@REQ-xxx` nhưng thêm test case mới.
  - [x] Viết suite test E2E Playwright `tests/dashboard/qa-smart-linker.spec.js` (chạy trên config `playwright.dashboard.config.js`).
  - [x] Chạy ma trận Gate 4 (C-7), xuất JUnit + receipt `record-gate-run.py`, kiểm định `npm run mp:gate`.
  - [x] Xác nhận `npm run check:framework`, `npm run qa:check`, `npm run test:dashboard:regression` và `npm run presync:drift` đạt 100% Green.
