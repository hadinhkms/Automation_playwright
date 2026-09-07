# 📘 Hướng Dẫn Cài Đặt & Vận Hành Môi Trường Kiểm Thử (Setup & Operating Guide)

Chào mừng bạn đến với **QA Automation Studio - Playwright Automation Framework**!  
Tài liệu này hướng dẫn chi tiết từng bước thiết lập toàn bộ môi trường làm việc từ con số 0 trên máy tính của bạn trong **15 - 20 phút**, giúp bạn sẵn sàng chạy test, khai thác Dashboard và làm việc hiệu quả với các trợ lý AI tích hợp sẵn.

---

## 🧭 Lộ trình cài đặt tổng quan

```text
[Bước 1: Chuẩn bị Node.js, Git & VS Code]
                  ↓
[Bước 2: Clone Repo, Cài Dependencies & Tạo File .env]
                  ↓
[Bước 3: Tải Trình Duyệt Playwright (Chromium & WebKit)]
                  ↓
[Bước 4: Khởi Động Automation Dashboard (Port 4174)]
                  ↓
[Bước 5: Cấu Hình AI Provider (Gemini / OpenAI / DeepSeek) & Token Quota]
                  ↓
[Bước 6: Khám Phá AI Inline Code Suggestion (Ghost Text, Tab, Esc)]
                  ↓
[Bước 7: Chạy Thử Test Suite Đầu Tiên & Mở Báo Cáo HTML]
                  ↓
[Bước 8: Kiểm Tra Quy Chuẩn Framework & Checklist Nghiệm Thu]
```

---

## 🛠️ Bước 1: Chuẩn bị công cụ nền tảng

Trước khi bắt đầu, máy tính của bạn cần được cài đặt các công cụ cơ bản sau:

