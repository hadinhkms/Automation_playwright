# Motion Choreography & Transitions Standard

> **Mặc định của Hub, chưa phải quy ước đã duyệt của dự án.** Bootstrap (Prompt 10) đối chiếu với code và design thật: giữ, sửa hoặc bỏ từng mục, rồi xóa dòng này.

> [!IMPORTANT]
> Quy chuẩn chuyển động giao diện (Motion), đường cong Bezier tự nhiên, chống giật layout (Zero CLS) và phản hồi xúc giác thị giác (Haptic-like visual response).

## 1. Nguyên Tắc Chuyển Động Cốt Lõi
- **Chuyển động có mục đích (Intentional Motion):** Chuyển động dùng để hướng dẫn sự chú ý và phản hồi trạng thái, tuyệt đối không lạm dụng hiệu ứng bay lượn làm chậm thao tác người dùng.
- **Thời lượng vàng (Goldilocks Duration):**
  - Tương tác vi mô (Hover, Focus, Press): `100ms - 150ms`.
  - Thành phần giao diện (Dropdown, Tooltip, Toast, Tab switch): `150ms - 200ms`.
  - Cấu trúc màn hình (Modal, Drawer, Accordion expand): `250ms - 300ms`.

## 2. Hệ Thống Đường Cong Bezier Chuẩn (Easing Curves)
Toàn bộ transition/animation phải dùng đường cong Bezier chuẩn hóa:
- **`--ease-standard`:** `cubic-bezier(0.4, 0, 0.2, 1)` - Dùng cho hover màu, viền, icon rotation.
- **`--ease-out-smooth`:** `cubic-bezier(0.16, 1, 0.3, 1)` - Hiệu ứng xuất hiện mượt mà như iOS cho Modal, Drawer, Bottom sheet.
- **`--ease-spring`:** `cubic-bezier(0.34, 1.56, 0.64, 1)` - Hiệu ứng nảy nhẹ tự nhiên cho Toast pop, Checkmark tick, Icon like.
- **`--ease-in-exit`:** `cubic-bezier(0.4, 0, 1, 1)` - Biến mất nhanh khi đóng modal hoặc xóa phần tử khỏi DOM.

## 3. Các Mẫu Chuyển Động Thực Chiến (Signature Motion Patterns)
- **Nút bấm phản hồi xúc giác (Press Effect):**
  `button:active { transform: scale(0.98); transition: transform 80ms ease-out; }`
- **Skeleton Shimmer (Vệt sóng tải ngầm):**
  Hiển thị dải gradient chạy ngang qua nền xám nhạt (`linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)`), chu kỳ `1.5s infinite`.
- **Mở rộng Accordion mượt mà (Zero Layout Shift):**
  Sử dụng kỹ thuật CSS Grid `grid-template-rows: 0fr -> 1fr` với `transition: grid-template-rows 250ms var(--ease-out-smooth)` để nội dung mở ra không giật cục.
- **Stagger Animation cho Danh sách:**
  Khi tải danh sách thẻ (Cards list), mỗi phần tử xuất hiện lệch nhau `40ms` (`animation-delay: calc(var(--index) * 40ms)`), tạo cảm giác mượt mà và cao cấp.

## 4. Bảo Vệ Trợ Năng (Reduced Motion Support)
Mọi hiệu ứng chuyển động bắt buộc phải tôn trọng cài đặt giảm chuyển động của hệ điều hành:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```
