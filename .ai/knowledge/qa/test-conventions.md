# Quy Ước Kiểm Thử (Test Conventions)

> [!NOTE]
> Tiêu chuẩn thiết kế và thực thi kịch bản tự động hóa Playwright E2E.

## 1. Thiết Kế Scenario (BDD Gherkin)
- **Cấu trúc 3 thì:**
  - `Given`: Thiết lập tiền điều kiện, xác thực trạng thái trang ban đầu và chụp ảnh evidence mốc xuất phát.
  - `When`: Chuỗi hành vi người dùng thao tác qua các method của Page Object.
  - `Then`: Kiểm chứng kết quả mong đợi (UI assertion, URL, trạng thái dữ liệu).
- **Metadata Bắt Buộc:**
  ```javascript
  testInfo.annotations.push({
    type: 'Precondition',
    description: 'Người dùng đã đăng nhập hoặc khách vãng lai...'
  });
  ```

## 2. Phân Chia Nền Tảng (Platform Projects)
- **Desktop Projects:** `Desktop Smoke Tests`, `Desktop Regression Tests`
- **Mobile Projects:** `Mobile Chrome Smoke/Regression Tests`, `Mobile Safari Smoke/Regression Tests`
- Không trộn lẫn logic selector desktop và mobile vào chung một branch mà không xử lý responsive phù hợp.

## 3. Quản Lý Dữ Liệu & Bằng Chứng (Data & Evidence)
- Mọi bằng chứng kiểm thử (screenshots, logs) được lưu trữ có tổ chức qua `core/utils/commonUtils.js`.
- Bằng chứng không commit trực tiếp lên git (nằm trong thư mục ignore: `/evidence/`, `/playwright-report/`, `/test-results/`).
