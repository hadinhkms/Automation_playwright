# Hướng Dẫn Khôi Phục Dữ Liệu Vieclam24h

Thư mục này chứa toàn bộ các kịch bản kiểm thử, page objects, dữ liệu test và cấu hình `.env` của hệ thống **Vieclam24h** được sao lưu trước khi chuyển đổi core engine thành framework đa dự án.

## Danh sách dữ liệu đã sao lưu:
- `tests/`: Gồm toàn bộ test cases E2E (Desktop, Mobile-web) và API.
- `pages/`: Gồm toàn bộ Page Object Models (Desktop, Mobile-web) và BasePage gốc.
- `data/`: Gồm toàn bộ file dữ liệu test JSON, mẫu CV, hình ảnh test.
- `.env`: File cấu hình môi trường, tài khoản và URL bí mật của Vieclam24h.

---

## Cách khôi phục lại dự án Vieclam24h:

### Cách 1: Khôi phục bằng PowerShell (1-Click)
Mở PowerShell tại thư mục gốc của dự án (`d:\_Automation-Project`) và chạy:

```powershell
Copy-Item -Recurse -Force "_backup_vieclam24h/tests/*" "tests/"
Copy-Item -Recurse -Force "_backup_vieclam24h/pages/*" "pages/"
Copy-Item -Recurse -Force "_backup_vieclam24h/data/*" "data/"
if (Test-Path "_backup_vieclam24h/.env") { Copy-Item -Force "_backup_vieclam24h/.env" ".env" }
Write-Host "Khôi phục dữ liệu Vieclam24h hoàn tất!" -ForegroundColor Green
```

### Cách 2: Khôi phục thủ công
Chép đè các thư mục tương ứng từ `_backup_vieclam24h/` sang thư mục gốc của dự án.
