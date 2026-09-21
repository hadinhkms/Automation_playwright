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
- `[ARCH-003]` **Feature Modularity (Vertical Slice):** Tổ chức mã nguồn theo tính năng độc lập tại `features/<name>/` gồm components, hooks, services, types để dễ dàng mở rộng.
- `[ARCH-004]` **File Size Budget:** Theo policy Hub: component/hook/utils ≤150, service ≤200, module ≤250 dòng. Phân rã theo trách nhiệm phù hợp stack; số dòng không chứng minh hiệu năng.

