# Domain Invariants

> [!IMPORTANT]
> Đây là các nguyên tắc bất biến (Invariants) của nghiệp vụ dự án này.
> Mọi thay đổi code hoặc logic đều phải tuân thủ nghiêm ngặt các quy tắc này.

## Quy Tắc Bất Biến Cốt Lõi
- `[INVAR-001]` (Cập nhật trong quá trình Bootstrap hoặc khi BA phân tích tính năng cốt lõi)

---

## Trạng Thái & Vòng Đời Thực Thể (State Machines)
- Entity: `DRAFT` -> `ACTIVE` -> `ARCHIVED`
