# Learning Candidates (Pending Gate 0.5 Review)

> [!NOTE]
> Đây là nơi chứa các bài học, quan sát, quy tắc mới được AI và các Role trích xuất sau khi hoàn thành Feature, Bug fix, Review hoặc QA.
> Các candidate ở đây CHƯA PHẢI LÀ STANDARD cho đến khi được Knowledge Curator duyệt qua Gate 0.5.

<!-- Mẫu ứng viên học hỏi:

### [LEARN-001] Tiêu đề quan sát / bài học
- **Nguồn trích xuất:** [FEATURE-X / BUG-Y / CODE-REVIEW]
- **Role quan sát:** [Developer / QA / Tech Lead / BA]
- **Quan sát (Observation):** Mô tả cụ thể hiện tượng hoặc vấn đề
- **Bằng chứng (Evidence):** Link file hoặc mã lỗi thực tế
- **Đề xuất phân loại:** [CURRENT PRACTICE / APPROVED STANDARD / KNOWN PITFALL]
- **Phạm vi đề xuất:** [FEATURE-LOCAL / MODULE / PROJECT]
- **Đề xuất Owner duyệt:** [Technical Lead / Principal QA / BA]
- **Trạng thái:** [PENDING / APPROVED / REJECTED]

-->

### [LEARN-PLAN09-001] Verify migration gates against actual audit and test discovery
- Source: Plan 09 v3 review, 2026-09-10.
- Observation: audit dashboard reports 4 JS violations; CSS/HTML are outside policy extensions. Existing Playwright project patterns exclude a root tests/dashboard-modular-smoke.spec.js.
- Evidence: D:/_Master_Process/config/quality-policy.json; core/config/defineConfig.js:134-187; master.ps1 audit dashboard (exit 1).
- Proposed rule: Capture the actual audit baseline, define per-phase scope, and verify test discovery before declaring migration acceptance runnable.
- Follow-up 2026-09-10: Plan 09 v4 records 13 distinct data-view targets from index.html and requires complete view/action ownership mapping; migration evidence remains pending Phase 0.
- Scope: FEATURE-LOCAL. Owner: Technical Lead / QA. Status: PENDING.
