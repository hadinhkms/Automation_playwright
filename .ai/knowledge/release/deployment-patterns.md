# Deployment Patterns & Rollback Playbooks

> [!NOTE]
> Quy trình triển khai, biến môi trường cần thiết và kịch bản phục hồi sự cố (Rollback) cho dự án.

## 1. Quy Trình Build & Triển Khai (Deployment Pipeline)
- Build command: `npm run build`
- Artifacts sinh ra: `dist/` hoặc `.next/`
- Containerization: `Dockerfile` (nếu có)

## 2. Kịch Bản Rollback Sự Cố (Rollback Playbook)
1. Xác định commit hash hoặc docker tag của bản release ổn định gần nhất.
2. Thực hiện rollback trigger trên pipeline hoặc redeploy artifact cũ.
3. Kiểm tra database migration: Nếu có migration không backward-compatible, thực hiện migration down script trước.
