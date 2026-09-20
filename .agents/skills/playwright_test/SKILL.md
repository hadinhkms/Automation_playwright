---
name: Playwright Test Generator
description: Sử dụng kỹ năng này khi người dùng yêu cầu viết hoặc tạo automation test script bằng Playwright, JavaScript, BDD và POM.
---

Trước khi tạo, sửa hoặc review Playwright test, phải đọc và tuân thủ `ai/shared/AI_PROMPTS.md` và `ai/shared/TEST_AUTOMATION_LESSONS.md`.

## Quy trình bắt buộc khi nhận lệnh viết test case:
1. **Rà soát xung đột trước khi viết (Pre-check & Conflict Resolution):**
   - Đọc kỹ tài liệu liên quan (`requirements/REQ-xxx.md`, `test-cases/REQ-xxx.md`) và mã nguồn hiện có (`pages/`, `tests/`).
   - Đối chiếu xem có mâu thuẫn (conflict), lệch bước hoặc dữ liệu chưa khớp giữa tài liệu với UI/mã nguồn thực tế hay không. Nếu có mâu thuẫn, phải làm rõ hoặc điều chỉnh thống nhất trước khi viết code.
2. **Thực thi & Kiểm chứng (Execute & Verify):**
   - Viết kịch bản test theo đúng chuẩn BDD / Page Object Model, gắn tag `@REQ-xxx` và mã `@TC-xxx`.
   - Chạy test kiểm chứng và đảm bảo pass 100%.
3. **Cập nhật ngược tài liệu sau khi chạy thành công (Post-execution Sync):**
   - Sau khi script chạy thành công, nếu phát hiện bất kỳ thay đổi, rule mới hoặc hành vi thực tế khác biệt so với tài liệu ban đầu, **BẮT BUỘC phải cập nhật ngược lại ngay vào file `requirements/REQ-xxx.md` (và `test-cases/`) tương ứng** để tài liệu và automation luôn đồng bộ 100%.
