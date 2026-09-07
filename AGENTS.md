# Project Agent Guidelines & Master Process Reference

> **Hiến Pháp Dự Án**: Dự án này tuân thủ nghiêm ngặt Quy trình Phát triển Phần mềm Chuẩn & Hệ thống Trí tuệ Tự học (Project Intelligence Layer) được định nghĩa tại **Master Process Hub**.

---

## 1. Tham Chiếu Quy Trình Chuẩn (Master Process References)

Mọi yêu cầu phát triển phần mềm, thay đổi UI/UX hoặc cải tiến kỹ thuật trong toàn bộ dự án BẮT BUỘC phải tuân thủ tài liệu quy trình chuẩn tại **Master Hub** (tra cứu qua liên kết cục bộ [.master_process/](file:///.master_process/) hoặc trực tiếp tại [D:\_Master_Process](file:///D:/_Master_Process)):

* 📘 **Quy trình tổng thể & 4 Quality Gates:**  
  [.master_process/00_CORE_PROCESS_GUIDE.md](file:///.master_process/00_CORE_PROCESS_GUIDE.md) (hoặc [D:\_Master_Process\00_CORE_PROCESS_GUIDE.md](file:///D:/_Master_Process/00_CORE_PROCESS_GUIDE.md))
* 📜 **Quy trình chi tiết 5 giai đoạn (A -> E):**  
  [.master_process/SOFTWARE_DELIVERY_PROCESS_MASTER.md](file:///.master_process/SOFTWARE_DELIVERY_PROCESS_MASTER.md) (hoặc [D:\_Master_Process\SOFTWARE_DELIVERY_PROCESS_MASTER.md](file:///D:/_Master_Process/SOFTWARE_DELIVERY_PROCESS_MASTER.md))
* 🧠 **Nguyên lý Tự học & Quản trị Tri thức (Gate 0.5):**  
  [.master_process/project_intelligence_layer_10_of_10.md](file:///.master_process/project_intelligence_layer_10_of_10.md) (hoặc [D:\_Master_Process\project_intelligence_layer_10_of_10.md](file:///D:/_Master_Process/project_intelligence_layer_10_of_10.md))
* 🎯 **Kho Master Prompts cho từng Role:**  
  [.master_process/prompts/](file:///.master_process/prompts/) (hoặc [D:\_Master_Process\prompts](file:///D:/_Master_Process/prompts))

### Tối Ưu Tốc Độ & Tiết Kiệm Token (Speed & Token-Saving Policy)
- **Tác vụ nhỏ/vừa (L1/L2):** Dùng ngay file gộp siêu tốc [.master_process/prompts/00_Fast_Track_L1_L2.prompt.md](file:///.master_process/prompts/00_Fast_Track_L1_L2.prompt.md) để giải quyết trọn vẹn cả 5 vai trò trong 1 lượt prompt duy nhất, tiết kiệm 80% token.
- **Tác vụ lớn (L3/L4):** Thực hiện tuần tự qua các file prompt con tương ứng (A1 -> A2 -> A3 -> B -> C -> D -> E).
- **Nguyên tắc phản hồi:** Trả lời trực diện, súc tích, đi thẳng vào bảng ma trận, code diff và checklist kiểm thử; KHÔNG chào hỏi xã giao, KHÔNG lặp lại toàn bộ đề bài, KHÔNG giải thích triết lý lan man.

---

## 2. Hệ Thống Trí Nhớ & Tri Thức Riêng Của Dự Án (.ai/)

Mọi tri thức tự học, quyết định kỹ thuật, quy tắc bất biến của riêng dự án này được lưu trữ và tra cứu tại thư mục `.ai/` cục bộ:

### A. Tri thức Kỹ thuật & Kiểm thử (Engineering & QA)
* Hồ sơ kỹ thuật & Lệnh chạy: [.ai/knowledge/engineering/project-profile.md](file:///.ai/knowledge/engineering/project-profile.md)
* Tiêu chuẩn viết code & Rào chắn: [.ai/knowledge/engineering/coding-conventions.md](file:///.ai/knowledge/engineering/coding-conventions.md)
* Quy chuẩn kịch bản kiểm thử: [.ai/knowledge/qa/test-conventions.md](file:///.ai/knowledge/qa/test-conventions.md)
* Điểm nóng hồi quy & Cạm bẫy: [.ai/knowledge/qa/regression-hotspots.md](file:///.ai/knowledge/qa/regression-hotspots.md)

### B. Vùng Tự Học & Đề Xuất Mới (Self-Learning Loop)
* Sau mỗi feature, bugfix hoặc review, mọi quan sát và bài học mới phải được trích xuất vào:  
  👉 [.ai/learning/candidates.md](file:///.ai/learning/candidates.md)
* Định kỳ chạy **Knowledge Curator (Gate 0.5)** qua [.master_process/prompts/11_Knowledge_Curator_Gate0_5.prompt.md](file:///.master_process/prompts/11_Knowledge_Curator_Gate0_5.prompt.md) để thăng cấp candidate thành tiêu chuẩn dự án.

---

## 3. Chỉ Dẫn Chuyên Sâu Từng Module (Subsystem Guidelines)

### A. Playwright Automation
Khi làm việc với các file Playwright test, Page Objects, fixtures:
- Đọc và tuân thủ tuyệt đối [ai/shared/AI_PROMPTS.md](file:///ai/shared/AI_PROMPTS.md) và [ai/shared/TEST_AUTOMATION_LESSONS.md](file:///ai/shared/TEST_AUTOMATION_LESSONS.md).
- Không load tài liệu Dashboard trừ khi task có chỉnh sửa `dashboard/`.
- Chạy kiểm tra quy chuẩn kiến trúc tự động: `npm run check:framework`.

### B. Dashboard Web Studio
Khi làm việc với Dashboard (`dashboard/`):
- Đọc và tuân thủ [ai/dashboard/DASHBOARD_AI_PROMPT.md](file:///ai/dashboard/DASHBOARD_AI_PROMPT.md) và [ai/dashboard/AI_LESSONS.md](file:///ai/dashboard/AI_LESSONS.md).
- Nếu hỗ trợ skill cục bộ, dùng `.agents/skills/dashboard-maintainer/SKILL.md`.
- Giữ nguyên kiến trúc Vanilla HTML/CSS/JS, tái sử dụng các primitives, layout tokens, panels và code editor có sẵn.

---

## 4. Senior QA Verification Gate (Gate 4 Bắt Buộc)

Sau mỗi lần hiện thực hóa mã nguồn, đóng vai trò **Senior QA Engineer với hơn 10 năm kinh nghiệm** trước khi báo cáo hoàn tất:
- Áp dụng kiểm thử dựa trên rủi ro (risk-based testing): phân vùng tương đương, phân tích giá trị biên; kiểm tra luồng happy, validation-failure, bảo mật, retry/conflict, loading, empty, và error paths.
- Đối với UI, kiểm tra độ phân giải 1920x1080 trước, sau đó là 1440x900, 1280px và mobile để phát hiện vỡ giao diện, tràn viền (clipping), che khuất (overlap), xuống dòng, tương tác bàn phím, độ tương phản và cả 2 chế độ Light/Dark.
- Quét UI đã render để loại bỏ ghi chú debug, lỗi thô, `undefined`, `null`, TODOs và comment mã nguồn thừa thãi.
- Chạy kiểm thử thực tế và kiểm tra output console; biên dịch tĩnh không bao giờ là đủ. Báo cáo chính xác lệnh đã chạy, kết quả, các điểm chưa kiểm tra được và rủi ro còn lại.
