# Learning Candidates (Pending Gate 0.5 Review)

> [!NOTE]
> Bài học trích xuất sau Feature/QA (chờ Gate 0.5 duyệt). Trần file < 50 dòng, chuẩn DO/DON'T.

- **CANDIDATE-01 (Rule-First for Structured AI Tasks):**
  - **DO:** Dùng code thuần (regex/AST/heuristics) cho Triage, Bug Report, Clarity, Arbitrate để 0 token, < 1ms, 0 hallucination.
  - **DON'T:** Không gọi LLM cho dữ liệu có cấu trúc trừ khi người dùng cấp explicit AI client configuration.
- **CANDIDATE-02 (Engine Label = Code Path, Test "No AI" With a Key):**
  - **DO:** Gắn nhãn source/engine tại đúng nhánh tạo kết quả; tính năng "không dùng AI" phải test với key đã cấu hình (0 request).
  - **DON'T:** Không suy ra AI từ `res.ok`; không để UI giữ nhãn "(AI)"/✦ cho tính năng chạy luật.
- **CANDIDATE-03 (Dynamic QA_PROJECT_ROOT for Test Isolation):**
  - **DO:** Giải quyết đường dẫn (`data/`, `reports/`) qua `process.env.QA_PROJECT_ROOT || process.cwd()`.
  - **DON'T:** Không gán cứng `path.join(__dirname, '../..', 'data')` ở module scope.
- **CANDIDATE-04 (Sequence Token + Abort for Async UI Requests - ASYNC-03):**
  - **DO:** Kết hợp `AbortController.abort()` và bộ đếm tuần tự `seq` (`currentSeq`) cho tác vụ async UI.
  - **DON'T:** Không phụ thuộc debounce hay giả định mạng phản hồi theo thứ tự gửi.
- **CANDIDATE-05 (DOM Budget & Prefetching without DOM Bloat):**
  - **DO:** Khi preload template view, lưu in-memory cache và gán innerHTML On-Demand để DOM < 1,500 nodes.
  - **DON'T:** Không gán `innerHTML` cho tất cả view lúc khởi động trang.
- **CANDIDATE-06 (Hub-Spoke Traceability Boundary):**
  - **DO:** Khi chạy truy vết tại Hub engine, tự động bỏ qua spec hạ tầng/dashboard nội bộ và thư mục ẩn `.`.
  - **DON'T:** Không áp đặt tài liệu nghiệp vụ vệ tinh lên sample specs hạ tầng.
- **CANDIDATE-07 (Tiered Overlap Coefficient & Mutex Test Isolation):**
  - **DO:** Tính điểm so khớp song ngữ theo tầng (Describe x3, Path x2, AC x1) qua Overlap Coefficient; test mutex trực tiếp hàm service.
  - **DON'T:** Không chia mẫu số cho toàn bộ text thô; không test mutex qua spawn process.
- **CANDIDATE-08 (Lazy Modal Mount & Editor Synchronization Contract):**
  - **DO:** Lazy DOM mount dialog vào `document.body` khi trigger lần đầu; đồng bộ editor qua API an toàn.
  - **DON'T:** Không chèn sẵn dialog trợ lý vào template khởi động gây phình DOM.
- **CANDIDATE-09 (Reverse Sync Non-Destructive Update & XSS Sanitization):**
  - **DO:** Nhận diện test theo title chuẩn hóa và tag `TC-zzz`; lọc sạch thẻ `<script>` và pipe `|` trước khi ghi markdown.
  - **DON'T:** Không tự ý xóa TC cũ không còn tìm thấy trong code khi đồng bộ ngược.
- **CANDIDATE-10 (Windows Workspace Teardown & Comment-Anchored Probes):**
  - **DO:** Dùng `fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5 })`; dùng neo chú thích `(?://|#|/\*)\s*(TODO|FIXME)`.
  - **DON'T:** Không xóa thư mục tạm trên Windows thiếu retry; không dùng regex probe thiếu neo comment.
- **CANDIDATE-11 (Git Log Probe Pathspec & Secret Dummy Filter):**
  - **DO:** Quét secret bằng `git log -G` kết hợp pathspec exclude `_Plan_implement` và lọc dummy key chuẩn.
  - **DON'T:** Không quét càn commit git mà không loại trừ markdown tài liệu.
- **CANDIDATE-12 (Facade Pattern for God Object Decomposition):**
  - **DO:** Bóc tách file God Object (> 1000 lines) thành các sub-module và giữ file gốc làm Facade mỏng (< 200 lines).
  - **DON'T:** Không thay đổi chữ ký hàm hay import paths của callers bên ngoài khi refactor nội bộ.
