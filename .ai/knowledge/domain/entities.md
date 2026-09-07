# Domain Entities & Relationships

> [!NOTE]
> Danh sách các thực thể chính, trường dữ liệu cốt lõi và mối quan hệ giữa chúng trong hệ thống.

## Danh Sách Thực Thể (Core Entities)

### 1. [EntityName]
- **Mô tả:** Mô tả mục đích của thực thể
- **Các trường chính (Core Attributes):**
  - `id`: Unique identifier
  - `status`: Trạng thái thực thể
  - `created_at` / `updated_at`
- **Quan hệ (Relationships):**
  - 1 - N với [OtherEntity]
