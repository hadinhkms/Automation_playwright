# Design System & Design Tokens Standard

> **Mặc định của Hub, chưa phải quy ước đã duyệt của dự án.** Bootstrap (Prompt 10) đối chiếu với code và design thật: giữ, sửa hoặc bỏ từng mục, rồi xóa dòng này.

> [!IMPORTANT]
> Bộ token mặc định: màu ngữ nghĩa (Semantic Tokens), chiều sâu không gian (Elevation), typography và z-index.

## 1. Hệ Thống Token Màu Sắc Ngữ Nghĩa (Semantic Color Tokens)
Toàn bộ màu sắc phải sử dụng biến CSS variables / HSL, không hardcode hex trực tiếp. Mọi cặp chữ/nền dưới đây đạt WCAG AA ≥ 4.5:1 trên `--bg-canvas`, `--bg-surface` và `--bg-surface-elevated`; đổi màu thì đo lại:
- `--bg-canvas`: Nền chính ứng dụng (Light: `hsl(0 0% 100%)` / Dark: `hsl(222 47% 7%)`).
- `--bg-surface`: Nền thẻ, panel, sidebar (Light: `hsl(0 0% 98%)` / Dark: `hsl(222 47% 11%)`).
- `--bg-surface-elevated`: Nền modal, popover, dropdown (Light: `hsl(0 0% 100%)` / Dark: `hsl(223 47% 14%)`).
- `--bg-glass`: Nền kính mờ (Light: `hsl(0 0% 100% / 0.8)` / Dark: `hsl(222 47% 11% / 0.8)`).
- `--border-subtle`: Viền chia tách mờ (Light: `hsl(214 32% 91%)` / Dark: `hsl(217 33% 18%)`).
- `--border-active`: Viền khi tương tác/active (Light: `hsl(221 83% 53% / 0.5)` / Dark: `hsl(217 91% 60% / 0.5)`).
- `--text-primary`: Chữ chính, độ tương phản cao (Light: `hsl(222 47% 11%)` / Dark: `hsl(210 40% 98%)`).
- `--text-secondary`: Chữ phụ, nhãn mô tả (Light: `hsl(215 16% 35%)` / Dark: `hsl(215 20% 75%)`).
- `--text-muted`: Chữ chú thích, placeholder (Light: `hsl(215 16% 47%)` / Dark: `hsl(215 20% 65%)`).
- `--color-primary`: Hành động chính (Light: `hsl(221 83% 53%)` / Dark: `hsl(217 91% 60%)`).
- `--on-primary`, `--on-danger`: Chữ trên nền nút `primary` / `danger` (Light: `hsl(0 0% 100%)` / Dark: `hsl(222 47% 7%)`; chữ trắng trên primary tối chỉ đạt 3.6:1).
- `--color-danger`: Thao tác nguy hiểm, lỗi (Light: `hsl(0 72% 45%)` / Dark: `hsl(0 91% 71%)`).
- `--color-success`: Trạng thái thành công (Light: `hsl(142 72% 29%)` / Dark: `hsl(142 69% 58%)`).
- `--color-warning`: Cảnh báo, tiến trình (Light: `hsl(26 90% 37%)` / Dark: `hsl(43 96% 56%)`).

## 2. Chiều Sâu Không Gian (Elevation)
- **Hiệu ứng Kính Mờ (tùy chọn, chỉ khi design system của dự án dùng):** Dùng cho floating toolbar, modal header: `backdrop-filter: blur(12px); background: var(--bg-glass);`.
- **Focus Ring:** `--focus-ring: 0 0 0 2px var(--bg-canvas), 0 0 0 4px var(--color-primary);` (viền đặc, primary so với canvas ≥ 5:1, đạt mức 3:1 của WCAG 1.4.11; viền mờ `/ 0.25` chỉ đạt ~1.4:1).
- **Thang đo Bóng đổ (Shadow System):**
  - Card/Panel: `box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);`
  - Dropdown/Popover: `box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);`
  - Modal/Dialog: `box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.25), 0 8px 10px -6px rgb(0 0 0 / 0.25);`

## 3. Thang Đo Typography & Khoảng Cách (8pt Grid)
- **Grid Spacing:** Áp dụng hệ số 4px/8px: `space-1 (4px)`, `space-2 (8px)`, `space-3 (12px)`, `space-4 (16px)`, `space-6 (24px)`.
- **Font Scale:**
  - H1: `24px` / line-height `32px` / font-weight `700`
  - H2: `20px` / line-height `28px` / font-weight `600`
  - Body: `14px` / line-height `20px` (tối ưu tiếng Việt) / font-weight `400`
  - Caption: `12px` / line-height `16px` / font-weight `400`

## 4. Hệ Thống Phân Tầng Độ Nổi (Z-Index Hierarchy)
- `z-base: 0` (Nội dung thông thường)
- `z-sticky: 10` (Header / Toolbar cố định)
- `z-floating: 30` (Floating action bar, widget nổi)
- `z-dropdown: 50` (Menu xổ xuống, Select popover)
- `z-modal: 100` (Hộp thoại xác nhận, Drawer)
- `z-toast: 200` (Thông báo nổi góc màn hình)

## 5. Iconography
- Một bộ icon duy nhất cho toàn dự án (ghi tên thư viện sau khi chốt, ví dụ `lucide-react`). Kích thước chuẩn: `16x16px` cho inline text, `20x20px` cho button icon. Luôn kèm `aria-label` hoặc tooltip.
