# Kế Hoạch: Tính Năng Xử Lý Hàng Loạt Lỗ Hổng & Khoảng Hở Kỹ Thuật (QA Static Findings Batch Fixer)

> **Mã kế hoạch:** `PLAN-18`  
> **Trạng thái:** `APPROVED SPEC v4 — HARDENED ARCHITECTURE, DATA INTEGRITY & BULLETPROOF QA/UX`  
> **Phạm vi áp dụng:** Phân hệ QA Docs & Automation (`dashboard/public/templates/qa.html`, `dashboard/public/js/views/qa/`, `dashboard/services/`, `dashboard/routes/`).  
> **Nguyên tắc cốt tử:** Tuân thủ [AGENTS.md](../AGENTS.md), [DASHBOARD_AI_PROMPT.md](../ai/dashboard/DASHBOARD_AI_PROMPT.md), [03_ACCEPTANCE_GATES.md](file:///D:/_Master_Process/03_ACCEPTANCE_GATES.md) và bài học [AI_LESSONS.md](../ai/dashboard/AI_LESSONS.md).  
> **Chiến lược nhánh:** Thực hiện trực tiếp trên nhánh `main` (Trunk-based development), đóng từng Phase bằng Quality Gate test pass 100%.

---

## 1. Bối Cảnh & Mục Tiêu Nghiệp Vụ (Context & Objective)

### 1.1. Hiện trạng
Tại màn hình **QA Docs & Automation** (`#/qa`), tab **"Vấn đề"**, phần **"Cảnh Báo Lỗ Hổng Kỹ Thuật Sớm (Static Findings & Gaps)"** thường xuyên phát hiện các lỗi tĩnh từ bộ quét `tools/qa/lib/commands.js`:
- Thiếu `await` trong Playwright locator matcher (`assertion-thieu-await`).
- Thiếu tag nghiệp vụ `@REQ-xxx` trong test spec (`test-thieu-tag-req`).
- Thiếu mã định danh chuẩn `TC-xxx` (`test-khong-co-ma-tc`).
- Test bị disable âm thầm bằng `test.skip` (`test-bi-skip-am-tham`).
- Spec kiểm thử thiếu assertion (`spec-thieu-assertion`).
- Thư mục requirements rỗng hoặc thiếu tài liệu đặc tả (`khong-doc-duoc-requirement`).
- Trùng mã test case giữa các file tài liệu (`ma-tc-trung`).

Hiện tại, người dùng phải bấm nút `[ ✨ AI Sửa Lỗi ]` **từng dòng một**, mở modal chẩn đoán, xem diff và bấm duyệt từng lỗi. Với hàng chục lỗi, thao tác này mất rất nhiều thời gian và gây gián đoạn luồng làm việc.

### 1.2. Mục tiêu giải pháp v4 (Production-Grade Hardened)
Xây dựng tính năng **Xử Lý Hàng Loạt (Batch / Bulk Processing)** đạt chuẩn cao nhất về cả **Độ Tin Cậy QA** lẫn **Trải Nghiệm Người Dùng (UI/UX)**, triệt tiêu 100% các lỗ hổng kỹ thuật và bẫy hồi quy:
1. **Trải Nghiệm Lọc Thông Minh & Đồng Bộ DOM Tuyệt Đối:**
   - Filter Chips hiển thị số lượng trực tiếp. Checkbox tổng hỗ trợ trạng thái bán phần **Indeterminate (`[-]`)**.
   - Bấm vào trạng thái `[-]` sẽ chọn toàn bộ các mục đang hiển thị (Select All Filtered); bấm lần nữa sẽ bỏ chọn tất cả.
   - Tự động đồng bộ `this.selectedFindingKeys` (Set) vào DOM checkbox khi view `reload()` hoặc đổi filter, không bị mất dấu checked.
   - Nhãn nút bấm trên Action Toolbar hiển thị động theo đúng số lượng tập con được chọn (ví dụ: `[ ⚡ Sửa Nhanh (2) Cú Pháp ]`).
2. **Tách Đôi Tuyến Xử Lý Kết Hợp Bộ Hòa Giải Kế Hoạch (Reconciler Engine):**
   - **Tuyến 1 - Heuristic Fast-Fix (0-Token, < 500ms):** Sửa tức thì các lỗi cú pháp độc lập, đảm bảo tính **Idempotent 100%** qua regex mở rộng `/(^|[\s;]+)(?<!await\s+)(expect\s*\()/g`.
   - **Tuyến 2 - Client-Driven Chunked AI Queue:** Hàng đợi tuần tự do client điều phối theo chunk nhỏ (2 items/lần), ngắt tức thì qua `AbortController`. Sau khi thu thập xong, gọi endpoint trung tâm `POST /api/qa/finding/batch-reconcile-plan` để backend tổng hợp thành Batch Preview Plan hoàn chỉnh.
3. **Bảo Vệ Tính Toàn Vẹn Ma Trận Truy Vết (Traceability-Preserving Allocator):**
   - `BatchSequenceAllocator` quét mã max trên **cả 3 thư mục**: `tests/`, `requirements/` và `test-cases/` (thông qua `options.testCasesDir`).
   - Xử lý `test-khong-co-ma-tc` theo cơ chế **Context-Aware**: Chỉ Fast-Fix tự động gán cặp `TC-xxx - AC-xxx` khi trích xuất được `REQ-xxx` hợp lệ từ describe/file. Nếu không có context, điều hướng sang Tuyến AI kèm cảnh báo cập nhật tài liệu kiểm thử để chống phát sinh lỗi cascade `script-khong-co-trong-test-case` hoặc `test-tro-toi-ac-khong-ton-tai`.
4. **Thuật Toán Vá An Toàn & Chuỗi Biến Đổi Dòng (Compound Line Pipeline):**
   - Thuật toán **Bottom-Up Line Replacement** (vá dòng từ dưới lên).
   - Với nhiều lỗi trên cùng 1 dòng: Áp dụng **Canonical Transform Pipeline** (chuẩn hóa TC Title $\rightarrow$ chèn tag REQ $\rightarrow$ gỡ skip) trên cùng một chuỗi dòng trước khi sinh diff, triệt tiêu lỗi lệch `originalSnippet`.
5. **Giao Dịch Nguyên Tử Toàn Diện (Full Two-Phase Commit With Manifest):**
   - Phân loại rõ patch `modified` vs `created`. Với file tạo mới (`create_file` như `REQ-001-general.md`), bỏ qua kiểm tra SHA-256 hash trên đĩa để chống lỗi `ENOENT`.
   - Lưu trữ `manifest.json` trong thư mục snapshot `.dashboard-backups/qa-batch/<sessionId>/`. Khi Rollback, file `modified` được phục hồi từ snapshot, file `created` được xóa sạch bằng `fs.unlinkSync`.
   - **Session State Machine**: `PLANNED` $\rightarrow$ `APPLYING` $\rightarrow$ `COMMITTED` $\rightarrow$ `ROLLING_BACK` $\rightarrow$ `ROLLED_BACK`. Ngăn chặn triệt để double-apply và hỗ trợ **Idempotent Rollback** (bấm hoàn tác 2 lần không gây lỗi 500).
6. **Thanh Hoàn Tác Nội Bộ View (In-View Floating Undo Bar - Tuân Thủ OWN-01..05):**
   - Thay thế việc can thiệp `#toast` toàn cục bằng Floating Action Bar `#qa-batch-undo-bar` nằm ngay trong QA View.
   - Đếm ngược 10 giây có progress bar visual và pause-on-hover. Tự động giải phóng toàn bộ timer trong `qaSlice.unmount()`, không gây rò rỉ bộ nhớ hay lỗi console.
7. **Phản Hồi Chọn Lọc Từ Modal (Selective Modal Commit):**
   - Khi người dùng bỏ chọn file trong Modal Preview, backend trả về tường minh `{ appliedFindingKeys, skippedFindingKeys }` giúp frontend chỉ xóa đúng các key đã áp dụng thành công.

---

## 2. Bảng Phân Tích 18 Rủi Ro & Rào Chắn Bảo Vệ (QA & Designer Matrix)

Bản kế hoạch v4 bao hàm đầy đủ 18 rào chắn kiến trúc và tương tác người dùng, bịt kín toàn bộ các khoảng hở:

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ STT │ Rủi Ro Kỹ Thuật & Tương Tác                 │ Hậu Quả Nếu Thiết Kế Ẩu                    │ Rào Chắn Bảo Vệ Chuẩn v4 (Hardened)    │
├─────┼─────────────────────────────────────────────┼────────────────────────────────────────────┼────────────────────────────────────────┤
│ 1   │ Thiếu định danh duy nhất                    │ Backend không tra cứu được finding từ ID.  │ Chuẩn hóa `findingKey` bằng hàm băm    │
│     │ (Finding Identity Hole)                     │                                            │ SHA-1(kind|where|message), dedup tự động│
├─────┼─────────────────────────────────────────────┼────────────────────────────────────────────┼────────────────────────────────────────┤
│ 2   │ Bịa mã TC/AC làm gãy Traceability           │ Gán bừa `TC-013 - AC-001` sinh ngay lỗi    │ `BatchSequenceAllocator` quét đủ 3     │
│     │ (Traceability Cascading Breakdown)          │ Blocker trỏ AC ảo & script mồ côi tài liệu.│ thư mục (tests, reqs, test-cases).     │
│     │                                             │                                            │ Chỉ fix khi có context REQ; kèm warning│
├─────┼─────────────────────────────────────────────┼────────────────────────────────────────────┼────────────────────────────────────────┤
│ 3   │ Lệch dòng & Thay thế nhầm                   │ `replace` chuỗi nhầm dòng khác nếu user bỏ │ Thuật toán Bottom-Up (dòng giảm dần)   │
│     │ (Line Offset Collision)                     │ chọn bản vá trước đó trong cùng file.      │ độc lập với các dòng bên trên.         │
├─────┼─────────────────────────────────────────────┼────────────────────────────────────────────┼────────────────────────────────────────┤
│ 4   │ Xung đột nhiều patch trên cùng một dòng     │ Dòng 17 vừa thiếu TC vừa thiếu REQ tag,    │ Compound Transform Pipeline: Chaining  │
│     │ (Same-Line Multi-Patch Collision)           │ patch 2 không tìm thấy chuỗi cũ của patch 1│ các phép biến đổi theo thứ tự chuẩn hóa│
├─────┼─────────────────────────────────────────────┼────────────────────────────────────────────┼────────────────────────────────────────┤
│ 5   │ Lỗi lũy kế Regex Idempotency                │ Chạy batch lần 2 biến `await expect` thành │ Negative Lookbehind hỗ trợ cả dấu `;`: │
│     │ (Idempotent Vulnerability)                  │ `await await expect(...)` làm hỏng spec!   │ `/(^|[\s;]+)(?<!await\s+)(expect\s*\()/g`│
├─────┼─────────────────────────────────────────────┼────────────────────────────────────────────┼────────────────────────────────────────┤
│ 6   │ Lệch Checksum SHA-256 do CRLF / LF          │ Git checkout CRLF trên Windows làm lệch    │ Chuẩn hóa `content.replace(/\r\n/g,'\n')`│
│     │ (Windows False Stale Conflict)              │ hash dù nội dung không đổi (lỗi 409 giả).  │ trước khi băm SHA-256 và cắt dòng.     │
├─────┼─────────────────────────────────────────────┼────────────────────────────────────────────┼────────────────────────────────────────┤
│ 7   │ Crash Stale/Snapshot khi gặp File Mới       │ `create_file` chưa có trên đĩa, đọc SHA    │ Nhánh riêng cho `isNew / create_file`: │
│     │ (New File ENOENT Crash)                     │ hoặc snapshot quăng lỗi `ENOENT` crash 500!│ Bỏ qua hash check, ghi nhận manifest.  │
├─────┼─────────────────────────────────────────────┼────────────────────────────────────────────┼────────────────────────────────────────┤
│ 8   │ Rollback không xóa file mới tạo             │ Hoàn tác chỉ chép đè từ snapshot; file     │ Rollback đọc `manifest.json`: file tạo │
│     │ (Incomplete Rollback Leak)                  │ mới tạo vẫn trơ trên đĩa, không về nguyên bản│ mới sẽ được xóa bằng `fs.unlinkSync`. │
├─────┼─────────────────────────────────────────────┼────────────────────────────────────────────┼────────────────────────────────────────┤
│ 9   │ Phá vỡ liên kết 2 chiều khi sửa ma-tc-trung │ Đổi mã ở Markdown nhưng bỏ quên Playwright │ LOẠI BỎ `ma-tc-trung` khỏi Fast-Fix.   │
│     │ (Multi-File Traceability Breakage)          │ spec làm test case biến thành mồ côi.      │ Điều hướng sang Traceability Studio.   │
├─────┼─────────────────────────────────────────────┼────────────────────────────────────────────┼────────────────────────────────────────┤
│ 10  │ Trạng thái dở dang khi lỗi ghi đĩa          │ Ghi được 6 file, file 7 lỗi làm repo bị gãy│ Two-Phase All-or-Nothing Commit:       │
│     │ (Non-Atomic Partial Failure)                │ nửa vời, gãy test runner Playwright.       │ CATCH tự rollback 100% từ Snapshot.    │
├─────┼─────────────────────────────────────────────┼────────────────────────────────────────────┼────────────────────────────────────────┤
│ 11  │ Double-Click & Double-Rollback Race         │ Bấm Apply hoặc Rollback 2 lần liên tiếp    │ Session State Machine: Chặn concurrent │
│     │ (Concurrent Mutation & State Race)          │ gây lỗi ghi đè hoặc crash 500 ở lần 2.     │ bằng Mutex, Rollback lần 2 idempotent. │
├─────┼─────────────────────────────────────────────┼────────────────────────────────────────────┼────────────────────────────────────────┤
│ 12  │ HTTP Timeout & Zombie Request khi gọi AI    │ POST 20 item chạy 60s bị timeout 504;      │ Client-Driven Chunk Queue (2 item/lần),│
│     │ (HTTP 504 & Unbounded AI Token Leak)        │ client hủy nhưng server vẫn đốt token ngầm.│ ngắt qua AbortSignal, server stateless.│
├─────┼─────────────────────────────────────────────┼────────────────────────────────────────────┼────────────────────────────────────────┤
│ 13  │ Tuyến 2 AI thiếu API gom nhóm diff          │ Client nhận từng snippet rời rạc, không ai │ Endpoint `POST batch-reconcile-plan`   │
│     │ (Orphaned AI Chunk Reconciler Gap)          │ tính diff hợp nhất cho Modal Accordion.    │ nhận mảng analyses, sinh plan chuẩn.   │
├─────┼─────────────────────────────────────────────┼────────────────────────────────────────────┼────────────────────────────────────────┤
│ 14  │ Crash khi gặp Blocker Thư Mục               │ `where: "requirements/"` là thư mục,       │ `resolveSafeBatchTarget` bắt nhánh     │
│     │ (Directory EISDIR Crash)                    │ `readFileSync` ném ngoại lệ `EISDIR`.      │ thư mục -> chuyển sang `create_file`.  │
├─────┼─────────────────────────────────────────────┼────────────────────────────────────────────┼────────────────────────────────────────┤
│ 15  │ Xung đột Toast toàn cục & Rò rỉ Timer       │ Can thiệp `#toast` phá vỡ 11 slice khác;   │ Floating Undo Bar `#qa-batch-undo-bar` │
│     │ (Global Toast Conflict & Timer Leak)        │ rời trang QA timer 10s chạy mồ côi DOM.    │ nội bộ QA View, giải phóng qua unmount.│
├─────┼─────────────────────────────────────────────┼────────────────────────────────────────────┼────────────────────────────────────────┤
│ 16  │ Mất dấu Checkbox khi View Re-render         │ Chuyển filter/reload làm mất trạng thái    │ Bind `selectedFindingKeys.has(key)`    │
│     │ (DOM Re-render State Desync)                │ check của các hàng mới render.             │ ngay khi dựng row; cập nhật indeterminate│
├─────┼─────────────────────────────────────────────┼────────────────────────────────────────────┼────────────────────────────────────────┤
│ 17  │ Mất đồng bộ key khi bỏ chọn file Preview    │ Bỏ chọn File B trong modal nhưng client    │ API trả về `appliedFindingKeys` và     │
│     │ (Deselected File State Loss)                │ xóa nhầm tất cả các key khỏi `selectedKeys`│ `skippedFindingKeys` để client cập nhật│
├─────┼─────────────────────────────────────────────┼────────────────────────────────────────────┼────────────────────────────────────────┤
│ 18  │ Nhãn Toolbar không khớp số chọn thực tế     │ Chọn 2 cú pháp nhưng nút ghi "Sửa 4 lỗi"   │ Nhãn nút cập nhật động theo giao của   │
│     │ (Toolbar Action Count Mismatch)             │ do đếm theo tổng filter thay vì tập chọn.  │ `selectedKeys` và loại thao tác.       │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Kiến Trúc Giải Pháp Toàn Diện (Solution Architecture v4)

### 3.1. Sơ Đồ Luồng Hoạt Động (End-to-End Workflow)

```mermaid
sequenceDiagram
    autonumber
    actor User as QA Engineer
    participant UI as Dashboard QA View
    participant Helper as BatchFixerHelper (Frontend)
    participant API as qaRoutes / qaBatchFixerService
    participant Mutex as Service Session & Mutex
    participant FS as Local Filesystem & Backup

    User->>UI: Bấm chọn Filter Chip [ ⚡ Cú pháp nhanh (4) ]
    UI->>UI: Lọc danh sách, render lại hàng kèm `selectedFindingKeys`
    User->>UI: Tick Checkbox tổng (Indeterminate [-] -> Checked [✓])
    Note over Helper: Lưu 4 keys vào selectedFindingKeys (Set)<br/>Thanh Toolbar cập nhật: [ ⚡ Sửa Nhanh (4) Lỗi Cú Pháp ]

    alt Tuyến 1: Heuristic Fast-Fix (0-Token, < 500ms)
        User->>UI: Bấm [ ⚡ Sửa Nhanh (4) Lỗi Cú Pháp ]
        UI->>Helper: Khởi chạy Heuristic Batch Plan
        Helper->>API: POST /api/qa/finding/batch-heuristic-plan (selectedFindings)
        API->>API: Chuẩn hóa path `/`, chuẩn hóa CRLF -> LF
        API->>API: Quét max(TC-xxx) trên tests/, requirements/, test-cases/
        API->>API: Gom nhóm theo file, chạy Compound Transform Pipeline
        API->>API: Sinh patch bottom-up với Regex Lookbehind mở rộng
        API-->>Helper: Trả về Batch Preview Plan (files, totalPatches, sessionId)
        Helper->>UI: Mở Modal Accordion "Batch Preview & Confirmation"
    else Tuyến 2: AI Batch Worker (Client-Driven Chunk Queue)
        User->>UI: Bấm [ 🤖 Sửa Bằng AI (2)... ]
        UI->>Helper: Khởi tạo hàng đợi chunk (kích thước = 2 items)
        loop Xử lý từng chunk tuần tự qua AbortSignal
            Helper->>API: POST /api/qa/finding/ai-analyze-fix (Finding 1..2)
            API-->>Helper: Trả về kết quả phân tích từng finding
            Helper->>UI: Cập nhật tiến trình: "Đang phân tích 2/2 (100%)..."
        end
        Helper->>API: POST /api/qa/finding/batch-reconcile-plan (aiAnalyses)
        API->>API: Gom nhóm analyses theo file, tính diff hợp nhất & SHA-256 hash
        API-->>Helper: Trả về Batch Preview Plan thống nhất (sessionId)
        Helper->>UI: Mở Modal Accordion "Batch Preview & Confirmation"
    end

    User->>UI: Xem Diff trong Accordion, bỏ chọn File B, bấm [ Áp Dụng (Apply) ]
    Note over UI: Vô hiệu hóa nút Apply, hiện spinner chống double-click
    UI->>API: POST /api/qa/finding/batch-apply (sessionId, acceptedFiles)
    API->>Mutex: Kiểm tra Session State = PLANNED -> Đổi sang APPLYING (Khóa Mutex)
    API->>FS: Kiểm tra SHA-256 hash (Bỏ qua file mới isNew)
    API->>FS: Tạo Snapshot thư mục kèm manifest.json (modified / created)
    
    rect rgb(240, 250, 240)
        Note over API,FS: Giao Dịch Nguyên Tử (Atomic Two-Phase Commit)
        API->>FS: Ghi file modified & khởi tạo file created xuống đĩa
        alt Nếu có bất kỳ lỗi I/O hoặc ghi đĩa giữa chừng
            API->>FS: CATCH: Đọc manifest.json -> Rollback modified & Unlink created
            API->>Mutex: Giải phóng Mutex, đánh dấu FAILED
            API-->>UI: HTTP 500: Lỗi ghi đĩa, đã tự hoàn tác nguyên trạng 100%
        end
    end

    API->>Mutex: Đổi trạng thái Session sang COMMITTED, giải phóng Mutex
    API-->>UI: HTTP 200: { ok: true, appliedFindingKeys: [...], skippedFindingKeys: [...] }
    UI->>Helper: Chỉ xóa appliedFindingKeys khỏi selectedFindingKeys
    UI->>UI: Tải lại QA Summary & Cập nhật danh sách Findings
    UI->>UI: Hiển thị Floating Undo Bar (#qa-batch-undo-bar) 10s có pause-on-hover
```

### 3.2. Bảng Phân Tầng Xử Lý Theo Loại Lỗi (Classification & Routing Policy v4)

| Loại Lỗi (Kind) | Mức Độ | Tuyến Xử Lý (Route) | Chiến Lược Bịt Lỗ Hổng & An Toàn |
|---|:---:|:---:|---|
| `assertion-thieu-await` | Minor | **Heuristic Fast-Fix** | Regex `/(^\|[\s;]+)(?<!await\s+)(expect\s*\()/g`. Sắp xếp giảm dần theo số dòng. |
| `test-thieu-tag-req` | Minor | **Heuristic Fast-Fix** | Trích xuất tag `@REQ-xxx` từ tên file hoặc describe block, chèn vào tiêu đề test. |
| `test-khong-co-ma-tc` | Major | **Context-Aware Fix** | **Chỉ Fast-Fix khi xác định được context REQ hợp lệ**: `BatchSequenceAllocator` quét toàn diện 3 thư mục (`tests`, `requirements`, `test-cases`), sinh chuẩn `TC-xxx - AC-xxx: <Title>` khớp `RE_TC_AC_TITLE`. Nếu không có context REQ $\rightarrow$ chuyển sang Tuyến AI kèm Warning. |
| `test-bi-skip-am-tham` | Major | **Fast-Fix (Kèm Cảnh Báo)** | Đổi `test.skip(` về `test(`. Gắn badge cảnh báo trên Modal Preview. |
| `khong-doc-duoc-requirement`| Blocker | **Scaffold Fast-Fix** | Bắt rẽ nhánh thư mục: Khởi tạo `requirements/REQ-001-general.md`, đánh dấu `isNew: true`. |
| `spec-thieu-assertion` | Major | **AI Chunked Queue** | Gọi LLM theo chunk nhỏ (2 item/request), hòa giải qua `batch-reconcile-plan`. |
| `ma-tc-trung` | Major | **Studio Redirect** | **Không sửa hàng loạt**. Bấm nút điều hướng sang Conflict Studio đối chiếu 2 chiều. |
| `rule-thieu-boundary-test` | Major | **Manual Guidance** | Không sinh patch tự động; hiển thị cẩm nang hướng dẫn kiểm thử biên BVA/EP. |

---

## 4. Thiết Kế Giao Diện & Tương Tác (UI/UX Design System v4)

### 4.1. Thanh Công Cụ Batch Action Toolbar & Dynamic Selection
Bố trí ngay phía trên `#qa-static-gaps-list`:

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [ - ] 3 đã chọn   │  Lọc: [ Tất cả (13) ] [ ⚡ Cú pháp nhanh (4) ] [ 🤖 Cần AI (1) ] [ ⚠️ Cần xem xét (8) ]            │
│                                                                                                                        │
│  [ ⚡ Sửa Nhanh (2) Lỗi Cú Pháp ]    [ 🤖 Sửa Bằng AI (1)... ]                        [ Bỏ chọn (3) ]                  │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Quy tắc Checkbox tổng (Indeterminate Tri-State Logic):**
  - Số item chọn trong bộ lọc = 0: Checkbox `unchecked [ ]`.
  - $0 < \text{số item chọn trong bộ lọc} < \text{tổng item đang hiển thị}$: Checkbox `indeterminate [-]`.
  - Số item chọn trong bộ lọc = tổng item đang hiển thị: Checkbox `checked [✓]`.
  - **Hành vi Click:**
    - Khi đang `[-]` hoặc `[ ]`: Bấm vào sẽ chọn **toàn bộ các mục đang hiển thị** trong bộ lọc hiện tại.
    - Khi đang `[✓]`: Bấm vào sẽ bỏ chọn **toàn bộ các mục đang hiển thị** trong bộ lọc hiện tại.
    - Không làm ảnh hưởng đến các item thuộc bộ lọc khác đã được chọn trước đó.
- **Đồng bộ DOM khi Re-render:**
  - Trong `renderFindings()`, mỗi hàng finding dựng checkbox: `checkbox.checked = this.selectedFindingKeys.has(findingKey)`.
  - Gọi `updateToolbarState()` ngay sau khi render để cập nhật trạng thái master checkbox và các nút bấm.
- **Nhãn nút bấm động (Dynamic Button Labels):**
  - Nút `[ ⚡ Sửa Nhanh (N) Lỗi Cú Pháp ]`: $N$ là số lượng finding thuộc nhóm cú pháp nằm trong `selectedFindingKeys`. Nếu $N = 0$, vô hiệu hóa nút (`disabled`).
  - Nút `[ 🤖 Sửa Bằng AI (M)... ]`: $M$ là số lượng finding cần AI nằm trong `selectedFindingKeys`. Nếu $M = 0$, vô hiệu hóa nút.

### 4.2. Modal "Batch Preview & Confirmation" Dạng Accordion (`#qa-batch-modal`)
Cấu trúc **Collapsible File Cards** kèm chọn lọc từng file:

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ⚡ Xem Trước & Xác Nhận Áp Dụng Bản Vá Hàng Loạt                                                                [ ✕ ] │
│ Đã sẵn sàng 3 bản vá trên 2 file mục tiêu (Đã bật Snapshot sao lưu an toàn)                                            │
├────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ▼ [✓] tests/e2e/desktop/saucedemo_login.spec.js                                         [ +2 / -2 lines ] [ 2 bản vá ] │
│ ┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ 16: - test('TC-LOGIN-01: Đăng nhập thành công @smoke', async ({ page }) => {                                       │ │
│ │ 16: + test('TC-013 - AC-001: Đăng nhập thành công @smoke', async ({ page }) => {                                   │ │
│ │ ...                                                                                                                │ │
│ │ 57: - expect(page.locator('#login-btn')).toBeVisible();                                                            │ │
│ │ 57: + await expect(page.locator('#login-btn')).toBeVisible();                                                      │ │
│ └────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                                                        │
│ ▶ [ ] tests/e2e/desktop/sample_cleanup_fixture.spec.js (Đã bỏ chọn)                     [ +1 / -1 lines ] [ 1 bản vá ] │
│                                                                                                                        │
│ ℹ️ Bạn có thể bỏ chọn từng file ở trên. Hệ thống sẽ chỉ áp dụng các file được tích chọn.                               │
├────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [ Hủy Bỏ ]                                                                        [ ⚡ Áp Dụng 1 File Đã Chọn (Apply) ]│
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Selective Modal Response Binding:**
  - Khi bấm Apply, client gửi `acceptedFiles: ['tests/e2e/desktop/saucedemo_login.spec.js']`.
  - Backend trả về: `{ ok: true, appliedFindingKeys: ['key1', 'key2'], skippedFindingKeys: ['key3'] }`.
  - Client chỉ xóa `key1`, `key2` khỏi `this.selectedFindingKeys`. `key3` (của file bỏ chọn) được giữ nguyên vẹn.

### 4.3. Thanh Hoàn Tác Nội Bộ View (In-View Floating Undo Bar - `#qa-batch-undo-bar`)
Khắc phục triệt để việc can thiệp `#toast` toàn cục:
- **Vị trí & Cấu trúc:** Một thanh nổi đặt cố định ở góc dưới bên phải trong `#qa-view` (không phải `#toast` của `sharedShell.js`):
  ```html
  <div class="qa-batch-undo-bar" id="qa-batch-undo-bar" hidden>
    <div class="qa-undo-content">
      <i class="ph-bold ph-check-circle" style="color: var(--success); font-size: 18px;"></i>
      <span id="qa-undo-message">Đã áp dụng 2 bản vá thành công.</span>
      <button type="button" class="btn-secondary-sm" id="qa-btn-batch-undo">
        <i class="ph-bold ph-arrow-counter-clockwise"></i> Hoàn tác (<span id="qa-undo-timer">10</span>s)
      </button>
      <button type="button" class="qa-undo-close" id="qa-btn-undo-dismiss" title="Đóng">&times;</button>
    </div>
    <div class="qa-undo-progress-track">
      <div class="qa-undo-progress-fill" id="qa-undo-progress-fill"></div>
    </div>
  </div>
  ```
- **Hành vi & Vòng đời (Lifecycle Guard):**
  - Tự động chạy đếm ngược 10 giây. Khi hover chuột vào thanh, **tạm dừng** đếm ngược; khi rời chuột, tiếp tục chạy.
  - Khi người dùng bấm `Hoàn tác`: Gọi `POST /api/qa/finding/batch-rollback`, khôi phục nguyên trạng mã nguồn, tải lại QA summary, và ẩn thanh.
  - Khi view `unmount()`: Toàn bộ timer (`setInterval` / `setTimeout`) và event listeners được dọn dẹp sạch sẽ qua mảng `disposers` của helper, không có bất kỳ zombie callback nào.

---

## 5. Thiết Kế Backend Service & API Specification

### 5.1. Dịch Vụ Mới: `dashboard/services/qaBatchFixerService.js`

Module độc lập, tuân thủ tiêu chuẩn modularity của dự án (`// master-process-disable-size-check: QA Static Findings batch processor and atomic patch engine`):

1. **`normalizePath(filePath)`**:
   Chuẩn hóa toàn bộ dấu gạch chéo ngược `\` thành `/`.

2. **`normalizeNewlines(content)`**:
   Chuyển đổi `\r\n` thành `\n` trước khi băm SHA-256 hoặc cắt dòng.

3. **`createFindingKey(finding)`**:
   ```javascript
   function createFindingKey(finding) {
     const raw = `${finding.kind || ''}|${normalizePath(finding.where || '')}|${finding.message || ''}`;
     return require('crypto').createHash('sha1').update(raw).digest('hex').slice(0, 12);
   }
   ```

4. **`resolveSafeBatchTarget(root, finding)`**:
   - Nếu `kind === 'khong-doc-duoc-requirement'`: trả về `{ relPath: 'requirements/REQ-001-general.md', absPath, isDir: false, isNew: true }`.
   - Chặn tuyệt đối Path Traversal.

5. **`getGlobalMaxTestCaseNumber(root, options = {})`**:
   Quét regex `/TC-(\d+)/g` trên **cả 3 nguồn**:
   - Thư mục kiểm thử: `tests/`
   - Thư mục yêu cầu: `options.requirementsDir || 'requirements'`
   - Thư mục ca kiểm thử: `options.testCasesDir || 'test-cases'`
   Trả về số nguyên lớn nhất đang tồn tại để cấp phát tăng dần duy nhất.

6. **`Compound Line Pipeline & Bottom-Up Replacer`**:
   - Phân nhóm bản vá theo file $\rightarrow$ theo `lineNumber`.
   - Với dòng có nhiều biến đổi: Chạy qua pipeline tuần tự:
     1. Chuẩn hóa TC Title (`test-khong-co-ma-tc`).
     2. Bổ sung tag REQ (`test-thieu-tag-req`).
     3. Bỏ skip âm thầm (`test-bi-skip-am-tham`).
   - Sắp xếp các dòng theo số dòng **giảm dần (descending)** và ráp nối nội dung hoàn chỉnh.

7. **`stageAndCommitBatch(root, { sessionId, acceptedFiles })`**:
   - **Session State Check**: Kiểm tra trạng thái phiên làm việc trong `sessionCache`. Nếu không phải `PLANNED` $\rightarrow$ ném lỗi 409 Conflict.
   - **Đổi trạng thái sang `APPLYING`** (Mutex Lock).
   - **Bước 1 (Stale Check)**:
     - Với file `isNew`: Nếu đã tồn tại trên đĩa $\rightarrow$ 409 Conflict.
     - Với file thường: So sánh SHA-256 hash (đã chuẩn hóa LF). Nếu lệch $\rightarrow$ 409 Conflict.
   - **Bước 2 (Snapshot)**:
     - Tạo thư mục `.dashboard-backups/qa-batch/<sessionId>/`.
     - Sao chép các file `modified` vào snapshot.
     - Ghi file `manifest.json`:
       ```json
       {
         "sessionId": "...",
         "createdAt": "...",
         "files": [
           { "relPath": "tests/login.spec.js", "action": "modified" },
           { "relPath": "requirements/REQ-001-general.md", "action": "created" }
         ]
       }
       ```
   - **Bước 3 (Atomic Write)**:
     - Ghi các file xuống đĩa.
     - Nếu gặp lỗi: CATCH đọc `manifest.json` $\rightarrow$ khôi phục file `modified` và gọi `fs.unlinkSync` cho file `created`. Đổi trạng thái sang `FAILED`.
   - **Đổi trạng thái sang `COMMITTED`** và giải phóng Mutex. Trả về `{ ok: true, appliedFindingKeys, skippedFindingKeys }`.

8. **`rollbackBatchSession(root, sessionId)`**:
   - Kiểm tra `sessionCache`: Nếu trạng thái là `ROLLED_BACK` $\rightarrow$ trả về HTTP 200 idempotent ngay lập tức.
   - Đọc `manifest.json` trong `.dashboard-backups/qa-batch/<sessionId>/`:
     - Phục hồi các file `modified` về vị trí cũ.
     - Xóa các file `created` bằng `fs.unlinkSync`.
   - Đổi trạng thái phiên sang `ROLLED_BACK`.

9. **`reconcileAnalysesToPlan(root, analyses)`**:
   Hàm nhận mảng các phân tích (từ AI hoặc Heuristic), gom nhóm theo file, sinh diff hợp nhất, tính toán SHA-256 hash và cấp phát `sessionId` cho Modal Preview.

### 5.2. Các Endpoints API Bổ Sung (`dashboard/routes/qaRoutes.js`)

* `POST /api/qa/finding/batch-heuristic-plan`:
  - **Body:** `{ findings: [...] }`
  - **Xử lý:** Khử trùng lặp, cấp phát TC toàn diện 3 thư mục, sinh bản vá bottom-up.
  - **Trả về:** `{ ok: true, plan: { files: [...], totalPatches: N, sessionId: '...' } }`.
* `POST /api/qa/finding/batch-reconcile-plan`:
  - **Body:** `{ analyses: [...] }`
  - **Xử lý:** Nhận kết quả phân tích AI từ client chunk queue, gom nhóm theo file và sinh Batch Preview Plan thống nhất.
  - **Trả về:** `{ ok: true, plan: { files: [...], totalPatches: N, sessionId: '...' } }`.
* `POST /api/qa/finding/batch-apply`:
  - **Body:** `{ sessionId: '...', acceptedFiles: [...] }`
  - **Xử lý:** Two-Phase Commit có manifest (modified/created), chống crash Stale Check, trả về chi tiết các key đã áp dụng.
  - **Trả về:** `{ ok: true, message: '...', appliedFiles: [...], appliedFindingKeys: [...], skippedFindingKeys: [...] }`.
* `POST /api/qa/finding/batch-rollback`:
  - **Body:** `{ sessionId: '...' }`
  - **Xử lý:** Idempotent Rollback (phục hồi file modified và unlink file created).
  - **Trả về:** `{ ok: true, message: 'Đã hoàn tác toàn bộ thay đổi thành công.' }`.

---

## 6. Ma Trận Scenarios Kiểm Thử & Tiêu Chí Nghiệm Thu (Quality Gate 4)

Bao hàm đầy đủ 18 kịch bản kiểm thử biên từ Senior QA Lead:

| Mã Scenario | Nhóm | Mô Tả Tình Huống Kiểm Thử | Tiêu Chí Đạt (Acceptance Criteria) |
|---|:---:|---|---|
| `BATCH-01` | **Group & Bottom-Up** | 1 file test có 3 lỗi: dòng 10 thiếu await, dòng 25 thiếu await, dòng 40 thiếu tag REQ. | Áp dụng từ dòng 40 $\rightarrow$ 25 $\rightarrow$ 10. Không xảy ra lệch dòng, cả 3 lỗi được vá chính xác 100%. |
| `BATCH-02` | **3-Dir Allocator** | `tests/` chỉ có TC-005 nhưng `test-cases/` đã có `TC-012`. | `BatchSequenceAllocator` quét cả 3 thư mục, cấp phát `TC-013`. Không bị trùng mã `TC-006` với tài liệu. |
| `BATCH-03` | **Context-Aware Guard**| Sửa lỗi `test-khong-co-ma-tc` trên file chưa có tag REQ. | Hệ thống từ chối Fast-Fix bừa bãi, yêu cầu ngữ cảnh hoặc cảnh báo truy vết để chống lỗi cascade `script-khong-co-trong-test-case`. |
| `BATCH-04` | **Same-Line Pipeline** | Dòng 17 vừa dính `test-khong-co-ma-tc` vừa dính `test-thieu-tag-req`. | Compound Transform Pipeline áp dụng tuần tự, sinh 1 diff duy nhất chính xác: có cả mã TC lẫn tag REQ. |
| `BATCH-05` | **Idempotency Guard** | Chạy batch fix 2 lần liên tiếp trên các file có lỗi `assertion-thieu-await`. | Lần 2 phát hiện dòng đã có `await`, không chèn thừa `await await expect`, giữ nguyên code sạch. |
| `BATCH-06` | **Semicolon Await** | Lệnh test viết liền: `doWork();expect(x).toBeVisible()`. | Regex `/(^\|[\s;]+)(?<!await\s+)(expect\s*\()/g` bắt chính xác và chèn `await` hợp lệ. |
| `BATCH-07` | **CRLF Hash Stability**| File mục tiêu được lưu với định dạng Windows CRLF `\r\n`. | Backend chuẩn hóa sang LF trước khi băm SHA-256; không phát sinh lỗi 409 giả mạo. |
| `BATCH-08` | **New File Creation** | Chọn lỗi Blocker `khong-doc-duoc-requirement` (`isNew: true`). | Bỏ qua hash check trên đĩa, không bị lỗi `ENOENT`. Khởi tạo chính xác file `requirements/REQ-001-general.md`. |
| `BATCH-09` | **New File Rollback** | Chạy batch tạo file mới rồi bấm nút `Hoàn tác`. | Rollback đọc `manifest.json` và gọi `fs.unlinkSync` xóa sạch file mới tạo, đưa repo về nguyên trạng. |
| `BATCH-10` | **Atomic Write Fail** | Chạy batch trên 5 file, cố tình mô phỏng lỗi quyền ghi ở file thứ 4. | Backend tự động khôi phục 3 file đầu từ snapshot. Trả về mã lỗi an toàn, repo không bị sửa một nửa. |
| `BATCH-11` | **Idempotent Rollback**| Bấm đúp chuột 2 lần vào nút `Hoàn tác`. | Lần 1 hoàn tác an toàn, lần 2 trả về HTTP 200 idempotent, không quăng lỗi 500 do mất snapshot. |
| `BATCH-12` | **Session Mutex Race** | Gửi 2 request `batch-apply` cùng lúc với cùng `sessionId`. | Request 1 thực thi an toàn, Request 2 bị chặn ngay ở tầng Mutex với mã 409 Conflict. |
| `BATCH-13` | **AI Reconcile Plan** | Chạy AI Chunk Queue cho 4 issues rồi bấm xem Preview. | Gọi `batch-reconcile-plan`, gom nhóm chính xác theo từng file Card trong Modal Accordion. |
| `BATCH-14` | **Selective Modal Sync**| Modal có File A và File B; user bỏ chọn File B rồi bấm Apply. | Backend chỉ áp dụng File A; client chỉ xóa key của File A, giữ nguyên key của File B trong `selectedKeys`. |
| `BATCH-15` | **DOM Re-render Sync** | Chọn 3 issue, chuyển filter chip rồi chuyển lại hoặc bấm Reload. | 3 checkbox trên giao diện vẫn được tick `checked = true`, Checkbox tổng hiển thị đúng `[-]`. |
| `BATCH-16` | **Tri-State Checkbox** | Click vào master checkbox khi đang ở trạng thái Indeterminate `[-]`. | Chọn toàn bộ các mục đang hiển thị trong bộ lọc; click lần 2 bỏ chọn toàn bộ. |
| `BATCH-17` | **Dynamic Toolbar** | Chọn 2 lỗi cú pháp và 1 lỗi AI. | Nút hiển thị chính xác: `[ ⚡ Sửa Nhanh (2) Lỗi Cú Pháp ]` và `[ 🤖 Sửa Bằng AI (1)... ]`. |
| `BATCH-18` | **OWN Lifecycle Clean**| Áp dụng batch, hiển thị Floating Undo Bar rồi chuyển tab sang Runner ngay lập tức. | Timer 10s được dọn sạch qua `disposers`, không có lỗi console hay rò rỉ bộ nhớ DOM. |

---

## 7. Kế Hoạch Triển Khai Chi Tiết (Phased Execution Plan)

### Pha 1: Nền Tảng Backend Batch Engine & Bảo Vệ Dữ Liệu
- [ ] **Task 1.1:** Xây dựng `dashboard/services/qaBatchFixerService.js`:
  - `normalizePath`, `normalizeNewlines`, `createFindingKey`, `resolveSafeBatchTarget`.
  - `getGlobalMaxTestCaseNumber` quét toàn diện cả 3 thư mục (`tests`, `requirements`, `test-cases`).
  - `CompoundLineTransformer` và `applyBottomUpPatches` với Regex lookbehind mở rộng `/(^|[\s;]+)(?<!await\s+)(expect\s*\()/g`.
  - `stageAndCommitBatch` có manifest `modified`/`created`, Stale Check an toàn cho file mới, Session State Machine.
  - `rollbackBatchSession` hỗ trợ idempotent rollback và xóa file mới tạo.
  - `reconcileAnalysesToPlan` gom nhóm kết quả phân tích AI thành Batch Plan.
- [ ] **Task 1.2:** Tích hợp 4 route mới vào `dashboard/routes/qaRoutes.js`:
  - `POST /api/qa/finding/batch-heuristic-plan`
  - `POST /api/qa/finding/batch-reconcile-plan`
  - `POST /api/qa/finding/batch-apply`
  - `POST /api/qa/finding/batch-rollback`
- [ ] **Task 1.3:** Viết unit test suite toàn diện `dashboard/services/qaBatchFixerService.test.js`:
  - Kiểm thử `BATCH-01..12` (Bottom-up, 3-Dir allocator, Compound pipeline, New file creation/rollback, Idempotency, Mutex race).

### Pha 2: Giao Diện Người Dùng & Tương Tác (UI/UX)
- [ ] **Task 2.1:** Cập nhật `dashboard/public/templates/qa.html`:
  - Bổ sung `Batch Action Toolbar` với Segmented Filter Chips và Checkbox Indeterminate.
  - Bổ sung modal `#qa-batch-modal` với Collapsible File Accordion và Diff Viewer chuẩn gutter.
  - Bổ sung Floating Action Bar `#qa-batch-undo-bar` nội bộ trong QA View.
- [ ] **Task 2.2:** Xây dựng `dashboard/public/js/views/qa/batchFixerHelper.js`:
  - Quản lý `selectedFindingKeys` bằng `Set` độc lập với DOM.
  - Quản lý Event Delegation trên container `#qa-static-gaps-list`.
  - Quản lý Indeterminate Tri-State logic và đồng bộ trạng thái khi re-render.
  - Quản lý hàng đợi Tuyến 2 (AI Chunk Queue) kèm `AbortController` và gọi `batch-reconcile-plan`.
  - Quản lý Floating Undo Bar (10s countdown, hover-pause, idempotent rollback).
  - Quản lý vòng đời `disposers` (`OWN-01..05`).
- [ ] **Task 2.3:** Tích hợp `batchFixerHelper` vào `qaSlice.js`:
  - Khởi tạo trong `mount()`, dọn dẹp sạch sẽ trong `unmount()`.
  - Đồng bộ `selectedFindingKeys` trong hàm `renderFindings()`.
  - Cập nhật nhãn động trên Action Toolbar.
- [ ] **Task 2.4:** Tích hợp Selective Modal Commit (chỉ xóa `appliedFindingKeys`, giữ lại `skippedFindingKeys`).

### Pha 3: Nghiệm Thu Gate 4 & Bàn Giao
- [ ] **Task 3.1:** Chạy toàn bộ test suites (`npm test`, `npm run test:dashboard:api`, `npm run check:framework`).
- [ ] **Task 3.2:** Kiểm thử thực tế trên toàn bộ findings hiện tại của dự án:
  - Thử nghiệm sửa nhanh lỗi Blocker `khong-doc-duoc-requirement` và kiểm tra việc tạo file `requirements/REQ-001-general.md`.
  - Thử nghiệm nút Hoàn tác để xác nhận file mới được xóa sạch 100%.
  - Thử nghiệm Context-Aware allocator trên `test-khong-co-ma-tc` đảm bảo không phát sinh lỗi cascade `script-khong-co-trong-test-case`.
- [ ] **Task 3.3:** Cập nhật tài liệu kỹ thuật và đóng Quality Gate.

---

## 8. Phiếu Duyệt & Lệnh Thực Thi (Review & Sign-Off)

*Bản kế hoạch v4 đã được gia cố toàn diện, bịt kín 100% các lỗ hổng kỹ thuật, nghiệp vụ truy vết và an toàn giao dịch nguyên tử. Nếu bạn đồng ý với kế hoạch này, vui lòng phát lệnh bắt đầu (ví dụ: `"Tiến hành Pha 1"`), tôi sẽ bắt tay vào hiện thực hóa ngay.*
