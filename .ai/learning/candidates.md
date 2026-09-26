# Learning Candidates (Pending Gate 0.5 Review)

> [!NOTE]
> Bài học trích xuất sau Feature/QA (chờ Gate 0.5 duyệt). Trần file < 50 dòng, chuẩn DO/DON'T.

### [LEARN-MP-001] Anti-Happy-Path & Multi-Target Verification in Hub-Spoke
- **Quan sát/DO:** Bọc Mutex ở service logic cho 100% mutation; kiểm tra toàn bộ N vệ tinh; refactor trước khi file > 90% trần dòng; viết API Contract tests (403, 409, 400). Không để mock string trong code chính thức. **Trạng thái:** PENDING

### [LEARN-API-002] Mandatory End-to-End API Verification for New Pages & Features
- **Quan sát/DO:** Test 100% API endpoints của tính năng mới (cả API trực tiếp lẫn click UI); lệnh chẩn đoán có exit code 1 vẫn trả về HTTP 200 kèm kết quả, không trả về 400. **Trạng thái:** PENDING
- **Phạm vi đề xuất:** PROJECT & DASHBOARD
- **Đề xuất Owner duyệt:** Lead QA / Framework Architect
- **Trạng thái:** PENDING

### [LEARN-FE-003] Zero Missing ESM Imports to Prevent Blank Dashboard Views
- **Quan sát:** `reqAnalyzerHelper.js` import thiếu module gây crash bootstrap view.
- **DO/DON'T:** Quét đồ thị import; đảm bảo core utility (`toast.js`) luôn sẵn sàng; test switch tab thực tế.
- **Trạng thái:** PENDING

### [LEARN-AI-004] 9Router Gateway Integration & Multi-Satellite Sync
- **Quan sát:** AI Gateway cục bộ (9Router) dùng chuẩn OpenAI (`/v1`). Cần proxy backend `/api/ai/models`.
- **DO/DON'T:** Thêm preset 9router riêng; auto-detect & live model fetch; đồng bộ `.env` đa dự án.
- **Trạng thái:** PENDING

### [LEARN-FIX-005] Windows Drive Letter & Safe Line Regex in Finding Fixers
- **Quan sát:** Dùng `split(':')` trên Windows làm tách nhầm ổ đĩa `C:\` thành số dòng, gây lọt path traversal.
- **DO/DON'T:** Dùng regex `/(.*?)(?::(\d+))?$/` bóc tách số dòng; chặn triệt để `^[a-zA-Z]:` và `..`.
- **Trạng thái:** PENDING

### [LEARN-QA-006] Mutation từ finding: tính lại từ file thật, đồng bộ cả tập, kiểm chứng rồi mới giữ
- **Quan sát/DO:** Server phải tự tính lại bằng chính analyzer, sửa cả TẬP AC, hoàn tác nếu còn lệch; token CSS mới phải thêm vào tokens.css. **Trạng thái:** PENDING

### [LEARN-AI-007] Jira Markup Parser Order & Vietnamese Diacritics in Slugs
- **Quan sát:** (1) Jira numbered list `# item` nếu parse sau `h1.` -> `# Title` sẽ vô tình biến `# Title` thành `1. Title`. (2) `đ/Đ` tiếng Việt không bị tách bởi `normalize('NFD')` nên regex `[^a-z0-9]` sẽ nuốt mất hoặc biến thành gạch ngang đôi.
- **DO:** Luôn parse numbered list `#` TRƯỚC heading `h1..h6`; thay thế `[đĐ] -> d` trước khi `normalize('NFD')`. **Trạng thái:** PENDING
