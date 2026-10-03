# Kế Hoạch 22 — Phase 3: Xây Dựng Showcase Traceability Mẫu & Vệ Sinh Dự Án

> **Plan ID:** `PLAN-22-PHASE-3` · **Cấp độ:** `L3` · **Trạng thái:** `COMPLETED`  
> **Chủ trì:** `@ba` (Đặc tả) / `@tl` (Kỹ thuật) · **Phụ thuộc:** Phase 2 (Đã hoàn thành)

---

## 1. Mục Tiêu Phase
1. Xây dựng bộ dữ liệu Traceability mẫu hoàn chỉnh (`requirements/`, `test-cases/`) gắn với spec thực tế [saucedemo_login.spec.js](file:///d:/_Automation-Project/tests/e2e/desktop/saucedemo_login.spec.js) để Dashboard QA View và Smart Linker hiển thị ma trận sống động ngay khi cài đặt.
2. Vệ sinh cấu hình dự án: Tạo `dashboardConfig.json` ở thư mục gốc, cập nhật [.env.example](file:///d:/_Automation-Project/.env.example) theo nhận diện thương hiệu Hub Engine.
3. Bổ sung `_backup_vieclam24h/` vào `.gitignore` để tránh phình dung lượng git.
4. Đóng gói kiểm định toàn diện chất lượng Gate 4 cho toàn bộ dự án.

---

## 2. Bảng Ngân Sách Dòng Mã & File Tác Động (File Budget)

| Thao Tác | Đường Dẫn File | Dòng Hiện Tại | Dòng Sau Sửa | Thay Đổi Net | Ghi Chú |
|---|---|:---:|:---:|:---:|---|
| Create | `requirements/REQ-001-authentication.md` | 0 | 45 | +45 | Đặc tả tính năng Đăng nhập mẫu |
| Create | `test-cases/REQ-001-authentication.md` | 0 | 48 | +48 | Ma trận Test Case mẫu gắn AC/spec |
| Modify | [tests/e2e/desktop/saucedemo_login.spec.js](file:///d:/_Automation-Project/tests/e2e/desktop/saucedemo_login.spec.js) | 83 | 85 | +2 | Gắn tag `@REQ-001` vào describe và test cases |
| Create | `dashboardConfig.json` | 0 | 172 | +172 | Cấu hình root mẫu chống warning |
| Modify | [.env.example](file:///d:/_Automation-Project/.env.example) | 56 | 56 | 0 | Cập nhật nhãn QA Automation Studio |
| Modify | [.gitignore](file:///d:/_Automation-Project/.gitignore) | 120 | 122 | +2 | Bổ sung `_backup_vieclam24h/` |

*Tất cả file mới tuân thủ nghiêm ngặt chuẩn ngân sách dòng (< 200 dòng).*

---

## 3. Tiêu Chí Nghiệm Thu (Acceptance Criteria & Test Cases)

| Mã AC | Mô Tả Tiêu Chí | Kịch Bản Kiểm Thử (TC) | Kết Quả Mong Đợi |
|---|---|---|---|
| **AC-22-08** | Traceability Showcase hoàn chỉnh | `TC-P3-01`: Chạy `npm run qa:trace` | Quét trúng 1 Requirement, 3 ACs, 3 Test Cases; spec SauceDemo được gắn kết 100%. |
| **AC-22-09** | Không còn major findings trên Hub | `TC-P3-02`: Chạy `npm run qa:check` | 0 finding major; ma trận hiển thị trạng thái xanh. |
| **AC-22-10** | Khử cảnh báo placeholder URL | `TC-P3-03`: Chạy `npx playwright test --list` | Không xuất hiện cảnh báo `[env] ⚠️ baseURL cho môi trường 'qc' vẫn là placeholder`. |
| **AC-22-11** | Nghiệm thu tổng thể Gate 4 | `TC-P3-04`: Chạy full bộ regression | 100% Green trên Playwright E2E, Dashboard API (179 tests), và Unit tests (585 tests, tổng 764 tests). |

---

## 4. Chi Tiết Thực Thi Kỹ Thuật

### 4.1. Cấu trúc `requirements/REQ-001-authentication.md`
- ID: `REQ-001`
- Title: Xác Thực & Quản Lý Đăng Nhập Người Dùng (SauceDemo Showcase)
- Acceptance Criteria:
  - `AC-001`: Đăng nhập thành công với tài khoản tiêu chuẩn.
  - `AC-002`: Chặn đăng nhập và hiển thị lỗi với tài khoản bị khóa.
  - `AC-003`: Xác thực các trường bắt buộc khi để trống thông tin.

### 4.2. Cấu trúc `test-cases/REQ-001-authentication.md`
- Bảng Traceability:
  - `TC-001` -> `AC-001` -> `saucedemo_login.spec.js` (P1 / Automated)
  - `TC-002` -> `AC-002` -> `saucedemo_login.spec.js` (P2 / Automated)
  - `TC-003` -> `AC-003` -> `saucedemo_login.spec.js` (P2 / Automated)

### 4.3. Cập nhật `dashboardConfig.json` ở Root
Sao chép mẫu cấu hình từ [core/config/dashboardConfig.json](file:///d:/_Automation-Project/core/config/dashboardConfig.json) ra thư mục gốc để người dùng có thể điều chỉnh cấu hình môi trường mà không cần can thiệp vào mã nguồn lõi `core/`.

---

## 5. Lệnh Kiểm Chứng Cổng Nghiệm Thu
```powershell
# 1. Kiểm tra QA Traceability ma trận
npm run qa:trace
npm run qa:check

# 2. Kiểm tra bộ kiểm thử hồi quy Dashboard
npm run test:dashboard:regression

# 3. Kiểm tra toàn bộ Playwright E2E tests
npm run suite:desktop
npm run suite:mobile
```
