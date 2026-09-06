## Canonical Software Delivery Process & Quality Standard
Mọi yêu cầu phát triển phần mềm, thay đổi UI/UX hoặc cải tiến kỹ thuật trong toàn bộ dự án BẮT BUỘC phải tuân thủ tài liệu quy trình chuẩn duy nhất tại:
- **Quy trình tổng thể & Playbook:** [.master_process/SOFTWARE_DELIVERY_PROCESS_MASTER.md](.master_process/SOFTWARE_DELIVERY_PROCESS_MASTER.md) (hoặc [D:\_Master_Process\SOFTWARE_DELIVERY_PROCESS_MASTER.md](file:///D:/_Master_Process/SOFTWARE_DELIVERY_PROCESS_MASTER.md))
- **Thư mục Prompts chuẩn:** [.master_process/prompts/](.master_process/prompts/)

## Tối Ưu Tốc Độ & Tiết Kiệm Token (Speed & Token-Saving Policy)
- **Tác vụ nhỏ/vừa (L1/L2):** Dùng ngay file gộp siêu tốc [.master_process/prompts/00_Fast_Track_L1_L2.prompt.md](.master_process/prompts/00_Fast_Track_L1_L2.prompt.md) để giải quyết trọn vẹn cả 5 vai trò trong 1 lượt prompt duy nhất, tiết kiệm 80% token.
- **Tác vụ lớn (L3/L4):** Thực hiện tuần tự qua các file prompt con tương ứng (A1 -> A2 -> A3 -> B -> C -> D -> E).
- **Nguyên tắc phản hồi:** Trả lời trực diện, súc tích, đi thẳng vào bảng ma trận, code diff và checklist kiểm thử; KHÔNG chào hỏi xã giao, KHÔNG lặp lại toàn bộ đề bài, KHÔNG giải thích triết lý lan man.

For Playwright test tasks, read and strictly follow `ai/shared/AI_PROMPTS.md` and `ai/shared/TEST_AUTOMATION_LESSONS.md`. Do not load Dashboard documents unless the task also changes `dashboard/`.

For Dashboard tasks, read and follow `ai/dashboard/DASHBOARD_AI_PROMPT.md` and `ai/dashboard/AI_LESSONS.md`. If repository-local skills are supported, use `.agents/skills/dashboard-maintainer/SKILL.md`. Reuse the shared dashboard layout, design tokens, panels, and code editor before introducing a new implementation.

## Senior QA verification gate

After every implementation, act as a Senior QA Engineer with more than 10 years of experience before reporting completion. Apply risk-based testing: use equivalence partitioning and boundary-value checks; exercise happy, validation-failure, security-sensitive, retry/conflict, loading, empty, and error paths; inspect affected API/UI behavior and backward compatibility. For UI, check 1920x1080 first, then 1440x900, 1280px, and mobile for clipping, overlap, wrapping, focus, keyboard access, contrast, overflow, and both themes. Search rendered UI for implementation/debug notes, raw errors, `undefined`, `null`, TODOs, and redundant visible code comments. Audit duplicate components, styles, and listeners against shared primitives. Run executable tests and inspect console output; compilation or static inspection alone is never sufficient. Report exact commands/results, failed or unavailable checks, and remaining risks.
