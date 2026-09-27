# Coding Conventions & Project Standards

> [!NOTE]
> Các quy tắc viết code đã được duyệt (Approved Standards) trong dự án.
> Giúp mã nguồn nhất quán, sạch sẽ và tránh technical debt.

## 1. Naming Conventions
- File names: `kebab-case` cho modules/services; `PascalCase` cho React Components.
- Biến và hàm: `camelCase`.
- Constants / Enums: `UPPER_SNAKE_CASE` hoặc `PascalCase` cho enum types.

## 2. Code Organization & Patterns
- Khuyến khích Pure Functions cho logic tính toán.
- Tránh mutate trực tiếp state; dùng immutable patterns.
- Export tường minh, hạn chế `export default` tùy tiện cho các shared modules.

## 3. Approved vs Legacy Patterns
| Pattern Loại bỏ (Legacy) | Pattern Thay Thế (Approved Standard) | Lý do |
|---|---|---|
| Direct API call inside Component | Custom Hook + Service layer | Tái sử dụng & dễ test |
| Inline hardcoded colors | Design Tokens / CSS Variables | Đồng bộ theme & dark mode |
| Monolithic God Component (>250 lines) | Feature Sub-components (<150 lines) + Hooks | Giảm trách nhiệm trộn lẫn; hiệu năng cần đo |
| Trộn lẫn State, API và UI vào 1 file | Isolated Hooks + Pure Presentational UI | Tối ưu memoization & bảo trì độc lập |
| Icon cạnh text không có `flex-shrink: 0` | Luôn thêm `flex-shrink: 0` cho icon/avatar/badge | Chống méo mó icon khi text dài hoặc co màn hình |
| Text động không giới hạn độ dài | `truncate`, `line-clamp-N` hoặc `break-words` + `min-w-0` | Chống vỡ layout, table blowout và tràn chữ |
| Nút bấm spinner đè lên text khi loading | Nút giữ `min-width` hoặc vị trí spinner riêng với gap | Chống Layout Shift và chữ đè spinner khi loading |

