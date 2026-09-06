## Canonical Software Delivery Process & Quality Standard
Mọi yêu cầu phát triển phần mềm, thay đổi UI/UX hoặc cải tiến kỹ thuật trong toàn bộ dự án BẮT BUỘC phải tuân thủ tài liệu quy trình chuẩn duy nhất tại:
- **Quy trình tổng thể & Playbook:** [.master_process/SOFTWARE_DELIVERY_PROCESS_MASTER.md](.master_process/SOFTWARE_DELIVERY_PROCESS_MASTER.md) (hoặc [D:\_Master_Process\SOFTWARE_DELIVERY_PROCESS_MASTER.md](file:///D:/_Master_Process/SOFTWARE_DELIVERY_PROCESS_MASTER.md))
- **Thư mục Prompts chuẩn:** [.master_process/prompts/](.master_process/prompts/)

## Tối Ưu Tốc Độ & Tiết Kiệm Token (Speed & Token-Saving Policy)
- **Tác vụ nhỏ/vừa (L1/L2):** Dùng ngay file gộp siêu tốc [.master_process/prompts/00_Fast_Track_L1_L2.prompt.md](.master_process/prompts/00_Fast_Track_L1_L2.prompt.md) để giải quyết trọn vẹn cả 5 vai trò trong 1 lượt prompt duy nhất, tiết kiệm 80% token.
- **Tác vụ lớn (L3/L4):** Thực hiện tuần tự qua các file prompt con tương ứng (A1 -> A2 -> A3 -> B -> C -> D -> E).
- **Nguyên tắc phản hồi:** Trả lời trực diện, súc tích, đi thẳng vào bảng ma trận, code diff và checklist kiểm thử; KHÔNG chào hỏi xã giao, KHÔNG lặp lại toàn bộ đề bài, KHÔNG giải thích triết lý lan man.

# Project Instructions for Claude

## Playwright automation

Only for a Playwright task, read:

- `ai/shared/AI_PROMPTS.md`
- `ai/shared/TEST_AUTOMATION_LESSONS.md`

## Dashboard

Only for a Dashboard task, read:

- `ai/dashboard/DASHBOARD_AI_PROMPT.md`
- `ai/dashboard/AI_LESSONS.md`

Preserve the existing vanilla HTML/CSS/JavaScript architecture, shared dashboard primitives, Page Object Model, fixture patterns, and validation commands. Do not duplicate the full rules in this file.

## Senior QA verification gate

After every implementation, perform a Senior QA verification pass with more than 10 years of experience before reporting completion. Apply risk-based testing, equivalence partitioning, boundary-value checks, exploratory checks, and regression checks. Validate happy, failure, security-sensitive, retry/conflict, loading, empty, and error paths. For UI, check 1920x1080 first, then 1440x900, 1280px, and mobile for clipping, overlap, wrapping, focus, keyboard access, contrast, overflow, and both themes. Audit duplicate components/styles/listeners and scan rendered UI for implementation notes, debug text, raw errors, undefined/null values, TODOs, and redundant visible code comments. Run executable checks and inspect console output; compilation alone is not sufficient.

## Personal instructions

Personal preferences and recurring individual mistakes belong outside the repository, preferably in `~/.claude/CLAUDE.md`. Do not add personal instruction files under version control.
