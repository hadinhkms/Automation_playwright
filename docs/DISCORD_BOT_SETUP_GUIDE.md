# 📖 Hướng Dẫn Cài Đặt Discord QA Bot & GitHub Actions (Dành Cho Mọi Người - Không Cần Biết Kỹ Thuật)

Tài liệu này được viết theo phong cách **"Cầm tay chỉ việc"**, giúp bất kỳ ai cũng có thể tự tạo Bot Discord và kết nối với GitHub để ra lệnh chạy test tự động chỉ trong **5 - 7 phút**.

---

## 🟢 BƯỚC 1: Tạo "Nhân Viên Ảo" (Bot) Trên Discord (Mất 2 phút)

> **🎯 Mục đích:** Tạo ra một con Bot trên Discord để sau này mình chỉ cần chat là Bot sẽ tự động đi chạy test.

1. **Mở cổng tạo Bot của Discord:**
   - Truy cập vào trang: [https://discord.com/developers/applications](https://discord.com/developers/applications) *(Đăng nhập tài khoản Discord nếu được hỏi)*.
2. **Tạo hồ sơ Bot:**
   - Nhìn lên **góc trên bên phải màn hình**, bấm nút màu tím **"New Application"**.
   - Ở ô **NAME**, gõ tên: `Vieclam24h QA Bot` -> Tích vào ô vuông nhỏ đồng ý điều khoản -> Bấm nút **Create**.
3. **Lấy mã chìa khóa của Bot (Token):**
   - Nhìn sang **cột menu bên trái**, bấm vào chữ **"Bot"** (có biểu tượng hình con robot).
   - Ở giữa màn hình, tìm chữ **TOKEN** -> Bấm nút **"Reset Token"** -> Bấm xác nhận **"Yes, do it!"**.
   - Bấm nút **"Copy"** màu xanh để sao chép mã chìa khóa bí mật.
   - 👉 **Quay lại trang Dashboard:** Dán mã vừa copy vào ô **`DISCORD BOT TOKEN`**.
4. ⚠️ **Bật quyền đọc tin nhắn cho Bot (CỰC KỲ QUAN TRỌNG):**
   - Vẫn ở trang đó, cuộn chuột xuống dưới tìm mục **Privileged Gateway Intents**.
   - Gạt công tắc dòng **`MESSAGE CONTENT INTENT`** sang màu xanh (**ON**).
   - Bấm nút màu xanh **Save Changes** ở thanh dưới đáy màn hình. *(Nếu quên bước này, Bot sẽ không đọc được tin nhắn chat của bạn)*.
5. **Mời Bot vào Server Discord của công ty:**
   - Nhìn sang **cột menu bên trái**, bấm vào **"OAuth2"** -> chọn **"URL Generator"**.
   - Tại bảng to **SCOPES**, tích chọn 1 ô vuông: `[x] bot`.
   - Ngay sau đó một bảng **BOT PERMISSIONS** hiện ra ở dưới, tích chọn 4 ô:
     - `[x] Send Messages` (Gửi tin nhắn)
     - `[x] Read Messages/View Channels` (Đọc tin nhắn / Xem kênh)
     - `[x] Read Message History` (Đọc lịch sử chat)
     - `[x] Embed Links` (Gửi thẻ kết quả)
   - Cuộn xuống đáy trang, bấm nút **Copy** ở ô **GENERATED URL**.
   - Dán link đó vào tab trình duyệt mới -> Chọn Server Discord của bạn -> Bấm **Tiếp tục (Continue)** -> Bấm **Phê duyệt (Authorize)**.
   - ✅ **Kiểm tra:** Mở Discord lên, thấy con bot `Vieclam24h QA Bot` xuất hiện trong danh sách thành viên là xong Bước 1!

---

## 🟢 BƯỚC 2: Lấy Mã Kênh Chat & Link Nhận Báo Cáo Trên Discord (Mất 1 phút)

> **🎯 Mục đích:** Chỉ định cho Bot biết nó được phép nhận lệnh ở kênh nào, và bắn kết quả test về kênh nào.

1. **Bật chế độ lấy mã ID trên Discord:**
   - Mở ứng dụng Discord trên máy tính -> Bấm vào biểu tượng **Bánh răng cài đặt (User Settings)** ở góc dưới cùng bên trái (cạnh tên tài khoản).
   - Cuộn menu bên trái xuống tìm mục **Nâng cao (Advanced)**.
   - Gạt công tắc dòng **Chế độ nhà phát triển (Developer Mode)** sang màu xanh (**ON**).
   - Bấm nút `X` góc trên bên phải để đóng cài đặt.
2. **Lấy mã ID kênh nhận lệnh:**
   - Nhìn vào danh sách kênh chat bên trái Discord, **chuột phải vào kênh bạn muốn chat ra lệnh** (ví dụ kênh `#qa-automation`).
   - Bấm chọn dòng cuối cùng: **Sao chép ID kênh (Copy Channel ID)**.
   - 👉 **Quay lại Dashboard:** Dán dãy số vừa copy vào ô **`ALLOWED CHANNEL ID`** (khoảng 18-19 chữ số).
3. **Lấy Link Webhook nhận kết quả báo cáo:**
   - Vẫn tại kênh đó (hoặc kênh muốn nhận kết quả), **chuột phải vào tên kênh** -> Chọn **Chỉnh sửa kênh (Edit Channel)**.
   - Ở cột menu bên trái, bấm vào mục **Tích hợp (Integrations)** -> Chọn mục **Webhooks**.
   - Bấm nút **Tạo Webhook mới (New Webhook)** -> Bấm nút **Sao chép URL Webhook (Copy Webhook URL)**.
   - 👉 **Quay lại Dashboard:** Dán link vừa copy vào ô **`DISCORD WEBHOOK URL`** ở thẻ trên cùng.
   - Bấm nút **"✈ Gửi tin nhắn thử"** trên Dashboard. Nếu Discord có tiếng *Ting* và xuất hiện thẻ báo màu xanh là hoàn thành 100%!

---

## 🟢 BƯỚC 3: Tạo Mật Khẩu Chạy Test Trên GitHub (GitHub Token) (Mất 1.5 phút)

> **🎯 Mục đích:** Cấp quyền cho Bot Discord được phép kích hoạt máy chủ GitHub Actions chạy test từ xa.

1. **Mở trang tạo Token của GitHub:**
   - Truy cập vào trang: [https://github.com/settings/tokens](https://github.com/settings/tokens) *(Đăng nhập tài khoản GitHub nếu được hỏi)*.
2. **Tạo Token:**
   - Bấm nút **Generate new token** (góc trên bên phải) -> Chọn dòng **Generate new token (classic)**.
   - Ở ô **Note**, gõ tên gợi nhớ: `Discord Bot Token`.
   - Ở ô **Expiration** (Hạn dùng), chọn: `No expiration` (Không bao giờ hết hạn).
3. **Chọn 2 quyền bắt buộc:**
   - Tích chọn đúng 2 ô vuông sau:
     - `[x] repo` (Tích vào ô to chữ `repo` ngay ở đầu danh sách).
     - `[x] workflow` (Cuộn xuống tìm dòng chữ `workflow` và tích vào).
4. **Lấy mã Token:**
   - Cuộn xuống tận cùng đáy trang, bấm nút màu xanh lá cây **Generate token**.
   - Bấm vào biểu tượng **2 ô vuông (Copy)** bên cạnh chuỗi ký tự bắt đầu bằng `ghp_...` để sao chép mã Token.
   - 👉 **Quay lại Dashboard:** Dán mã vừa copy vào ô **`GITHUB PERSONAL TOKEN`**.

---

## 🟢 BƯỚC 4: Dán Link Báo Cáo Vào GitHub (Secret) (Mất 1 phút)

> **🎯 Mục đích:** Cho máy chủ GitHub biết link Discord để sau khi chạy test xong, nó tự động bắn kết quả về kênh chat.

1. **Mở trang Secrets của dự án:**
   - Truy cập vào trang: [https://github.com/hadinhkms/Automation_playwright_SV/settings/secrets/actions](https://github.com/hadinhkms/Automation_playwright_SV/settings/secrets/actions).
2. **Tạo Secret mới:**
   - Nhìn lên **góc trên bên phải**, bấm nút màu xanh lá **"New repository secret"**.
   - Điền chính xác 2 ô như sau:
     - **Ô Name (Tên):** Gõ chính xác từng chữ in hoa: `DISCORD_WEBHOOK_URL`
     - **Ô Secret (Giá trị):** Dán lại đường link Discord Webhook URL bạn đã copy ở **Bước 2.3**.
3. Bấm nút màu xanh lá **Add secret** để lưu lại. Xong!

---

## 🟢 BƯỚC 5: Bật Bot & Bắt Đầu Sử Dụng (Mất 30 giây)

> **🎯 Mục đích:** Bật công tắc cho Bot thức dậy và bắt đầu chat ra lệnh trên Discord.

1. **Lưu cấu hình trên Dashboard:**
   - Kiểm tra các ô thông tin ở bảng phía trên Dashboard đã điền đầy đủ.
   - Nhìn lên **góc trên bên phải trang Dashboard**, bấm nút màu xanh **"💾 Lưu cấu hình"**.
2. **Bật Bot chạy (Chỉ cần làm 1 lần):**
   - Mở cửa sổ dòng lệnh (Terminal hoặc PowerShell) trên máy tính.
   - Dán nguyên vẹn dòng lệnh sau rồi bấm **Enter**:
     ```bash
     cd D:\_Automation-Project\discord-qa-bot && node bot.js
     ```
   - ✅ Khi thấy màn hình hiện chữ: `Ready: Vieclam24h QA Bot...` là Bot đã chính thức thức dậy và sẵn sàng!
3. **Trải nghiệm ra lệnh trên Discord:**
   - Mở kênh chat Discord đã cài đặt ở Bước 2, gõ câu lệnh sau rồi bấm gửi:
     ```text
     @Vieclam24h QA Bot run smoke qc
     ```
   - 🎉 **Kết quả:** Bot sẽ trả lời ngay và kích hoạt test trên GitHub. Sau vài phút, thẻ báo cáo kết quả (Pass/Fail) sẽ tự động gửi thẳng về kênh chat cho bạn!
