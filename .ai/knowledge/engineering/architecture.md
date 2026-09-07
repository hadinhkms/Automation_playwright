# Architecture Map & Technical Decisions

> [!IMPORTANT]
> Sơ đồ phân lớp kiến trúc và các quyết định kỹ thuật cốt lõi (ADR) áp dụng cho dự án này.

## 1. Phân Tầng Kiến Trúc (Layering Strategy)
- **Presentation Layer:** Các thành phần UI, hooks giao diện, form handling.
- **Service / Application Layer:** Orchestrate business use-cases, gọi repository hoặc client.
- **Data / Infrastructure Layer:** Gọi REST/GraphQL API, database client, caching.

## 2. Các Quyết Định Kiến Trúc Cốt Lõi (Architecture Decisions)
- `[ARCH-001]` **UI Independence:** UI components không được gọi trực tiếp HTTP/Fetch; phải thông qua Service/API client layer.
- `[ARCH-002]` **Error Handling Standard:** Toàn bộ API response lỗi phải được chuẩn hoá qua Error Boundary hoặc Interceptor thống nhất.
