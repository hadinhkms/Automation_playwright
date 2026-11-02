---
name: Playwright Test Generator
description: Sử dụng kỹ năng này khi người dùng yêu cầu viết hoặc tạo automation test script bằng Playwright, JavaScript, BDD và POM.
---

Trước khi tạo, sửa hoặc review Playwright test, phải đọc và tuân thủ `ai/shared/AI_PROMPTS.md` và `ai/shared/TEST_AUTOMATION_LESSONS.md`.

## Quy trình bắt buộc khi nhận lệnh viết test case:
1. **Rà soát xung đột & dung lượng file trước khi viết (Pre-check, Conflict & Code-Limit Check):**
   - Đọc kỹ tài liệu liên quan (`requirements/REQ-xxx.md`, `test-cases/REQ-xxx.md`) và mã nguồn hiện có (`pages/`, `tests/`, `core/local/`).
   - Đối chiếu xem có mâu thuẫn (conflict), lệch bước hoặc dữ liệu chưa khớp giữa tài liệu với UI/mã nguồn thực tế hay không. Nếu có mâu thuẫn, phải làm rõ hoặc điều chỉnh thống nhất trước khi viết code.
   - **Kiểm tra trước số dòng của Page Object / Spec / Helper định sửa:** nếu file đã tiến sát hoặc vượt **vùng vàng 80%** (Page Object/Fixture/Module `>= 200` dòng trên trần `250`, Spec `>= 640` dòng trên trần `800`, Service/API client ngoài `tests/` `>= 160` dòng trên trần `200`, Utils/Helper ngoài `tests/` `>= 120` dòng trên trần `150`), **phải tách nhỏ module/Page Object/Spec ngay từ đầu** trước khi nhét thêm hàm hoặc `test()` mới (vì Git `pre-commit` sẽ chặn `SPLIT REQUIRED` nếu thêm logic vào file đang ở vùng vàng `>= 80%`).
2. **Thực thi & Kiểm chứng (Execute, Code-Limit Gate & Verify):**
   - Viết kịch bản test theo đúng chuẩn BDD / Page Object Model, gắn tag `@REQ-xxx` và mã `TC-xxx - AC-yyy`.
   - **Link/domain lấy từ cấu hình môi trường, không hard-code:** dùng path tương đối với `baseURL`, `env.apiBaseURL` hoặc key `*URL` khai cho mọi môi trường trong `dashboardConfig.json` (đọc qua `core/config/env.js`). Nếu thiếu key cho domain mới, bổ sung vào config trước khi viết script.
   - **Quy chuẩn chụp ảnh Evidence:** Khi mở đến page cần test thì capture đúng 1 ảnh xác lập trạng thái ban đầu; kể từ đó, cứ mỗi 1 thao tác active (click, select, fill form xong, toggle...) thì capture lại 1 ảnh; tuyệt đối không để các ảnh trùng lặp kế bên nhau (không chụp liên tiếp nếu UI không đổi).
   - **Tự review giới hạn kích thước code trước khi kết thúc (Zero Pre-Commit Rework):**
     - Mọi file tạo mới hoặc thêm hàm/test phải giữ dưới ngưỡng vùng vàng 80%: Spec `< 640` dòng (trần `800`), Page Object / Fixture / Module `< 200` dòng (trần `250`), Service/API ngoài `tests/` `< 160` dòng (trần `200`), Utils/Helper ngoài `tests/` `< 120` dòng (trần `150`); dòng đơn `<= 500` ký tự, trung bình dòng `<= 100` ký tự, file `<= 150KB`.
     - Chạy bắt buộc `npm run check:framework` và `npm run check:limits:strict` (hoặc `npm run mp:audit:changed`), tự tách file ngay nếu có bất kỳ lỗi/cảnh báo vùng vàng nào trước khi bàn giao.
   - Chạy Playwright test kiểm chứng trên spec/project bị ảnh hưởng, đảm bảo pass 100%.
3. **Cập nhật ngược tài liệu sau khi chạy thành công (Post-execution Sync):**
   - Sau khi script chạy thành công, nếu phát hiện bất kỳ thay đổi, rule mới hoặc hành vi thực tế khác biệt so với tài liệu ban đầu, **BẮT BUỘC phải cập nhật ngược lại ngay vào file `requirements/REQ-xxx.md` (và `test-cases/`) tương ứng** để tài liệu và automation luôn đồng bộ 100%.
4. **Khu vực cách ly file test tạm & nháp của AI (Scratchpad Isolation):**
   - Mọi script kiểm tra nhanh, thăm dò selector hoặc test nháp do AI tạo ra (`*.ai-test.*`, `*.scratch.*`, `draft_*`, `temp_*`) **BẮT BUỘC** phải đặt trong thư mục `scratch/` (ví dụ: `scratch/check_xxx.js`) hoặc `tests/scratch/`. Đặt ngoài vùng cách ly sẽ bị `npm run check:framework` và `npm run check:limits` chặn ngay trước khi commit.
