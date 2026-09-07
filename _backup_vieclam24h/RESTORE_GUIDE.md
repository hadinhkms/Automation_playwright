# Hướng Dẫn Khôi Phục Dữ Liệu Vieclam24h

Thư mục này chứa toàn bộ các kịch bản kiểm thử, page objects, dữ liệu test và cấu hình `.env` của hệ thống **Vieclam24h** được sao lưu trước khi chuyển đổi core engine thành framework đa dự án.

## Danh sách dữ liệu đã sao lưu:
- `tests/`: Gồm toàn bộ 25 test cases E2E (Desktop, Mobile-web) và API của Vieclam24h.
- `pages/`: Gồm toàn bộ Page Object Models (Desktop, Mobile-web) và BasePage gốc của Vieclam24h.
- `data/`: Gồm toàn bộ file dữ liệu test JSON, mẫu CV, hình ảnh test.
- `core/`: Gồm các custom fixtures (`baseTest.js`, `mobileWebTest.js`), utils (`authSetup.js`, `registrationApiHelper.js`), và metadata Page Objects gốc (`core/generator/`).
- `_Plan_implement/`: Toàn bộ file kế hoạch triển khai kiến trúc Visual Step Builder, No-code Data Studio, Object Repository gốc của Vieclam24h.
- `dashboardConfig.json`: Cấu hình môi trường nội bộ QC/Staging của Vieclam24h.
- `.env`: File cấu hình môi trường, tài khoản và URL bí mật của Vieclam24h.

---

## Cách khôi phục lại dự án Vieclam24h:

### Cách 1: Khôi phục bằng PowerShell (Chuẩn xác 100%)
Mở PowerShell tại thư mục gốc của dự án (`d:\_SV_Automation`) và chạy:

```powershell
# 1. Khôi phục thư mục mã nguồn và dữ liệu
robocopy "_backup_vieclam24h\pages" "pages" /E /IS /IT
robocopy "_backup_vieclam24h\data" "data" /E /IS /IT
robocopy "_backup_vieclam24h\core" "core" /E /IS /IT
robocopy "_backup_vieclam24h\tests" "tests" /E /IS /IT
robocopy "_backup_vieclam24h\_Plan_implement" "_Plan_implement" /E /IS /IT

# 2. Khôi phục cấu hình Dashboard Vieclam24h
Copy-Item -Force "_backup_vieclam24h\dashboardConfig.json" "dashboardConfig.json"
Copy-Item -Force "_backup_vieclam24h\dashboardConfig.json" "core\config\dashboardConfig.json"

# 3. Tạo .env nếu chưa có
if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
}

# 4. Dọn dẹp các file mẫu sample template
Remove-Item -Force -ErrorAction SilentlyContinue "tests\e2e\desktop\sample_demo.spec.js"
Remove-Item -Force -ErrorAction SilentlyContinue "tests\e2e\mobile-web\sample_mobile.spec.js"
Remove-Item -Force -ErrorAction SilentlyContinue "tests\api\sample_api.spec.js"
Remove-Item -Force -ErrorAction SilentlyContinue "pages\desktop\SamplePage.js"
Remove-Item -Force -ErrorAction SilentlyContinue "data\sampleData.json"

# 5. Khởi động lại Dashboard server
node dashboard\stop-server.js
node dashboard\start-server.js

Write-Host "Khôi phục dữ liệu Vieclam24h hoàn tất!" -ForegroundColor Green
```

### Cách 2: Khôi phục bằng file tiện ích
Chạy trực tiếp file `_backup_vieclam24h\restore_vieclam24h.bat`.
