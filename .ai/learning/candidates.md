# Learning Candidates (Pending Gate 0.5 Review)

> [!NOTE]
> Đây là nơi chứa các bài học, quan sát, quy tắc mới được AI và các Role trích xuất sau khi hoàn thành Feature, Bug fix, Review hoặc QA.
> - Các candidate ở đây CHƯA PHẢI LÀ STANDARD cho đến khi được Knowledge Curator duyệt qua Gate 0.5.
> - Sau khi được duyệt (`PROMOTED`) hoặc từ chối (`REJECTED`), script `optimize-knowledge.ps1` sẽ tự động chuyển mục này sang `.ai/learning/archive/` để tiết kiệm Token Context.
> - Quy tắc viết: Tối đa 15 dòng/candidate, súc tích theo chuẩn DO/DON'T.

### [LEARN-MP-001] Anti-Happy-Path & Multi-Target Verification in Hub-Spoke
- **Nguồn trích xuất:** Plan 12 Master Process Dashboard Integration Audit
- **Role quan sát:** Senior QA Engineer & Tooling Lead
- **Quan sát (Observation):** Mutex bị hở ở direct endpoints; bỏ quên vệ tinh CarThings; sợ trần dòng 250 nên bỏ tính năng thay vì refactor; để sót mock string cứng.
- **Bằng chứng (Evidence):** Plan 12 Re-audit findings (masterProcessHelper.js, masterProcessService.js)
- **DO:** Bọc Mutex ở service logic cho 100% mutation actions; kiểm tra toàn bộ N vệ tinh; refactor trước khi file > 90% trần dòng; viết API Contract tests (403, 409, 400).
- **DON'T:** Không để mock string trong code chính thức; không nghiệm thu đại diện 1 vệ tinh rồi suy diễn cho toàn bộ.
- **Đề xuất phân loại:** APPROVED STANDARD
- **Phạm vi đề xuất:** PROJECT
- **Đề xuất Owner duyệt:** Technical Lead / Principal QA
- **Trạng thái:** PENDING

### [LEARN-API-002] Mandatory End-to-End API Verification for New Pages & Features
- **Nguồn trích xuất:** Plan 13 Settings & Doctor/Probes HTTP 400 Incident
- **Role quan sát:** Senior QA Engineer & Backend Web Developer
- **Quan sát (Observation):** Nút Doctor/Probes bấm trả về HTTP 400 vì backend nhầm exit code 1 của công cụ chẩn đoán (có cảnh báo) thành Bad Request (400); thiếu test click thực tế cho toàn bộ API endpoints của tính năng mới.
- **Bằng chứng (Evidence):** masterProcessRoutes.js line 72 (res.ok ? 200 : 400), masterProcessHelper.js
- **DO:** Luôn test 100% API endpoints của page/tính năng mới (cả API trực tiếp lẫn click UI trên browser); lệnh chẩn đoán/quét hoàn thành phải trả về HTTP 200 kèm payload kết quả, không trả về 400 khi tool có exit code 1 do phát hiện lỗi.
- **DON'T:** Không nghiệm thu tính năng mới khi chưa click thử và assert 200 cho toàn bộ nút bấm/endpoint trên giao diện thực tế.
- **Đề xuất phân loại:** APPROVED STANDARD
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
