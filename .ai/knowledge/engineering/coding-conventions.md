# Tiêu Chuẩn Viết Mã (Coding Conventions)

> [!IMPORTANT]
> Toàn bộ mã nguồn kiểm thử và tiện ích trong dự án phải tuân thủ nghiêm ngặt các quy tắc dưới đây. Kiểm tra tự động bằng lệnh: `npm run check:framework`.

## 1. Quy Tắc Bắt Buộc Trong Test Specs (`tests/e2e/**/*.spec.js`)
1. **Tuân thủ mô hình Page Object Model (POM)**:
   - Nghiêm cấm gọi trực tiếp `page.locator()`, `page.getByRole()`, `page.getByLabel()`, `page.getByPlaceholder()`, `page.getByTestId()`, `page.getByText()`, `page.screenshot()`, `page.evaluate()` trong file spec.
   - Toàn bộ locator và UI interaction phải nằm trong Page Object (`pages/`). File spec chỉ điều phối action cấp cao và assertion hành vi.
2. **Không import `fs` trong spec**:
   - Mọi thao tác I/O, chụp ảnh evidence hoặc đọc file phải thông qua helper trong `core/utils/`.
3. **Cấu trúc BDD rõ ràng**:
   - Mỗi scenario độc lập trong 1 `test()`.
   - Các bước kịch bản phải đặt trong `await test.step('Given ...' | 'When ...' | 'Then ...', async () => {})`.
   - Bắt buộc khai báo Precondition metadata bằng `testInfo.annotations.push({ type: 'Precondition', description: '...' })`.
   - Bước `Given` phải kiểm tra trạng thái khởi điểm và chụp bằng chứng ban đầu (evidence capture).

## 2. Quy Tắc Page Object & Framework Core
1. **Tuyệt đối cấm `page.waitForTimeout()`**:
   - Không được dùng hard wait (`waitForTimeout`). Phải sử dụng smart wait của Playwright: `waitFor({ state: 'visible' })`, `waitForURL()`, hoặc web assertions `await expect(locator).toBeVisible()`.
2. **Cấm nuốt lỗi âm thầm**:
   - Tuyệt đối không viết `.catch(() => {})` làm mất dấu vết lỗi kiểm thử.
3. **Không dùng API Private**:
   - Cấm truy cập `page.context()._options` hoặc các thuộc tính nội bộ bắt đầu bằng dấu gạch dưới `_`.
4. **Resilient Locators**:
   - Sử dụng locator bền vững theo vai trò: `getByRole`, `getByLabel`. Tránh phụ thuộc cứng vào cấu trúc thẻ HTML nếu có thể thay đổi (ví dụ: dùng union selector `img, svg` cho logo thương hiệu).
   - Base locator cho nút tài khoản phải tránh overbroad regex để không xung đột strict mode (`getByRole('button', { name: /avt_invalid|tài khoản/i }).first()`).

## 3. Dashboard Web Studio (`dashboard/`)
1. **Giữ nguyên kiến trúc Vanilla**:
   - Sử dụng Vanilla HTML5, CSS3, JavaScript. Tránh đưa các framework như React/Vue/Tailwind vào nếu không có yêu cầu rõ ràng.
2. **Tái sử dụng Design Primitives**:
   - Tái sử dụng design tokens, layout, panels, và code editor có sẵn trong `dashboard/`.
