# Điểm Nóng Hồi Quy & Cạm Bẫy (Regression Hotspots)

> [!WARNING]
> Tổng hợp các lỗi và điểm nóng hay gặp trong Playwright Automation của dự án, trích xuất từ [TEST_AUTOMATION_LESSONS.md](file:///d:/_SV_Automation/ai/shared/TEST_AUTOMATION_LESSONS.md).

## 1. Onboarding Overlay & Modal Chặn Tương Tác
- **Hiện tượng:** Sau khi đăng nhập, Onboarding modal overlay xuất hiện và intercept pointer event / che khuất element trên trang chủ.
- **Giải pháp:** Luôn gọi `onboardingPopup.closeIfVisible()` trong bước Given / Precondition trước khi assert element trang chủ.

## 2. Union Selector Cho Logo & Icon Thương Hiệu
- **Hiện tượng:** Trang web cập nhật hiển thị logo từ inline SVG sang thẻ `<img>`, dẫn đến locator chờ strictly `svg` bị Timeout.
- **Giải pháp:** Dùng resilient union selector: `page.locator('a[href="/"] img, a[href="/"] svg').first()`.

## 3. Strict Mode Violation Trên Menu Tài Khoản
- **Hiện tượng:** Regex tìm button `avt_invalid|tài khoản|hồ sơ` match trúng nút CTA "Tạo hồ sơ ngay" trên banner.
- **Giải pháp:** Thu hẹp regex thành `/avt_invalid|tài khoản/i` và gắn `.first()`.

## 4. Modal Gợi Ý Không Bắt Buộc Sau Nộp Đơn (Post-Apply Recommendation Dialog)
- **Hiện tượng:** Chờ bắt buộc popup "Xem thêm việc gợi ý" nhưng luồng thực tế có thể đóng thẳng hoặc chuyển trang.
- **Giải pháp:** Xử lý popup gợi ý như optional step với finite timeout bọc trong `try/catch`.
