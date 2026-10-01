# Learning Candidates (Pending Gate 0.5 Review)

> [!NOTE]
> Bài học trích xuất sau Feature/QA (chờ Gate 0.5 duyệt). Trần file < 50 dòng, chuẩn DO/DON'T.

- **CANDIDATE-01 (Rule-First for Structured AI Tasks):**
  - **DO:** Luôn ưu tiên dùng code thuần (deterministic regex/AST/heuristics) cho các tác vụ phân tích lỗi kiểm thử (Triage), soạn thảo Bug Report, rà soát độ mơ hồ requirement (Clarity) và phân xử truy vết (Arbitrate) để đạt 0 token, phản hồi < 1ms và triệt tiêu hoàn toàn rủi ro hallucination.
  - **DON'T:** Không gọi LLM/AI cho các dữ liệu đã có cấu trúc hoặc có thể tính toán bằng regex/thuật toán xác định trừ khi người dùng cung cấp explicit AI client configuration.

- **CANDIDATE-02 (Engine Label = Code Path, Test "No AI" With a Key):**
  - **DO:** Gắn nhãn `source`/`engine` tại đúng nhánh code tạo ra kết quả; mọi tính năng tuyên bố "không dùng AI" phải có test chạy với key đã cấu hình và khẳng định fake provider nhận 0 request.
  - **DON'T:** Không suy ra "AI" từ `res.ok` khi wrapper có thể tự trả `ok: true` từ nhánh luật; không để UI giữ nhãn "(AI)"/✦ cho tính năng chạy luật.

- **CANDIDATE-03 (Dynamic QA_PROJECT_ROOT for Test Isolation):**
  - **DO:** Luôn giải quyết đường dẫn thư mục lưu trữ (`data/`, `reports/`) thông qua hàm getter kiểm tra `process.env.QA_PROJECT_ROOT || process.cwd()` để các harness kiểm thử E2E chạy trên workspace tạm cô lập hoàn toàn với thư mục gốc của repository.
  - **DON'T:** Không gán cứng `path.join(__dirname, '../..', 'data')` ở cấp module scope (tĩnh lúc nạp file) khiến các test suite ghi đè dữ liệu thật hoặc thất bại kiểm thử đĩa.

- **CANDIDATE-04 (Sequence Token + Abort for Async UI Requests - ASYNC-03):**
  - **DO:** Luôn kết hợp `AbortController.abort()` và bộ đếm tuần tự `seq` (`currentSeq`) cho các tác vụ phân tích bất đồng bộ để ngăn chặn hoàn toàn yêu cầu chậm đến sau (late response) ghi đè giao diện.
  - **DON'T:** Không phụ thuộc đơn thuần vào debounce hay giả định mạng phản hồi theo thứ tự gửi.
