# Technical Spike Report: SPIKE-01 (Gate 1 Evidence)

> **Mã thử nghiệm:** SPIKE-01 — ESM Feature Slice & Legacy Coexistence  
> **Ngày thực hiện:** 2026-09-10  
> **Môi trường:** Isolated Ephemeral Port Harness (`playwright.dashboard.config.js`), Chromium  
> **Trạng thái:** **PASSED (100% 4/4 Tests Pass)**

---

## 1. Mục Tiêu Kỹ Thuật Của Spike
Chứng minh tính khả thi trên trình duyệt thực tế của 3 cơ chế kiến trúc trọng yếu trước khi bước vào bóc tách mã nguồn:
1. **WindowBridge Pattern:** Xác nhận việc export action từ mô-đun ESM và gắn an toàn vào `window` cho phép các nút bấm HTML inline (`onclick="..."`) gọi bình thường mà không gây lỗi `Uncaught ReferenceError`.
2. **EventBus Decoupling:** Xác nhận Event Envelope `{ type, version, entityId, revision, source }` cho phép Data Slice (ESM mới) giao tiếp với BDD Studio (Legacy) mà không cần can thiệp trực tiếp vào biến toàn cục của nhau.
3. **Single Ownership & Mutation Guard:** Xác nhận cơ chế cờ khóa `isMutating` ngăn chặn hoàn toàn việc click nhanh (double-click) sinh ra 2 mutation đồng thời.

---

## 2. Kết Quả Kiểm Thử Thực Tế

Lệnh thực thi:
```powershell
npx playwright test --config=playwright.dashboard.config.js --project="Dashboard Chromium"
```

Output thực tế:
```text
Running 4 tests using 1 worker

  ok 1 [Dashboard Chromium] › tests\dashboard\smoke.spec.js:20:3 › Dashboard Studio Baseline Smoke Test › TC-SMOKE-01: Dashboard boots on isolated port and renders Shell container (1.6s)
  ok 2 [Dashboard Chromium] › tests\dashboard\spike-esm-coexistence.spec.js:27:3 › SPIKE-01: ESM Feature Slice & Legacy Coexistence › SPIKE-01-A: WindowBridge pattern exposes ESM action to global window without ReferenceError (1.2s)
  ok 3 [Dashboard Chromium] › tests\dashboard\spike-esm-coexistence.spec.js:58:3 › SPIKE-01: ESM Feature Slice & Legacy Coexistence › SPIKE-01-B: EventBus enables cross-slice event emission without direct global state mutation (1.4s)
  ok 4 [Dashboard Chromium] › tests\dashboard\spike-esm-coexistence.spec.js:95:3 › SPIKE-01: ESM Feature Slice & Legacy Coexistence › SPIKE-01-C: Single Ownership & Mutation Guard: one action triggers exactly one mutation (1.3s)

  4 passed (8.1s)
```

---

## 3. Kết Luận & Khuyến Nghị Nghiệm Thu Gate 1

- **Kết luận:** Mô hình kết hợp giữa **WindowBridge**, **EventBus chuẩn hóa** và **Strangler Fig Pattern** hoạt động hoàn hảo trên môi trường thực tế của Dashboard.
- **Rào chắn rủi ro đã được hóa giải:**
  - Không có xung đột giữa mã CommonJS backend và ESM frontend.
  - Không phát sinh lỗi console `ReferenceError`.
  - Không có rò rỉ dữ liệu hay nhân đôi mutation.
- **Quyết định:** ĐỦ ĐIỀU KIỆN ĐÓNG **GATE 1: TECHNICAL SPIKE PASSED**. Sẵn sàng tiến hành **Phase 1: Bóc tách Backend Router (`dashboard/routes/`)**.
