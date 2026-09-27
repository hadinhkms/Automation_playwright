# Domain Invariants

> [!IMPORTANT]
> Đây là các nguyên tắc bất biến (Invariants) của nghiệp vụ dự án này.
> Mọi thay đổi code hoặc logic đều phải tuân thủ nghiêm ngặt các quy tắc này.

## Quy Tắc Bất Biến Cốt Lõi
- `[INVAR-001]` (Cập nhật trong quá trình Bootstrap hoặc khi BA phân tích tính năng cốt lõi)
- `[INVAR-SCOPE-001]` Phân tách Feature Permission vs Data Scope: Người dùng nhánh con chỉ truy cập dữ liệu thuộc nhánh con của mình (`tenant_id`/`branch_id`). Nhánh chính mới có quyền tổng hợp (Aggregated/Global).
- `[INVAR-SYNC-001]` Đồng bộ nhánh con: Nhánh con nhận trạng thái cập nhật (Sync Status) từ nhánh chính, không sở hữu luồng điều phối danh sách các nhánh khác.

---

## Trạng Thái & Vòng Đời Thực Thể (State Machines)
- Entity: `DRAFT` -> `ACTIVE` -> `ARCHIVED`
- Branch Sync State: `UP_TO_DATE` -> `UPDATE_AVAILABLE` -> `SYNCING` -> (`UP_TO_DATE` | `SYNC_FAILED`)
