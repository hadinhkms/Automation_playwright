## Canonical Software Delivery Process & Quality Standard
Mọi yêu cầu phát triển phần mềm, thay đổi UI/UX hoặc cải tiến kỹ thuật trong toàn bộ dự án BẮT BUỘC phải tuân thủ tài liệu quy trình chuẩn duy nhất tại:
- **Quy trình tổng thể & Playbook:** [.master_process/SOFTWARE_DELIVERY_PROCESS_MASTER.md](.master_process/SOFTWARE_DELIVERY_PROCESS_MASTER.md) (hoặc [D:\_Master_Process\SOFTWARE_DELIVERY_PROCESS_MASTER.md](file:///D:/_Master_Process/SOFTWARE_DELIVERY_PROCESS_MASTER.md))
- **Thư mục Prompts chuẩn:** [.master_process/prompts/](.master_process/prompts/)

## Tối Ưu Tốc Độ & Tiết Kiệm Token (Speed & Token-Saving Policy)
- **Tác vụ nhỏ/vừa (L1/L2):** Dùng ngay file gộp siêu tốc [.master_process/prompts/00_Fast_Track_L1_L2.prompt.md](.master_process/prompts/00_Fast_Track_L1_L2.prompt.md) để giải quyết trọn vẹn cả 5 vai trò trong 1 lượt prompt duy nhất, tiết kiệm 80% token.
- **Tác vụ lớn (L3/L4):** Thực hiện tuần tự qua các file prompt con tương ứng (A1 -> A2 -> A3 -> B -> C -> D -> E).
- **Nguyên tắc phản hồi:** Trả lời trực diện, súc tích, đi thẳng vào bảng ma trận, code diff và checklist kiểm thử; KHÔNG chào hỏi xã giao, KHÔNG lặp lại toàn bộ đề bài, KHÔNG giải thích triết lý lan man.

# Project Context for Gemini

@./AGENTS.md

Load only the canonical documents required by the task:

- Playwright test task: `ai/shared/AI_PROMPTS.md` and `ai/shared/TEST_AUTOMATION_LESSONS.md`.
- Dashboard task: `ai/dashboard/DASHBOARD_AI_PROMPT.md` and `ai/dashboard/AI_LESSONS.md`.
- Unrelated task: do not load either group.

Keep detailed Dashboard rules in the imported canonical documents rather than duplicating them here. If those documents change during an active Gemini CLI session, run `/memory refresh` before continuing.