### 1.1. Cài đặt Node.js (Môi trường thực thi JavaScript)
- **Yêu cầu phiên bản**: Node.js **18.x LTS**, **20.x LTS** hoặc **22.x LTS** (khuyên dùng Node.js 20 LTS).
- **Cách cài đặt**:
  1. Truy cập trang chủ: [https://nodejs.org](https://nodejs.org)
  2. Tải bản cài đặt **LTS (Long Term Support)** cho hệ điều hành của bạn (Windows x64 / macOS).
  3. Mở file tải về và nhấn *Next* theo tùy chọn mặc định cho đến khi hoàn tất.
- **Kiểm tra sau khi cài đặt**: Mở Terminal (PowerShell trên Windows, hoặc Terminal trên macOS) và chạy:
  ```bash
  node -v
  npm -v
  ```
  *(Kết quả hiển thị `v18.x`, `v20.x` hoặc `v22.x` và `npm >= 9.x` là đạt chuẩn).*

### 1.2. Cài đặt Git (Hệ thống quản lý mã nguồn)
- **Cách cài đặt**: Tải tại [https://git-scm.com/downloads](https://git-scm.com/downloads) và cài đặt theo các bước mặc định.
- **Kiểm tra**:
  ```bash
  git --version
  ```

### 1.3. Trình soạn thảo mã nguồn khuyên dùng: Visual Studio Code (VS Code)
- Tải tại: [https://code.visualstudio.com/](https://code.visualstudio.com/)
- **Các tiện ích mở rộng (Extensions) nên cài đặt**:
  - `Playwright Test for VSCode` (hỗ trợ chạy, debug kịch bản test trực quan).
  - `Prettier - Code formatter` (tự động căn lề và định dạng code chuẩn).
  - `ESLint` (phát hiện lỗi cú pháp và cảnh báo quy chuẩn mã nguồn).
  - `GitLens` (hỗ trợ theo dõi lịch sử commit Git dễ dàng).

---

## 📦 Bước 2: Lấy mã nguồn dự án & Cài đặt thư viện

### 2.1. Clone dự án về máy tính
Mở terminal và di chuyển vào thư mục làm việc của bạn (ví dụ `D:\Projects` hoặc `~/Projects`):
```bash
# Clone dự án về máy
git clone <URL_REPOSITORY_CUA_DU_AN>

# Di chuyển vào thư mục dự án
cd _Automation-Project
```

### 2.2. Cài đặt các thư viện phụ thuộc (Dependencies)
Dự án sử dụng các gói thư viện được khai báo trong file `package.json`. Chạy lệnh sau để cài đặt:
```bash
npm install
```
> ⏱️ *Quá trình này mất khoảng 1 - 2 phút tùy tốc độ mạng. Khi hoàn tất, terminal sẽ hiển thị thông báo thành công mà không có lỗi màu đỏ.*

### 2.3. Tạo file cấu hình môi trường `.env`
Dự án cung cấp sẵn file mẫu [`.env.example`](file:///.env.example). Bạn hãy sao chép thành file `.env` tại thư mục gốc:

- **Trên Windows PowerShell**:
  ```powershell
  Copy-Item .env.example .env
  ```
- **Trên Bash / macOS / Linux**:
  ```bash
  cp .env.example .env
  ```

Nội dung cơ bản của file `.env`:
```env
# Nhà cung cấp AI mặc định: gemini, openai, hoặc deepseek
AI_PROVIDER=gemini

# Google Gemini API Key (Lấy miễn phí tại https://aistudio.google.com/)
GEMINI_API_KEY=AIzaSy...

# Mô hình AI sử dụng
AI_MODEL=gemini-2.5-flash

# Cổng chạy Dashboard
DASHBOARD_PORT=4174

# Môi trường kiểm thử mặc định: qc, stg, hoặc prod
NODE_ENV=qc
```

> [!TIP]
> Bạn có thể chạy ngay hệ thống với tài khoản cá nhân thông qua tab **Cấu hình** trên giao diện Dashboard mà không bắt buộc phải sửa file `.env` chung (xem chi tiết tại Bước 5).

---

## 🌐 Bước 3: Cài đặt trình duyệt Playwright

Playwright quản lý các engine trình duyệt chuyên biệt, độc lập với trình duyệt Chrome/Edge cá nhân của bạn nhằm bảo đảm môi trường chạy test luôn sạch và đồng nhất:

```bash
npx playwright install chromium webkit
```

- **`chromium`**: Dành cho kịch bản Web Desktop và Mobile Chrome mô phỏng (Android).
- **`webkit`**: Dành cho kịch bản Web Desktop Safari và Mobile Safari mô phỏng (iPhone/iPad).

> 💡 **Lưu ý trên Linux/WSL**: Nếu chạy trên Ubuntu/Debian hoặc WSL, bạn có thể cần cài thêm dependencies hệ thống bằng lệnh: `npx playwright install-deps`.

---

## 🚀 Bước 4: Khởi động Automation Dashboard & Làm quen

Dự án tích hợp sẵn **Automation Dashboard** – cổng điều khiển tập trung giúp bạn chạy test, quản lý kịch bản BDD, chỉnh sửa Page Objects, theo dõi Token Quota và sử dụng AI Agent.

### 4.1. Cách khởi động Dashboard:
- **Cách 1 (Khuyên dùng trên Windows)**: Nhấp đúp chuột vào file **`Start_Dashboard.bat`** ở thư mục gốc dự án.
- **Cách 2 (Chạy nền - Background Daemon)**:
  ```bash
  npm run dashboard:start
  ```
- **Cách 3 (Chạy trực tiếp trong Terminal - Foreground)**:
  ```bash
  npm run dashboard
  ```

Sau khi khởi động, trình duyệt sẽ tự động mở trang Dashboard tại địa chỉ:  
👉 **[http://127.0.0.1:4174](http://127.0.0.1:4174)**

### 4.2. Khám phá các khu vực chức năng:

| Khu vực / Tab | Chức năng chính |
| :--- | :--- |
| **Thanh Header Cố định** | Chứa logo, nút tài liệu **"Hướng dẫn"**, nút chuyển **Theme Sáng/Tối**, và **Pill theo dõi % Token Quota** thời gian thực. |
| **▶️ Chạy test (`runner-view`)** | Chọn Test Suite (Smoke, Regression, Mobile...), chọn file `.spec.js`, bật/tắt chế độ hiện browser (`--headed`), lọc theo thẻ `@tag`, và bấm nút **Chạy test**. |
| **🌳 Kịch bản test (BDD)** | Xem danh sách scenarios Gherkin (Given - When - Then), Wizard tạo kịch bản mới, và trình chỉnh sửa code Step Definition có hỗ trợ **AI Inline Suggestion**. |
| **🖥️ Quản lý Page (`pages-view`)** | Quản lý cây thư mục Page Objects (`pages/`), kiểm tra locators, methods và chỉnh sửa mã nguồn trực tiếp. |
| **📊 Báo cáo & evidence** | Xem lịch sử các lượt chạy test, mở Playwright HTML Report, tải video và screenshot bằng chứng lỗi. |
| **🤖 AI Agent (`agent-view`)** | Trợ lý AI tự hành hỗ trợ phân tích spec, sửa lỗi locator, giải thích code và kiểm tra trạng thái Token Quota chi tiết. |
| **⚙️ Cấu hình (`settings-view`)** | Cấu hình AI Provider cá nhân (lưu `localStorage`), chỉnh timeout, cấu hình Discord Bot và đọc các tài liệu framework. |

### 4.3. Cách tắt Dashboard khi hoàn thành công việc:
- Nhấp đúp vào file **`Stop_Dashboard.bat`**, hoặc chạy lệnh:
  ```bash
  npm run dashboard:stop
  ```

---

## 🤖 Bước 5: Cấu hình AI Provider, Mô hình & Giám sát Quota Token

Hệ thống hỗ trợ cơ chế đa nhà cung cấp AI (**Google Gemini**, **OpenAI**, **DeepSeek**) phục vụ cả AI Agent tự hành và AI Inline Code Suggestion trong trình soạn thảo.

### 5.1. Nhận API Key miễn phí (Khuyên dùng Google Gemini):
1. Truy cập [Google AI Studio](https://aistudio.google.com/).
2. Đăng nhập bằng tài khoản Google và nhấn **"Get API key"** -> **"Create API key"**.
3. Sao chép chuỗi khóa API (bắt đầu bằng `AIzaSy...`).
   *(Google Gemini cung cấp gói miễn phí Free Tier hoàn toàn đầy đủ cho nhu cầu kiểm thử cá nhân).*

### 5.2. Hai phương thức cấu hình AI linh hoạt:

#### Cách A: Cấu hình cá nhân trên Dashboard (Khuyên dùng cho thành viên nhóm)
> 🌟 **Ưu điểm**: Khóa API và cấu hình được lưu cục bộ trong trình duyệt của riêng bạn (`localStorage`), **hoàn toàn không chạm vào file `.env`**, không lo xung đột mã nguồn khi commit Git, và mỗi thành viên có thể dùng hạn mức riêng của mình.

1. Trên Dashboard, chuyển sang tab **⚙️ Cấu hình** -> cuộn đến phần **🤖 AI Agent & Mô hình**.
2. Bật công tắc: **"Sử dụng cấu hình cá nhân (lưu trên máy này, không sửa file .env)"**.
3. Chọn nhà cung cấp: **Google Gemini**, **OpenAI**, hoặc **DeepSeek**.
4. Dán API Key cá nhân của bạn vào ô nhập.
5. Chọn hoặc nhập tên mô hình:
   - `gemini-2.5-flash` (Mặc định cân bằng tốc độ và chất lượng).
   - `gemini-flash-lite-latest` (Siêu nhanh, độ trễ cực thấp, tiết kiệm tối đa quota).
6. Nhấn nút **"Kiểm tra kết nối"**: Hệ thống sẽ gửi yêu cầu thử nghiệm trực tiếp và hiển thị thông báo xanh: *"Kết nối thành công!"*.

#### Cách B: Cấu hình hệ thống qua file `.env`
Dành cho máy chủ CI/CD hoặc người quản trị muốn thiết lập mặc định cho toàn bộ dự án:
```env
AI_PROVIDER=gemini
GEMINI_API_KEY=AIzaSy...
AI_MODEL=gemini-2.5-flash
```

### 5.3. Theo dõi hạn mức Token (% Token Quota) trên Header:
- **Pill hiển thị trên Header chính**:
  Ngay trên thanh điều hướng đầu trang (cạnh nút *Hướng dẫn*), bạn sẽ thấy huy hiệu Token thời gian thực (ví dụ: `⚡ 100% Token`).
- **Màu sắc trạng thái**:
  - 🟢 **Xanh lá (> 50%)**: Hạn mức token dồi dào, sẵn sàng thực hiện các tác vụ phức tạp.
  - 🟡 **Vàng cam (20% - 50%)**: Đang tiêu thụ nhiều token trong phút hiện tại, nên giãn cách các lần gọi.
  - 🔴 **Đỏ (< 20%)**: Sắp chạm ngưỡng giới hạn (Rate Limit), hệ thống sẽ đếm ngược thời gian hồi phục.
- **Tự động hồi phục**: Hạn mức token tính theo cửa sổ trượt 60 giây (Rolling Window) và tự động làm mới lại 100% sau mỗi phút.
- **Xem chi tiết**: Nhấp chuột trực tiếp vào huy hiệu Token trên Header để mở ngay tab **AI Agent** xem biểu đồ Quota, số lượng requests/phút (RPM), tokens/phút (TPM) và lịch sử tác vụ.

---

## ⚡ Bước 6: Hướng dẫn sử dụng AI Inline Code Suggestion trong Editor

Khi bạn viết mã nguồn kiểm thử trong **Kịch bản test (BDD)** (Step Implementation) hoặc **Quản lý Page**, tính năng **AI Inline Suggestion** sẽ tự động phân tích ngữ cảnh và hiển thị đoạn code tiếp theo dưới dạng chữ xám mờ (**Ghost Text**).

### 6.1. Các phím tắt điều khiển:

| Phím tắt | Thao tác | Mô tả |
| :---: | :--- | :--- |
| <kbd>Tab</kbd> | **Chấp nhận gợi ý** | Chèn toàn bộ đoạn code gợi ý mờ vào vị trí con trỏ và tự động định dạng. |
| <kbd>Esc</kbd> | **Hủy bỏ gợi ý** | Đóng gợi ý mờ hiện tại mà không làm ảnh hưởng đến mã nguồn đang viết. |
| <kbd>Ctrl</kbd> + <kbd>Space</kbd> | **Gọi gợi ý thủ công** | Kích hoạt AI phân tích ngữ cảnh ngay lập tức tại vị trí con trỏ. |

### 6.2. Huy hiệu trạng thái AI (Floating Status Pill):
Ở góc dưới bên phải của mỗi trình soạn thảo mã nguồn có một huy hiệu trạng thái:
- `AI Ready`: Sẵn sàng nhận diện khi bạn gõ phím.
- `AI Thinking...`: Đang phân tích ngữ cảnh mã nguồn.
- `Tab chèn`: Đoạn code gợi ý đã sẵn sàng, chỉ cần nhấn <kbd>Tab</kbd>.
- `AI Tắt`: Tính năng đang tạm dừng.
- 👉 **Bật/Tắt nhanh**: Nhấp chuột trực tiếp vào huy hiệu này để bật hoặc tắt tính năng bất kỳ lúc nào.

### 6.3. Cơ chế thông minh với Chú thích (Comment `//`):
Trình gợi ý được tối ưu đặc biệt để hiểu ý định của kỹ sư QA thông qua chú thích:
1. **Khi bạn đang gõ dở lời chú thích**:  
   Ví dụ gõ: `// Kiểm tra thông báo hiển thị`  
   AI sẽ gợi ý phần chữ tiếp theo của câu mô tả trên cùng dòng để bạn hoàn thiện ý diễn đạt.
2. **Khi bạn viết chú thích hành động kiểm thử (Action Comment)**:  
   Ví dụ gõ: `// Click nút đăng nhập và chờ chuyển trang`  
   AI nhận diện đây là hành động cần thực thi và sẽ **tự động sinh mã code Playwright xuống dòng mới (`\n`)** kèm thụt lề chuẩn xác:
   ```javascript
   // Click nút đăng nhập và chờ chuyển trang
   await page.locator('#login-button').click();
   await page.waitForURL('**/dashboard');
   ```

### 6.4. Tốc độ phản hồi cực nhanh (0ms Local Match):
- Hệ thống áp dụng công nghệ đệm 3 tầng: Khớp tiền tố 0ms ngay trên trình duyệt, thư viện mẫu cú pháp Playwright phổ biến, bộ nhớ đệm thông minh LRU Cache, và cơ chế gửi API với debounce thích ứng.

---

## 🧪 Bước 7: Chạy thử kịch bản Test & Xem Báo cáo

### 7.1. Chạy test từ giao diện Dashboard (Đơn giản nhất):
1. Mở tab **▶️ Chạy test**.
2. Tại dropdown *Kịch bản Test Suite*, chọn **`Smoke Tests (Đăng ký nhanh)`**.
3. Tích chọn ô **"Hiện browser"** để xem Playwright mở trình duyệt và thao tác tự động.
4. Nhấn nút màu tím **"Chạy test"** và quan sát tiến trình trên console log.

### 7.2. Chạy test từ dòng lệnh Terminal:
Mở terminal tại thư mục dự án:
```bash
# Chạy bộ Smoke Tests cơ bản (nhanh nhất)
npm run suite:smoke

# Chạy toàn bộ Regression Tests
npm run suite:regression

# Chạy kịch bản Desktop
npm run suite:desktop

# Chạy kịch bản Mobile (Chrome Android & Safari iOS)
npm run suite:mobile

# Chạy kịch bản API
npm run suite:api
```

### 7.3. Chạy giao diện tương tác Playwright UI Mode:
```bash
npm run test:ui
```
*(Chế độ này cho phép bạn xem từng bước thao tác (Time-travel debugging), xem DOM snapshot và inspect element trực tiếp).*

### 7.4. Xem Báo cáo kết quả kiểm thử (HTML Report):
Sau khi kịch bản kết thúc, để mở báo cáo tổng quan:
```bash
npm run report
```
Hoặc trên Dashboard, bạn chỉ cần chuyển sang tab **📊 Báo cáo & evidence** để xem danh sách báo cáo theo ngày cùng hình ảnh/video bằng chứng lỗi.

---

## 📏 Bước 8: Kiểm tra quy chuẩn Framework (Quality Gate)

Dự án áp dụng quy chuẩn kiểm thử nghiêm ngặt theo mô hình Page Object Model (POM) và tiêu chuẩn chất lượng của Senior QA:

```bash
npm run check:framework
```

Bộ quy chuẩn tự động kiểm tra các lỗi thường gặp:
- ❌ **Không hardcode URL**: Mọi URL trang web phải lấy qua `baseURL` cấu hình môi trường trong `core/config/env.js`.
- ❌ **Không dùng `waitForTimeout()`**: Phải sử dụng wait tự động của Playwright (`waitForSelector`, `toBeVisible()`, v.v.).
- ❌ **Không nuốt lỗi**: Không được viết block `catch {}` rỗng làm sai lệch kết quả kiểm thử.
- ❌ **Đúng cấu trúc POM**: Tách bạch giữa Spec kịch bản (`tests/`) và hành vi của trang (`pages/`).

---

## ⚠️ Bước 9: Xử lý sự cố thường gặp (Troubleshooting)

| Tình huống / Thông báo lỗi | Nguyên nhân | Cách xử lý |
| :--- | :--- | :--- |
| **`Port 4174 is already in use`** | Phiên Dashboard trước đó vẫn đang chạy nền | Nhấp đúp vào `Stop_Dashboard.bat` hoặc chạy lệnh: `npm run dashboard:stop`. |
| **`Lỗi 429: Resource exhausted / Quota exceeded`** | Hạn mức gọi API miễn phí trong 1 phút bị vượt quá | Chờ khoảng 30 - 60 giây để cửa sổ Quota hồi phục, hoặc vào tab **Cấu hình** chuyển sang model nhẹ hơn (`gemini-flash-lite-latest`), hoặc nhập API key cá nhân khác. |
| **`playwright: command not found`** hoặc thiếu trình duyệt | Chưa tải browser engine của Playwright | Chạy lệnh: `npx playwright install chromium webkit`. |
| **`File cannot be loaded because running scripts is disabled`** (PowerShell) | Chính sách bảo mật mặc định của Windows hạn chế chạy file script | Mở PowerShell với quyền Administrator và chạy: `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser`, nhấn `Y` để đồng ý. |
| **Gợi ý AI Inline không xuất hiện trong Editor** | Tính năng đang bị tắt hoặc chưa cấu hình API Key | 1. Kiểm tra huy hiệu góc phải dưới editor có đang ở trạng thái `AI Tắt` không (click vào để bật).<br>2. Vào tab **Cấu hình** kiểm tra API Key đã hợp lệ chưa bằng nút *Kiểm tra kết nối*. |
| **Chạy test gặp lỗi kết nối môi trường QC/STG** | Chưa cấu hình biến môi trường `NODE_ENV` | Thêm biến môi trường trước khi chạy, ví dụ: `$env:NODE_ENV="qc"; npm run suite:smoke` (PowerShell) hoặc `NODE_ENV=qc npm run suite:smoke` (Bash). |

---

## ✅ Bước 10: Checklist nghiệm thu môi trường

Hãy tích chọn đầy đủ các mục dưới đây để xác nhận máy tính của bạn đã sẵn sàng 100%:

- [ ] Lệnh `node -v` hiển thị phiên bản `>= 18.0.0`.
- [ ] Lệnh `npm -v` hiển thị phiên bản `>= 9.0.0`.
- [ ] Đã chạy `npm install` thành công (có thư mục `node_modules`).
- [ ] Đã có file `.env` (sao chép từ `.env.example`).
- [ ] Đã chạy `npx playwright install chromium webkit`.
- [ ] Khởi động được Dashboard qua `Start_Dashboard.bat` hoặc `npm run dashboard:start` tại `http://127.0.0.1:4174`.
- [ ] Huy hiệu `% Token Quota` hiển thị trên Header chính và kết nối AI thành công trong tab Cấu hình.
- [ ] Tính năng **AI Inline Suggestion** hoạt động (nhận diện Ghost text và chèn bằng phím <kbd>Tab</kbd>).
- [ ] Chạy thử thành công kịch bản `npm run suite:smoke`.
- [ ] Lệnh `npm run check:framework` báo đạt chuẩn (PASS).

---

> 💡 **Hỗ trợ thêm**: Nếu bạn gặp bất kỳ vướng mắc nào trong quá trình thiết lập, hãy chụp ảnh màn hình terminal hoặc Dashboard và liên hệ Technical Lead / Maintainer của framework để được hỗ trợ kịp thời. Chúc bạn có trải nghiệm làm việc năng suất và tuyệt vời!
