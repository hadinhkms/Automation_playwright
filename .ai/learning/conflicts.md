# Knowledge Conflicts Log

> [!WARNING]
> Nhật ký ghi nhận các mâu thuẫn được phát hiện giữa:
> 1. Tri thức đã lưu trữ vs Hiện trạng code trong repository.
> 2. Đề xuất mới vs Quy chuẩn cũ đã được duyệt.
> Mọi conflict đều phải được Owner tương ứng phân xử.

| ID Conflict | Nguồn A (Hiện tại) | Nguồn B (Đề xuất / Code mới) | Mức độ ảnh hưởng | Owner phụ trách | Hướng xử lý |
|---|---|---|---|---|---|
| CONF-001 | (Ví dụ: Code cũ dùng Fetch) | (Ví dụ: Rule mới cấm Fetch) | Medium | Tech Lead | Refactor code cũ theo rule mới |
