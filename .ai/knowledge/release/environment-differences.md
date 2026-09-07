# Environment Differences & Configuration Matrix

> [!NOTE]
> Bảng tổng hợp các khác biệt về môi trường (Local, Staging, Production).

| Thành phần | Local Development | Staging / QA | Production |
|---|---|---|---|
| Base API URL | `http://localhost:8000` | `https://staging-api.example.com` | `https://api.example.com` |
| Mock Service | Bật (Mock API nếu cần) | Tắt | Tắt |
| Log Level | `debug` | `info` | `warn` / `error` |
| SSL / CORS | Tắt / Loose | Bật (Staging domain) | Bật (Strict CORS) |
