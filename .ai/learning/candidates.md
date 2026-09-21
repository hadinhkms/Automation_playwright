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
